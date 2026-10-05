import { hash, verify, type Algorithm } from "@node-rs/argon2";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Password policy & hashing.
 *
 * Policy follows NIST SP 800-63B-4 (2025): passwords used as a single factor
 * SHALL be at least 15 characters; no composition rules; no forced rotation;
 * block known-compromised and context-specific passwords; allow ≥ 64 chars
 * and all printable characters including spaces (passphrases).
 *
 * Hashing: Argon2id with OWASP's recommended minimum (m = 19 MiB, t = 2, p = 1).
 * A concurrency gate bounds memory use so a burst of logins cannot exhaust RAM
 * on a small VPS (a real DoS vector with higher memory costs).
 */

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

const ARGON2_PARAMS = {
  algorithm: 2 as Algorithm, // Argon2id (ambient const enum cannot be referenced under isolatedModules)
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

// A short list of the most common long-enough passwords/passphrases. The HIBP
// range check (optional) covers the long tail without sending the password.
const COMMON = new Set(
  [
    "123456789012345",
    "1234567890123456",
    "passwordpassword",
    "password1234567",
    "qwertyuiopasdfgh",
    "iloveyou1234567",
    "bangladesh12345",
    "bangladesh123456",
    "aaaaaaaaaaaaaaa",
    "abcdefghijklmnop",
    "letmeinletmein1",
    "welcome12345678",
    "peerlinkpeerlink",
    "correcthorsebatterystaple",
  ].map((s) => s.toLowerCase()),
);

export type PasswordIssue = "too_short" | "too_long" | "common" | "contains_personal_info" | "repetitive" | "breached";

export function checkPasswordPolicy(password: string, context: { email?: string; username?: string } = {}): PasswordIssue | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) return "too_short";
  if (length > PASSWORD_MAX_LENGTH) return "too_long";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "common";
  if (/^(.)\1+$/.test(password) || new Set(password).size < 4) return "repetitive";
  const personal = [context.username, context.email?.split("@")[0]].filter((s): s is string => !!s && s.length >= 4);
  if (personal.some((p) => lower.includes(p.toLowerCase()))) return "contains_personal_info";
  return null;
}

// ─── Concurrency gate ───────────────────────────────────────────────────────

const MAX_CONCURRENT_HASHES = 4;
let active = 0;
const waiters: Array<() => void> = [];

async function withHashSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_HASHES) await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

export async function hashPassword(password: string): Promise<string> {
  return withHashSlot(() => hash(password, ARGON2_PARAMS));
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (!storedHash.startsWith("$argon2")) return false;
  return withHashSlot(async () => {
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  });
}

/** A valid hash of a random value, used to equalise timing when the account does not exist. */
let dummyHash: string | undefined;
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= await hashPassword(`dummy-${Math.random()}-${Date.now()}`);
  await verifyPassword(dummyHash, password);
}

/** True if the stored hash uses weaker parameters than today's policy (rehash on next login). */
export function needsRehash(storedHash: string): boolean {
  const m = /\$m=(\d+),t=(\d+),p=(\d+)/.exec(storedHash);
  if (!m) return true;
  return Number(m[1]) < ARGON2_PARAMS.memoryCost || Number(m[2]) < ARGON2_PARAMS.timeCost;
}

/**
 * Have I Been Pwned k-anonymity range check: only the first 5 hex chars of the
 * SHA-1 leave the server. Fails OPEN (returns false) on network errors so an
 * outage of a third party can never lock users out — the event is logged.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  if (!env().HIBP_CHECK) return false;
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "peerlink-password-check" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    console.warn(JSON.stringify({ level: "warn", msg: "hibp check unavailable; failing open" }));
    return false;
  }
}
