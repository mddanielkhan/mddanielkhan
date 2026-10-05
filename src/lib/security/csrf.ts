import { hmacHex, safeEqual } from "@/lib/security/crypto";
import { env, secureCookiesEnabled } from "@/lib/env";

/**
 * CSRF defence in depth (OWASP CSRF Prevention Cheat Sheet):
 *  1. SameSite=Lax session cookie (baseline).
 *  2. Origin / Sec-Fetch-Site verification on every state-changing request.
 *  3. Signed double-submit token: the proxy sets a random seed in a __Host-
 *     cookie (cannot be set by subdomains or other sites); forms carry
 *     HMAC(seed). An attacker can neither read the cookie nor forge the HMAC.
 */

export const CSRF_FIELD = "_csrf";
export const CSRF_SEED_HEADER = "x-peerlink-csrf-seed";

export function csrfCookieName() {
  return secureCookiesEnabled() ? "__Host-peerlink_csrf" : "peerlink_csrf";
}

export function csrfTokenForSeed(seed: string): string {
  return hmacHex("csrf", seed);
}

export function verifyCsrfToken(seed: string | undefined, token: string | undefined | null): boolean {
  if (!seed || !token || seed.length < 20) return false;
  return safeEqual(csrfTokenForSeed(seed), token);
}

/** Reject cross-site requests. Requires an Origin header or Fetch-Metadata from a same-origin context. */
export function verifySameOrigin(headers: Headers): boolean {
  const expected = new URL(env().APP_URL).origin;
  const origin = headers.get("origin");
  if (origin) return origin === expected;
  const site = headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}
