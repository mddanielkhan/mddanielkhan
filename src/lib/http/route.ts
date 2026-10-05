import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { resolveSession, sessionCookieName } from "@/lib/auth/session";
import { authorize, DENY_MESSAGES, type Action, type Actor, type PolicyContext } from "@/lib/policy/policy";
import { consume, POLICIES, type RatePolicy } from "@/lib/security/rate-limit";
import { CSRF_FIELD, csrfCookieName, verifyCsrfToken, verifySameOrigin } from "@/lib/security/csrf";
import { clientIp } from "@/lib/security/ip";
import { hashIp } from "@/lib/security/crypto";
import { env } from "@/lib/env";
import { AppError } from "./errors";
import { processDueJobs } from "@/lib/jobs/queue";
import "@/lib/jobs/handlers";
import { safeBackPath, withParam } from "./urls";

/**
 * The single request pipeline every mutating route goes through:
 *
 *   size cap → same-origin → CSRF → IP flood limit → session → authorization
 *   → route rate limits → Zod validation → handler → (errors → safe response)
 *
 * tests/unit/route-coverage.test.ts fails the build if any route.ts exports a
 * handler that does not come from defineRoute(). "We hope every route is
 * protected" becomes "the build fails if one isn't".
 */

const MAX_BODY_BYTES = 256 * 1024;

export type RouteContext<TInput> = {
  req: NextRequest;
  actor: Actor;
  input: TInput;
  ip: string | null;
  ipHash: string | null;
  userAgent: string | null;
  params: Record<string, string>;
  requestId: string;
};

export type CookieSpec = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

export type RouteResult =
  | { redirect: string; notice?: string; cookies?: CookieSpec[]; clearCookies?: string[] }
  | { json: unknown; status?: number; cookies?: CookieSpec[]; clearCookies?: string[] }
  | { body: string; contentType: string; headers?: Record<string, string> };

type Auth =
  | { kind: "public" }
  | { kind: "authenticated" }
  | { kind: "policy"; action: Action; context?: (actor: NonNullable<Actor>) => Promise<PolicyContext> | PolicyContext };

/** `ip` here is the keyed HMAC of the client IP (never the raw address). */
type RateSpec = (c: { actor: Actor; ip: string | null; input: unknown }) => Array<[RatePolicy, string | null | undefined]>;

export type RouteDefinition<S extends z.ZodType> = {
  method?: "POST" | "GET";
  auth: Auth;
  schema: S;
  rate?: RateSpec;
  /** GET routes skip CSRF/origin checks (they must be side-effect free). */
  handler: (ctx: RouteContext<z.infer<S>>) => Promise<RouteResult>;
};

export const ROUTE_MARK = Symbol.for("shikor.defineRoute");

export function defineRoute<S extends z.ZodType>(def: RouteDefinition<S>) {
  const method = def.method ?? "POST";
  const handler = async (req: NextRequest, segment: { params: Promise<Record<string, string | string[]>> }) => {
    const requestId = randomUUID();
    const wantsJson = (req.headers.get("accept") ?? "").includes("application/json") || (req.headers.get("content-type") ?? "").includes("application/json");
    let back = "/";
    try {
      const params = Object.fromEntries(
        Object.entries((await segment?.params) ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.join("/") : v]),
      );
      const ip = clientIp(req.headers);
      const ipHash = hashIp(ip);
      const userAgent = req.headers.get("user-agent");

      let raw: Record<string, unknown> = {};
      if (method === "POST") {
        const len = Number(req.headers.get("content-length") ?? "0");
        if (len > MAX_BODY_BYTES) throw new AppError("payload_too_large", 413);
        const text = await req.text();
        if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new AppError("payload_too_large", 413);
        raw = parseBody(text, req.headers.get("content-type") ?? "");
        back = safeBackPath(typeof raw._back === "string" ? raw._back : req.headers.get("referer"));

        if (!verifySameOrigin(req.headers)) throw new AppError("cross_site_request", 403);
        const seed = req.cookies.get(csrfCookieName())?.value;
        const token = (typeof raw[CSRF_FIELD] === "string" ? (raw[CSRF_FIELD] as string) : null) ?? req.headers.get("x-csrf-token");
        if (!verifyCsrfToken(seed, token)) throw new AppError("csrf_failed", 403);

        // Rate-limit keys use the keyed IP hash: raw IPs are never persisted, not even for a minute.
        const flood = await consume(POLICIES.mutationIp, ipHash ?? "unknown-ip");
        if (!flood.ok) throw new AppError("rate_limited", 429);
      } else {
        raw = Object.fromEntries(req.nextUrl.searchParams.entries());
      }

      const actor = await resolveSession(req.cookies.get(sessionCookieName())?.value);

      if (def.auth.kind === "authenticated" && !actor) throw new AppError("login_required", 401);
      if (def.auth.kind === "authenticated" && actor?.session.mfaState === "pending") throw new AppError("mfa_required", 401);
      if (def.auth.kind === "policy") {
        const ctx = actor && def.auth.context ? await def.auth.context(actor) : {};
        const decision = authorize(actor, def.auth.action, ctx);
        if (!decision.ok) throw new AppError(decision.reason, decision.reason === "login_required" ? 401 : 403);
      }

      const parsed = def.schema.safeParse({ ...raw, ...params });
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new AppError(`invalid_${String(first?.path[0] ?? "input")}`, 400, first?.message);
      }

      for (const [policy, subject] of def.rate?.({ actor, ip: ipHash, input: parsed.data }) ?? []) {
        if (!subject) continue;
        const r = await consume(policy, subject);
        if (!r.ok) throw new AppError("rate_limited", 429);
      }

      const result = await def.handler({ req, actor, input: parsed.data, ip, ipHash, userAgent, params, requestId });
      // Dev/test only: drain jobs enqueued inside committed transactions (production runs the worker).
      if (env().JOBS_INLINE && method === "POST") await processDueJobs(50).catch((e) => console.error("inline jobs failed", e));
      return toResponse(result, req, wantsJson);
    } catch (err) {
      return errorResponse(err, req, back, wantsJson, requestId);
    }
  };
  (handler as unknown as Record<symbol, boolean>)[ROUTE_MARK] = true;
  return handler;
}

function parseBody(text: string, contentType: string): Record<string, unknown> {
  if (!text) return {};
  if (contentType.includes("application/json")) {
    try {
      const v = JSON.parse(text);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    } catch {
      throw new AppError("invalid_json", 400);
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType === "") {
    const params = new URLSearchParams(text);
    const out: Record<string, unknown> = {};
    for (const key of new Set(params.keys())) {
      const all = params.getAll(key);
      // Fields named foo[] are arrays; everything else is the last value.
      if (key.endsWith("[]")) out[key.slice(0, -2)] = all;
      else out[key] = all[all.length - 1];
    }
    return out;
  }
  throw new AppError("unsupported_media_type", 415);
}

function applyCookies(res: NextResponse, result: { cookies?: CookieSpec[]; clearCookies?: string[] }) {
  for (const c of result.cookies ?? []) res.cookies.set(c.name, c.value, c.options);
  for (const name of result.clearCookies ?? []) res.cookies.set(name, "", { path: "/", maxAge: 0 });
}

function toResponse(result: RouteResult, req: NextRequest, wantsJson: boolean): Response {
  if ("body" in result) {
    return new Response(result.body, { status: 200, headers: { "content-type": result.contentType, ...(result.headers ?? {}) } });
  }
  if ("json" in result) {
    const res = NextResponse.json(result.json, { status: result.status ?? 200 });
    applyCookies(res, result);
    return res;
  }
  const location = result.notice ? withParam(result.redirect, "n", result.notice) : result.redirect;
  const res = wantsJson ? NextResponse.json({ ok: true, redirect: location }) : NextResponse.redirect(new URL(location, env().APP_URL), 303);
  applyCookies(res, result);
  return res;
}

function errorResponse(err: unknown, req: NextRequest, back: string, wantsJson: boolean, requestId: string): Response {
  const known = err instanceof AppError;
  const code = known ? err.code : "server_error";
  const status = known ? err.status : 500;
  if (!known) {
    console.error(
      JSON.stringify({ level: "error", msg: "unhandled route error", requestId, path: req.nextUrl.pathname, err: err instanceof Error ? err.message : String(err) }),
    );
  }
  if (wantsJson) {
    const message = known ? (DENY_MESSAGES as Record<string, string>)[code] ?? err.message : "Something went wrong.";
    return NextResponse.json({ ok: false, error: code, message, requestId }, { status });
  }
  if (code === "login_required") {
    return NextResponse.redirect(new URL(withParam("/login", "next", back), env().APP_URL), 303);
  }
  if (code === "mfa_required" && req.nextUrl.pathname !== "/api/auth/2fa") {
    return NextResponse.redirect(new URL(withParam("/settings/security", "e", "mfa_required"), env().APP_URL), 303);
  }
  const target = withParam(withParam(back, "e", code), "ref", known ? null : requestId.slice(0, 8));
  return NextResponse.redirect(new URL(target, env().APP_URL), 303);
}
