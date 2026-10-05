import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { badges, bookings, posts, reputationEvents, users } from "@/lib/db/schema";
import { award, reverse, reputationByTopic, recomputeTopHelpers, refreshOpportunityScout, refreshSessionBadges, gatherTrustInputs, DAILY_VOTE_POINT_CAP } from "@/lib/trust/reputation";
import { badgeState, grantBadge, revokeBadges } from "@/lib/trust/badges";
import { makeMentor, makeUser, topicId } from "./helpers";

describe("reputation ledger", () => {
  it("is idempotent, capped for votes, reversible, and grouped by topic", async () => {
    const u = await makeUser();
    const t = await topicId();
    expect(await award({ userId: u.user.id, kind: "answer_accepted", points: 10, sourceType: "answer", sourceId: "a1", topicId: t })).toBe(true);
    expect(await award({ userId: u.user.id, kind: "answer_accepted", points: 10, sourceType: "answer", sourceId: "a1", topicId: t })).toBe(false);
    expect(await award({ userId: u.user.id, kind: "manual_adjustment", points: 0, sourceType: "x", sourceId: "y" })).toBe(false);
    for (let i = 0; i < 15; i++) await award({ userId: u.user.id, kind: "helpful_vote_answer", points: 2, sourceType: "vote", sourceId: `v${i}`, topicId: t });
    const votePoints = (await db().select().from(reputationEvents).where(and(eq(reputationEvents.userId, u.user.id), eq(reputationEvents.kind, "helpful_vote_answer")))).reduce((s, r) => s + r.points, 0);
    expect(votePoints).toBe(DAILY_VOTE_POINT_CAP);
    await reverse(u.user.id, "answer_accepted", "answer", "a1", "test");
    await reverse(u.user.id, "answer_accepted", "answer", "a1", "test"); // idempotent
    await reverse(u.user.id, "answer_accepted", "answer", "missing", "test"); // no-op
    const [row] = await db().select().from(users).where(eq(users.id, u.user.id));
    expect(row!.reputation).toBe(DAILY_VOTE_POINT_CAP);
    const byTopic = await reputationByTopic(u.user.id);
    expect(byTopic.find((x) => x.topicId === t)?.points).toBe(DAILY_VOTE_POINT_CAP);
    const inputs = await gatherTrustInputs(u.user.id);
    expect(inputs?.emailVerified).toBe(true);
    expect(await gatherTrustInputs("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("computed badges", () => {
  it("grants session milestones from confirmed sessions only", async () => {
    const { mentor, offeringId } = await makeMentor();
    const student = await makeUser();
    const base = { offeringId, mentorId: mentor.user.id, menteeId: student.user.id, subject: "s", message: "m", proposedTimes: [new Date()], durationMin: 30, requestExpiresAt: new Date() };
    await db().insert(bookings).values(Array.from({ length: 10 }, () => ({ ...base, status: "completed" as const })));
    await db().insert(bookings).values({ ...base, status: "requested" as const, mentorId: mentor.user.id, menteeId: (await makeUser()).user.id });
    await refreshSessionBadges(mentor.user.id);
    const b = await db().select().from(badges).where(and(eq(badges.userId, mentor.user.id), eq(badges.kind, "sessions_10")));
    expect(b).toHaveLength(1);
    const none = await db().select().from(badges).where(and(eq(badges.userId, mentor.user.id), eq(badges.kind, "sessions_50")));
    expect(none).toHaveLength(0);
  });

  it("grants Opportunity Scout after 5 moderator-verified opportunities", async () => {
    const u = await makeUser();
    const t = await topicId("scholarships");
    const mk = (i: number, verified: boolean) => ({
      authorId: u.user.id,
      topicId: t,
      type: "opportunity" as const,
      title: `Verified opportunity number ${i}`,
      body: "An opportunity with an official link and no fees, verified by moderators.",
      orgName: "Org",
      officialUrl: "https://example.edu/",
      involvesFee: false,
      verifiedAt: verified ? new Date() : null,
    });
    await db().insert(posts).values([1, 2, 3, 4].map((i) => mk(i, true)));
    await refreshOpportunityScout(u.user.id);
    expect(await db().select().from(badges).where(and(eq(badges.userId, u.user.id), eq(badges.kind, "opportunity_scout")))).toHaveLength(0);
    await db().insert(posts).values(mk(5, true));
    await refreshOpportunityScout(u.user.id);
    expect(await db().select().from(badges).where(and(eq(badges.userId, u.user.id), eq(badges.kind, "opportunity_scout")))).toHaveLength(1);
  });

  it("awards and withdraws Top Helper per topic", async () => {
    const t = await topicId("research");
    const star = await makeUser();
    await award({ userId: star.user.id, kind: "manual_adjustment", points: 60, sourceType: "test", sourceId: "top", topicId: t });
    await recomputeTopHelpers();
    const active = () => db().select().from(badges).where(and(eq(badges.userId, star.user.id), eq(badges.kind, "top_helper"), isNull(badges.revokedAt)));
    expect(await active()).toHaveLength(1);
    await award({ userId: star.user.id, kind: "reversal", points: -60, sourceType: "test", sourceId: "top-undo", topicId: t });
    await recomputeTopHelpers();
    expect(await active()).toHaveLength(0);
  });

  it("extends badges on re-verification, revokes by topic, and reports state", async () => {
    const u = await makeUser();
    const t = await topicId();
    const id = await grantBadge({ userId: u.user.id, kind: "expert_verified", topicId: t, label: "A", method: "manual_review", expiresAt: new Date(Date.now() + 1000) });
    expect(id).not.toBeNull();
    const again = await grantBadge({ userId: u.user.id, kind: "expert_verified", topicId: t, label: "B", method: "manual_review", expiresAt: new Date(Date.now() + 86400_000) });
    expect(again).toBeNull();
    const [b] = await db().select().from(badges).where(eq(badges.id, id!));
    expect(b!.label).toBe("B");
    expect(badgeState(b!)).toBe("active");
    expect(badgeState({ revokedAt: null, expiresAt: new Date(0) })).toBe("expired");
    await revokeBadges(u.user.id, "expert_verified", "test", null, db(), t);
    const [r] = await db().select().from(badges).where(eq(badges.id, id!));
    expect(badgeState(r!)).toBe("revoked");
  });
});
