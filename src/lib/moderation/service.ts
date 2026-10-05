import { and, asc, desc, eq, gt, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db/client";
import {
  answers,
  appeals,
  blockedDomains,
  blockedIdentifiers,
  bookingMessages,
  bookings,
  feedback,
  mentorProfiles,
  moderationActions,
  offerings,
  posts,
  reports,
  strikes,
  users,
} from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";
import { revokeAllSessions, type ResolvedSession } from "@/lib/auth/session";
import { AppError } from "@/lib/http/errors";
import { hashIdentifier } from "@/lib/security/crypto";
import { notify } from "@/lib/notify/notifications";
import { award, POINTS, recomputeTrustLevel, refreshOpportunityScout, reverse } from "@/lib/trust/reputation";
import { revokeBadges } from "@/lib/trust/badges";
import { alertStaff } from "@/lib/reports/service";
import { assertAllowed } from "@/lib/policy/policy";

/**
 * Moderation: every decision writes (1) a moderation_actions row with a public
 * reason, (2) an audit-chain entry, and (3) a notification to the affected
 * member with an appeal link. Appeals are decided by a DIFFERENT staff member
 * whenever one exists. The enforcement ladder is published in the Guidelines.
 */

export const STRIKE_LADDER = [
  { strike: 1, effect: "restrict", days: 7 },
  { strike: 2, effect: "restrict", days: 30 },
  { strike: 3, effect: "suspend", days: 90 },
  { strike: 4, effect: "ban", days: 0 },
] as const;
export const STRIKE_EXPIRY_DAYS = 365;

type ContentTarget = "post" | "answer" | "booking_message" | "feedback";

function appealLink(actionId: string) {
  return `/appeals/new?action=${actionId}`;
}

async function recordAction(
  tx: DbOrTx,
  a: { actorId: string; action: string; targetType: string; targetId: string; targetUserId: string | null; reasonCode: string; publicReason: string; internalNote?: string | null; reportId?: string | null },
) {
  const [row] = await tx
    .insert(moderationActions)
    .values({ ...a, internalNote: a.internalNote ?? null, reportId: a.reportId ?? null })
    .returning({ id: moderationActions.id });
  await audit({ action: `moderation.${a.action}`, actorId: a.actorId, targetType: a.targetType, targetId: a.targetId, meta: { reasonCode: a.reasonCode, targetUserId: a.targetUserId, reportId: a.reportId ?? null } }, tx);
  return row!.id;
}

async function closeReportsFor(tx: DbOrTx, targetType: string, targetId: string, staffId: string, note: string) {
  await tx
    .update(reports)
    .set({ status: "actioned", resolvedAt: new Date(), resolvedBy: staffId, resolutionNote: note })
    .where(and(eq(reports.targetType, targetType as (typeof reports.$inferSelect)["targetType"]), eq(reports.targetId, targetId), eq(reports.status, "open")));
}

// ─── Queues ─────────────────────────────────────────────────────────────────

export async function queueCounts() {
  const one = async (q: Promise<Array<{ n: number }>>) => (await q)[0]?.n ?? 0;
  const c = sql<number>`count(*)::int`;
  const [heldPosts, heldAnswers, heldMessages, heldFeedback, openReports, p0, pendingMentors, openAppeals, disputes] = await Promise.all([
    one(db().select({ n: c }).from(posts).where(eq(posts.status, "held"))),
    one(db().select({ n: c }).from(answers).where(eq(answers.status, "held"))),
    one(db().select({ n: c }).from(bookingMessages).where(eq(bookingMessages.status, "held"))),
    one(db().select({ n: c }).from(feedback).where(eq(feedback.status, "held"))),
    one(db().select({ n: c }).from(reports).where(eq(reports.status, "open"))),
    one(db().select({ n: c }).from(reports).where(and(eq(reports.status, "open"), eq(reports.priority, 0)))),
    one(db().select({ n: c }).from(mentorProfiles).where(eq(mentorProfiles.status, "pending"))),
    one(db().select({ n: c }).from(appeals).where(eq(appeals.status, "open"))),
    one(db().select({ n: c }).from(bookings).where(eq(bookings.status, "disputed"))),
  ]);
  return { held: heldPosts + heldAnswers + heldMessages + heldFeedback, heldPosts, heldAnswers, heldMessages, heldFeedback, openReports, p0, pendingMentors, openAppeals, disputes };
}

export async function heldQueue() {
  const p = await db()
    .select({ id: posts.id, type: posts.type, title: posts.title, body: posts.body, riskScore: posts.riskScore, riskSignals: posts.riskSignals, createdAt: posts.createdAt, officialUrl: posts.officialUrl, orgName: posts.orgName, involvesFee: posts.involvesFee, deadline: posts.deadline, author: users.username, authorTrust: users.trustLevel, authorCreated: users.createdAt })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.status, "held"))
    .orderBy(desc(posts.riskScore), asc(posts.createdAt))
    .limit(50);
  const a = await db()
    .select({ id: answers.id, postId: answers.postId, body: answers.body, riskScore: answers.riskScore, riskSignals: answers.riskSignals, createdAt: answers.createdAt, author: users.username, authorTrust: users.trustLevel })
    .from(answers)
    .innerJoin(users, eq(users.id, answers.authorId))
    .where(eq(answers.status, "held"))
    .orderBy(desc(answers.riskScore), asc(answers.createdAt))
    .limit(50);
  const m = await db()
    .select({ id: bookingMessages.id, bookingId: bookingMessages.bookingId, body: bookingMessages.body, riskSignals: bookingMessages.riskSignals, createdAt: bookingMessages.createdAt, author: users.username })
    .from(bookingMessages)
    .innerJoin(users, eq(users.id, bookingMessages.senderId))
    .where(eq(bookingMessages.status, "held"))
    .orderBy(asc(bookingMessages.createdAt))
    .limit(50);
  const f = await db()
    .select({ id: feedback.id, bookingId: feedback.bookingId, comment: feedback.comment, createdAt: feedback.createdAt })
    .from(feedback)
    .where(eq(feedback.status, "held"))
    .orderBy(asc(feedback.createdAt))
    .limit(50);
  return { posts: p, answers: a, messages: m, feedback: f };
}

export async function openReports() {
  return db()
    .select({
      report: reports,
      ageHours: sql<number>`extract(epoch from (now() - ${reports.createdAt})) / 3600`,
      targetUser: { username: users.username, displayName: users.displayName, status: users.status },
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.targetUserId))
    .where(eq(reports.status, "open"))
    .orderBy(asc(reports.priority), asc(reports.createdAt))
    .limit(100);
}

// ─── Content decisions ──────────────────────────────────────────────────────

export async function decideContent(
  staff: ResolvedSession,
  input: { targetType: ContentTarget | "booking"; targetId: string; decision: "approve" | "approve_verify" | "remove"; reasonCode: string; publicReason: string; reportId?: string },
) {
  assertAllowed(staff, "staff.moderate");
  if (input.targetType === "booking") throw new AppError("use_dispute_tools", 400);
  const targetType = input.targetType;
  const tableFor = { post: posts, answer: answers, booking_message: bookingMessages, feedback } as const;
  const table = tableFor[targetType];
  const [row] = await db().select().from(table).where(eq(table.id, input.targetId));
  if (!row) throw new AppError("not_found", 404);
  const authorId = "authorId" in row ? row.authorId : "senderId" in row ? row.senderId : (row as typeof feedback.$inferSelect).menteeId;
  if (authorId === staff.user.id) throw new AppError("conflict_of_interest", 403, "You can't moderate your own content.");
  const wasVisible = row.status === "published" || row.status === "flagged";

  await db().transaction(async (tx) => {
    if (input.decision === "remove") {
      await tx.update(table).set({ status: "removed" }).where(eq(table.id, input.targetId));
      if (targetType === "answer" && wasVisible) {
        await tx.update(posts).set({ answerCount: sql`greatest(${posts.answerCount} - 1, 0)` }).where(eq(posts.id, (row as typeof answers.$inferSelect).postId));
      }
      const fraud = input.reasonCode === "fraud" || input.reasonCode === "scam";
      const actionId = await recordAction(tx, {
        actorId: staff.user.id,
        action: "remove_content",
        targetType,
        targetId: input.targetId,
        targetUserId: authorId,
        reasonCode: input.reasonCode,
        publicReason: input.publicReason || "This content broke our Community Guidelines.",
        reportId: input.reportId,
      });
      await award(
        { userId: authorId, kind: fraud ? "fraud_confirmed" : "content_removed", points: fraud ? POINTS.fraud_confirmed : POINTS.content_removed, sourceType: targetType, sourceId: input.targetId },
        tx,
      );
      await closeReportsFor(tx, targetType, input.targetId, staff.user.id, "content removed");
      await notify(authorId, { kind: "moderation", title: "Some of your content was removed", body: input.publicReason || "It broke our Community Guidelines.", link: appealLink(actionId), email: true }, tx);
    } else {
      const verify = input.decision === "approve_verify";
      if (verify && (targetType !== "post" || (row as typeof posts.$inferSelect).type !== "opportunity")) throw new AppError("only_opportunities_verifiable", 400);
      await tx
        .update(table)
        .set({ status: "published", ...(verify ? { verifiedAt: new Date(), verifiedBy: staff.user.id } : {}) })
        .where(eq(table.id, input.targetId));
      if (targetType === "answer" && !wasVisible) {
        await tx.update(posts).set({ answerCount: sql`${posts.answerCount} + 1` }).where(eq(posts.id, (row as typeof answers.$inferSelect).postId));
      }
      await recordAction(tx, {
        actorId: staff.user.id,
        action: verify ? "verify_opportunity" : "approve_content",
        targetType,
        targetId: input.targetId,
        targetUserId: authorId,
        reasonCode: input.reasonCode || "approved",
        publicReason: input.publicReason || "Reviewed by a moderator.",
        reportId: input.reportId,
      });
      if (verify) {
        const p = row as typeof posts.$inferSelect;
        await award({ userId: authorId, kind: "opportunity_verified", points: POINTS.opportunity_verified, sourceType: "post", sourceId: p.id, topicId: p.topicId }, tx);
        await refreshOpportunityScout(authorId, tx);
      }
      await tx
        .update(reports)
        .set({ status: "dismissed", resolvedAt: new Date(), resolvedBy: staff.user.id, resolutionNote: "content approved" })
        .where(and(eq(reports.targetType, targetType), eq(reports.targetId, input.targetId), eq(reports.status, "open")));
      if (!wasVisible) {
        const link = targetType === "post" ? `/posts/${input.targetId}` : targetType === "answer" ? `/posts/${(row as typeof answers.$inferSelect).postId}` : "/bookings";
        await notify(authorId, { kind: "moderation", title: verify ? "Your opportunity was verified and is now live" : "Your content was reviewed and is now live", link }, tx);
      }
    }
  });
  await recomputeTrustLevel(authorId);
}

export async function resolveReport(staff: ResolvedSession, input: { reportId: string; resolution: "dismiss" | "actioned"; note: string }) {
  assertAllowed(staff, "staff.moderate");
  const [r] = await db().select().from(reports).where(eq(reports.id, input.reportId));
  if (!r || r.status !== "open") throw new AppError("not_found", 404);
  await db()
    .update(reports)
    .set({ status: input.resolution === "dismiss" ? "dismissed" : "actioned", resolvedAt: new Date(), resolvedBy: staff.user.id, resolutionNote: input.note })
    .where(eq(reports.id, r.id));
  await audit({ action: `report.${input.resolution}`, actorId: staff.user.id, targetType: "report", targetId: r.id });
  if (r.reporterId) {
    await notify(r.reporterId, {
      kind: "report_outcome",
      title: input.resolution === "dismiss" ? "We reviewed your report and took no action this time" : "Thanks — we took action on something you reported",
      link: "/notifications",
    });
  }
}

// ─── Member enforcement ─────────────────────────────────────────────────────

async function assertCanActOn(staff: ResolvedSession, targetId: string) {
  assertAllowed(staff, "staff.moderate");
  if (targetId === staff.user.id) throw new AppError("cannot_act_on_self", 403);
  const [t] = await db().select().from(users).where(eq(users.id, targetId));
  if (!t) throw new AppError("not_found", 404);
  if ((t.role === "moderator" || t.role === "admin") && staff.user.role !== "admin") throw new AppError("forbidden", 403, "Only admins can act on staff accounts.");
  return t;
}

async function banEffects(tx: DbOrTx, userId: string, email: string, staffId: string) {
  await tx.insert(blockedIdentifiers).values({ valueHash: hashIdentifier("email", email), kind: "email", reason: "banned" }).onConflictDoNothing();
  await revokeAllSessions(userId, "banned", undefined, tx);
  await revokeBadges(userId, "expert_verified", "banned", staffId, tx);
  await revokeBadges(userId, "institution_email", "banned", staffId, tx);
  await revokeBadges(userId, "professional_verified", "banned", staffId, tx);
  await tx.update(mentorProfiles).set({ status: "revoked", reviewNote: "account banned" }).where(eq(mentorProfiles.userId, userId));
  await tx.update(offerings).set({ active: false }).where(eq(offerings.mentorId, userId));
  await tx
    .update(bookings)
    .set({ status: "cancelled_by_mentor", cancelReason: "account_banned", closedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(bookings.mentorId, userId), inArray(bookings.status, ["requested", "accepted"])));
  await tx
    .update(bookings)
    .set({ status: "cancelled_by_mentee", cancelReason: "account_banned", closedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(bookings.menteeId, userId), inArray(bookings.status, ["requested", "accepted"])));
}

export async function actOnUser(
  staff: ResolvedSession,
  input: { userId: string; action: "warn" | "strike" | "suspend" | "ban" | "unban" | "restore"; days?: number; reasonCode: string; publicReason: string; internalNote: string; reportId?: string; fraud: boolean },
) {
  const target = await assertCanActOn(staff, input.userId);
  const now = new Date();
  let effect = input.action as string;
  await db().transaction(async (tx) => {
    let actionId: string;
    const base = { actorId: staff.user.id, targetType: "user", targetId: target.id, targetUserId: target.id, reasonCode: input.reasonCode, publicReason: input.publicReason, internalNote: input.internalNote, reportId: input.reportId };
    switch (input.action) {
      case "warn":
        actionId = await recordAction(tx, { ...base, action: "warn" });
        break;
      case "strike": {
        const [active] = await tx.select({ n: sql<number>`count(*)::int` }).from(strikes).where(and(eq(strikes.userId, target.id), isNull(strikes.revokedAt), gt(strikes.expiresAt, now)));
        const n = (active?.n ?? 0) + 1;
        const step = STRIKE_LADDER[Math.min(n, STRIKE_LADDER.length) - 1]!;
        effect = `strike_${n}_${step.effect}`;
        actionId = await recordAction(tx, { ...base, action: "strike" });
        await tx.insert(strikes).values({ userId: target.id, actionId, severity: n, expiresAt: new Date(now.getTime() + STRIKE_EXPIRY_DAYS * 86400_000) });
        if (step.effect === "restrict") await tx.update(users).set({ restrictedUntil: new Date(now.getTime() + step.days * 86400_000) }).where(eq(users.id, target.id));
        if (step.effect === "suspend") await tx.update(users).set({ status: "suspended", suspendedUntil: new Date(now.getTime() + step.days * 86400_000) }).where(eq(users.id, target.id));
        if (step.effect === "ban") {
          await tx.update(users).set({ status: "banned" }).where(eq(users.id, target.id));
          await banEffects(tx, target.id, target.email, staff.user.id);
        }
        break;
      }
      case "suspend": {
        const days = input.days ?? 7;
        actionId = await recordAction(tx, { ...base, action: "suspend" });
        await tx.update(users).set({ status: "suspended", suspendedUntil: new Date(now.getTime() + days * 86400_000) }).where(eq(users.id, target.id));
        break;
      }
      case "ban":
        actionId = await recordAction(tx, { ...base, action: "ban" });
        await tx.update(users).set({ status: "banned" }).where(eq(users.id, target.id));
        await banEffects(tx, target.id, target.email, staff.user.id);
        if (input.fraud) await award({ userId: target.id, kind: "fraud_confirmed", points: POINTS.fraud_confirmed, sourceType: "user_ban", sourceId: actionId }, tx);
        break;
      case "unban":
      case "restore":
        actionId = await recordAction(tx, { ...base, action: input.action });
        await tx.update(users).set({ status: "active", suspendedUntil: null, restrictedUntil: null }).where(eq(users.id, target.id));
        await tx.delete(blockedIdentifiers).where(eq(blockedIdentifiers.valueHash, hashIdentifier("email", target.email)));
        break;
    }
    if (input.reportId) await tx.update(reports).set({ status: "actioned", resolvedAt: now, resolvedBy: staff.user.id, resolutionNote: effect }).where(eq(reports.id, input.reportId));
    const titles: Record<string, string> = {
      warn: "A warning from the moderation team",
      strike: "Your account received a strike",
      suspend: "Your account has been suspended",
      ban: "Your account has been banned",
      unban: "Your account has been restored",
      restore: "Your account restrictions have been lifted",
    };
    if (input.action !== "ban") {
      await notify(target.id, { kind: "moderation", title: titles[input.action]!, body: input.publicReason, link: input.action === "unban" || input.action === "restore" ? "/" : appealLink(actionId!), email: true }, tx);
    }
  });
  await recomputeTrustLevel(target.id);
  return effect;
}

// ─── Appeals ────────────────────────────────────────────────────────────────

export const APPEAL_WINDOW_DAYS = 30;

export async function getAppealableAction(actor: ResolvedSession, actionId: string) {
  const [a] = await db().select().from(moderationActions).where(eq(moderationActions.id, actionId));
  if (!a || a.targetUserId !== actor.user.id) return null;
  const [existing] = await db().select().from(appeals).where(eq(appeals.actionId, a.id));
  return { action: a, existing: existing ?? null, expired: Date.now() - a.createdAt.getTime() > APPEAL_WINDOW_DAYS * 86400_000 };
}

export async function createAppeal(actor: ResolvedSession, input: { actionId: string; statement: string }) {
  assertAllowed(actor, "appeal.create");
  const found = await getAppealableAction(actor, input.actionId);
  if (!found) throw new AppError("not_found", 404);
  if (found.existing) throw new AppError("already_appealed", 409, "You've already appealed this decision.");
  if (found.expired) throw new AppError("appeal_window_closed", 409, `Appeals must be filed within ${APPEAL_WINDOW_DAYS} days.`);
  if (["approve_content", "verify_opportunity", "mentor_approve", "unban", "restore"].includes(found.action.action)) throw new AppError("not_appealable", 400);
  const [ap] = await db().insert(appeals).values({ userId: actor.user.id, actionId: input.actionId, statement: input.statement }).returning({ id: appeals.id });
  await audit({ action: "appeal.created", actorId: actor.user.id, targetType: "moderation_action", targetId: input.actionId });
  await alertStaff("A new appeal needs a decision");
  return ap!.id;
}

export async function openAppeals() {
  return db()
    .select({ appeal: appeals, action: moderationActions, user: { username: users.username, displayName: users.displayName } })
    .from(appeals)
    .innerJoin(moderationActions, eq(moderationActions.id, appeals.actionId))
    .innerJoin(users, eq(users.id, appeals.userId))
    .where(eq(appeals.status, "open"))
    .orderBy(asc(appeals.createdAt));
}

export async function decideAppeal(staff: ResolvedSession, input: { appealId: string; decision: "granted" | "denied"; note: string }) {
  assertAllowed(staff, "staff.moderate");
  const [row] = await db().select({ appeal: appeals, action: moderationActions }).from(appeals).innerJoin(moderationActions, eq(moderationActions.id, appeals.actionId)).where(eq(appeals.id, input.appealId));
  if (!row || row.appeal.status !== "open") throw new AppError("not_found", 404);
  if (row.appeal.userId === staff.user.id) throw new AppError("conflict_of_interest", 403);
  let singleStaffException = false;
  if (row.action.actorId === staff.user.id) {
    const [others] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(inArray(users.role, ["moderator", "admin"]), eq(users.status, "active"), ne(users.id, staff.user.id)));
    if ((others?.n ?? 0) > 0) throw new AppError("independent_review_required", 403, "Appeals must be decided by a different moderator than the one who took the action.");
    singleStaffException = true; // documented, audited exception for a one-person team
  }
  const { action } = row;
  await db().transaction(async (tx) => {
    await tx.update(appeals).set({ status: input.decision, decidedBy: staff.user.id, decidedAt: new Date(), decisionNote: input.note }).where(eq(appeals.id, row.appeal.id));
    if (input.decision === "granted") {
      await tx.update(moderationActions).set({ reversedAt: new Date() }).where(eq(moderationActions.id, action.id));
      const userId = action.targetUserId!;
      if (action.action === "remove_content") {
        const tableFor = { post: posts, answer: answers, booking_message: bookingMessages, feedback } as const;
        const table = tableFor[action.targetType as keyof typeof tableFor];
        if (table) await tx.update(table).set({ status: "published" }).where(eq(table.id, action.targetId));
        if (action.targetType === "answer") {
          const [a] = await tx.select({ postId: answers.postId }).from(answers).where(eq(answers.id, action.targetId));
          if (a) await tx.update(posts).set({ answerCount: sql`${posts.answerCount} + 1` }).where(eq(posts.id, a.postId));
        }
        await reverse(userId, "content_removed", action.targetType, action.targetId, "appeal_granted", tx);
        await reverse(userId, "fraud_confirmed", action.targetType, action.targetId, "appeal_granted", tx);
      }
      if (action.action === "strike") {
        await tx.update(strikes).set({ revokedAt: new Date() }).where(eq(strikes.actionId, action.id));
        await tx.update(users).set({ restrictedUntil: null }).where(eq(users.id, userId));
        await tx.update(users).set({ status: "active", suspendedUntil: null }).where(and(eq(users.id, userId), eq(users.status, "suspended")));
      }
      if (action.action === "suspend") await tx.update(users).set({ status: "active", suspendedUntil: null }).where(eq(users.id, userId));
      if (action.action === "mentor_reject" || action.action === "mentor_revoke" || action.action === "mentor_pause") {
        // Reinstatement goes back through review (credentials must still check out).
        await tx.update(mentorProfiles).set({ status: "pending", reviewNote: `appeal granted: ${input.note}` }).where(eq(mentorProfiles.userId, userId));
      }
    }
    await audit({ action: `appeal.${input.decision}`, actorId: staff.user.id, targetType: "appeal", targetId: row.appeal.id, meta: { singleStaffException } }, tx);
    await notify(row.appeal.userId, { kind: "appeal", title: input.decision === "granted" ? "Your appeal was granted" : "Your appeal was reviewed and the decision stands", body: input.note, link: "/notifications", email: true }, tx);
  });
  if (row.action.targetUserId) await recomputeTrustLevel(row.action.targetUserId);
}

// ─── Admin tools ────────────────────────────────────────────────────────────

export async function addBlockedDomain(staff: ResolvedSession, domain: string, reason: string) {
  assertAllowed(staff, "staff.moderate");
  await db().insert(blockedDomains).values({ domain, reason, createdBy: staff.user.id }).onConflictDoNothing();
  await audit({ action: "moderation.domain_blocked", actorId: staff.user.id, targetType: "domain", targetId: domain, meta: { reason } });
}

export async function removeBlockedDomain(staff: ResolvedSession, domain: string) {
  assertAllowed(staff, "staff.admin");
  await db().delete(blockedDomains).where(eq(blockedDomains.domain, domain));
  await audit({ action: "moderation.domain_unblocked", actorId: staff.user.id, targetType: "domain", targetId: domain });
}

export async function listBlockedDomains() {
  return db().select().from(blockedDomains).orderBy(asc(blockedDomains.domain));
}

export async function setRole(admin: ResolvedSession, userId: string, role: "member" | "moderator" | "admin") {
  assertAllowed(admin, "staff.admin");
  if (userId === admin.user.id) throw new AppError("cannot_change_own_role", 403);
  const [t] = await db().select().from(users).where(eq(users.id, userId));
  if (!t || t.status !== "active") throw new AppError("not_found", 404);
  await db().transaction(async (tx) => {
    await tx.update(users).set({ role }).where(eq(users.id, userId));
    // Privilege change → new sessions (staff sessions have stricter lifetimes and require 2FA).
    await revokeAllSessions(userId, "role_changed", undefined, tx);
    await audit({ action: "admin.role_changed", actorId: admin.user.id, targetType: "user", targetId: userId, meta: { from: t.role, to: role } }, tx);
    await notify(userId, { kind: "role", title: role === "member" ? "Your staff role was removed" : `You were given the ${role} role — 2FA is required to use it`, link: "/settings/security" }, tx);
  });
}

export async function searchUsers(q: string) {
  const like = `%${q.trim().slice(0, 60).replace(/[%_\\]/g, "\\$&")}%`;
  return db()
    .select({ id: users.id, username: users.username, displayName: users.displayName, email: users.email, role: users.role, status: users.status, trustLevel: users.trustLevel, createdAt: users.createdAt, restrictedUntil: users.restrictedUntil, suspendedUntil: users.suspendedUntil })
    .from(users)
    .where(or(ilike(users.username, like), ilike(users.displayName, like), ilike(users.email, like)))
    .orderBy(desc(users.createdAt))
    .limit(50);
}

export async function userModerationHistory(userId: string) {
  return db().select().from(moderationActions).where(eq(moderationActions.targetUserId, userId)).orderBy(desc(moderationActions.createdAt)).limit(50);
}

// ─── Public transparency ────────────────────────────────────────────────────

export async function transparencyStats(days = 90) {
  const since = sql`now() - make_interval(days => ${days})`;
  const actions = await db()
    .select({ action: moderationActions.action, n: sql<number>`count(*)::int` })
    .from(moderationActions)
    .where(sql`${moderationActions.createdAt} > ${since}`)
    .groupBy(moderationActions.action);
  const reasons = await db()
    .select({ reason: reports.reason, n: sql<number>`count(*)::int` })
    .from(reports)
    .where(sql`${reports.createdAt} > ${since}`)
    .groupBy(reports.reason);
  const [timing] = await db()
    .select({
      medianHours: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${reports.resolvedAt} - ${reports.createdAt})) / 3600)`,
      p90Hours: sql<number | null>`percentile_cont(0.9) within group (order by extract(epoch from (${reports.resolvedAt} - ${reports.createdAt})) / 3600)`,
      resolved: sql<number>`count(*)::int`,
    })
    .from(reports)
    .where(and(sql`${reports.createdAt} > ${since}`, sql`${reports.resolvedAt} is not null`));
  const appealRows = await db()
    .select({ status: appeals.status, n: sql<number>`count(*)::int` })
    .from(appeals)
    .where(sql`${appeals.createdAt} > ${since}`)
    .groupBy(appeals.status);
  const [autoHeld] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(sql`${posts.createdAt} > ${since}`, sql`${posts.riskScore} >= 45`));
  return { days, actions, reasons, timing: timing ?? { medianHours: null, p90Hours: null, resolved: 0 }, appeals: appealRows, autoHeld: autoHeld?.n ?? 0 };
}
