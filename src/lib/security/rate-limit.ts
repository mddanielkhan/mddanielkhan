import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/**
 * Postgres-backed fixed-window rate limiter.
 *
 * Why Postgres and not in-memory: an in-memory limiter silently stops working
 * the moment you run two app instances or restart (a hidden flaw in many
 * starters). Why not Redis in Phase 1: one fewer moving part to secure, back up
 * and monitor; a single atomic UPSERT is plenty fast at this scale. The
 * interface is store-agnostic so Redis can replace it with zero call-site changes.
 */

export type RatePolicy = { name: string; limit: number; windowSec: number };

export const POLICIES = {
  // Authentication — dual keyed: generous per IP (campus NAT: a whole hall shares one IP),
  // strict per account/email (credential-stuffing brake).
  loginIp: { name: "login-ip", limit: 40, windowSec: 900 },
  loginAccount: { name: "login-acct", limit: 8, windowSec: 900 },
  registerIp: { name: "register-ip", limit: 10, windowSec: 3600 },
  forgotIp: { name: "forgot-ip", limit: 10, windowSec: 3600 },
  forgotEmail: { name: "forgot-email", limit: 3, windowSec: 3600 },
  resendVerification: { name: "resend-verify", limit: 5, windowSec: 3600 },
  totpVerify: { name: "totp", limit: 8, windowSec: 900 },
  reauth: { name: "reauth", limit: 8, windowSec: 900 },
  // Global flood ceiling for any mutation, per IP.
  mutationIp: { name: "mutation-ip", limit: 300, windowSec: 300 },
  // Content & community (per user)
  postBurst: { name: "post-burst", limit: 4, windowSec: 600 },
  answerBurst: { name: "answer-burst", limit: 10, windowSec: 600 },
  vote: { name: "vote", limit: 120, windowSec: 3600 },
  report: { name: "report", limit: 20, windowSec: 86400 },
  publicReportIp: { name: "public-report-ip", limit: 5, windowSec: 3600 },
  bookingRequest: { name: "booking-req", limit: 5, windowSec: 86400 },
  bookingMessage: { name: "booking-msg", limit: 30, windowSec: 3600 },
  mentorApply: { name: "mentor-apply", limit: 3, windowSec: 86400 },
  institutionEmail: { name: "inst-email", limit: 5, windowSec: 86400 },
  profileUpdate: { name: "profile", limit: 30, windowSec: 3600 },
  export: { name: "export", limit: 5, windowSec: 86400 },
  appeal: { name: "appeal", limit: 10, windowSec: 86400 },
} satisfies Record<string, RatePolicy>;

/** Daily caps on posting, scaled by trust level (TL0 … TL4). */
export function dailyPostCap(trustLevel: number) {
  return [3, 8, 15, 30, 50][trustLevel] ?? 3;
}
export function dailyAnswerCap(trustLevel: number) {
  return [10, 25, 50, 100, 150][trustLevel] ?? 10;
}

export type RateResult = { ok: boolean; remaining: number; retryAfterSec: number };

export async function consume(policy: RatePolicy, subject: string, cost = 1): Promise<RateResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStartSec = nowSec - (nowSec % policy.windowSec);
  const windowStart = new Date(windowStartSec * 1000);
  const expiresAt = new Date((windowStartSec + policy.windowSec) * 1000);
  const key = `${policy.name}:${subject}`;
  const rows = await db().execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count, expires_at)
    values (${key}, ${windowStart}, ${cost}, ${expiresAt})
    on conflict (key, window_start) do update set count = rate_limits.count + ${cost}
    returning count
  `);
  const count = Number(rows.rows[0]?.count ?? cost);
  return {
    ok: count <= policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterSec: windowStartSec + policy.windowSec - nowSec,
  };
}

/** Count without consuming (e.g. to decide whether to show a challenge). */
export async function peek(policy: RatePolicy, subject: string): Promise<number> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = new Date((nowSec - (nowSec % policy.windowSec)) * 1000);
  const rows = await db().execute<{ count: number }>(
    sql`select count from rate_limits where key = ${`${policy.name}:${subject}`} and window_start = ${windowStart}`,
  );
  return Number(rows.rows[0]?.count ?? 0);
}

export async function purgeExpiredRateLimits() {
  await db().execute(sql`delete from rate_limits where expires_at < now()`);
}
