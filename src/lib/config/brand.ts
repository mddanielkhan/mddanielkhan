/** Brand constants — the name is a working name; changing it is a one-line edit (plus a trademark search). */
export const BRAND = {
  name: "Shikor",
  nameBn: "শিকড়",
  tagline: "Honest guidance from verified people — studies, admissions, scholarships and careers.",
  taglineBn: "যাচাই করা মানুষের কাছ থেকে সৎ পরামর্শ — পড়াশোনা, ভর্তি, স্কলারশিপ ও ক্যারিয়ার।",
  goldenRule: "Nobody on Shikor will ever ask you for money. Sessions are free.",
  goldenRuleBn: "শিকড়ে কেউ আপনার কাছে টাকা চাইবে না। সেশন বিনামূল্যে।",
} as const;

/** Policy document versions. Bump on material change; users re-accept. */
export const POLICY_VERSIONS = { terms: "2026-10-05", privacy: "2026-10-05", guidelines: "2026-10-05" } as const;

/** Phase 1 minimum age (PDPA 2026 treats under-18s as children requiring verifiable guardian consent). */
export const MIN_AGE = 18;
