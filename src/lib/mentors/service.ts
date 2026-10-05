import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { badges, bookings, feedback, mentorProfiles, mentorTopics, moderationActions, offerings, profiles, topics, users } from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";
import type { ResolvedSession } from "@/lib/auth/session";
import { AppError } from "@/lib/http/errors";
import { evaluateRisk } from "@/lib/risk/engine";
import { grantBadge, revokeBadges } from "@/lib/trust/badges";
import { summariseRatings, PRIOR_MEAN, PRIOR_STRENGTH, MIN_REVIEWS_TO_DISPLAY } from "@/lib/trust/rating";
import { summariseReliability } from "@/lib/trust/reliability";
import { notify } from "@/lib/notify/notifications";
import { alertStaff } from "@/lib/reports/service";
import { assertAllowed } from "@/lib/policy/policy";

/**
 * Mentors: expert status is GRANTED after manual review, never self-declared.
 * Applications require a scope-of-advice statement and a public conflict-of-
 * interest declaration (agency commissions are the #1 hidden bias in
 * study-abroad advice). Approved mentors must enable 2FA before they appear in
 * the directory — verified accounts are the most valuable to hijack.
 */

export const MAX_ACTIVE_OFFERINGS = 5;
export const REAPPLY_AFTER_MS = 30 * 86400_000;

export async function getMentorProfile(userId: string) {
  const [m] = await db().select().from(mentorProfiles).where(eq(mentorProfiles.userId, userId));
  if (!m) return null;
  const t = await db()
    .select({ id: topics.id, slug: topics.slug, name: topics.nameEn })
    .from(mentorTopics)
    .innerJoin(topics, eq(topics.id, mentorTopics.topicId))
    .where(eq(mentorTopics.userId, userId));
  return { ...m, topics: t };
}

export async function applyAsMentor(
  actor: ResolvedSession,
  input: { headline: string; topicIds: number[]; credentials: string; evidenceLinks: string; scopeStatement: string; conflictOfInterest: string; weeklyCapacity: number },
) {
  assertAllowed(actor, "mentor.apply");
  const existing = await getMentorProfile(actor.user.id);
  if (existing?.status === "approved" || existing?.status === "paused") throw new AppError("already_mentor", 409, "You're already a mentor.");
  if (existing?.status === "revoked") throw new AppError("mentor_revoked", 403, "Your mentor status was revoked. You can appeal the decision from your notifications.");
  if (existing?.status === "rejected" && existing.reviewedAt && Date.now() - existing.reviewedAt.getTime() < REAPPLY_AFTER_MS) {
    throw new AppError("reapply_too_soon", 429, "You can re-apply 30 days after a decision. Use the time to gather stronger evidence.");
  }
  const validTopics = await db().select({ id: topics.id }).from(topics).where(inArray(topics.id, input.topicIds));
  if (validTopics.length !== new Set(input.topicIds).size) throw new AppError("invalid_topic", 400);

  const links = input.evidenceLinks
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => /^https:\/\/\S+$/i.test(s))
    .slice(0, 8);
  const risk = evaluateRisk({
    text: [input.headline, input.credentials, input.scopeStatement, input.conflictOfInterest].join("\n"),
    surface: "profile",
    authorTrustLevel: actor.user.trustLevel,
    authorAccountAgeMs: Date.now() - actor.user.createdAt.getTime(),
  });
  // Mentor applications are always human-reviewed; risk signals are attached for the reviewer.
  await db().transaction(async (tx) => {
    const values = {
      userId: actor.user.id,
      status: "pending" as const,
      headline: input.headline,
      credentials: input.credentials,
      evidenceLinks: links,
      scopeStatement: input.scopeStatement,
      conflictOfInterest: input.conflictOfInterest,
      weeklyCapacity: input.weeklyCapacity,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: risk.signals.length ? `Automatic signals: ${risk.signals.map((s) => s.code).join(", ")}` : null,
    };
    await tx.insert(mentorProfiles).values(values).onConflictDoUpdate({ target: mentorProfiles.userId, set: values });
    await tx.delete(mentorTopics).where(eq(mentorTopics.userId, actor.user.id));
    await tx.insert(mentorTopics).values([...new Set(input.topicIds)].map((topicId) => ({ userId: actor.user.id, topicId })));
    await audit({ action: "mentor.applied", actorId: actor.user.id, targetType: "user", targetId: actor.user.id, meta: { topics: input.topicIds, signals: risk.signals.map((s) => s.code) } }, tx);
  });
  await alertStaff("New mentor application to review");
}

export async function updateMentorSettings(actor: ResolvedSession, input: { weeklyCapacity: number; acceptingRequests: boolean; scopeStatement: string; conflictOfInterest: string }) {
  const m = await getMentorProfile(actor.user.id);
  assertAllowed(actor, "mentor.manage", { mentorStatus: m?.status ?? null });
  await db()
    .update(mentorProfiles)
    .set({ weeklyCapacity: input.weeklyCapacity, acceptingRequests: input.acceptingRequests, scopeStatement: input.scopeStatement, conflictOfInterest: input.conflictOfInterest })
    .where(eq(mentorProfiles.userId, actor.user.id));
  await audit({ action: "mentor.settings_updated", actorId: actor.user.id, meta: { acceptingRequests: input.acceptingRequests, weeklyCapacity: input.weeklyCapacity } });
}

// ─── Offerings ──────────────────────────────────────────────────────────────

export async function createOffering(actor: ResolvedSession, input: { title: string; description: string; durationMin: number }) {
  assertAllowed(actor, "mentor.manage", { mentorStatus: (await getMentorProfile(actor.user.id))?.status ?? null });
  const [count] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(offerings)
    .where(and(eq(offerings.mentorId, actor.user.id), eq(offerings.active, true)));
  if ((count?.n ?? 0) >= MAX_ACTIVE_OFFERINGS) throw new AppError("too_many_offerings", 400, `You can have at most ${MAX_ACTIVE_OFFERINGS} active session types.`);
  const risk = evaluateRisk({ text: `${input.title}\n${input.description}`, surface: "profile", authorTrustLevel: actor.user.trustLevel, authorAccountAgeMs: Date.now() - actor.user.createdAt.getTime(), authorIsApprovedMentor: true });
  if (risk.decision === "hold" || risk.decision === "reject") {
    throw new AppError("offering_rejected", 400, "Session descriptions can't include payment requests, contact details or outside links.");
  }
  const [o] = await db().insert(offerings).values({ mentorId: actor.user.id, ...input, priceBdt: 0 }).returning({ id: offerings.id });
  await audit({ action: "offering.created", actorId: actor.user.id, targetType: "offering", targetId: o!.id });
  return o!.id;
}

export async function deactivateOffering(actor: ResolvedSession, id: string) {
  const res = await db()
    .update(offerings)
    .set({ active: false })
    .where(and(eq(offerings.id, id), eq(offerings.mentorId, actor.user.id)))
    .returning({ id: offerings.id });
  if (!res.length) throw new AppError("not_found", 404);
  await audit({ action: "offering.deactivated", actorId: actor.user.id, targetType: "offering", targetId: id });
}

export async function listOfferings(mentorId: string, activeOnly = true) {
  return db()
    .select()
    .from(offerings)
    .where(and(eq(offerings.mentorId, mentorId), activeOnly ? eq(offerings.active, true) : undefined))
    .orderBy(asc(offerings.durationMin));
}

// ─── Directory (merit-only ranking; never pay-to-rank) ──────────────────────

export type DirectoryFilter = { topic?: string; q?: string; language?: string; women?: boolean };

export async function listDirectory(f: DirectoryFilter) {
  const conditions: SQL[] = [eq(mentorProfiles.status, "approved"), eq(users.status, "active"), isNotNull(users.totpEnabledAt)];
  if (f.topic) {
    const [t] = await db().select({ id: topics.id }).from(topics).where(eq(topics.slug, f.topic));
    if (t) conditions.push(sql`exists (select 1 from mentor_topics mt where mt.user_id = ${users.id} and mt.topic_id = ${t.id})`);
  }
  if (f.q && f.q.trim().length >= 2) {
    const like = `%${f.q.trim().slice(0, 60).replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(ilike(users.displayName, like), ilike(mentorProfiles.headline, like), ilike(mentorProfiles.credentials, like), ilike(profiles.institution, like))!);
  }
  if (f.language) conditions.push(sql`${f.language.toLowerCase()} = any (select lower(x) from unnest(${profiles.languages}) as x)`);
  if (f.women) conditions.push(and(eq(profiles.gender, "woman"), eq(profiles.showGender, true))!);

  const ratingSql = sql<number>`(
    (select coalesce(sum(0.4 * f.helpfulness + 0.4 * f.knowledge + 0.2 * f.respect), 0) from feedback f where f.mentor_id = ${users.id} and f.status = 'published')
    + ${PRIOR_MEAN}::numeric * ${PRIOR_STRENGTH}::numeric
  ) / ((select count(*) from feedback f where f.mentor_id = ${users.id} and f.status = 'published') + ${PRIOR_STRENGTH}::numeric)`;
  const reviewsSql = sql<number>`(select count(*)::int from feedback f where f.mentor_id = ${users.id} and f.status = 'published')`;
  const completedSql = sql<number>`(select count(*)::int from bookings b where b.mentor_id = ${users.id} and b.status = 'completed')`;

  const rows = await db()
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      headline: mentorProfiles.headline,
      institution: profiles.institution,
      languages: profiles.languages,
      accepting: mentorProfiles.acceptingRequests,
      founding: mentorProfiles.founding,
      rating: ratingSql,
      reviews: reviewsSql,
      completed: completedSql,
    })
    .from(mentorProfiles)
    .innerJoin(users, eq(users.id, mentorProfiles.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(mentorProfiles.acceptingRequests), desc(ratingSql), desc(completedSql), asc(users.createdAt))
    .limit(100);

  const ids = rows.map((r) => r.userId);
  const topicRows = ids.length
    ? await db().select({ userId: mentorTopics.userId, name: topics.nameEn, slug: topics.slug }).from(mentorTopics).innerJoin(topics, eq(topics.id, mentorTopics.topicId)).where(inArray(mentorTopics.userId, ids))
    : [];
  const withTopics = rows.map((r) => ({
    ...r,
    rating: Number(r.rating),
    showRating: Number(r.reviews) >= MIN_REVIEWS_TO_DISPLAY,
    topics: topicRows.filter((t) => t.userId === r.userId),
  }));
  // Cold-start fairness: new mentors (fewer than 3 reviews) get their own section instead of sinking to the bottom.
  return { established: withTopics.filter((m) => m.showRating), newMentors: withTopics.filter((m) => !m.showRating) };
}

export async function mentorStats(mentorId: string) {
  const [counts] = await db()
    .select({
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')::int`,
      noShowsByMentor: sql<number>`count(*) filter (where ${bookings.status} = 'no_show_mentor')::int`,
      lateCancelsByMentor: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled_by_mentor' and ${bookings.lateCancel})::int`,
    })
    .from(bookings)
    .where(and(eq(bookings.mentorId, mentorId), sql`${bookings.createdAt} > now() - interval '365 days'`));
  const reviews = await db()
    .select({ helpfulness: feedback.helpfulness, knowledge: feedback.knowledge, respect: feedback.respect, comment: feedback.comment, createdAt: feedback.createdAt, id: feedback.id })
    .from(feedback)
    .where(and(eq(feedback.mentorId, mentorId), eq(feedback.status, "published")))
    .orderBy(desc(feedback.createdAt));
  const completed = counts?.completed ?? 0;
  return {
    rating: summariseRatings(reviews, completed),
    reliability: summariseReliability({ completed, noShowsByMentor: counts?.noShowsByMentor ?? 0, lateCancelsByMentor: counts?.lateCancelsByMentor ?? 0 }),
    reviews: reviews.slice(0, 20),
    completed,
  };
}

// ─── Staff review ───────────────────────────────────────────────────────────

export async function listPendingApplications() {
  return db()
    .select({ mentor: mentorProfiles, user: { id: users.id, username: users.username, displayName: users.displayName, trustLevel: users.trustLevel, createdAt: users.createdAt, emailVerifiedAt: users.emailVerifiedAt } })
    .from(mentorProfiles)
    .innerJoin(users, eq(users.id, mentorProfiles.userId))
    .where(eq(mentorProfiles.status, "pending"))
    .orderBy(asc(mentorProfiles.submittedAt));
}

export async function reviewMentor(
  staff: ResolvedSession,
  input: { userId: string; decision: "approve" | "reject" | "revoke" | "pause"; note: string; founding: boolean; credentialLabel: string },
) {
  assertAllowed(staff, "staff.moderate");
  const m = await getMentorProfile(input.userId);
  if (!m) throw new AppError("not_found", 404);
  if (input.userId === staff.user.id) throw new AppError("cannot_review_self", 403, "You can't review your own application.");
  const nextStatus = { approve: "approved", reject: "rejected", revoke: "revoked", pause: "paused" } as const;
  if (input.decision === "approve" && m.status !== "pending" && m.status !== "paused") throw new AppError("invalid_state", 409);
  if ((input.decision === "revoke" || input.decision === "pause") && m.status !== "approved" && m.status !== "paused") throw new AppError("invalid_state", 409);

  await db().transaction(async (tx) => {
    await tx
      .update(mentorProfiles)
      .set({ status: nextStatus[input.decision], reviewedAt: new Date(), reviewedBy: staff.user.id, reviewNote: input.note, founding: input.decision === "approve" ? input.founding || m.founding : m.founding })
      .where(eq(mentorProfiles.userId, input.userId));
    const [action] = await tx
      .insert(moderationActions)
      .values({ actorId: staff.user.id, action: `mentor_${input.decision}`, targetType: "user", targetId: input.userId, targetUserId: input.userId, reasonCode: `mentor_${input.decision}`, publicReason: input.note })
      .returning({ id: moderationActions.id });
    if (input.decision === "approve") {
      for (const t of m.topics) {
        await grantBadge(
          { userId: input.userId, kind: "expert_verified", topicId: t.id, label: `${input.credentialLabel || m.headline} · ${t.name}`.slice(0, 160), method: "manual_review", grantedBy: staff.user.id, expiresAt: new Date(Date.now() + 365 * 86400_000) },
          tx,
        );
      }
      if (input.founding) await grantBadge({ userId: input.userId, kind: "founding_mentor", label: "Founding mentor", method: "staff_designation", grantedBy: staff.user.id }, tx);
    }
    if (input.decision === "revoke") {
      await revokeBadges(input.userId, "expert_verified", "mentor_revoked", staff.user.id, tx);
      await tx.update(offerings).set({ active: false }).where(eq(offerings.mentorId, input.userId));
      await tx
        .update(bookings)
        .set({ status: "cancelled_by_mentor", cancelReason: "mentor_status_revoked", closedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(bookings.mentorId, input.userId), eq(bookings.status, "requested")));
    }
    const title =
      input.decision === "approve"
        ? "Your mentor application was approved — enable 2FA to appear in the directory"
        : input.decision === "reject"
          ? "Your mentor application was not approved this time"
          : input.decision === "pause"
            ? "Your mentor profile has been paused by our team"
            : "Your mentor status has been revoked";
    await notify(input.userId, { kind: "mentor_review", title, body: input.note, link: input.decision === "approve" ? "/settings/security" : `/appeals/new?action=${action!.id}`, email: true }, tx);
    await audit({ action: `mentor.${input.decision}`, actorId: staff.user.id, targetType: "user", targetId: input.userId, meta: { note: input.note } }, tx);
  });
}

export async function activeBadges(userId: string) {
  return db()
    .select({ id: badges.id, kind: badges.kind, label: badges.label, method: badges.method, grantedAt: badges.grantedAt, expiresAt: badges.expiresAt, topicId: badges.topicId })
    .from(badges)
    .where(and(eq(badges.userId, userId), isNull(badges.revokedAt), or(isNull(badges.expiresAt), sql`${badges.expiresAt} > now()`)))
    .orderBy(asc(badges.grantedAt));
}
