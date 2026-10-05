import { z } from "zod";

/**
 * Every request body is validated against an explicit, strict schema
 * (types, bounds, enums, https-only URLs). Nothing free-form reaches services.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;

/** Trimmed, NFC-normalised text with control and bidi-override characters removed. */
export const text = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.normalize("NFC").replace(CONTROL_CHARS, "").replace(/\r\n/g, "\n").trim())
    .pipe(z.string().min(min, `Must be at least ${min} characters`).max(max, `Must be at most ${max} characters`));

export const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((s) => (s ?? "").normalize("NFC").replace(CONTROL_CHARS, "").trim())
    .pipe(z.string().max(max));

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1" || v === true);

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !!u.hostname && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Must be a full https:// link");

export const optionalHttpsUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(httpsUrl.optional());

export const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address"));

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "moderator", "mod", "support", "help", "staff", "team", "official", "system", "root", "security",
  "verify", "verified", "shikor", "api", "www", "mail", "null", "undefined", "anonymous", "deleted", "grievance", "legal", "abuse",
]);

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "3–24 characters: lowercase letters, numbers, underscore")
  // Prefix rules are narrow on purpose: "mod_x" is reserved, but Bangla names like "modhu" or "moduli" are not.
  .refine((u) => !RESERVED_USERNAMES.has(u) && !/^(?:shikor|admin|support|official)|^mod(?:erator)?(?:[_\d]|$)/.test(u), "This username is reserved");

/** Display names must not impersonate staff or carry badge-like symbols (an impersonation vector). */
const IMPERSONATION = /\b(?:official|verified|admin|administrator|moderator|support|staff|shikor team|customer care)\b|শিকড় টিম|অফিসিয়াল/iu;
const BADGE_SYMBOLS = /[✓✔☑✅\u{1F6E1}\u{1F396}\u{1F3C5}\u{1F947}⭐\u{1F31F}\u{1F512}]/u;

export const displayName = text(2, 60).refine((n) => !IMPERSONATION.test(n), "Display names cannot include words like 'official', 'verified' or 'support'")
  .refine((n) => !BADGE_SYMBOLS.test(n), "Display names cannot include badge-like symbols");

export const password = z.string().min(1).max(128);
export const uuid = z.uuid();
export const back = z.string().max(500).optional();

// ─── Auth ────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email,
  username,
  displayName,
  password,
  adult: checkbox.refine((v) => v === true, "You must be 18 or older to join during this phase"),
  accept: checkbox.refine((v) => v === true, "You must accept the Terms, Privacy Policy and Community Guidelines"),
  "cf-turnstile-response": z.string().max(4096).optional(),
});

export const loginSchema = z.object({ email, password, next: z.string().max(500).optional() });
export const totpSchema = z.object({ code: z.string().trim().min(6).max(20), next: z.string().max(500).optional() });
export const emailOnlySchema = z.object({ email });
export const tokenSchema = z.object({ token: z.string().min(20).max(100) });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(100), password });
export const changePasswordSchema = z.object({ current: password, password });
export const reauthSchema = z.object({ password, code: z.string().trim().max(20).optional(), next: z.string().max(500).optional() });
export const confirmTotpSchema = z.object({ code: z.string().trim().min(6).max(10) });
export const disableTotpSchema = z.object({ password, code: z.string().trim().min(6).max(20) });
export const revokeSessionSchema = z.object({ sessionId: z.string().regex(/^[0-9a-f]{64}$/) });

// ─── Profile & account ──────────────────────────────────────────────────────

export const profileSchema = z.object({
  displayName,
  headline: optionalText(120),
  bio: optionalText(1500),
  institution: optionalText(120),
  fieldOfStudy: optionalText(120),
  location: optionalText(80),
  languages: optionalText(120),
  linkedinUrl: optionalHttpsUrl.refine((v) => !v || /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(v), "Must be a linkedin.com link"),
  websiteUrl: optionalHttpsUrl,
  gender: z.enum(["", "woman", "man", "non_binary", "prefer_not"]).optional(),
  showGender: checkbox,
  allowSearchIndexing: checkbox,
  emailNotifications: checkbox,
  locale: z.enum(["en", "bn"]).optional(),
});

export const deleteAccountSchema = z.object({
  password,
  confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }),
  deleteContent: checkbox,
});

export const institutionEmailSchema = z.object({ email });

// ─── Content ─────────────────────────────────────────────────────────────────

export const POST_TYPES = ["question", "discussion", "guide", "opportunity", "story"] as const;

const tagList = optionalText(120).transform((s) =>
  [...new Set(s.split(",").map((t) => t.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "")).filter((t) => t.length >= 2 && t.length <= 30))].slice(0, 5),
);

export const postSchema = z
  .object({
    type: z.enum([...POST_TYPES, "safety_alert"]),
    topicId: z.coerce.number().int().positive(),
    title: text(8, 160),
    body: text(20, 20000),
    tags: tagList,
    orgName: optionalText(120),
    officialUrl: optionalHttpsUrl,
    deadline: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.iso.date().optional()),
    // HTML forms submit "" for an untouched <select>; that must mean "not provided", not "invalid".
    involvesFee: z
      .enum(["yes", "no", ""])
      .optional()
      .transform((v) => (v ? v : undefined)),
    sources: optionalText(1500),
  })
  .superRefine((p, ctx) => {
    if (p.type === "opportunity") {
      if (!p.orgName) ctx.addIssue({ code: "custom", path: ["orgName"], message: "Organisation name is required for opportunities" });
      if (!p.officialUrl) ctx.addIssue({ code: "custom", path: ["officialUrl"], message: "An official https:// link is required for opportunities" });
      if (!p.involvesFee) ctx.addIssue({ code: "custom", path: ["involvesFee"], message: "Say whether this opportunity involves any fee" });
    }
    if (p.type === "guide" && !p.sources) {
      ctx.addIssue({ code: "custom", path: ["sources"], message: "Guides must cite at least one official source link" });
    }
  });

export const editPostSchema = z.object({ id: uuid, title: text(8, 160), body: text(20, 20000), tags: tagList });
export const answerSchema = z.object({ postId: uuid, body: text(2, 10000) });
export const idSchema = z.object({ id: uuid });
export const voteSchema = z.object({ targetType: z.enum(["post", "answer"]), targetId: uuid });
export const acceptAnswerSchema = z.object({ postId: uuid, answerId: uuid });

// ─── Mentors & bookings ─────────────────────────────────────────────────────

export const mentorApplicationSchema = z.object({
  headline: text(10, 120),
  topicIds: z.array(z.coerce.number().int().positive()).min(1, "Choose at least one topic").max(5, "Choose at most 5 topics"),
  credentials: text(40, 3000),
  evidenceLinks: optionalText(1500),
  scopeStatement: text(30, 1000),
  conflictOfInterest: text(4, 1000),
  weeklyCapacity: z.coerce.number().int().min(1).max(20),
  agreeMentorCode: checkbox.refine((v) => v === true, "You must agree to the mentor code of conduct"),
});

export const mentorSettingsSchema = z.object({
  weeklyCapacity: z.coerce.number().int().min(1).max(20),
  acceptingRequests: checkbox,
  scopeStatement: text(30, 1000),
  conflictOfInterest: text(4, 1000),
});

export const offeringSchema = z.object({
  title: text(5, 80),
  description: text(20, 1000),
  durationMin: z.coerce.number().int().refine((d) => [15, 30, 45, 60].includes(d), "Duration must be 15, 30, 45 or 60 minutes"),
});

export const bookingRequestSchema = z.object({
  offeringId: uuid,
  subject: text(5, 120),
  message: text(40, 2000),
  times: z.array(z.string().max(40)).min(1, "Propose at least one time").max(3, "Propose at most 3 times"),
});

export const acceptBookingSchema = z.object({ id: uuid, slot: z.string().max(40), meetingUrl: optionalHttpsUrl });
export const declineBookingSchema = z.object({ id: uuid, note: optionalText(300) });
export const cancelBookingSchema = z.object({ id: uuid, reason: optionalText(300) });
export const outcomeSchema = z.object({ id: uuid, outcome: z.enum(["happened", "no_show"]) });
export const bookingMessageSchema = z.object({ id: uuid, body: text(1, 2000) });
export const feedbackSchema = z.object({
  id: uuid,
  helpfulness: z.coerce.number().int().min(1).max(5),
  knowledge: z.coerce.number().int().min(1).max(5),
  respect: z.coerce.number().int().min(1).max(5),
  comment: optionalText(1000),
});

// ─── Safety & moderation ────────────────────────────────────────────────────

export const REPORT_REASONS = [
  "scam",
  "fake_opportunity",
  "off_platform_payment",
  "impersonation",
  "harassment",
  "hate",
  "sexual_content",
  "minor_safety",
  "self_harm",
  "privacy",
  "misinformation",
  "spam",
  "other",
] as const;

export const reportSchema = z.object({
  targetType: z.enum(["post", "answer", "user", "booking", "feedback", "booking_message"]),
  targetId: uuid,
  reason: z.enum(REPORT_REASONS),
  details: optionalText(1000),
});

export const publicReportSchema = z.object({
  url: z.string().trim().min(5).max(500),
  reason: z.enum(REPORT_REASONS),
  details: text(20, 3000),
  contact: z.string().trim().max(254).pipe(z.email("Enter an email so we can respond")),
  goodFaith: checkbox.refine((v) => v === true, "Please confirm this report is made in good faith"),
});

export const appealSchema = z.object({ actionId: uuid, statement: text(20, 2000) });

export const modDecisionSchema = z.object({
  targetType: z.enum(["post", "answer", "booking", "booking_message", "feedback"]),
  targetId: uuid,
  decision: z.enum(["approve", "approve_verify", "remove"]),
  reasonCode: z.string().max(60).default("policy"),
  publicReason: optionalText(500),
  reportId: uuid.optional(),
});

export const modUserActionSchema = z.object({
  userId: uuid,
  action: z.enum(["warn", "strike", "suspend", "ban", "unban", "restore"]),
  days: z.coerce.number().int().min(1).max(365).optional(),
  reasonCode: z.string().max(60),
  publicReason: text(10, 500),
  internalNote: optionalText(1000),
  reportId: uuid.optional(),
  fraud: checkbox,
});

export const resolveReportSchema = z.object({ reportId: uuid, resolution: z.enum(["dismiss", "actioned"]), note: optionalText(500) });
export const mentorReviewSchema = z.object({
  userId: uuid,
  decision: z.enum(["approve", "reject", "revoke", "pause"]),
  note: text(5, 1000),
  founding: checkbox,
  credentialLabel: optionalText(120),
});
export const appealDecisionSchema = z.object({ appealId: uuid, decision: z.enum(["granted", "denied"]), note: text(5, 1000) });
export const disputeResolutionSchema = z.object({
  id: uuid,
  resolution: z.enum(["completed", "no_show_mentor", "no_show_mentee", "cancelled_by_mentor", "cancelled_by_mentee"]),
  note: text(5, 1000),
});
export const blockedDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/, "Enter a bare domain like scam.example.com"),
  reason: text(5, 300),
});
export const killSwitchSchema = z.object({ key: z.enum(["registrations_paused", "posting_paused", "opportunities_paused", "bookings_paused"]), value: z.enum(["on", "off"]) });
export const roleSchema = z.object({ userId: uuid, role: z.enum(["member", "moderator", "admin"]) });
