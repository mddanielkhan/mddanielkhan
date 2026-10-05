/**
 * Booking lifecycle — a pure, exhaustively tested state machine.
 *
 *   requested ──accept──▶ accepted ──(both confirm / one confirms + 72 h)──▶ completed
 *       │ decline/cancel/expire          │ cancel (before start)
 *       ▼                                ▼
 *   declined · cancelled_* · expired   cancelled_by_mentee | cancelled_by_mentor (late if < 24 h)
 *
 *   accepted ──conflicting reports──▶ disputed ──staff decision──▶ completed | no_show_* | cancelled_*
 *   accepted ──one "no-show" report + 72 h unanswered──▶ no_show_mentor | no_show_mentee
 *
 * Improvement over both earlier blueprints: completion is never decided by one
 * side alone. Mentor-only confirmation (Pathshala) lets a mentor farm fake
 * sessions; dual check-in/out (the Shikor blueprint) needs live telemetry we do not have
 * without our own video stack. Here: both confirm, or one confirms and the
 * other has 72 h to dispute — and every dispute goes to a human.
 */

export type BookingStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled_by_mentee"
  | "cancelled_by_mentor"
  | "completed"
  | "no_show_mentor"
  | "no_show_mentee"
  | "disputed";

export type Party = "mentor" | "mentee";
export type Outcome = "happened" | "no_show";

export type BookingState = {
  status: BookingStatus;
  proposedTimes: Date[];
  durationMin: number;
  scheduledAt: Date | null;
  requestExpiresAt: Date;
  mentorOutcome: Outcome | null;
  menteeOutcome: Outcome | null;
  outcomeDeadline: Date | null;
  completedAt: Date | null;
};

export type BookingEvent =
  | { type: "accept"; by: Party; slot: Date }
  | { type: "decline"; by: Party }
  | { type: "cancel"; by: Party }
  | { type: "report_outcome"; by: Party; outcome: Outcome }
  | { type: "expire" }
  | { type: "auto_resolve" }
  | { type: "staff_resolve"; resolution: "completed" | "no_show_mentor" | "no_show_mentee" | "cancelled_by_mentor" | "cancelled_by_mentee" };

export type BookingPatch = Partial<BookingState> & { lateCancel?: boolean; closedAt?: Date };
export type TransitionResult = { ok: true; patch: BookingPatch } | { ok: false; error: string };

export const TERMINAL: ReadonlySet<BookingStatus> = new Set([
  "declined",
  "expired",
  "cancelled_by_mentee",
  "cancelled_by_mentor",
  "completed",
  "no_show_mentor",
  "no_show_mentee",
]);

export const RULES = {
  requestTtlMs: 72 * 3600_000,
  minLeadTimeMs: 12 * 3600_000,
  maxLeadTimeMs: 30 * 86400_000,
  acceptMinLeadMs: 60 * 60_000,
  lateCancelWindowMs: 24 * 3600_000,
  outcomeGraceMs: 15 * 60_000,
  disputeWindowMs: 72 * 3600_000,
  unconfirmedCloseMs: 7 * 86400_000,
  feedbackWindowMs: 14 * 86400_000,
  messageWindowAfterMs: 7 * 86400_000,
} as const;

const ok = (patch: BookingPatch): TransitionResult => ({ ok: true, patch });
const fail = (error: string): TransitionResult => ({ ok: false, error });

/** Validate a mentee's proposed times (1–3, ≥ 12 h ahead, ≤ 30 days ahead, distinct). */
export function validateProposedTimes(times: Date[], now: Date): string | null {
  if (times.length < 1 || times.length > 3) return "propose_1_to_3_times";
  const keys = new Set(times.map((t) => t.getTime()));
  if (keys.size !== times.length) return "duplicate_times";
  for (const t of times) {
    if (Number.isNaN(t.getTime())) return "invalid_time";
    if (t.getTime() - now.getTime() < RULES.minLeadTimeMs) return "time_too_soon";
    if (t.getTime() - now.getTime() > RULES.maxLeadTimeMs) return "time_too_far";
  }
  return null;
}

/** Request expires after 72 h or at the earliest proposed time, whichever is first. */
export function requestExpiry(createdAt: Date, proposedTimes: Date[]): Date {
  const earliest = Math.min(...proposedTimes.map((t) => t.getTime()));
  return new Date(Math.min(createdAt.getTime() + RULES.requestTtlMs, earliest));
}

function sessionStartPassed(s: BookingState, now: Date, graceMs = 0) {
  return !!s.scheduledAt && now.getTime() >= s.scheduledAt.getTime() + graceMs;
}

function resolveOutcomes(mentor: Outcome | null, mentee: Outcome | null): BookingStatus | null {
  if (mentor && mentee) return mentor === "happened" && mentee === "happened" ? "completed" : "disputed";
  return null;
}

export function transition(s: BookingState, e: BookingEvent, now: Date): TransitionResult {
  if (TERMINAL.has(s.status)) return fail("booking_closed");

  switch (e.type) {
    case "accept": {
      if (e.by !== "mentor") return fail("only_mentor_can_accept");
      if (s.status !== "requested") return fail("not_requested");
      if (now >= s.requestExpiresAt) return fail("request_expired");
      if (!s.proposedTimes.some((t) => t.getTime() === e.slot.getTime())) return fail("slot_not_proposed");
      if (e.slot.getTime() - now.getTime() < RULES.acceptMinLeadMs) return fail("slot_too_soon");
      return ok({ status: "accepted", scheduledAt: e.slot });
    }

    case "decline": {
      if (e.by !== "mentor") return fail("only_mentor_can_decline");
      if (s.status !== "requested") return fail("not_requested");
      return ok({ status: "declined", closedAt: now });
    }

    case "cancel": {
      if (s.status === "requested") {
        return e.by === "mentee" ? ok({ status: "cancelled_by_mentee", closedAt: now }) : fail("mentor_should_decline");
      }
      if (s.status !== "accepted") return fail("cannot_cancel_now");
      if (sessionStartPassed(s, now)) return fail("session_started_report_outcome_instead");
      const late = !!s.scheduledAt && s.scheduledAt.getTime() - now.getTime() < RULES.lateCancelWindowMs;
      return ok({ status: e.by === "mentor" ? "cancelled_by_mentor" : "cancelled_by_mentee", lateCancel: late, closedAt: now });
    }

    case "report_outcome": {
      if (s.status !== "accepted") return fail("cannot_report_now");
      if (!sessionStartPassed(s, now, RULES.outcomeGraceMs)) return fail("too_early_to_report");
      const already = e.by === "mentor" ? s.mentorOutcome : s.menteeOutcome;
      if (already) return fail("outcome_already_recorded");
      const mentorOutcome = e.by === "mentor" ? e.outcome : s.mentorOutcome;
      const menteeOutcome = e.by === "mentee" ? e.outcome : s.menteeOutcome;
      const resolved = resolveOutcomes(mentorOutcome, menteeOutcome);
      if (resolved === "completed") return ok({ status: "completed", mentorOutcome, menteeOutcome, completedAt: now, closedAt: now });
      if (resolved === "disputed") return ok({ status: "disputed", mentorOutcome, menteeOutcome });
      return ok({ mentorOutcome, menteeOutcome, outcomeDeadline: new Date(now.getTime() + RULES.disputeWindowMs) });
    }

    case "expire": {
      if (s.status !== "requested") return fail("not_requested");
      if (now < s.requestExpiresAt) return fail("not_yet_expired");
      return ok({ status: "expired", closedAt: now });
    }

    case "auto_resolve": {
      if (s.status !== "accepted") return fail("not_accepted");
      const single = s.mentorOutcome ?? s.menteeOutcome;
      if (single && s.outcomeDeadline && now >= s.outcomeDeadline) {
        // Exactly one side reported and the other did not dispute within 72 h.
        if (single === "happened") return ok({ status: "completed", completedAt: now, closedAt: now });
        // "no_show" reported by X means the OTHER party did not show.
        return ok({ status: s.mentorOutcome ? "no_show_mentee" : "no_show_mentor", closedAt: now });
      }
      if (!single && s.scheduledAt && now.getTime() >= s.scheduledAt.getTime() + RULES.unconfirmedCloseMs) {
        // Nobody confirmed anything within 7 days: close neutrally (no reputation either way).
        return ok({ status: "expired", closedAt: now });
      }
      return fail("nothing_to_resolve");
    }

    case "staff_resolve": {
      if (s.status !== "disputed") return fail("not_disputed");
      return ok({ status: e.resolution, closedAt: now, ...(e.resolution === "completed" ? { completedAt: now } : {}) });
    }

    default: {
      const exhaustive: never = e;
      void exhaustive;
      return fail("unknown_event");
    }
  }
}

export function canLeaveFeedback(s: Pick<BookingState, "status" | "completedAt">, party: Party, now: Date) {
  return party === "mentee" && s.status === "completed" && !!s.completedAt && now.getTime() - s.completedAt.getTime() <= RULES.feedbackWindowMs;
}

export function canMessage(s: Pick<BookingState, "status" | "completedAt">, now: Date) {
  if (s.status === "requested" || s.status === "accepted" || s.status === "disputed") return true;
  if (s.status === "completed" && s.completedAt) return now.getTime() - s.completedAt.getTime() <= RULES.messageWindowAfterMs;
  return false;
}

/** Statuses that hold a mentor's weekly capacity. */
export const CAPACITY_STATUSES: BookingStatus[] = ["accepted", "completed", "disputed", "no_show_mentee"];
