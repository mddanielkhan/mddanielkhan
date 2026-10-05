import { sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import type { CookieSpec } from "./route";

export function sessionCookie(token: string, maxAgeSec: number): CookieSpec {
  return { name: sessionCookieName(), value: token, options: sessionCookieOptions(maxAgeSec) };
}

export const RECOVERY_CODES_COOKIE = "shikor_rc";
