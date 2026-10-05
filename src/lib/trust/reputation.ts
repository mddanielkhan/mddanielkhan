import { and, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db/client";
import { answers, badges, bookings, moderationActions, posts, reports, reputationEvents, strikes, topics, users } from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";
import { computeTrustLevel, type TrustInputs } from "./trust-level";
import { grantBadge, revokeBadges } from "./badges";

/**
 * Reputation = an append-only, idempotent, explainable ledger.
 * Every point a member has corresponds to one row they can see on their
 * profile ("why is my score X?"). Awards are idempotent per (kind, source), so
 * retries, double-clicks and job replays can never double-count.
 */

export const POINTS = {
  helpful_vote_post: 1,
  helpful_vote_answer: 2,
  answer_accepted: 10,
  session_completed: 5,
  opportunity_verified: 5,
  content_removed: -10,
  fraud_confirmed: -50,
} as const;

/** Votes can award at most this many points per member per day (anti-farming). */
export const DAILY_VOTE_POINT_CAP = 20;

export type ReputationKind = keyof typeof POINTS | "feedback" | "manual_adjustment" | "reversal";

export async function award(
  e: { userId: string; kind: ReputationKind; points: number; sourceType: string; sourceId: string; topicId?: number | null; note?: string; createdBy?: string | null },
  tx: DbOrTx = db(),
): Promise<boolean> {
  if (e.points === 0) return false;
  let points = e.points;
  if ((e.kind === "helpful_vote_post" || e.kind === "helpful_vote_answer") && points > 0) {
    const [today] = await tx
      .select({ total: sql<number>`coalesce(sum(${reputationEvents.points}), 0)::int` })
      .from(reputationEvents)
      .where(and(eq(reputationEvents.userId, e.userId), inArray(reputationEvents.kind, ["helpful_vote_post", "helpful_vote_answer"]), gte(reputationEvents.createdAt, sql`date_trunc('day', now())`)));
    const remaining = DAILY_VOTE_POINT_CAP - (today?.total ?? 0);
    if (remaining <= 0) return false;
    points = Math.min(points, remaining);
  }
  const inserted = await tx
    .insert(reputationEvents)
    .values({ userId: e.userId, kind: e.kind, points, sourceType: e.sourceType, sourceId: e.sourceId, topicId: e.topicId ?? null, note: e.note ?? null, createdBy: e.createdBy ?? null })
    .onConflictDoNothing()
    .returning({ id: reputationEvents.id });
  if (!inserted[0]) return false;
  await tx.update(users).set({ reputation: sql`${users.reputation} + ${points}` }).where(eq(users.id, e.userId));
  return true;
}

/** Undo an earlier award by appending an equal and opposite row (history is never rewritten). */
export async function reverse(userId: string, kind: ReputationKind, sourceType: string, sourceId: string, reason: string, tx: DbOrTx = db()) {
  const [orig] = await tx
    .select()
    .from(reputationEvents)
    .where(and(eq(reputationEvents.userId, userId), eq(reputationEvents.kind, kind), eq(reputationEvents.sourceType, sourceType), eq(reputationEvents.sourceId, sourceId)));
  if (!orig) return;
  await award({ userId, kind: "reversal", points: -orig.points, sourceType: `reversal:${kind}:${sourceType}`, sourceId, topicId: orig.topicId, note: reason }, tx);
}

export async function reputationByTopic(userId: string) {
  return db()
    .select({ topicId: reputationEvents.topicId, slug: topics.slug, name: topics.nameEn, points: sql<number>`sum(${reputationEvents.points})::int` })
    .from(reputationEvents)
    .leftJoin(topics, eq(topics.id, reputationEvents.topicId))
    .where(eq(reputationEvents.userId, userId))
    .groupBy(reputationEvents.topicId, topics.slug, topics.nameEn)
    .orderBy(sql`sum(${reputationEvents.points}) desc`);
}

export async function gatherTrustInputs(userId: string): Promise<TrustInputs | null> {
  const [u] = await db().select().from(users).where(eq(users.id, userId));
  if (!u || u.status === "deleted") return null;
  const now = Date.now();
  const since = (days: number) => new Date(now - days * 86400_000);
  const count = (q: Promise<Array<{ n: number }>>) => q.then((r) => r[0]?.n ?? 0);
  const [postsN, answersN, votesPost, votesAnswer, accepted, upheld, activeStrikes, strikes180, removed90] = await Promise.all([
    count(db().select({ n: sql<number>`count(*)::int` }).from(posts).where(and(eq(posts.authorId, userId), inArray(posts.status, ["published", "flagged"])))),
    count(db().select({ n: sql<number>`count(*)::int` }).from(answers).where(and(eq(answers.authorId, userId), inArray(answers.status, ["published", "flagged"])))),
    count(db().select({ n: sql<number>`coalesce(sum(${posts.helpfulCount}),0)::int` }).from(posts).where(eq(posts.authorId, userId))),
    count(db().select({ n: sql<number>`coalesce(sum(${answers.helpfulCount}),0)::int` }).from(answers).where(eq(answers.authorId, userId))),
    count(
      db()
        .select({ n: sql<number>`count(*)::int` })
        .from(posts)
        .innerJoin(answers, eq(answers.id, posts.acceptedAnswerId))
        .where(eq(answers.authorId, userId)),
    ),
    count(db().select({ n: sql<number>`count(*)::int` }).from(reports).where(and(eq(reports.reporterId, userId), eq(reports.status, "actioned")))),
    count(db().select({ n: sql<number>`count(*)::int` }).from(strikes).where(and(eq(strikes.userId, userId), isNull(strikes.revokedAt), gt(strikes.expiresAt, new Date())))),
    count(db().select({ n: sql<number>`count(*)::int` }).from(strikes).where(and(eq(strikes.userId, userId), isNull(strikes.revokedAt), gt(strikes.createdAt, since(180))))),
    count(
      db()
        .select({ n: sql<number>`count(*)::int` })
        .from(moderationActions)
        .where(and(eq(moderationActions.targetUserId, userId), eq(moderationActions.action, "remove_content"), isNull(moderationActions.reversedAt), gt(moderationActions.createdAt, since(90)))),
    ),
  ]);
  return {
    accountAgeDays: Math.floor((now - u.createdAt.getTime()) / 86400_000),
    emailVerified: !!u.emailVerifiedAt,
    daysVisited: u.daysVisited,
    publishedContributions: postsN + answersN,
    helpfulVotesReceived: votesPost + votesAnswer,
    acceptedAnswers: accepted,
    upheldReportsFiled: upheld,
    activeStrikes,
    strikesLast180Days: strikes180,
    removedContentLast90Days: removed90,
    appointedLeader: u.trustLevel === 4,
  };
}

/** Recompute and persist a member's trust level. Changes are audited. */
export async function recomputeTrustLevel(userId: string): Promise<number | null> {
  const inputs = await gatherTrustInputs(userId);
  if (!inputs) return null;
  const [u] = await db().select({ trustLevel: users.trustLevel }).from(users).where(eq(users.id, userId));
  const level = computeTrustLevel(inputs);
  if (u && u.trustLevel !== level) {
    await db().update(users).set({ trustLevel: level }).where(eq(users.id, userId));
    await audit({ action: "trust.level_changed", targetType: "user", targetId: userId, meta: { from: u.trustLevel, to: level } });
  }
  return level;
}

/** Milestone badges from confirmed sessions (computed from ground truth, never granted ad hoc). */
export async function refreshSessionBadges(mentorId: string, tx: DbOrTx = db()) {
  const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.mentorId, mentorId), eq(bookings.status, "completed")));
  const n = r?.n ?? 0;
  for (const [threshold, kind] of [
    [10, "sessions_10"],
    [50, "sessions_50"],
    [100, "sessions_100"],
  ] as const) {
    if (n >= threshold) await grantBadge({ userId: mentorId, kind, label: `${threshold} confirmed sessions`, method: "computed" }, tx);
  }
}

export async function refreshOpportunityScout(userId: string, tx: DbOrTx = db()) {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.type, "opportunity"), sql`${posts.verifiedAt} is not null`, inArray(posts.status, ["published", "flagged"])));
  if ((r?.n ?? 0) >= 5) await grantBadge({ userId, kind: "opportunity_scout", label: "5+ verified opportunities", method: "computed" }, tx);
}

/**
 * Weekly: top helpers per topic = top 5 % (at least the top 1, at most 10) by
 * 180-day topic reputation, minimum 30 points. Badges are revoked when lost.
 */
export async function recomputeTopHelpers() {
  const rows = await db().execute<{ user_id: string; topic_id: number; pts: number; rnk: number; total: number }>(sql`
    with scores as (
      select re.user_id, re.topic_id, sum(re.points)::int as pts
      from reputation_events re join users u on u.id = re.user_id
      where re.topic_id is not null and re.created_at > now() - interval '180 days' and u.status = 'active'
      group by re.user_id, re.topic_id
      having sum(re.points) >= 30
    )
    select user_id, topic_id, pts,
      row_number() over (partition by topic_id order by pts desc) as rnk,
      count(*) over (partition by topic_id) as total
    from scores
  `);
  const winners = new Set<string>();
  const topicNames = new Map((await db().select({ id: topics.id, name: topics.nameEn }).from(topics)).map((t) => [t.id, t.name]));
  for (const r of rows.rows) {
    const cutoff = Math.min(10, Math.max(1, Math.ceil(Number(r.total) * 0.05)));
    if (Number(r.rnk) <= cutoff) {
      winners.add(`${r.user_id}:${r.topic_id}`);
      await grantBadge({ userId: r.user_id, kind: "top_helper", topicId: r.topic_id, label: `Top helper · ${topicNames.get(r.topic_id) ?? "topic"}`, method: "computed" });
    }
  }
  const current = await db().select({ userId: badges.userId, topicId: badges.topicId }).from(badges).where(and(eq(badges.kind, "top_helper"), isNull(badges.revokedAt)));
  for (const b of current) {
    if (!winners.has(`${b.userId}:${b.topicId}`)) await revokeBadges(b.userId, "top_helper", "no_longer_top", null, db(), b.topicId ?? undefined);
  }
}
