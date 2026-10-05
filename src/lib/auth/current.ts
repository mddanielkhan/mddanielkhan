import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { resolveSession } from "@/lib/auth/session";
import { sessionCookieName } from "@/lib/auth/session";
import { authorize, type Action, type Actor, type PolicyContext } from "@/lib/policy/policy";
import { CSRF_SEED_HEADER, csrfTokenForSeed } from "@/lib/security/csrf";

/** The current actor for this request (memoised per request). Pending-MFA sessions count as logged out. */
export const getActor = cache(async (): Promise<Actor> => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  const resolved = await resolveSession(token);
  if (!resolved || resolved.session.mfaState === "pending") return null;
  return resolved;
});

/** Raw session including pending-MFA state (only for the 2FA login step). */
export const getRawSession = cache(async () => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  return resolveSession(token);
});

export async function requireActor(nextPath?: string): Promise<NonNullable<Actor>> {
  const actor = await getActor();
  if (!actor) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return actor;
}

/** Server-component authorization gate: redirects with a reason instead of rendering. */
export async function requirePermission(action: Action, nextPath: string, ctx: PolicyContext = {}) {
  const actor = await requireActor(nextPath);
  const d = authorize(actor, action, ctx);
  if (!d.ok) {
    if (d.reason === "mfa_required") redirect("/settings/security?e=mfa_required");
    if (d.reason === "email_unverified") redirect("/verify-email?e=email_unverified");
    redirect(`/?e=${d.reason}`);
  }
  return actor;
}

export async function csrfToken(): Promise<string> {
  const seed = (await headers()).get(CSRF_SEED_HEADER) ?? "";
  return seed ? csrfTokenForSeed(seed) : "";
}

export async function cspNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
