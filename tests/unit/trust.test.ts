import { describe, expect, it } from "vitest";
import { computeTrustLevel, explainTrustLevel, reportWeight, trustLevelName, type TrustInputs } from "@/lib/trust/trust-level";
import { feedbackPoints, needsSafetyReview, summariseRatings } from "@/lib/trust/rating";
import { summariseReliability } from "@/lib/trust/reliability";

const blank: TrustInputs = {
  accountAgeDays: 0,
  emailVerified: false,
  daysVisited: 0,
  publishedContributions: 0,
  helpfulVotesReceived: 0,
  acceptedAnswers: 0,
  upheldReportsFiled: 0,
  activeStrikes: 0,
  strikesLast180Days: 0,
  removedContentLast90Days: 0,
  appointedLeader: false,
};
const tl1 = { ...blank, accountAgeDays: 3, emailVerified: true, daysVisited: 3, publishedContributions: 1 };
const tl2 = { ...tl1, accountAgeDays: 30, daysVisited: 10, publishedContributions: 10, helpfulVotesReceived: 10 };
const tl3 = { ...tl2, accountAgeDays: 90, daysVisited: 45, publishedContributions: 30, helpfulVotesReceived: 50, acceptedAnswers: 3, upheldReportsFiled: 3 };

describe("trust levels", () => {
  it("promotes stepwise on observable behaviour", () => {
    expect(computeTrustLevel(blank)).toBe(0);
    expect(computeTrustLevel(tl1)).toBe(1);
    expect(computeTrustLevel(tl2)).toBe(2);
    expect(computeTrustLevel(tl3)).toBe(3);
  });
  it("cannot skip levels", () => {
    expect(computeTrustLevel({ ...tl3, emailVerified: false })).toBe(0);
  });
  it("demotes on violations (TL3 must be maintained)", () => {
    expect(computeTrustLevel({ ...tl3, removedContentLast90Days: 1 })).toBe(2);
    expect(computeTrustLevel({ ...tl3, strikesLast180Days: 1 })).toBe(1);
    expect(computeTrustLevel({ ...tl3, activeStrikes: 1, strikesLast180Days: 1 })).toBe(0);
  });
  it("TL4 only by appointment and only without active strikes", () => {
    expect(computeTrustLevel({ ...blank, appointedLeader: true })).toBe(4);
    expect(computeTrustLevel({ ...tl3, appointedLeader: true, activeStrikes: 1 })).toBe(0);
  });
  it("explains what the next level needs", () => {
    const e = explainTrustLevel({ ...tl1, daysVisited: 5 });
    expect(e.current).toBe(1);
    expect(e.next?.level).toBe(2);
    expect(e.next?.requirements.find((r) => r.label.includes("10 different days"))?.progress).toBe("5/10");
  });
  it("weights reports by trust", () => {
    expect([0, 1, 2, 3, 4].map(reportWeight)).toEqual([0, 1, 2, 3, 3]);
  });
});

describe("ratings", () => {
  const five = { helpfulness: 5, knowledge: 5, respect: 5 };
  it("hides ratings below 3 reviews", () => {
    expect(summariseRatings([five, five], 2)).toEqual({ display: false, reviews: 2, completedSessions: 2 });
  });
  it("shrinks small samples toward the prior so 3 perfect reviews ≠ 5.0", () => {
    const r = summariseRatings([five, five, five], 3);
    expect(r.display && r.score).toBeCloseTo(4.4, 1);
  });
  it("converges to the true mean with evidence", () => {
    const r = summariseRatings(Array.from({ length: 200 }, () => five), 220);
    expect(r.display && r.score).toBeGreaterThanOrEqual(4.9);
    expect(r.display && r.responseRate).toBeCloseTo(200 / 220, 3);
  });
  it("awards bounded, asymmetric points", () => {
    expect(feedbackPoints(five)).toBe(5);
    expect(feedbackPoints({ helpfulness: 3, knowledge: 3, respect: 3 })).toBe(1);
    expect(feedbackPoints({ helpfulness: 1, knowledge: 1, respect: 1 })).toBe(-5);
  });
  it("flags any low respect score for safety review", () => {
    expect(needsSafetyReview({ helpfulness: 5, knowledge: 5, respect: 2 })).toBe(true);
    expect(needsSafetyReview(five)).toBe(false);
  });
});

describe("reliability", () => {
  it("needs at least 3 sessions", () => {
    expect(summariseReliability({ completed: 2, noShowsByMentor: 0, lateCancelsByMentor: 0 })).toEqual({ display: false });
  });
  it("counts late cancels as half a no-show", () => {
    expect(summariseReliability({ completed: 18, noShowsByMentor: 1, lateCancelsByMentor: 1 })).toEqual({ display: true, percent: 93, band: "good", basis: 20 });
    expect(summariseReliability({ completed: 20, noShowsByMentor: 0, lateCancelsByMentor: 0 })).toMatchObject({ percent: 100, band: "excellent" });
    expect(summariseReliability({ completed: 3, noShowsByMentor: 3, lateCancelsByMentor: 0 })).toMatchObject({ band: "at_risk" });
  });
});

describe("trust level explanations", () => {
  it("explains every requirement type with progress text", () => {
    const fresh = explainTrustLevel(blank);
    expect(fresh.currentName).toBe("New");
    const labels = fresh.next!.requirements.map((r) => `${r.label}:${r.progress}:${r.met}`);
    expect(labels).toEqual(expect.arrayContaining(["Verified email:not yet:false", "No active strikes:done:true"]));
    const struck = explainTrustLevel({ ...blank, activeStrikes: 1 });
    expect(struck.next!.requirements.find((r) => r.label === "No active strikes")?.progress).toBe("active strike");
    const tl1Strike = explainTrustLevel({ ...tl2, strikesLast180Days: 1, activeStrikes: 0 });
    expect(tl1Strike.current).toBe(1);
    expect(tl1Strike.next!.requirements.find((r) => r.label.startsWith("No strikes"))?.progress).toBe("recent strike");
    const tl2v = explainTrustLevel({ ...tl3, removedContentLast90Days: 1 });
    expect(tl2v.next!.requirements.find((r) => r.label.startsWith("No strikes in 180"))?.progress).toBe("recent violation");
    expect(explainTrustLevel({ ...tl3, upheldReportsFiled: 3 }).next).toBeNull();
    expect(explainTrustLevel({ ...blank, appointedLeader: true }).currentName).toBe("Leader");
  });
  it("anchors the explanation to the level the member holds", () => {
    // Stored levels change at the daily recompute, so live inputs can be ahead of (or behind) them.
    const ahead = explainTrustLevel(tl2, 1);
    expect(ahead).toMatchObject({ current: 1, currentName: "Basic", next: { level: 2 }, promotionPending: true });
    const behind = explainTrustLevel(tl1, 2);
    expect(behind).toMatchObject({ current: 2, currentName: "Member", next: { level: 3 }, promotionPending: false });
    expect(explainTrustLevel(tl1, 1).promotionPending).toBe(false);
    expect(explainTrustLevel(tl3, 3).next).toBeNull();
    expect(explainTrustLevel(blank, 4)).toMatchObject({ currentName: "Leader", next: null, promotionPending: false });
  });
  it("names levels", () => {
    expect([0, 1, 2, 3, 4, 9].map(trustLevelName)).toEqual(["New", "Basic", "Member", "Regular", "Leader", "New"]);
  });
  it("handles zero completed sessions in response rate", () => {
    const r = summariseRatings([{ helpfulness: 4, knowledge: 4, respect: 4 }, { helpfulness: 4, knowledge: 4, respect: 4 }, { helpfulness: 4, knowledge: 4, respect: 4 }], 0);
    expect(r.display && r.responseRate).toBe(0);
    expect(feedbackPoints({ helpfulness: 2, knowledge: 2, respect: 2 })).toBe(0);
    expect(summariseReliability({ completed: 8, noShowsByMentor: 1, lateCancelsByMentor: 1 })).toMatchObject({ band: "good" });
    expect(summariseReliability({ completed: 7, noShowsByMentor: 2, lateCancelsByMentor: 1 })).toMatchObject({ band: "mixed" });
  });
});
