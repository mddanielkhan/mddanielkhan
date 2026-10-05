import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditIp, emailTokens, sessions, users } from "@/lib/db/schema";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { purgeExpiredRateLimits } from "@/lib/security/rate-limit";
import { purgeOldJobs } from "./queue";
import { recomputeTopHelpers, recomputeTrustLevel } from "@/lib/trust/reputation";
import { verifyAuditChain, audit } from "@/lib/audit/audit";
import { runBookingMaintenance } from "@/lib/booking/service";
import { notify } from "@/lib/notify/notifications";

/**
 * Scheduled maintenance. Retention limits are enforced by code, not by policy
 * documents alone: a purge that silently stops running is a compliance incident,
 * so every run is logged and failures alert.
 */

export const RETENTION = {
  ipHashDays: 90,
  usedTokenDays: 7,
} as const;

export async function purgeRetention() {
  await purgeExpiredSessions();
  await purgeExpiredRateLimits();
  await purgeOldJobs();
  await db().delete(auditIp).where(lt(auditIp.createdAt, sql`now() - make_interval(days => ${RETENTION.ipHashDays})`));
  await db()
    .update(sessions)
    .set({ ipHash: null })
    .where(and(sql`${sessions.ipHash} is not null`, lt(sessions.createdAt, sql`now() - make_interval(days => ${RETENTION.ipHashDays})`)));
  await db().delete(emailTokens).where(or(lt(emailTokens.expiresAt, sql`now() - make_interval(days => ${RETENTION.usedTokenDays})`), lt(emailTokens.usedAt, sql`now() - make_interval(days => ${RETENTION.usedTokenDays})`)));
}

export async function recomputeAllTrustLevels() {
  const active = await db()
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.status, ["active", "suspended"]), or(gt(users.createdAt, sql`now() - interval '400 days'`), sql`${users.lastVisitedOn} > now() - interval '180 days'`)));
  for (const u of active) await recomputeTrustLevel(u.id);
  return active.length;
}

export async function verifyChainAndAlert() {
  const result = await verifyAuditChain();
  if (!result.ok) {
    console.error(JSON.stringify({ level: "error", msg: "AUDIT CHAIN BROKEN", ...result }));
    const admins = await db().select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active")));
    for (const a of admins) await notify(a.id, { kind: "security", title: "SECURITY: audit log integrity check failed — follow the incident runbook", link: "/mod/audit", email: true });
  } else {
    await audit({ action: "system.audit_chain_verified", meta: { checked: result.checked } });
  }
  return result;
}

export const SCHEDULE: Array<{ name: string; everyMs: number; run: () => Promise<unknown> }> = [
  { name: "booking-maintenance", everyMs: 5 * 60_000, run: () => runBookingMaintenance() },
  { name: "retention-purge", everyMs: 60 * 60_000, run: purgeRetention },
  { name: "trust-recompute", everyMs: 24 * 3600_000, run: recomputeAllTrustLevels },
  { name: "top-helpers", everyMs: 24 * 3600_000, run: recomputeTopHelpers },
  { name: "audit-chain-verify", everyMs: 24 * 3600_000, run: verifyChainAndAlert },
];
