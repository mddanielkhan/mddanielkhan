/**
 * Displayed mentor rating — completion-gated, multi-axis, shrunk toward a prior.
 *
 * Why shrinkage: without it, one 5★ review reads "5.0" and outranks a 4.8 from
 * 120 sessions. Bayesian averaging ((n·x̄ + m·μ)/(n + m)) makes a new mentor
 * start near the prior and climb as evidence accumulates.
 *
 * Why a minimum n: never show a number on fewer than 3 reviews ("New mentor").
 * Why response rate: "40 sessions, 2 reviews" is information students deserve.
 */

export const PRIOR_MEAN = 4.0;
export const PRIOR_STRENGTH = 5;
export const MIN_REVIEWS_TO_DISPLAY = 3;
export const AXIS_WEIGHTS = { helpfulness: 0.4, knowledge: 0.4, respect: 0.2 } as const;

export type Review = { helpfulness: number; knowledge: number; respect: number };

export type RatingSummary =
  | { display: false; reviews: number; completedSessions: number }
  | {
      display: true;
      score: number;
      reviews: number;
      completedSessions: number;
      responseRate: number;
      axes: { helpfulness: number; knowledge: number; respect: number };
    };

function shrink(sum: number, n: number) {
  return (sum + PRIOR_MEAN * PRIOR_STRENGTH) / (n + PRIOR_STRENGTH);
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function summariseRatings(reviews: Review[], completedSessions: number): RatingSummary {
  const n = reviews.length;
  if (n < MIN_REVIEWS_TO_DISPLAY) return { display: false, reviews: n, completedSessions };
  const sums = reviews.reduce(
    (acc, r) => ({ helpfulness: acc.helpfulness + r.helpfulness, knowledge: acc.knowledge + r.knowledge, respect: acc.respect + r.respect }),
    { helpfulness: 0, knowledge: 0, respect: 0 },
  );
  const axes = { helpfulness: shrink(sums.helpfulness, n), knowledge: shrink(sums.knowledge, n), respect: shrink(sums.respect, n) };
  const score = axes.helpfulness * AXIS_WEIGHTS.helpfulness + axes.knowledge * AXIS_WEIGHTS.knowledge + axes.respect * AXIS_WEIGHTS.respect;
  return {
    display: true,
    score: round1(score),
    reviews: n,
    completedSessions,
    responseRate: completedSessions > 0 ? Math.min(1, n / completedSessions) : 0,
    axes: { helpfulness: round1(axes.helpfulness), knowledge: round1(axes.knowledge), respect: round1(axes.respect) },
  };
}

/** Reputation points awarded to a mentor for one review (bounded; asymmetric penalties). */
export function feedbackPoints(r: Review): number {
  const avg = (r.helpfulness + r.knowledge + r.respect) / 3;
  if (avg >= 4) return 5;
  if (avg >= 3) return 1;
  if (avg >= 2) return 0;
  return -5;
}

/** A respect score ≤ 2 always triggers a safety review, whatever the other axes say. */
export function needsSafetyReview(r: Review) {
  return r.respect <= 2;
}
