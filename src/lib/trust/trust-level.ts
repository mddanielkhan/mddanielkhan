/**
 * Trust Levels — "citizenship", adapted from Discourse's proven model.
 *
 * Promotion is automatic, behavioural and DEMOTABLE (TL3 must be maintained).
 * Trust Level cannot be bought, granted by popularity alone, or raised by money.
 * TL4 is reserved for staff-appointed community leaders.
 *
 * Inputs are observable facts only; the function is pure and explainable:
 * `explainTrustLevel` tells the member exactly what the next level needs.
 */

export type TrustInputs = {
  accountAgeDays: number;
  emailVerified: boolean;
  daysVisited: number;
  publishedContributions: number; // posts + answers currently published
  helpfulVotesReceived: number;
  acceptedAnswers: number;
  upheldReportsFiled: number;
  activeStrikes: number;
  strikesLast180Days: number;
  removedContentLast90Days: number;
  appointedLeader: boolean;
};

type Requirement = { key: string; label: string; met: (i: TrustInputs) => boolean; progress: (i: TrustInputs) => string };

const req = (key: string, label: string, field: keyof TrustInputs, min: number): Requirement => ({
  key,
  label,
  met: (i) => (i[field] as number) >= min,
  progress: (i) => `${Math.min(i[field] as number, min)}/${min}`,
});

export const LEVELS: Array<{ level: number; name: string; requirements: Requirement[] }> = [
  { level: 0, name: "New", requirements: [] },
  {
    level: 1,
    name: "Basic",
    requirements: [
      { key: "email", label: "Verified email", met: (i) => i.emailVerified, progress: (i) => (i.emailVerified ? "done" : "not yet") },
      req("age", "Account at least 3 days old", "accountAgeDays", 3),
      req("visits", "Visited on 3 different days", "daysVisited", 3),
      req("contrib", "1 published post or answer", "publishedContributions", 1),
      { key: "clean", label: "No active strikes", met: (i) => i.activeStrikes === 0, progress: (i) => (i.activeStrikes === 0 ? "done" : "active strike") },
    ],
  },
  {
    level: 2,
    name: "Member",
    requirements: [
      req("age", "Account at least 30 days old", "accountAgeDays", 30),
      req("visits", "Visited on 10 different days", "daysVisited", 10),
      req("contrib", "10 published posts or answers", "publishedContributions", 10),
      req("helpful", "10 helpful votes received", "helpfulVotesReceived", 10),
      { key: "clean", label: "No strikes in the last 180 days", met: (i) => i.strikesLast180Days === 0, progress: (i) => (i.strikesLast180Days === 0 ? "done" : "recent strike") },
    ],
  },
  {
    level: 3,
    name: "Regular",
    requirements: [
      req("age", "Account at least 90 days old", "accountAgeDays", 90),
      req("visits", "Visited on 45 different days", "daysVisited", 45),
      req("contrib", "30 published posts or answers", "publishedContributions", 30),
      req("helpful", "50 helpful votes received", "helpfulVotesReceived", 50),
      req("accepted", "3 accepted answers", "acceptedAnswers", 3),
      req("reports", "3 reports upheld by moderators", "upheldReportsFiled", 3),
      {
        key: "clean",
        label: "No strikes in 180 days and no removed content in 90 days",
        met: (i) => i.strikesLast180Days === 0 && i.removedContentLast90Days === 0,
        progress: (i) => (i.strikesLast180Days === 0 && i.removedContentLast90Days === 0 ? "done" : "recent violation"),
      },
    ],
  },
];

export function computeTrustLevel(i: TrustInputs): number {
  if (i.appointedLeader && i.activeStrikes === 0) return 4;
  let level = 0;
  for (const l of LEVELS.slice(1)) {
    if (l.requirements.every((r) => r.met(i))) level = l.level;
    else break;
  }
  return level;
}

/**
 * What a member's level is and what the next one needs. Pass `held` (the stored
 * level shown on their profile) so the explanation never contradicts it: stored
 * levels only change at the daily recompute or after moderation, so they can lag
 * behind the live inputs. `promotionPending` marks that lag.
 */
export function explainTrustLevel(i: TrustInputs, held?: number) {
  const current = held ?? computeTrustLevel(i);
  const next = current >= 3 ? undefined : LEVELS.find((l) => l.level === current + 1);
  const requirements = next?.requirements.map((r) => ({ label: r.label, met: r.met(i), progress: r.progress(i) })) ?? [];
  return {
    current,
    currentName: trustLevelName(current),
    next: next ? { level: next.level, name: next.name, requirements } : null,
    promotionPending: next !== undefined && requirements.every((r) => r.met),
  };
}

export function trustLevelName(level: number) {
  return level === 4 ? "Leader" : (LEVELS[level]?.name ?? "New");
}

/**
 * Weight of a member's report towards community auto-hiding. Experienced,
 * accurate reporters count more (TL3 = community moderators). Brand-new (TL0)
 * accounts still reach the moderator queue but carry zero hiding weight, so a
 * brigade of throwaway accounts cannot silence anyone.
 */
export function reportWeight(trustLevel: number) {
  return trustLevel >= 3 ? 3 : trustLevel === 2 ? 2 : trustLevel === 1 ? 1 : 0;
}

/** Weighted reports at or above this hide content pending moderator review (it is never auto-removed). */
export const COMMUNITY_HIDE_THRESHOLD = 4;
