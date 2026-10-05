import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/security/headers";
import { CSRF_SEED_HEADER, csrfCookieName } from "@/lib/security/csrf";
import { secureCookiesEnabled } from "@/lib/env";

/**
 * Proxy (formerly "middleware"): per-request CSP nonce + CSRF seed cookie.
 *
 * DELIBERATELY NOT AN AUTH GATE. Next.js shipped several 2025–2026 advisories
 * for middleware/proxy authorization bypasses. Every page and route handler
 * performs its own server-side authorization; this file only adds headers.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp(nonce, isDev, (process.env.APP_URL ?? "").startsWith("https://"));

  const cookieName = csrfCookieName();
  const existingSeed = request.cookies.get(cookieName)?.value;
  const seed = existingSeed && /^[A-Za-z0-9_-]{20,100}$/.test(existingSeed) ? existingSeed : randomSeed();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  // Always overwrite — a client-supplied value must never be trusted.
  requestHeaders.set(CSRF_SEED_HEADER, seed);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (seed !== existingSeed) {
    response.cookies.set(cookieName, seed, {
      httpOnly: true,
      secure: secureCookiesEnabled(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

function randomSeed() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|manifest.webmanifest|\\.well-known).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
