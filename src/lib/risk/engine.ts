import { extractContacts, hostMatches, hostOf, normalise, SHORTENER_DOMAINS } from "./normalise";
import { GUARANTEE_ALLOWLIST, RULESET_VERSION, SIGNALS, TRUSTED_DOMAIN_SUFFIXES, type SignalCategory } from "./rules";

/**
 * Explainable, deterministic risk engine (no ML in Phase 1, by design):
 * every decision can be explained to a moderator, an appellant and a regulator
 * as a list of named signals with weights.
 *
 *   score < 20        → publish
 *   20 ≤ score < 45   → publish + flag for priority patrol (invisible to author)
 *   45 ≤ score        → HOLD for human review before anyone sees it
 *   hard combination  → REJECT (author is told why; appeal available)
 *
 * Automated rejection only happens for high-precision COMBINATIONS (e.g. an
 * offer to arrange bank statements + a payment request), never for a single
 * keyword. Everything ambiguous goes to a human — that is the point.
 */

export type Surface = "post" | "answer" | "booking_request" | "booking_message" | "profile" | "feedback";
export type Decision = "allow" | "flag" | "hold" | "reject";

export type RiskInput = {
  text: string;
  surface: Surface;
  postType?: string;
  highRiskTopic?: boolean;
  authorTrustLevel: number;
  authorAccountAgeMs: number;
  authorIsApprovedMentor?: boolean;
  authorIsStaff?: boolean;
  /** Extra URLs not in the text (e.g. an opportunity's official URL field). */
  extraUrls?: string[];
  involvesFee?: boolean;
  blockedDomains?: ReadonlySet<string>;
};

export type FiredSignal = { code: string; category: SignalCategory | "policy"; weight: number; publicReason: string };

export type RiskResult = {
  decision: Decision;
  score: number;
  signals: FiredSignal[];
  /** True when the text suggests the author may be in crisis — route to support, never punish. */
  supportNeeded: boolean;
  rulesetVersion: string;
};

const INTERROGATIVE = /^(?:is|are|was|were|do|does|did|can|could|should|would|will|how|what|why|where|which|who|when|has|have|any|anyone|কি|কী|কিভাবে|কেন|কোথায়|কোন)\b/iu;

function sentenceAround(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf(".", index), text.lastIndexOf("!", index), text.lastIndexOf("\n", index), text.lastIndexOf("।", index), text.lastIndexOf("?", index - 1)) + 1;
  const ends = [".", "!", "?", "\n", "।"].map((c) => text.indexOf(c, index)).filter((i) => i !== -1);
  const end = ends.length ? Math.min(...ends) + 1 : text.length;
  return text.slice(start, end).trim();
}

function isQuestion(sentence: string) {
  return sentence.endsWith("?") || INTERROGATIVE.test(sentence);
}

export function isTrustedHost(host: string) {
  return TRUSTED_DOMAIN_SUFFIXES.some((suffix) => hostMatches(host, suffix) || host.endsWith(`.${suffix}`));
}

export function evaluateRisk(input: RiskInput): RiskResult {
  const { text } = normalise(input.text);
  const scanText = text.replace(GUARANTEE_ALLOWLIST, " ");
  const fired: FiredSignal[] = [];
  let supportNeeded = false;

  for (const s of SIGNALS) {
    const m = s.pattern.exec(scanText);
    if (!m) continue;
    if (s.category === "support") {
      supportNeeded = true;
      continue;
    }
    let weight = s.weight;
    if (s.questionDiscount && isQuestion(sentenceAround(scanText, m.index))) weight = Math.round(weight / 2);
    fired.push({ code: s.code, category: s.category, weight, publicReason: s.publicReason });
  }

  // ── Contacts & links ──
  const contacts = extractContacts(input.text);
  const publicSurface = input.surface === "post" || input.surface === "answer" || input.surface === "profile";
  if (publicSurface && (contacts.phones.length > 0 || contacts.emails.length > 0)) {
    const lowTrust = input.authorTrustLevel < 2 && !input.authorIsStaff;
    fired.push({ code: "CONTACT_DETAILS_PUBLIC", category: lowTrust ? "policy" : "contact", weight: lowTrust ? 45 : 12, publicReason: "Please don't share phone numbers or emails publicly — they attract scammers." });
  }

  const urls = [...contacts.urls, ...(input.extraUrls ?? [])];
  let untrustedLinks = 0;
  for (const url of urls) {
    const host = hostOf(url);
    if (!host) continue;
    if (input.blockedDomains && [...input.blockedDomains].some((d) => hostMatches(host, d))) {
      fired.push({ code: "BLOCKED_DOMAIN", category: "link", weight: 100, publicReason: "This post links to a site that has been reported for fraud." });
      continue;
    }
    if (SHORTENER_DOMAINS.has(host)) {
      fired.push({ code: "LINK_SHORTENER", category: "policy", weight: 45, publicReason: "Shortened links hide where they go. Please post the full official link." });
      continue;
    }
    if (!isTrustedHost(host)) untrustedLinks++;
  }
  if (untrustedLinks > 0 && input.authorTrustLevel === 0 && publicSurface) {
    fired.push({ code: "NEW_USER_LINK", category: "policy", weight: 45, publicReason: "Links from brand-new accounts are checked by a moderator first." });
  }

  // ── Policy gates (structural, not textual) ──
  if (input.surface === "post" && input.postType === "opportunity") {
    if (input.involvesFee) {
      fired.push({ code: "OPPORTUNITY_WITH_FEE", category: "policy", weight: 45, publicReason: "Opportunities that involve a fee are verified by a moderator before they go live." });
    }
    if (input.authorTrustLevel < 2 && !input.authorIsStaff) {
      fired.push({ code: "OPPORTUNITY_LOW_TRUST", category: "policy", weight: 45, publicReason: "Opportunities from newer members are checked by a moderator before they go live." });
    }
  }

  // ── Combinations: the scam signature is guarantee/offer + money + off-platform contact ──
  const has = (cat: SignalCategory | "policy") => fired.some((f) => f.category === cat);
  const hasCode = (code: string) => fired.some((f) => f.code === code);
  let combo = 0;
  const moneyish = has("money") || hasCode("OVERSEAS_JOB_FEE");
  const offerish = hasCode("AGENT_SERVICE_OFFER") || hasCode("GUARANTEED_OUTCOME") || hasCode("DOCUMENT_FRAUD_OFFER") || hasCode("EXAM_FRAUD");
  const contactish = has("steering") || contacts.phones.length > 0 || contacts.emails.length > 0;
  if (offerish && moneyish) combo += 25;
  if (offerish && contactish) combo += 20;
  if (moneyish && contactish) combo += 15;
  if (hasCode("URGENCY_PRESSURE") && (moneyish || offerish)) combo += 15;
  if (combo > 0) fired.push({ code: "SCAM_SIGNATURE_COMBINATION", category: "fraud", weight: combo, publicReason: "This looks like a common scam pattern." });

  // ── Context multipliers (never immunity) ──
  let multiplier = 1;
  if (input.surface === "post" && input.postType === "opportunity") multiplier *= 1.3;
  if (input.highRiskTopic) multiplier *= 1.15;
  if (input.authorAccountAgeMs < 72 * 3600_000) multiplier *= 1.3;
  if (input.authorTrustLevel >= 3) multiplier *= 0.75;
  else if (input.authorTrustLevel >= 2) multiplier *= 0.85;
  if (input.authorIsApprovedMentor) multiplier *= 0.85;
  if (input.authorIsStaff) multiplier *= 0.5;

  const raw = fired.reduce((sum, f) => sum + f.weight, 0);
  const policyFloor = fired.filter((f) => f.category === "policy").reduce((m, f) => Math.max(m, f.weight), 0);
  // Policy gates are not reduced by trust multipliers: a held opportunity stays held.
  const score = Math.min(100, Math.max(Math.round(raw * multiplier), policyFloor));

  const hardReject =
    hasCode("BLOCKED_DOMAIN") ||
    (hasCode("DOCUMENT_FRAUD_OFFER") && (moneyish || contactish)) ||
    (hasCode("EXAM_FRAUD") && (moneyish || contactish)) ||
    (hasCode("WALLET_WITH_NUMBER") && offerish);

  let decision: Decision = "allow";
  if (hardReject) decision = "reject";
  else if (score >= 45) decision = "hold";
  else if (score >= 20) decision = "flag";

  return { decision, score, signals: fired, supportNeeded, rulesetVersion: RULESET_VERSION };
}

/** The author-facing explanation: policy reasons only, never patterns or weights. */
export function publicReasons(result: RiskResult): string[] {
  return [...new Set(result.signals.filter((s) => s.publicReason && s.weight > 0).map((s) => s.publicReason))];
}

const POLICY_REASONS: Record<string, string> = {
  CONTACT_DETAILS_PUBLIC: "Please don't share phone numbers or emails publicly — they attract scammers.",
  BLOCKED_DOMAIN: "This post links to a site that has been reported for fraud.",
  LINK_SHORTENER: "Shortened links hide where they go. Please post the full official link.",
  NEW_USER_LINK: "Links from brand-new accounts are checked by a moderator first.",
  OPPORTUNITY_WITH_FEE: "Opportunities that involve a fee are verified by a moderator before they go live.",
  OPPORTUNITY_LOW_TRUST: "Opportunities from newer members are checked by a moderator before they go live.",
  SCAM_SIGNATURE_COMBINATION: "This looks like a common scam pattern.",
};

/** Map stored signal codes back to author-facing policy reasons. */
export function reasonsForCodes(codes: string[]): string[] {
  const byCode = new Map(SIGNALS.map((s) => [s.code, s.publicReason]));
  return [...new Set(codes.map((c) => byCode.get(c) || POLICY_REASONS[c]).filter((r): r is string => !!r))];
}
