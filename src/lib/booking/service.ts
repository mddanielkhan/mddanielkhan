import { and, asc, desc, eq, inArray, lte, ne, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db/client";
import { bookingMessages, bookings, feedback, mentorProfiles, mentorTopics, offerings, reports, users } from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";
import type { ResolvedSession } from "@/lib/auth/session";
import { AppError } from "@/lib/http/errors";
import { isPaused } from "@/lib/settings";
import { evaluateRisk, publicReasons } from "@/lib/risk/engine";
import { hostMatches } from "@/lib/risk/normalise";
import { hmacHex } from "@/lib/security/crypto";
import { env } from "@/lib/env";
import { assertAllowed, isStaffRole } from "@/lib/policy/policy";
import { notify } from "@/lib/notify/notifications";
import { alertStaff } from "@/lib/reports/service";
import { enqueue } from "@/lib/jobs/queue";
import { award, POINTS, refreshSessionBadges } from "@/lib/trust/reputation";
import { feedbackPoints, needsSafetyReview } from "@/lib/trust/rating";
import { AUTO_PAUSE_BELOW_PERCENT, summariseReliability } from "@/lib/trust/reliability";
import { canLeaveFeedback, canMessage, CAPACITY_STATUSES, requestExpiry, transition, validateProposedTimes, type BookingEvent, type BookingState, type Party } from "./state-machine";

/** Phase 1: all session times are entered and shown in Bangladesh time (UTC+6, no DST) — one unambiguous clock. */
export const BD_OFFSET = "+06:00";
export const OPEN_REQUEST_LIMIT_BY_TL = [1, 2, 3, 3, 5];

/** Video links must point at a known meeting provider (prevents phishing links in the "join" button). */
export const MEETING_HOSTS = ["meet.jit.si", "8x8.vc", "meet.google.com", "zoom.us", "teams.microsoft.com", "teams.live.com", "whereby.com"];

export function parseLocalBdTime(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(Number.NaN);
  return new Date(`${value}:00${BD_OFFSET}`);
}

export function isAllowedMeetingUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && MEETING_HOSTS.some((h) => hostMatches(u.hostname.toLowerCase(), h));
  } catch {
    return false;
  }
}

export function defaultMeetingUrl(bookingId: string) {
  // Unguessable but stable room name; no personal data in the URL.
  return `${env().JITSI_BASE_URL.replace(/\/$/, "")}/Shikor-${hmacHex("jitsi-room", bookingId).slice(0, 24)}`;
}

function toState(b: typeof bookings.$inferSelect): BookingState {
  return {
    status: b.status,
    proposedTimes: b.proposedTimes,
    durationMin: b.durationMin,
    scheduledAt: b.scheduledAt,
    requestExpiresAt: b.requestExpiresAt,
    mentorOutcome: (b.mentorOutcome as BookingState["mentorOutcome"]) ?? null,
    menteeOutcome: (b.menteeOutcome as BookingState["menteeOutcome"]) ?? null,
    outcomeDeadline: b.outcomeDeadline,
    completedAt: b.completedAt,
  };
}

async function loadForParticipant(actor: ResolvedSession, id: string) {
  const [b] = await db().select().from(bookings).where(eq(bookings.id, id));
  if (!b) throw new AppError("not_found", 404);
  const party: Party | null = b.mentorId === actor.user.id ? "mentor" : b.menteeId === actor.user.id ? "mentee" : null;
  // IDOR defence: a booking you are not part of does not exist for you.
  if (!party) throw new AppError("not_found", 404);
  return { b, party };
}

/** Apply a state-machine event with optimistic concurrency (status must not have changed underneath us). */
async function applyEvent(b: typeof bookings.$inferSelect, event: BookingEvent, extra: Partial<typeof bookings.$inferInsert> = {}, tx: DbOrTx = db()) {
  const now = new Date();
  const r = transition(toState(b), event, now);
  if (!r.ok) throw new AppError(r.error, 409);
  const updated = await tx
    .update(bookings)
    .set({ ...r.patch, ...extra, updatedAt: now })
    .where(and(eq(bookings.id, b.id), eq(bookings.status, b.status)))
    .returning();
  if (!updated[0]) throw new AppError("booking_changed", 409, "This booking was just updated. Refresh and try again.");
  return updated[0];
}

// ─── Request ────────────────────────────────────────────────────────────────

export async function requestBooking(actor: ResolvedSession, input: { offeringId: string; subject: string; message: string; times: string[] }) {
  assertAllowed(actor, "booking.request");
  if (await isPaused("bookings_paused")) throw new AppError("bookings_paused", 503);
  const [o] = await db()
    .select({ offering: offerings, mentor: mentorProfiles, mentorUser: { id: users.id, status: users.status, totp: users.totpEnabledAt } })
    .from(offerings)
    .innerJoin(mentorProfiles, eq(mentorProfiles.userId, offerings.mentorId))
    .innerJoin(users, eq(users.id, offerings.mentorId))
    .where(eq(offerings.id, input.offeringId));
  if (!o || !o.offering.active || o.mentor.status !== "approved" || o.mentorUser.status !== "active" || !o.mentorUser.totp) {
    throw new AppError("mentor_unavailable", 404, "This mentor isn't taking requests right now.");
  }
  if (!o.mentor.acceptingRequests) throw new AppError("mentor_not_accepting", 409, "This mentor has paused new requests.");
  if (o.offering.mentorId === actor.user.id) throw new AppError("cannot_book_self", 400);

  const [open] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.menteeId, actor.user.id), inArray(bookings.status, ["requested", "accepted"])));
  const limit = OPEN_REQUEST_LIMIT_BY_TL[actor.user.trustLevel] ?? 1;
  if ((open?.n ?? 0) >= limit) throw new AppError("too_many_open_requests", 429, `You can have ${limit} open session request(s) at your trust level.`);

  const now = new Date();
  const times = input.times.filter(Boolean).map(parseLocalBdTime);
  const timeError = validateProposedTimes(times, now);
  if (timeError) throw new AppError(timeError, 400, "Propose 1–3 different times, at least 12 hours and at most 30 days from now (Bangladesh time).");

  const risk = evaluateRisk({
    text: `${input.subject}\n${input.message}`,
    surface: "booking_request",
    authorTrustLevel: actor.user.trustLevel,
    authorAccountAgeMs: now.getTime() - actor.user.createdAt.getTime(),
  });
  if (risk.decision === "hold" || risk.decision === "reject") {
    throw new AppError("booking_request_blocked", 400, `Your request can't be sent: ${publicReasons(risk).join(" ")} Sessions on this platform are free and stay on the platform.`);
  }
  const [topic] = await db().select({ topicId: mentorTopics.topicId }).from(mentorTopics).where(eq(mentorTopics.userId, o.offering.mentorId)).limit(1);

  try {
    const id = await db().transaction(async (tx) => {
      const [b] = await tx
        .insert(bookings)
        .values({
          offeringId: o.offering.id,
          mentorId: o.offering.mentorId,
          menteeId: actor.user.id,
          topicId: topic?.topicId ?? null,
          subject: input.subject,
          message: input.message,
          proposedTimes: times,
          durationMin: o.offering.durationMin,
          riskScore: risk.score,
          riskSignals: risk.signals.map((s) => ({ code: s.code, weight: s.weight })),
          requestExpiresAt: requestExpiry(now, times),
        })
        .returning({ id: bookings.id });
      await notify(o.offering.mentorId, { kind: "booking_request", title: "You have a new session request", link: `/bookings/${b!.id}`, email: true }, tx);
      await audit({ action: "booking.requested", actorId: actor.user.id, targetType: "booking", targetId: b!.id, meta: { score: risk.score } }, tx);
      return b!.id;
    });
    return id;
  } catch (err) {
    if (err instanceof Error && /bookings_one_open_per_pair_uq/.test(err.message + String((err as { cause?: unknown }).cause ?? ""))) {
      throw new AppError("already_requested", 409, "You already have an open request with this mentor.");
    }
    throw err;
  }
}

// ─── Mentor decisions ───────────────────────────────────────────────────────

function weekBoundsBd(d: Date) {
  // ISO week (Mon–Sun) in Bangladesh time.
  const bd = new Date(d.getTime() + 6 * 3600_000);
  const day = (bd.getUTCDay() + 6) % 7;
  const start = Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate() - day) - 6 * 3600_000;
  return { start: new Date(start), end: new Date(start + 7 * 86400_000) };
}

export async function acceptBooking(actor: ResolvedSession, input: { id: string; slot: string; meetingUrl?: string }) {
  const { b, party } = await loadForParticipant(actor, input.id);
  if (party !== "mentor") throw new AppError("only_mentor_can_accept", 403);
  const slot = new Date(input.slot);
  if (input.meetingUrl && !isAllowedMeetingUrl(input.meetingUrl)) {
    throw new AppError("meeting_url_not_allowed", 400, `Use a link from: ${MEETING_HOSTS.join(", ")} — or leave it empty for a private Jitsi room.`);
  }
  const [mp] = await db().select({ capacity: mentorProfiles.weeklyCapacity }).from(mentorProfiles).where(eq(mentorProfiles.userId, actor.user.id));
  const { start, end } = weekBoundsBd(slot);
  const [load] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.mentorId, actor.user.id), inArray(bookings.status, CAPACITY_STATUSES), sql`${bookings.scheduledAt} >= ${start}`, sql`${bookings.scheduledAt} < ${end}`));
  if ((load?.n ?? 0) >= (mp?.capacity ?? 3)) {
    throw new AppError("weekly_capacity_reached", 409, "You've reached your weekly session capacity for that week. Choose another time or raise your capacity.");
  }
  await db().transaction(async (tx) => {
    await applyEvent(b, { type: "accept", by: "mentor", slot }, { meetingUrl: input.meetingUrl ?? defaultMeetingUrl(b.id), acceptedAt: new Date() }, tx);
    for (const [kind, before] of [["24h", 24 * 3600_000], ["1h", 3600_000]] as const) {
      const runAt = new Date(slot.getTime() - before);
      if (runAt.getTime() > Date.now()) await enqueue("booking_reminder", { bookingId: b.id, kind, scheduledAt: slot.toISOString() }, { runAt, tx });
    }
    await notify(b.menteeId, { kind: "booking_accepted", title: "Your session request was accepted", link: `/bookings/${b.id}`, email: true }, tx);
    await audit({ action: "booking.accepted", actorId: actor.user.id, targetType: "booking", targetId: b.id }, tx);
  });
}

export async function declineBooking(actor: ResolvedSession, input: { id: string; note: string }) {
  const { b, party } = await loadForParticipant(actor, input.id);
  if (party !== "mentor") throw new AppError("only_mentor_can_decline", 403);
  await db().transaction(async (tx) => {
    await applyEvent(b, { type: "decline", by: "mentor" }, { resolutionNote: input.note || null }, tx);
    await notify(b.menteeId, { kind: "booking_declined", title: "A mentor couldn't take your session request", body: "Try another mentor — the directory shows who is accepting requests.", link: "/mentors" }, tx);
    await audit({ action: "booking.declined", actorId: actor.user.id, targetType: "booking", targetId: b.id }, tx);
  });
}

export async function cancelBooking(actor: ResolvedSession, input: { id: string; reason: string }) {
  const { b, party } = await loadForParticipant(actor, input.id);
  await db().transaction(async (tx) => {
    const updated = await applyEvent(b, { type: "cancel", by: party }, { cancelReason: input.reason || null }, tx);
    const other = party === "mentor" ? b.menteeId : b.mentorId;
    await notify(other, { kind: "booking_cancelled", title: "A session was cancelled", link: `/bookings/${b.id}`, email: b.status === "accepted" }, tx);
    await audit({ action: "booking.cancelled", actorId: actor.user.id, targetType: "booking", targetId: b.id, meta: { by: party, late: updated.lateCancel } }, tx);
  });
  if (party === "mentor") await checkMentorReliability(b.mentorId);
}

// ─── Outcomes ───────────────────────────────────────────────────────────────

async function onCompleted(b: typeof bookings.$inferSelect, tx: DbOrTx) {
  await award({ userId: b.mentorId, kind: "session_completed", points: POINTS.session_completed, sourceType: "booking", sourceId: b.id, topicId: b.topicId }, tx);
  await refreshSessionBadges(b.mentorId, tx);
  await notify(b.menteeId, { kind: "feedback_request", title: "How was your session? Your feedback helps other students", link: `/bookings/${b.id}#feedback`, email: true }, tx);
  await notify(b.mentorId, { kind: "booking_completed", title: "Session confirmed as completed — thank you for helping", link: `/bookings/${b.id}` }, tx);
}

export async function reportOutcome(actor: ResolvedSession, input: { id: string; outcome: "happened" | "no_show" }) {
  const { b, party } = await loadForParticipant(actor, input.id);
  const updated = await db().transaction(async (tx) => {
    const u = await applyEvent(b, { type: "report_outcome", by: party, outcome: input.outcome }, {}, tx);
    if (u.status === "completed") await onCompleted(u, tx);
    if (u.status === "disputed") {
      for (const userId of [b.mentorId, b.menteeId]) {
        await notify(userId, { kind: "booking_disputed", title: "Your session reports don't match — a moderator will review", link: `/bookings/${b.id}` }, tx);
      }
    } else if (u.status === "accepted") {
      const other = party === "mentor" ? b.menteeId : b.mentorId;
      await notify(other, { kind: "booking_outcome", title: "Please confirm whether your session happened (72 hours)", link: `/bookings/${b.id}`, email: true }, tx);
    }
    await audit({ action: "booking.outcome_reported", actorId: actor.user.id, targetType: "booking", targetId: b.id, meta: { by: party, outcome: input.outcome, status: u.status } }, tx);
    return u;
  });
  if (updated.status === "disputed") await alertStaff("A session dispute needs a decision");
}

async function checkMentorReliability(mentorId: string) {
  const [c] = await db()
    .select({
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')::int`,
      noShows: sql<number>`count(*) filter (where ${bookings.status} = 'no_show_mentor')::int`,
      late: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled_by_mentor' and ${bookings.lateCancel})::int`,
    })
    .from(bookings)
    .where(and(eq(bookings.mentorId, mentorId), sql`${bookings.createdAt} > now() - interval '180 days'`));
  const r = summariseReliability({ completed: c?.completed ?? 0, noShowsByMentor: c?.noShows ?? 0, lateCancelsByMentor: c?.late ?? 0 });
  if (r.display && r.percent < AUTO_PAUSE_BELOW_PERCENT) {
    const paused = await db()
      .update(mentorProfiles)
      .set({ acceptingRequests: false })
      .where(and(eq(mentorProfiles.userId, mentorId), eq(mentorProfiles.acceptingRequests, true)))
      .returning({ id: mentorProfiles.userId });
    if (paused.length) {
      await notify(mentorId, { kind: "reliability", title: "New requests paused: too many missed or late-cancelled sessions", link: "/mentor", email: true });
      await audit({ action: "mentor.auto_paused_reliability", targetType: "user", targetId: mentorId, meta: { percent: r.percent } });
      await alertStaff("A mentor was auto-paused for low reliability");
    }
  }
}

// ─── Messages & feedback ────────────────────────────────────────────────────

export async function sendBookingMessage(actor: ResolvedSession, input: { id: string; body: string }) {
  const { b, party } = await loadForParticipant(actor, input.id);
  if (!canMessage(toState(b), new Date())) throw new AppError("messaging_closed", 409, "Messaging is closed for this booking.");
  const risk = evaluateRisk({ text: input.body, surface: "booking_message", authorTrustLevel: actor.user.trustLevel, authorAccountAgeMs: Date.now() - actor.user.createdAt.getTime() });
  if (risk.decision === "reject") throw new AppError("message_blocked", 400, publicReasons(risk).join(" "));
  const status = risk.decision === "hold" ? "held" : risk.decision === "flag" ? "flagged" : "published";
  await db().transaction(async (tx) => {
    const [m] = await tx
      .insert(bookingMessages)
      .values({ bookingId: b.id, senderId: actor.user.id, body: input.body, status, riskSignals: risk.signals.map((s) => ({ code: s.code, weight: s.weight })) })
      .returning({ id: bookingMessages.id });
    if (status !== "held") {
      await notify(party === "mentor" ? b.menteeId : b.mentorId, { kind: "booking_message", title: "New message about your session", link: `/bookings/${b.id}#messages` }, tx);
    }
    await audit({ action: "booking.message_sent", actorId: actor.user.id, targetType: "booking_message", targetId: m!.id, meta: { status, signals: risk.signals.map((s) => s.code) } }, tx);
  });
  return { status, reasons: publicReasons(risk) };
}

export async function leaveFeedback(actor: ResolvedSession, input: { id: string; helpfulness: number; knowledge: number; respect: number; comment: string }) {
  const { b, party } = await loadForParticipant(actor, input.id);
  if (!canLeaveFeedback(toState(b), party, new Date())) throw new AppError("feedback_not_allowed", 409, "Feedback is available to the student for 14 days after a completed session.");
  const risk = input.comment
    ? evaluateRisk({ text: input.comment, surface: "feedback", authorTrustLevel: actor.user.trustLevel, authorAccountAgeMs: Date.now() - actor.user.createdAt.getTime() })
    : null;
  const status = risk && (risk.decision === "hold" || risk.decision === "reject") ? "held" : "published";
  const scores = { helpfulness: input.helpfulness, knowledge: input.knowledge, respect: input.respect };
  try {
    await db().transaction(async (tx) => {
      const [f] = await tx
        .insert(feedback)
        .values({ bookingId: b.id, mentorId: b.mentorId, menteeId: b.menteeId, ...scores, comment: input.comment, status })
        .returning({ id: feedback.id });
      await award({ userId: b.mentorId, kind: "feedback", points: feedbackPoints(scores), sourceType: "feedback", sourceId: f!.id, topicId: b.topicId }, tx);
      if (needsSafetyReview(scores)) {
        await tx
          .insert(reports)
          .values({ reporterId: actor.user.id, targetType: "booking", targetId: b.id, targetUserId: b.mentorId, reason: "harassment", details: "Automatic: student rated respect/safety 2 or lower.", priority: 1, weight: 0 })
          .onConflictDoNothing();
      }
      await notify(b.mentorId, { kind: "feedback_received", title: "You received feedback on a session", link: "/mentor" }, tx);
      await audit({ action: "booking.feedback_left", actorId: actor.user.id, targetType: "feedback", targetId: f!.id, meta: scores }, tx);
    });
  } catch (err) {
    if (err instanceof Error && /feedback_booking_uq/.test(err.message + String((err as { cause?: unknown }).cause ?? ""))) {
      throw new AppError("feedback_exists", 409, "You've already left feedback for this session.");
    }
    throw err;
  }
  if (needsSafetyReview(scores)) await alertStaff("A session received a low safety/respect rating");
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function listMyBookings(userId: string) {
  return db()
    .select({
      id: bookings.id,
      status: bookings.status,
      subject: bookings.subject,
      scheduledAt: bookings.scheduledAt,
      proposedTimes: bookings.proposedTimes,
      createdAt: bookings.createdAt,
      mentorId: bookings.mentorId,
      menteeId: bookings.menteeId,
      durationMin: bookings.durationMin,
    })
    .from(bookings)
    .where(or(eq(bookings.mentorId, userId), eq(bookings.menteeId, userId)))
    .orderBy(desc(bookings.createdAt))
    .limit(100);
}

export async function getBookingForViewer(id: string, viewer: ResolvedSession) {
  const [b] = await db().select().from(bookings).where(eq(bookings.id, id));
  if (!b) return null;
  const staff = isStaffRole(viewer.user.role);
  const party: Party | null = b.mentorId === viewer.user.id ? "mentor" : b.menteeId === viewer.user.id ? "mentee" : null;
  if (!party && !staff) return null;
  const people = await db()
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, [b.mentorId, b.menteeId]));
  const messages = await db()
    .select()
    .from(bookingMessages)
    .where(and(eq(bookingMessages.bookingId, b.id), staff ? undefined : or(ne(bookingMessages.status, "held"), eq(bookingMessages.senderId, viewer.user.id))))
    .orderBy(asc(bookingMessages.createdAt));
  const [fb] = await db().select().from(feedback).where(eq(feedback.bookingId, b.id));
  const [offering] = await db().select().from(offerings).where(eq(offerings.id, b.offeringId));
  return {
    booking: b,
    party,
    staff,
    mentor: people.find((p) => p.id === b.mentorId)!,
    mentee: people.find((p) => p.id === b.menteeId)!,
    messages,
    feedback: fb ?? null,
    offering: offering ?? null,
  };
}

export async function listDisputes() {
  return db().select().from(bookings).where(eq(bookings.status, "disputed")).orderBy(asc(bookings.updatedAt));
}

export async function resolveDispute(staff: ResolvedSession, input: { id: string; resolution: "completed" | "no_show_mentor" | "no_show_mentee" | "cancelled_by_mentor" | "cancelled_by_mentee"; note: string }) {
  assertAllowed(staff, "staff.moderate");
  const [b] = await db().select().from(bookings).where(eq(bookings.id, input.id));
  if (!b) throw new AppError("not_found", 404);
  if (b.mentorId === staff.user.id || b.menteeId === staff.user.id) throw new AppError("conflict_of_interest", 403, "You can't resolve a dispute you're part of.");
  await db().transaction(async (tx) => {
    const u = await applyEvent(b, { type: "staff_resolve", resolution: input.resolution }, { resolutionNote: input.note }, tx);
    if (u.status === "completed") await onCompleted(u, tx);
    for (const userId of [b.mentorId, b.menteeId]) {
      await notify(userId, { kind: "dispute_resolved", title: "A moderator resolved your session dispute", body: input.note, link: `/bookings/${b.id}` }, tx);
    }
    await audit({ action: "booking.dispute_resolved", actorId: staff.user.id, targetType: "booking", targetId: b.id, meta: { resolution: input.resolution } }, tx);
  });
  if (input.resolution === "no_show_mentor") await checkMentorReliability(b.mentorId);
}

// ─── System jobs ────────────────────────────────────────────────────────────

export async function runBookingMaintenance(now = new Date()) {
  const expiring = await db().select().from(bookings).where(and(eq(bookings.status, "requested"), lte(bookings.requestExpiresAt, now))).limit(200);
  for (const b of expiring) {
    try {
      await db().transaction(async (tx) => {
        await applyEvent(b, { type: "expire" }, {}, tx);
        await notify(b.menteeId, { kind: "booking_expired", title: "Your session request expired without a reply", body: "Try another mentor who is accepting requests.", link: "/mentors" }, tx);
      });
    } catch {
      /* changed concurrently — fine */
    }
  }
  const pending = await db()
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "accepted"), or(lte(bookings.outcomeDeadline, now), lte(bookings.scheduledAt, new Date(now.getTime() - 7 * 86400_000)))))
    .limit(200);
  for (const b of pending) {
    try {
      const u = await db().transaction(async (tx) => {
        const updated = await applyEvent(b, { type: "auto_resolve" }, {}, tx);
        if (updated.status === "completed") await onCompleted(updated, tx);
        await audit({ action: "booking.auto_resolved", targetType: "booking", targetId: b.id, meta: { status: updated.status } }, tx);
        return updated;
      });
      if (u.status === "no_show_mentor") await checkMentorReliability(u.mentorId);
    } catch {
      /* nothing to resolve yet */
    }
  }
  return { expired: expiring.length, resolved: pending.length };
}
