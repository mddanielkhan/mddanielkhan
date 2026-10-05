import { describe, expect, it } from "vitest";
import { canLeaveFeedback, canMessage, requestExpiry, RULES, transition, validateProposedTimes, type BookingState } from "@/lib/booking/state-machine";

const H = 3600_000;
const now = new Date("2026-10-05T10:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * H);

const base = (over: Partial<BookingState> = {}): BookingState => ({
  status: "requested",
  proposedTimes: [at(24), at(48)],
  durationMin: 30,
  scheduledAt: null,
  requestExpiresAt: at(24),
  mentorOutcome: null,
  menteeOutcome: null,
  outcomeDeadline: null,
  completedAt: null,
  ...over,
});
const accepted = (over: Partial<BookingState> = {}) => base({ status: "accepted", scheduledAt: at(24), ...over });
const apply = (s: BookingState, patch: object) => ({ ...s, ...patch }) as BookingState;

describe("proposed times", () => {
  it("accepts 1–3 future distinct times within 12h–30d", () => {
    expect(validateProposedTimes([at(13)], now)).toBeNull();
    expect(validateProposedTimes([at(13), at(14), at(15)], now)).toBeNull();
  });
  it("rejects bad inputs", () => {
    expect(validateProposedTimes([], now)).toBe("propose_1_to_3_times");
    expect(validateProposedTimes([at(13), at(14), at(15), at(16)], now)).toBe("propose_1_to_3_times");
    expect(validateProposedTimes([at(13), at(13)], now)).toBe("duplicate_times");
    expect(validateProposedTimes([at(2)], now)).toBe("time_too_soon");
    expect(validateProposedTimes([at(24 * 31)], now)).toBe("time_too_far");
    expect(validateProposedTimes([new Date("nope")], now)).toBe("invalid_time");
  });
  it("expires at 72h or the earliest proposed time", () => {
    expect(requestExpiry(now, [at(100)]).getTime()).toBe(now.getTime() + RULES.requestTtlMs);
    expect(requestExpiry(now, [at(20), at(100)]).getTime()).toBe(at(20).getTime());
  });
});

describe("accept / decline / cancel", () => {
  it("only the mentor accepts, only a proposed slot, before expiry", () => {
    expect(transition(base(), { type: "accept", by: "mentee", slot: at(24) }, now)).toEqual({ ok: false, error: "only_mentor_can_accept" });
    expect(transition(base(), { type: "accept", by: "mentor", slot: at(30) }, now)).toEqual({ ok: false, error: "slot_not_proposed" });
    expect(transition(base(), { type: "accept", by: "mentor", slot: at(24) }, at(25))).toEqual({ ok: false, error: "request_expired" });
    const r = transition(base(), { type: "accept", by: "mentor", slot: at(48) }, now);
    expect(r).toEqual({ ok: true, patch: { status: "accepted", scheduledAt: at(48) } });
  });
  it("refuses to accept a slot that starts within the hour", () => {
    const s = base({ proposedTimes: [at(0.5)], requestExpiresAt: at(0.5) });
    expect(transition(s, { type: "accept", by: "mentor", slot: at(0.5) }, now)).toEqual({ ok: false, error: "slot_too_soon" });
  });
  it("declines only by mentor and only while requested", () => {
    expect(transition(base(), { type: "decline", by: "mentee" }, now).ok).toBe(false);
    expect(transition(base(), { type: "decline", by: "mentor" }, now)).toMatchObject({ ok: true, patch: { status: "declined" } });
    expect(transition(accepted(), { type: "decline", by: "mentor" }, now).ok).toBe(false);
  });
  it("mentee withdraws a request; mentor must decline instead of cancel", () => {
    expect(transition(base(), { type: "cancel", by: "mentee" }, now)).toMatchObject({ ok: true, patch: { status: "cancelled_by_mentee" } });
    expect(transition(base(), { type: "cancel", by: "mentor" }, now)).toEqual({ ok: false, error: "mentor_should_decline" });
  });
  it("marks mentor cancellations within 24h as late", () => {
    expect(transition(accepted({ scheduledAt: at(20) }), { type: "cancel", by: "mentor" }, now)).toMatchObject({ ok: true, patch: { status: "cancelled_by_mentor", lateCancel: true } });
    expect(transition(accepted({ scheduledAt: at(48) }), { type: "cancel", by: "mentor" }, now)).toMatchObject({ patch: { lateCancel: false } });
  });
  it("cannot cancel after the session started", () => {
    expect(transition(accepted(), { type: "cancel", by: "mentee" }, at(25))).toEqual({ ok: false, error: "session_started_report_outcome_instead" });
  });
});

describe("outcomes", () => {
  const after = at(24.5);
  it("is too early before start + grace", () => {
    expect(transition(accepted(), { type: "report_outcome", by: "mentor", outcome: "happened" }, at(24.1))).toEqual({ ok: false, error: "too_early_to_report" });
  });
  it("completes when both confirm", () => {
    const r1 = transition(accepted(), { type: "report_outcome", by: "mentor", outcome: "happened" }, after);
    expect(r1).toMatchObject({ ok: true, patch: { mentorOutcome: "happened" } });
    const s1 = apply(accepted(), (r1 as { patch: object }).patch);
    const r2 = transition(s1, { type: "report_outcome", by: "mentee", outcome: "happened" }, after);
    expect(r2).toMatchObject({ ok: true, patch: { status: "completed", completedAt: after } });
  });
  it("disputes conflicting reports", () => {
    const s1 = accepted({ mentorOutcome: "happened" });
    expect(transition(s1, { type: "report_outcome", by: "mentee", outcome: "no_show" }, after)).toMatchObject({ patch: { status: "disputed" } });
    const s2 = accepted({ mentorOutcome: "no_show" });
    expect(transition(s2, { type: "report_outcome", by: "mentee", outcome: "no_show" }, after)).toMatchObject({ patch: { status: "disputed" } });
  });
  it("forbids double reporting", () => {
    expect(transition(accepted({ mentorOutcome: "happened" }), { type: "report_outcome", by: "mentor", outcome: "no_show" }, after)).toEqual({
      ok: false,
      error: "outcome_already_recorded",
    });
  });
  it("auto-resolves a single unanswered report after 72h", () => {
    const deadline = at(24.5 + 72);
    const happened = accepted({ mentorOutcome: "happened", outcomeDeadline: deadline });
    expect(transition(happened, { type: "auto_resolve" }, at(24))).toEqual({ ok: false, error: "nothing_to_resolve" });
    expect(transition(happened, { type: "auto_resolve" }, deadline)).toMatchObject({ patch: { status: "completed" } });
    const mentorSaysNoShow = accepted({ mentorOutcome: "no_show", outcomeDeadline: deadline });
    expect(transition(mentorSaysNoShow, { type: "auto_resolve" }, deadline)).toMatchObject({ patch: { status: "no_show_mentee" } });
    const menteeSaysNoShow = accepted({ menteeOutcome: "no_show", outcomeDeadline: deadline });
    expect(transition(menteeSaysNoShow, { type: "auto_resolve" }, deadline)).toMatchObject({ patch: { status: "no_show_mentor" } });
  });
  it("closes unconfirmed sessions neutrally after 7 days", () => {
    expect(transition(accepted(), { type: "auto_resolve" }, at(24 + 24 * 7))).toMatchObject({ patch: { status: "expired" } });
  });
  it("lets staff resolve disputes only", () => {
    expect(transition(accepted(), { type: "staff_resolve", resolution: "completed" }, now).ok).toBe(false);
    expect(transition(accepted({ status: "disputed" }), { type: "staff_resolve", resolution: "no_show_mentor" }, now)).toMatchObject({
      patch: { status: "no_show_mentor" },
    });
  });
});

describe("expiry and terminal states", () => {
  it("expires requests only after the deadline", () => {
    expect(transition(base(), { type: "expire" }, at(1)).ok).toBe(false);
    expect(transition(base(), { type: "expire" }, at(24))).toMatchObject({ patch: { status: "expired" } });
  });
  it("rejects every event on terminal bookings", () => {
    for (const status of ["declined", "expired", "completed", "cancelled_by_mentee", "no_show_mentor"] as const) {
      expect(transition(base({ status }), { type: "cancel", by: "mentee" }, now)).toEqual({ ok: false, error: "booking_closed" });
    }
  });
});

describe("feedback and messaging windows", () => {
  const done = { status: "completed" as const, completedAt: now };
  it("only the mentee, only after completion, within 14 days", () => {
    expect(canLeaveFeedback(done, "mentee", at(24))).toBe(true);
    expect(canLeaveFeedback(done, "mentor", at(24))).toBe(false);
    expect(canLeaveFeedback(done, "mentee", at(24 * 15))).toBe(false);
    expect(canLeaveFeedback({ status: "accepted", completedAt: null }, "mentee", now)).toBe(false);
  });
  it("messages allowed while active and 7 days after completion", () => {
    expect(canMessage({ status: "requested", completedAt: null }, now)).toBe(true);
    expect(canMessage(done, at(24 * 6))).toBe(true);
    expect(canMessage(done, at(24 * 8))).toBe(false);
    expect(canMessage({ status: "declined", completedAt: null }, now)).toBe(false);
  });
});
