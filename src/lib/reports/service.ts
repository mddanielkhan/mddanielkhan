import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { answers, bookingMessages, bookings, feedback, posts, reports, users } from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";
import type { ResolvedSession } from "@/lib/auth/session";
import { AppError } from "@/lib/http/errors";
import { COMMUNITY_HIDE_THRESHOLD, reportWeight } from "@/lib/trust/trust-level";
import { notify } from "@/lib/notify/notifications";
import { assertAllowed } from "@/lib/policy/policy";

export type ReportReason = (typeof reports.$inferSelect)["reason"];
export type ReportTarget = (typeof reports.$inferSelect)["targetType"];

/** P0 imminent harm … P3 standard. Scam lanes are P1 — answered within hours, not days. */
export const REASON_PRIORITY: Record<ReportReason, number> = {
  minor_safety: 0,
  self_harm: 0,
  sexual_content: 1,
  scam: 1,
  fake_opportunity: 1,
  off_platform_payment: 1,
  impersonation: 1,
  harassment: 2,
  hate: 2,
  privacy: 2,
  misinformation: 2,
  spam: 3,
  other: 3,
};

export const SLA_HOURS: Record<number, number> = { 0: 1, 1: 4, 2: 24, 3: 48 };

export const REASON_LABELS: Record<ReportReason, string> = {
  scam: "Scam or fraud",
  fake_opportunity: "Fake or misleading opportunity",
  off_platform_payment: "Asking for payment or moving off-platform",
  impersonation: "Impersonation",
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  sexual_content: "Sexual content",
  minor_safety: "Risk to a minor",
  self_harm: "Someone may be at risk of self-harm",
  privacy: "Shares private information",
  misinformation: "Dangerous misinformation",
  spam: "Spam",
  other: "Something else",
};

async function resolveTarget(type: ReportTarget, id: string, reporterId: string | null): Promise<{ userId: string | null }> {
  switch (type) {
    case "post": {
      const [p] = await db().select({ userId: posts.authorId, status: posts.status }).from(posts).where(eq(posts.id, id));
      if (!p || p.status === "deleted") throw new AppError("not_found", 404);
      return { userId: p.userId };
    }
    case "answer": {
      const [a] = await db().select({ userId: answers.authorId, status: answers.status }).from(answers).where(eq(answers.id, id));
      if (!a || a.status === "deleted") throw new AppError("not_found", 404);
      return { userId: a.userId };
    }
    case "user": {
      const [u] = await db().select({ id: users.id }).from(users).where(eq(users.id, id));
      if (!u) throw new AppError("not_found", 404);
      return { userId: u.id };
    }
    case "booking": {
      const [b] = await db().select().from(bookings).where(eq(bookings.id, id));
      // Only participants can report a private booking (no IDOR into other people's sessions).
      if (!b || (b.menteeId !== reporterId && b.mentorId !== reporterId)) throw new AppError("not_found", 404);
      return { userId: b.menteeId === reporterId ? b.mentorId : b.menteeId };
    }
    case "booking_message": {
      const [m] = await db()
        .select({ senderId: bookingMessages.senderId, mentorId: bookings.mentorId, menteeId: bookings.menteeId })
        .from(bookingMessages)
        .innerJoin(bookings, eq(bookings.id, bookingMessages.bookingId))
        .where(eq(bookingMessages.id, id));
      if (!m || (m.mentorId !== reporterId && m.menteeId !== reporterId)) throw new AppError("not_found", 404);
      return { userId: m.senderId };
    }
    case "feedback": {
      const [f] = await db().select({ menteeId: feedback.menteeId, mentorId: feedback.mentorId }).from(feedback).where(eq(feedback.id, id));
      // Mentors may report a review left about them (e.g. retaliation or extortion).
      if (!f || f.mentorId !== reporterId) throw new AppError("not_found", 404);
      return { userId: f.menteeId };
    }
  }
}

export async function createReport(actor: ResolvedSession, input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details: string }) {
  assertAllowed(actor, "report.create");
  const target = await resolveTarget(input.targetType, input.targetId, actor.user.id);
  if (target.userId === actor.user.id) throw new AppError("cannot_report_self", 400, "You can't report your own content.");
  const priority = REASON_PRIORITY[input.reason];
  const weight = reportWeight(actor.user.trustLevel);
  const inserted = await db()
    .insert(reports)
    .values({ reporterId: actor.user.id, targetType: input.targetType, targetId: input.targetId, targetUserId: target.userId, reason: input.reason, details: input.details, priority, weight })
    .onConflictDoNothing()
    .returning({ id: reports.id });
  if (!inserted[0]) throw new AppError("already_reported", 409, "You've already reported this. Our team will review it.");
  await audit({ action: "report.created", actorId: actor.user.id, targetType: input.targetType, targetId: input.targetId, meta: { reason: input.reason, priority } });

  if (input.targetType === "post" || input.targetType === "answer") await maybeCommunityHide(input.targetType, input.targetId);
  if (priority === 0) await alertStaff(`Urgent report (P0): ${REASON_LABELS[input.reason]}`);
  return inserted[0].id;
}

/** Enough weighted reports from established members hide content pending review — never auto-remove. */
async function maybeCommunityHide(type: "post" | "answer", id: string) {
  const [sum] = await db()
    .select({ w: sql<number>`coalesce(sum(${reports.weight}),0)::int` })
    .from(reports)
    .where(and(eq(reports.targetType, type), eq(reports.targetId, id), eq(reports.status, "open")));
  if ((sum?.w ?? 0) < COMMUNITY_HIDE_THRESHOLD) return;
  const table = type === "post" ? posts : answers;
  const hidden = await db()
    .update(table)
    .set({ status: "held", flagWeight: sum!.w })
    .where(and(eq(table.id, id), inArray(table.status, ["published", "flagged"])))
    .returning({ id: table.id });
  if (hidden.length) await audit({ action: "content.community_hidden", targetType: type, targetId: id, meta: { weight: sum!.w } });
}

export async function alertStaff(title: string) {
  const staff = await db()
    .select({ id: users.id })
    .from(users)
    .where(and(or(eq(users.role, "moderator"), eq(users.role, "admin")), eq(users.status, "active")));
  for (const s of staff) await notify(s.id, { kind: "staff_alert", title, link: "/mod/reports", email: true });
}

/** Public notice-and-action intake (works for people without an account — most scam victims aren't users yet). */
export async function createPublicReport(input: { url: string; reason: ReportReason; details: string; contact: string }) {
  let path = input.url.trim();
  try {
    path = new URL(path, "https://x.invalid").pathname;
  } catch {
    throw new AppError("invalid_url", 400);
  }
  const postMatch = /^\/posts\/([0-9a-f-]{36})/.exec(path);
  const userMatch = /^\/u\/([a-z0-9_]{3,24})/.exec(path);
  let targetType: ReportTarget;
  let targetId: string;
  let targetUserId: string | null = null;
  if (postMatch) {
    const [p] = await db().select({ id: posts.id, authorId: posts.authorId }).from(posts).where(eq(posts.id, postMatch[1]!));
    if (!p) throw new AppError("target_not_found", 404, "We couldn't find that post. Check the link.");
    targetType = "post";
    targetId = p.id;
    targetUserId = p.authorId;
  } else if (userMatch) {
    const [u] = await db().select({ id: users.id }).from(users).where(eq(users.username, userMatch[1]!));
    if (!u) throw new AppError("target_not_found", 404, "We couldn't find that profile. Check the link.");
    targetType = "user";
    targetId = u.id;
    targetUserId = u.id;
  } else {
    throw new AppError("invalid_url", 400, "Paste the link of a specific post (/posts/…) or profile (/u/…). For anything else, email us.");
  }
  const priority = REASON_PRIORITY[input.reason];
  const [r] = await db()
    .insert(reports)
    .values({ reporterId: null, reporterContact: input.contact, targetType, targetId, targetUserId, reason: input.reason, details: input.details, priority, weight: 0 })
    .returning({ id: reports.id });
  await audit({ action: "report.public_created", targetType, targetId, meta: { reason: input.reason, priority, reportId: r!.id } });
  if (priority <= 1) await alertStaff(`Public report (P${priority}): ${REASON_LABELS[input.reason]}`);
  return r!.id;
}
