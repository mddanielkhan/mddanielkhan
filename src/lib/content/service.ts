import { and, asc, desc, eq, gte, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { answers, blockedDomains, mentorProfiles, posts, reports, topics, users, votes } from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";
import { authorize, assertAllowed, isStaffRole, DENY_MESSAGES } from "@/lib/policy/policy";
import type { ResolvedSession } from "@/lib/auth/session";
import { evaluateRisk, publicReasons, type Decision, type RiskResult } from "@/lib/risk/engine";
import { AppError } from "@/lib/http/errors";
import { isPaused } from "@/lib/settings";
import { dailyAnswerCap, dailyPostCap } from "@/lib/security/rate-limit";
import { award, POINTS, reverse } from "@/lib/trust/reputation";
import { notify } from "@/lib/notify/notifications";

type ContentStatus = (typeof posts.$inferSelect)["status"];
export const VISIBLE: ContentStatus[] = ["published", "flagged"];

const STATUS_FOR: Record<Decision, ContentStatus> = { allow: "published", flag: "flagged", hold: "held", reject: "rejected" };

export async function loadBlockedDomains(): Promise<Set<string>> {
  const rows = await db().select({ domain: blockedDomains.domain }).from(blockedDomains);
  return new Set(rows.map((r) => r.domain));
}

async function isApprovedMentor(userId: string) {
  const [m] = await db().select({ status: mentorProfiles.status }).from(mentorProfiles).where(eq(mentorProfiles.userId, userId));
  return m?.status === "approved";
}

/** Crisis language → private support + a P0 human follow-up. Never a penalty, never public. */
export async function routeSupport(userId: string, targetType: "post" | "answer", targetId: string) {
  await notify(userId, {
    kind: "support",
    title: "You're not alone — support is available",
    body: "If you are going through a hard time, please talk to someone. Kaan Pete Roi (free, confidential emotional support in Bangladesh) and the national emergency number 999 are listed on our Safety page. A member of our team may check in with you privately.",
    link: "/safety#support",
  });
  await db()
    .insert(reports)
    .values({ reporterId: null, targetType, targetId, targetUserId: userId, reason: "self_harm", details: "Automatic: crisis language detected. Reach out privately; do not take enforcement action.", priority: 0 })
    .onConflictDoNothing();
}

async function postsToday(userId: string) {
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), gte(posts.createdAt, sql`now() - interval '24 hours'`)));
  return r?.n ?? 0;
}

async function answersToday(userId: string) {
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(answers)
    .where(and(eq(answers.authorId, userId), gte(answers.createdAt, sql`now() - interval '24 hours'`)));
  return r?.n ?? 0;
}

export type PostInput = {
  type: "question" | "discussion" | "guide" | "opportunity" | "story" | "safety_alert";
  topicId: number;
  title: string;
  body: string;
  tags: string[];
  orgName?: string;
  officialUrl?: string;
  deadline?: string;
  involvesFee?: "yes" | "no";
  sources?: string;
};

function parseSources(raw?: string) {
  return (raw ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => /^https:\/\/[^\s]+$/i.test(s))
    .slice(0, 10);
}

export async function createPost(actor: ResolvedSession, input: PostInput): Promise<{ id: string; status: ContentStatus; reasons: string[] }> {
  assertAllowed(actor, "post.create");
  if (await isPaused("posting_paused")) throw new AppError("posting_paused", 503);
  if (input.type === "opportunity") {
    if (await isPaused("opportunities_paused")) throw new AppError("opportunities_paused", 503);
    const d = authorize(actor, "post.create.opportunity");
    if (!d.ok) throw new AppError(d.reason, 403, DENY_MESSAGES[d.reason]);
  }
  if (input.type === "safety_alert") {
    const d = authorize(actor, "post.create.safety_alert");
    if (!d.ok) throw new AppError(d.reason, 403, DENY_MESSAGES[d.reason]);
  }
  if ((await postsToday(actor.user.id)) >= dailyPostCap(actor.user.trustLevel)) {
    throw new AppError("daily_post_limit", 429, "You've reached today's posting limit for your trust level. It grows as you take part.");
  }
  const [topic] = await db().select().from(topics).where(eq(topics.id, input.topicId));
  if (!topic) throw new AppError("invalid_topic", 400);

  const sources = parseSources(input.sources);
  if (input.type === "guide" && sources.length === 0) throw new AppError("invalid_sources", 400, "Guides must cite at least one official https:// source.");

  const risk = evaluateRisk({
    text: [input.title, input.body, input.orgName ?? ""].join("\n"),
    surface: "post",
    postType: input.type,
    highRiskTopic: topic.highRisk,
    authorTrustLevel: actor.user.trustLevel,
    authorAccountAgeMs: Date.now() - actor.user.createdAt.getTime(),
    authorIsApprovedMentor: await isApprovedMentor(actor.user.id),
    authorIsStaff: isStaffRole(actor.user.role),
    extraUrls: [input.officialUrl, ...sources].filter((u): u is string => !!u),
    involvesFee: input.involvesFee === "yes",
    blockedDomains: await loadBlockedDomains(),
  });
  const status = STATUS_FOR[risk.decision];

  const id = await db().transaction(async (tx) => {
    const [row] = await tx
      .insert(posts)
      .values({
        authorId: actor.user.id,
        topicId: input.topicId,
        type: input.type,
        title: input.title,
        body: input.body,
        tags: input.tags,
        status,
        riskScore: risk.score,
        riskSignals: risk.signals.map((s) => ({ code: s.code, weight: s.weight })),
        orgName: input.type === "opportunity" ? (input.orgName ?? null) : null,
        officialUrl: input.type === "opportunity" ? (input.officialUrl ?? null) : null,
        deadline: input.type === "opportunity" ? (input.deadline ?? null) : null,
        involvesFee: input.type === "opportunity" ? input.involvesFee === "yes" : null,
        sources,
        lastVerifiedOn: input.type === "guide" ? new Date().toISOString().slice(0, 10) : null,
        // Staff safety alerts are the platform's own voice: verified by definition.
        verifiedAt: input.type === "safety_alert" ? new Date() : null,
        verifiedBy: input.type === "safety_alert" ? actor.user.id : null,
      })
      .returning({ id: posts.id });
    await audit(
      { action: "content.post_created", actorId: actor.user.id, targetType: "post", targetId: row!.id, meta: { status, score: risk.score, ruleset: risk.rulesetVersion, signals: risk.signals.map((s) => s.code) } },
      tx,
    );
    return row!.id;
  });

  if (risk.supportNeeded) await routeSupport(actor.user.id, "post", id);
  return { id, status, reasons: publicReasons(risk) };
}

async function getOwnedPost(actor: ResolvedSession, id: string) {
  const [p] = await db().select().from(posts).where(eq(posts.id, id));
  if (!p || p.status === "deleted") throw new AppError("not_found", 404);
  if (p.authorId !== actor.user.id) throw new AppError("forbidden", 403);
  return p;
}

export async function editPost(actor: ResolvedSession, input: { id: string; title: string; body: string; tags: string[] }) {
  const p = await getOwnedPost(actor, input.id);
  if (p.status === "removed") throw new AppError("content_removed", 403, "Removed content can't be edited. You can appeal the decision.");
  const [topic] = await db().select().from(topics).where(eq(topics.id, p.topicId));
  // Every edit is re-screened: "post clean, edit in the scam" must not work.
  const risk = evaluateRisk({
    text: [input.title, input.body, p.orgName ?? ""].join("\n"),
    surface: "post",
    postType: p.type,
    highRiskTopic: topic?.highRisk,
    authorTrustLevel: actor.user.trustLevel,
    authorAccountAgeMs: Date.now() - actor.user.createdAt.getTime(),
    authorIsApprovedMentor: await isApprovedMentor(actor.user.id),
    authorIsStaff: isStaffRole(actor.user.role),
    extraUrls: [p.officialUrl, ...p.sources].filter((u): u is string => !!u),
    involvesFee: !!p.involvesFee,
    blockedDomains: await loadBlockedDomains(),
  });
  let status = STATUS_FOR[risk.decision];
  // A held post stays held until a moderator looks at it, whatever the edit.
  if (p.status === "held" && status !== "rejected") status = "held";
  const contentChanged = input.title !== p.title || input.body !== p.body;
  await db()
    .update(posts)
    .set({
      title: input.title,
      body: input.body,
      tags: input.tags,
      status,
      riskScore: risk.score,
      riskSignals: risk.signals.map((s) => ({ code: s.code, weight: s.weight })),
      editedAt: new Date(),
      updatedAt: new Date(),
      // A moderator verified the OLD text. An edited opportunity must be re-verified.
      ...(contentChanged && p.type === "opportunity" ? { verifiedAt: null, verifiedBy: null } : {}),
    })
    .where(eq(posts.id, p.id));
  await audit({ action: "content.post_edited", actorId: actor.user.id, targetType: "post", targetId: p.id, meta: { status, score: risk.score, signals: risk.signals.map((s) => s.code) } });
  return { status, reasons: publicReasons(risk) };
}

export async function deleteOwnPost(actor: ResolvedSession, id: string) {
  const p = await getOwnedPost(actor, id);
  await db().update(posts).set({ status: "deleted", updatedAt: new Date() }).where(eq(posts.id, p.id));
  await audit({ action: "content.post_deleted_by_author", actorId: actor.user.id, targetType: "post", targetId: p.id });
}

/** An author whose post the automatic filter rejected may ask a human to look (once). */
export async function requestHumanReview(actor: ResolvedSession, id: string) {
  const p = await getOwnedPost(actor, id);
  if (p.status !== "rejected") throw new AppError("not_rejected", 400);
  await db().update(posts).set({ status: "held", updatedAt: new Date() }).where(eq(posts.id, p.id));
  await audit({ action: "content.review_requested", actorId: actor.user.id, targetType: "post", targetId: p.id });
}

// ─── Answers ────────────────────────────────────────────────────────────────

export async function createAnswer(actor: ResolvedSession, input: { postId: string; body: string }) {
  assertAllowed(actor, "answer.create");
  if (await isPaused("posting_paused")) throw new AppError("posting_paused", 503);
  const [p] = await db().select().from(posts).where(eq(posts.id, input.postId));
  if (!p || !VISIBLE.includes(p.status)) throw new AppError("not_found", 404);
  if ((await answersToday(actor.user.id)) >= dailyAnswerCap(actor.user.trustLevel)) {
    throw new AppError("daily_answer_limit", 429, "You've reached today's answer limit for your trust level.");
  }
  const [topic] = await db().select().from(topics).where(eq(topics.id, p.topicId));
  const risk = evaluateRisk({
    text: input.body,
    surface: "answer",
    highRiskTopic: topic?.highRisk,
    authorTrustLevel: actor.user.trustLevel,
    authorAccountAgeMs: Date.now() - actor.user.createdAt.getTime(),
    authorIsApprovedMentor: await isApprovedMentor(actor.user.id),
    authorIsStaff: isStaffRole(actor.user.role),
    blockedDomains: await loadBlockedDomains(),
  });
  const status = STATUS_FOR[risk.decision];
  const id = await db().transaction(async (tx) => {
    const [row] = await tx
      .insert(answers)
      .values({ postId: p.id, authorId: actor.user.id, body: input.body, status, riskScore: risk.score, riskSignals: risk.signals.map((s) => ({ code: s.code, weight: s.weight })) })
      .returning({ id: answers.id });
    if (VISIBLE.includes(status)) {
      await tx.update(posts).set({ answerCount: sql`${posts.answerCount} + 1` }).where(eq(posts.id, p.id));
      if (p.authorId !== actor.user.id) {
        await notify(p.authorId, { kind: "answer", title: "Someone answered your post", link: `/posts/${p.id}#answer-${row!.id}`, email: true }, tx);
      }
    }
    await audit({ action: "content.answer_created", actorId: actor.user.id, targetType: "answer", targetId: row!.id, meta: { status, score: risk.score, signals: risk.signals.map((s) => s.code) } }, tx);
    return row!.id;
  });
  if (risk.supportNeeded) await routeSupport(actor.user.id, "answer", id);
  return { id, status, reasons: publicReasons(risk) };
}

export async function deleteOwnAnswer(actor: ResolvedSession, id: string) {
  const [a] = await db().select().from(answers).where(eq(answers.id, id));
  if (!a || a.authorId !== actor.user.id || a.status === "deleted") throw new AppError("not_found", 404);
  await db().transaction(async (tx) => {
    await tx.update(answers).set({ status: "deleted", updatedAt: new Date() }).where(eq(answers.id, id));
    if (VISIBLE.includes(a.status)) await tx.update(posts).set({ answerCount: sql`greatest(${posts.answerCount} - 1, 0)` }).where(eq(posts.id, a.postId));
    await audit({ action: "content.answer_deleted_by_author", actorId: actor.user.id, targetType: "answer", targetId: id }, tx);
  });
}

export async function acceptAnswer(actor: ResolvedSession, input: { postId: string; answerId: string }) {
  const [p] = await db().select().from(posts).where(eq(posts.id, input.postId));
  if (!p || !VISIBLE.includes(p.status)) throw new AppError("not_found", 404);
  if (p.authorId !== actor.user.id) throw new AppError("forbidden", 403, "Only the person who asked can accept an answer.");
  if (p.type !== "question") throw new AppError("not_a_question", 400);
  const [a] = await db().select().from(answers).where(and(eq(answers.id, input.answerId), eq(answers.postId, p.id)));
  if (!a || !VISIBLE.includes(a.status)) throw new AppError("not_found", 404);
  if (a.authorId === actor.user.id) throw new AppError("cannot_accept_own", 400, "You can't accept your own answer.");
  if (p.acceptedAnswerId === a.id) return;
  await db().transaction(async (tx) => {
    if (p.acceptedAnswerId) {
      const [prev] = await tx.select().from(answers).where(eq(answers.id, p.acceptedAnswerId));
      if (prev) await reverse(prev.authorId, "answer_accepted", "answer", prev.id, "accepted_answer_changed", tx);
    }
    await tx.update(posts).set({ acceptedAnswerId: a.id, updatedAt: new Date() }).where(eq(posts.id, p.id));
    await award({ userId: a.authorId, kind: "answer_accepted", points: POINTS.answer_accepted, sourceType: "answer", sourceId: a.id, topicId: p.topicId }, tx);
    await notify(a.authorId, { kind: "accepted", title: "Your answer was accepted — thank you for helping", link: `/posts/${p.id}#answer-${a.id}` }, tx);
    await audit({ action: "content.answer_accepted", actorId: actor.user.id, targetType: "answer", targetId: a.id }, tx);
  });
}

// ─── Votes ──────────────────────────────────────────────────────────────────

export async function toggleVote(actor: ResolvedSession, input: { targetType: "post" | "answer"; targetId: string }) {
  assertAllowed(actor, "vote.cast");
  const table = input.targetType === "post" ? posts : answers;
  const [target] = await db().select({ id: table.id, authorId: table.authorId, status: table.status }).from(table).where(eq(table.id, input.targetId));
  if (!target || !VISIBLE.includes(target.status)) throw new AppError("not_found", 404);
  if (target.authorId === actor.user.id) throw new AppError("cannot_vote_own", 400, "You can't vote on your own contribution.");
  let topicId: number | null = null;
  if (input.targetType === "post") {
    const [p] = await db().select({ topicId: posts.topicId }).from(posts).where(eq(posts.id, input.targetId));
    topicId = p?.topicId ?? null;
  } else {
    const [r] = await db().select({ topicId: posts.topicId }).from(answers).innerJoin(posts, eq(posts.id, answers.postId)).where(eq(answers.id, input.targetId));
    topicId = r?.topicId ?? null;
  }
  const kind = input.targetType === "post" ? "helpful_vote_post" : "helpful_vote_answer";
  const sourceId = `${actor.user.id}:${input.targetId}`;
  return db().transaction(async (tx) => {
    const removed = await tx
      .delete(votes)
      .where(and(eq(votes.userId, actor.user.id), eq(votes.targetType, input.targetType), eq(votes.targetId, input.targetId)))
      .returning();
    if (removed.length) {
      await tx.update(table).set({ helpfulCount: sql`greatest(${table.helpfulCount} - 1, 0)` }).where(eq(table.id, input.targetId));
      await reverse(target.authorId, kind, "vote", sourceId, "vote_removed", tx);
      return { voted: false };
    }
    await tx.insert(votes).values({ userId: actor.user.id, targetType: input.targetType, targetId: input.targetId });
    await tx.update(table).set({ helpfulCount: sql`${table.helpfulCount} + 1` }).where(eq(table.id, input.targetId));
    // Idempotent per voter+target: vote → unvote → vote can never farm points.
    await award({ userId: target.authorId, kind, points: POINTS[kind], sourceType: "vote", sourceId, topicId }, tx);
    return { voted: true };
  });
}

// ─── Queries ────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 20;

export type FeedQuery = { topic?: string; type?: string; q?: string; sort?: "new" | "top" | "unanswered"; page?: number };

const authorVisible = () => and(ne(users.status, "banned"), ne(users.status, "deleted"));

export async function listFeed(f: FeedQuery) {
  const conditions: SQL[] = [inArray(posts.status, VISIBLE), ne(users.status, "banned")];
  if (f.topic) {
    const [t] = await db().select({ id: topics.id }).from(topics).where(eq(topics.slug, f.topic));
    if (t) conditions.push(eq(posts.topicId, t.id));
  }
  if (f.type && ["question", "discussion", "guide", "opportunity", "story", "safety_alert"].includes(f.type)) {
    conditions.push(eq(posts.type, f.type as PostInput["type"]));
  }
  if (f.sort === "unanswered") conditions.push(eq(posts.answerCount, 0), eq(posts.type, "question"));
  if (f.q && f.q.trim().length >= 2) conditions.push(sql`${posts.search} @@ websearch_to_tsquery('simple', ${f.q.trim().slice(0, 100)})`);
  const page = Math.max(1, Math.min(f.page ?? 1, 500));
  const order =
    f.sort === "top"
      ? [desc(posts.helpfulCount), desc(posts.createdAt)]
      : f.q && f.q.trim().length >= 2
        ? [desc(sql`ts_rank(${posts.search}, websearch_to_tsquery('simple', ${f.q.trim().slice(0, 100)}))`), desc(posts.createdAt)]
        : [desc(posts.createdAt)];
  const rows = await db()
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      body: sql<string>`left(${posts.body}, 280)`,
      tags: posts.tags,
      status: posts.status,
      answerCount: posts.answerCount,
      helpfulCount: posts.helpfulCount,
      acceptedAnswerId: posts.acceptedAnswerId,
      verifiedAt: posts.verifiedAt,
      deadline: posts.deadline,
      orgName: posts.orgName,
      createdAt: posts.createdAt,
      topicSlug: topics.slug,
      topicName: topics.nameEn,
      authorUsername: users.username,
      authorName: users.displayName,
      authorTrust: users.trustLevel,
      authorStatus: users.status,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .innerJoin(topics, eq(topics.id, posts.topicId))
    .where(and(...conditions))
    .orderBy(...order)
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, page };
}

export async function listOpportunities(opts: { verifiedOnly?: boolean; topic?: string } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const conditions: SQL[] = [eq(posts.type, "opportunity"), inArray(posts.status, VISIBLE), ne(users.status, "banned"), or(isNull(posts.deadline), gte(posts.deadline, today))!];
  if (opts.verifiedOnly) conditions.push(sql`${posts.verifiedAt} is not null`);
  if (opts.topic) {
    const [t] = await db().select({ id: topics.id }).from(topics).where(eq(topics.slug, opts.topic));
    if (t) conditions.push(eq(posts.topicId, t.id));
  }
  return db()
    .select({
      id: posts.id,
      title: posts.title,
      orgName: posts.orgName,
      officialUrl: posts.officialUrl,
      deadline: posts.deadline,
      involvesFee: posts.involvesFee,
      verifiedAt: posts.verifiedAt,
      topicName: topics.nameEn,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .innerJoin(topics, eq(topics.id, posts.topicId))
    .where(and(...conditions))
    .orderBy(sql`${posts.deadline} asc nulls last`, desc(posts.createdAt))
    .limit(200);
}

export async function getPostForViewer(id: string, viewer: ResolvedSession | null) {
  const [row] = await db()
    .select({ post: posts, topic: topics, author: { id: users.id, username: users.username, displayName: users.displayName, trustLevel: users.trustLevel, status: users.status } })
    .from(posts)
    .innerJoin(topics, eq(topics.id, posts.topicId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.id, id));
  if (!row || row.post.status === "deleted") return null;
  const isAuthor = viewer?.user.id === row.post.authorId;
  const isStaff = !!viewer && isStaffRole(viewer.user.role);
  const visible = VISIBLE.includes(row.post.status) && row.author.status !== "banned";
  if (!visible && !isAuthor && !isStaff) return null;

  const answerRows = await db()
    .select({
      answer: answers,
      author: { id: users.id, username: users.username, displayName: users.displayName, trustLevel: users.trustLevel, status: users.status },
    })
    .from(answers)
    .innerJoin(users, eq(users.id, answers.authorId))
    .where(
      and(
        eq(answers.postId, id),
        isStaff ? ne(answers.status, "deleted") : or(and(inArray(answers.status, VISIBLE), authorVisible()), and(eq(answers.authorId, viewer?.user.id ?? "00000000-0000-0000-0000-000000000000"), ne(answers.status, "deleted"))),
      ),
    )
    .orderBy(asc(answers.createdAt));

  let votedIds = new Set<string>();
  if (viewer) {
    const ids = [id, ...answerRows.map((a) => a.answer.id)];
    const v = await db()
      .select({ targetId: votes.targetId })
      .from(votes)
      .where(and(eq(votes.userId, viewer.user.id), inArray(votes.targetId, ids)));
    votedIds = new Set(v.map((x) => x.targetId));
  }
  // Accepted answer first, then by helpfulness, then oldest first.
  answerRows.sort((a, b) => {
    if (a.answer.id === row.post.acceptedAnswerId) return -1;
    if (b.answer.id === row.post.acceptedAnswerId) return 1;
    return b.answer.helpfulCount - a.answer.helpfulCount || a.answer.createdAt.getTime() - b.answer.createdAt.getTime();
  });
  return { ...row, answers: answerRows, votedIds, isAuthor, isStaff };
}

export async function postsByAuthor(userId: string, limit = 20) {
  return db()
    .select({ id: posts.id, title: posts.title, type: posts.type, createdAt: posts.createdAt, answerCount: posts.answerCount, helpfulCount: posts.helpfulCount })
    .from(posts)
    .where(and(eq(posts.authorId, userId), inArray(posts.status, VISIBLE)))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}

export async function myHeldContent(userId: string) {
  return db()
    .select({ id: posts.id, title: posts.title, status: posts.status, createdAt: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.authorId, userId), inArray(posts.status, ["held", "rejected"])))
    .orderBy(desc(posts.createdAt))
    .limit(20);
}

export type { RiskResult };
