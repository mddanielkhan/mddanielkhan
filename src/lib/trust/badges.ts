import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db/client";
import { badges } from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";

/**
 * Badges are FACTS with provenance (type, scope, method, date, expiry), never
 * ranks and never purchasable. Each has a public credential page at /v/{id}.
 */

export type BadgeKind = (typeof badges.$inferSelect)["kind"];

export const BADGE_INFO: Record<BadgeKind, { title: string; icon: string; meaning: string; verified: boolean }> = {
  institution_email: { title: "Verified institution email", icon: "🎓", meaning: "Controls a mailbox at a university/college domain (we verified mailbox access, not the person's degree).", verified: true },
  professional_verified: { title: "Verified professional", icon: "💼", meaning: "A moderator reviewed evidence of this person's stated role or qualification.", verified: true },
  expert_verified: { title: "Verified mentor", icon: "🛡️", meaning: "Approved as a mentor in this topic after a manual credential review. Revocable.", verified: true },
  founding_mentor: { title: "Founding mentor", icon: "🌱", meaning: "One of the first mentors who helped build this community.", verified: false },
  moderator: { title: "Community moderator", icon: "⚖️", meaning: "Currently serves on the moderation team.", verified: false },
  sessions_10: { title: "10 sessions", icon: "🤝", meaning: "Completed 10 confirmed mentoring sessions.", verified: false },
  sessions_50: { title: "50 sessions", icon: "🤝", meaning: "Completed 50 confirmed mentoring sessions.", verified: false },
  sessions_100: { title: "100 sessions", icon: "🏅", meaning: "Completed 100 confirmed mentoring sessions.", verified: false },
  top_helper: { title: "Top helper", icon: "⭐", meaning: "Among the most helpful contributors in this topic over the last 180 days (recomputed weekly).", verified: false },
  opportunity_scout: { title: "Opportunity scout", icon: "🧭", meaning: "Shared 5 or more opportunities that moderators verified against official sources.", verified: false },
};

export async function grantBadge(
  b: { userId: string; kind: BadgeKind; label: string; method: string; topicId?: number | null; expiresAt?: Date | null; grantedBy?: string | null },
  tx: DbOrTx = db(),
) {
  const inserted = await tx
    .insert(badges)
    .values({ userId: b.userId, kind: b.kind, label: b.label, method: b.method, topicId: b.topicId ?? null, expiresAt: b.expiresAt ?? null, grantedBy: b.grantedBy ?? null })
    .onConflictDoNothing()
    .returning({ id: badges.id });
  if (inserted[0]) {
    await audit({ action: "badge.granted", actorId: b.grantedBy ?? null, targetType: "user", targetId: b.userId, meta: { kind: b.kind, topicId: b.topicId ?? null, badgeId: inserted[0].id } }, tx);
  } else if (b.expiresAt) {
    // Re-verification extends an existing active badge.
    await tx
      .update(badges)
      .set({ expiresAt: b.expiresAt, label: b.label })
      .where(and(eq(badges.userId, b.userId), eq(badges.kind, b.kind), isNull(badges.revokedAt), sql`coalesce(${badges.topicId}, 0) = ${b.topicId ?? 0}`));
  }
  return inserted[0]?.id ?? null;
}

export async function revokeBadges(userId: string, kind: BadgeKind, reason: string, actorId: string | null, tx: DbOrTx = db(), topicId?: number) {
  const conditions = [eq(badges.userId, userId), eq(badges.kind, kind), isNull(badges.revokedAt)];
  if (topicId !== undefined) conditions.push(eq(badges.topicId, topicId));
  const revoked = await tx.update(badges).set({ revokedAt: new Date(), revokeReason: reason }).where(and(...conditions)).returning({ id: badges.id });
  if (revoked.length) await audit({ action: "badge.revoked", actorId, targetType: "user", targetId: userId, meta: { kind, reason, count: revoked.length } }, tx);
}

export function badgeState(b: { revokedAt: Date | null; expiresAt: Date | null }, now = new Date()): "active" | "expired" | "revoked" {
  if (b.revokedAt) return "revoked";
  if (b.expiresAt && b.expiresAt <= now) return "expired";
  return "active";
}
