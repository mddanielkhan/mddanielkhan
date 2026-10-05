/**
 * Reliability — dependability from booking telemetry only (no opinions, so it
 * cannot be review-bombed). Public on mentor profiles: hiding no-shows is how
 * free mentoring platforms burn students (a documented ADPList complaint).
 */

export type ReliabilityInputs = { completed: number; noShowsByMentor: number; lateCancelsByMentor: number };

export type ReliabilitySummary = { display: false } | { display: true; percent: number; band: "excellent" | "good" | "mixed" | "at_risk"; basis: number };

export const MIN_SESSIONS_FOR_RELIABILITY = 3;

export function summariseReliability(i: ReliabilityInputs): ReliabilitySummary {
  // A late cancellation is half as bad as a no-show.
  const basis = i.completed + i.noShowsByMentor + i.lateCancelsByMentor;
  if (basis < MIN_SESSIONS_FOR_RELIABILITY) return { display: false };
  const failures = i.noShowsByMentor + 0.5 * i.lateCancelsByMentor;
  const percent = Math.max(0, Math.round((1 - failures / basis) * 100));
  const band = percent >= 95 ? "excellent" : percent >= 85 ? "good" : percent >= 70 ? "mixed" : "at_risk";
  return { display: true, percent, band, basis };
}

/** Below this, a mentor stops receiving new requests until a moderator reviews (protects students). */
export const AUTO_PAUSE_BELOW_PERCENT = 60;
