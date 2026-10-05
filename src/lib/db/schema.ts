/**
 * Database schema (PostgreSQL 16+, Drizzle ORM).
 *
 * Conventions
 *  - ids: uuid v4 (non-enumerable). Public credential IDs are uuids too.
 *  - timestamps: timestamptz (UTC).
 *  - Business invariants live in the database as constraints, not only in
 *    application code: e.g. one feedback per booking, Phase-1 sessions are
 *    free (price_bdt = 0), one open booking per mentor/mentee pair, ledger
 *    idempotency. If application code has a bug, the database still refuses
 *    to store an invalid state.
 *  - Secrets are never stored in plaintext: session tokens, email tokens and
 *    recovery codes are SHA-256 hashed; TOTP secrets are AES-256-GCM encrypted.
 *  - IP addresses are never stored raw — only keyed HMACs, purged after 90 days.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  serial,
  bigint,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRole = pgEnum("user_role", ["member", "moderator", "admin"]);
export const accountStatus = pgEnum("account_status", ["active", "suspended", "banned", "deleted"]);
export const postType = pgEnum("post_type", ["question", "discussion", "guide", "opportunity", "story", "safety_alert"]);
export const contentStatus = pgEnum("content_status", ["published", "flagged", "held", "rejected", "removed", "deleted"]);
export const mentorStatus = pgEnum("mentor_status", ["pending", "approved", "rejected", "paused", "revoked"]);
export const bookingStatus = pgEnum("booking_status", [
  "requested",
  "accepted",
  "declined",
  "expired",
  "cancelled_by_mentee",
  "cancelled_by_mentor",
  "completed",
  "no_show_mentor",
  "no_show_mentee",
  "disputed",
]);
export const reportStatus = pgEnum("report_status", ["open", "actioned", "dismissed"]);
export const reportReason = pgEnum("report_reason", [
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
]);
export const reportTarget = pgEnum("report_target", ["post", "answer", "user", "booking", "feedback", "booking_message"]);
export const badgeKind = pgEnum("badge_kind", [
  "institution_email",
  "professional_verified",
  "expert_verified",
  "founding_mentor",
  "moderator",
  "sessions_10",
  "sessions_50",
  "sessions_100",
  "top_helper",
  "opportunity_scout",
]);
export const appealStatus = pgEnum("appeal_status", ["open", "granted", "denied"]);
export const tokenPurpose = pgEnum("token_purpose", ["verify_email", "reset_password", "institution_email", "change_email"]);
export const mfaState = pgEnum("mfa_state", ["none", "pending", "verified"]);

// ─── Identity & authentication ──────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    passwordHash: text("password_hash").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    role: userRole("role").notNull().default("member"),
    status: accountStatus("status").notNull().default("active"),
    suspendedUntil: ts("suspended_until"),
    /** Posting/booking restriction from a strike (account still usable for reading, appeals, data export). */
    restrictedUntil: ts("restricted_until"),
    /** Phase 1 is 18+ only (PDPA 2026: a "child" is <18 and needs guardian consent). We store the attestation, not a birthdate. */
    adultAttestedAt: ts("adult_attested_at").notNull(),
    locale: text("locale").notNull().default("en"),
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabledAt: ts("totp_enabled_at"),
    totpLastStep: bigint("totp_last_step", { mode: "number" }),
    trustLevel: smallint("trust_level").notNull().default(0),
    reputation: integer("reputation").notNull().default(0),
    daysVisited: integer("days_visited").notNull().default(0),
    lastVisitedOn: date("last_visited_on"),
    passwordChangedAt: ts("password_changed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_username_uq").on(t.username),
    check("users_email_lower", sql`${t.email} = lower(${t.email})`),
    check("users_username_format", sql`${t.username} ~ '^[a-z0-9_]{3,24}$'`),
    check("users_trust_level_range", sql`${t.trustLevel} between 0 and 4`),
  ],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  institution: text("institution").notNull().default(""),
  fieldOfStudy: text("field_of_study").notNull().default(""),
  location: text("location").notNull().default(""),
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  linkedinUrl: text("linkedin_url"),
  websiteUrl: text("website_url"),
  /** Optional, self-described, shown only if showGender = true. Used for the "women mentors" filter. */
  gender: text("gender"),
  showGender: boolean("show_gender").notNull().default(false),
  allowSearchIndexing: boolean("allow_search_indexing").notNull().default(false),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the opaque cookie token. The raw token is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mfaState: mfaState("mfa_state").notNull().default("none"),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    reauthenticatedAt: ts("reauthenticated_at"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    revokedAt: ts("revoked_at"),
    revokedReason: text("revoked_reason"),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const emailTokens = pgTable(
  "email_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: tokenPurpose("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    /** Target address (institutional or new email). */
    email: text("email"),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_tokens_hash_uq").on(t.tokenHash), index("email_tokens_user_idx").on(t.userId, t.purpose)],
);

export const recoveryCodes = pgTable(
  "recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: ts("used_at"),
  },
  (t) => [index("recovery_codes_user_idx").on(t.userId)],
);

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    document: text("document").notNull(),
    version: text("version").notNull(),
    acceptedAt: ts("accepted_at").notNull().defaultNow(),
  },
  (t) => [index("consent_user_idx").on(t.userId)],
);

/** Hashes of identifiers of banned accounts, so a ban survives account deletion (ban evasion). */
export const blockedIdentifiers = pgTable("blocked_identifiers", {
  valueHash: text("value_hash").primaryKey(),
  kind: text("kind").notNull(),
  reason: text("reason").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ─── Taxonomy & content ─────────────────────────────────────────────────────

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameBn: text("name_bn").notNull(),
  description: text("description").notNull().default(""),
  /** High-risk topics (visa, overseas jobs, money) get stricter screening. */
  highRisk: boolean("high_risk").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type RiskSignalRecord = { code: string; weight: number };

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    type: postType("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    status: contentStatus("status").notNull().default("published"),
    riskScore: integer("risk_score").notNull().default(0),
    riskSignals: jsonb("risk_signals").$type<RiskSignalRecord[]>().notNull().default([]),
    // Opportunity fields
    orgName: text("org_name"),
    officialUrl: text("official_url"),
    deadline: date("deadline"),
    involvesFee: boolean("involves_fee"),
    verifiedAt: ts("verified_at"),
    verifiedBy: uuid("verified_by").references(() => users.id),
    // Guide fields
    sources: text("sources").array().notNull().default(sql`'{}'::text[]`),
    lastVerifiedOn: date("last_verified_on"),
    acceptedAnswerId: uuid("accepted_answer_id"),
    answerCount: integer("answer_count").notNull().default(0),
    helpfulCount: integer("helpful_count").notNull().default(0),
    flagWeight: integer("flag_weight").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    editedAt: ts("edited_at"),
    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(body, '')), 'B') || setweight(to_tsvector('simple', coalesce(org_name, '')), 'A')`,
    ),
  },
  (t) => [
    index("posts_feed_idx").on(t.status, t.createdAt),
    index("posts_topic_idx").on(t.topicId, t.status, t.createdAt),
    index("posts_author_idx").on(t.authorId),
    index("posts_deadline_idx").on(t.type, t.deadline),
    index("posts_search_idx").using("gin", t.search),
    check("posts_title_len", sql`char_length(${t.title}) between 8 and 160`),
    check("posts_body_len", sql`char_length(${t.body}) between 20 and 20000`),
    check(
      "posts_opportunity_fields",
      sql`${t.type} <> 'opportunity' or (${t.orgName} is not null and ${t.officialUrl} is not null and ${t.involvesFee} is not null)`,
    ),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    status: contentStatus("status").notNull().default("published"),
    riskScore: integer("risk_score").notNull().default(0),
    riskSignals: jsonb("risk_signals").$type<RiskSignalRecord[]>().notNull().default([]),
    helpfulCount: integer("helpful_count").notNull().default(0),
    flagWeight: integer("flag_weight").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("answers_post_idx").on(t.postId, t.createdAt),
    index("answers_author_idx").on(t.authorId),
    check("answers_body_len", sql`char_length(${t.body}) between 2 and 10000`),
  ],
);

/** "Helpful" votes only. No downvotes on questions (anti-humiliation design). */
export const votes = pgTable(
  "votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetType, t.targetId] }),
    check("votes_target_type", sql`${t.targetType} in ('post','answer')`),
  ],
);

export const blockedDomains = pgTable("blocked_domains", {
  domain: text("domain").primaryKey(),
  reason: text("reason").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ─── Trust & reputation ─────────────────────────────────────────────────────

/** Append-only reputation ledger. Every point a user has is explainable by a row here. */
export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: integer("topic_id").references(() => topics.id),
    kind: text("kind").notNull(),
    points: integer("points").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Idempotency: the same event for the same source can never be awarded twice.
    uniqueIndex("reputation_events_idem_uq").on(t.userId, t.kind, t.sourceType, t.sourceId),
    index("reputation_events_user_idx").on(t.userId, t.createdAt),
    index("reputation_events_topic_idx").on(t.topicId, t.createdAt),
  ],
);

export const badges = pgTable(
  "badges",
  {
    /** Public credential ID — resolvable at /v/{id}. */
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: badgeKind("kind").notNull(),
    topicId: integer("topic_id").references(() => topics.id),
    label: text("label").notNull(),
    method: text("method").notNull(),
    grantedAt: ts("granted_at").notNull().defaultNow(),
    expiresAt: ts("expires_at"),
    revokedAt: ts("revoked_at"),
    revokeReason: text("revoke_reason"),
    grantedBy: uuid("granted_by"),
  },
  (t) => [
    uniqueIndex("badges_active_uq")
      .on(t.userId, t.kind, sql`coalesce(${t.topicId}, 0)`)
      .where(sql`${t.revokedAt} is null`),
    index("badges_user_idx").on(t.userId),
  ],
);

// ─── Mentors, offerings, bookings ───────────────────────────────────────────

export const mentorProfiles = pgTable(
  "mentor_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    status: mentorStatus("status").notNull().default("pending"),
    headline: text("headline").notNull(),
    credentials: text("credentials").notNull(),
    evidenceLinks: text("evidence_links").array().notNull().default(sql`'{}'::text[]`),
    /** Mandatory: what the mentor can and cannot advise on (advice-safety). */
    scopeStatement: text("scope_statement").notNull(),
    /** Mandatory public conflict-of-interest declaration (e.g. agency commissions). */
    conflictOfInterest: text("conflict_of_interest").notNull(),
    weeklyCapacity: smallint("weekly_capacity").notNull().default(3),
    acceptingRequests: boolean("accepting_requests").notNull().default(true),
    founding: boolean("founding").notNull().default(false),
    submittedAt: ts("submitted_at").notNull().defaultNow(),
    reviewedAt: ts("reviewed_at"),
    reviewedBy: uuid("reviewed_by"),
    reviewNote: text("review_note"),
  },
  (t) => [
    index("mentor_status_idx").on(t.status),
    check("mentor_capacity_range", sql`${t.weeklyCapacity} between 1 and 20`),
  ],
);

export const mentorTopics = pgTable(
  "mentor_topics",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] })],
);

export const offerings = pgTable(
  "offerings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mentorId: uuid("mentor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    durationMin: smallint("duration_min").notNull(),
    /** Phase 1 is free. The database refuses any non-zero price until Phase 2 changes this constraint. */
    priceBdt: integer("price_bdt").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("offerings_mentor_idx").on(t.mentorId),
    check("offerings_phase1_free", sql`${t.priceBdt} = 0`),
    check("offerings_duration", sql`${t.durationMin} in (15, 30, 45, 60)`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offeringId: uuid("offering_id")
      .notNull()
      .references(() => offerings.id),
    mentorId: uuid("mentor_id")
      .notNull()
      .references(() => users.id),
    menteeId: uuid("mentee_id")
      .notNull()
      .references(() => users.id),
    topicId: integer("topic_id").references(() => topics.id),
    status: bookingStatus("status").notNull().default("requested"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    proposedTimes: timestamp("proposed_times", { withTimezone: true, mode: "date" }).array().notNull(),
    durationMin: smallint("duration_min").notNull(),
    scheduledAt: ts("scheduled_at"),
    meetingUrl: text("meeting_url"),
    riskScore: integer("risk_score").notNull().default(0),
    riskSignals: jsonb("risk_signals").$type<RiskSignalRecord[]>().notNull().default([]),
    mentorOutcome: text("mentor_outcome"),
    menteeOutcome: text("mentee_outcome"),
    outcomeDeadline: ts("outcome_deadline"),
    resolutionNote: text("resolution_note"),
    cancelReason: text("cancel_reason"),
    lateCancel: boolean("late_cancel").notNull().default(false),
    requestExpiresAt: ts("request_expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    completedAt: ts("completed_at"),
    closedAt: ts("closed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("bookings_mentor_idx").on(t.mentorId, t.status),
    index("bookings_mentee_idx").on(t.menteeId, t.status),
    index("bookings_scheduled_idx").on(t.status, t.scheduledAt),
    uniqueIndex("bookings_one_open_per_pair_uq")
      .on(t.mentorId, t.menteeId)
      .where(sql`${t.status} in ('requested','accepted')`),
    check("bookings_not_self", sql`${t.mentorId} <> ${t.menteeId}`),
    check("bookings_outcome_values", sql`coalesce(${t.mentorOutcome}, 'happened') in ('happened','no_show') and coalesce(${t.menteeOutcome}, 'happened') in ('happened','no_show')`),
    check("bookings_proposed_times_count", sql`cardinality(${t.proposedTimes}) between 1 and 3`),
  ],
);

export const bookingMessages = pgTable(
  "booking_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    status: contentStatus("status").notNull().default("published"),
    riskSignals: jsonb("risk_signals").$type<RiskSignalRecord[]>().notNull().default([]),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("booking_messages_booking_idx").on(t.bookingId, t.createdAt),
    check("booking_messages_len", sql`char_length(${t.body}) between 1 and 2000`),
  ],
);

/** Completion-gated feedback. One per booking — a database invariant, not application hope. */
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    mentorId: uuid("mentor_id")
      .notNull()
      .references(() => users.id),
    menteeId: uuid("mentee_id")
      .notNull()
      .references(() => users.id),
    helpfulness: smallint("helpfulness").notNull(),
    knowledge: smallint("knowledge").notNull(),
    respect: smallint("respect").notNull(),
    comment: text("comment").notNull().default(""),
    status: contentStatus("status").notNull().default("published"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("feedback_booking_uq").on(t.bookingId),
    index("feedback_mentor_idx").on(t.mentorId, t.createdAt),
    check(
      "feedback_scores_range",
      sql`${t.helpfulness} between 1 and 5 and ${t.knowledge} between 1 and 5 and ${t.respect} between 1 and 5`,
    ),
  ],
);

// ─── Safety, moderation, governance ─────────────────────────────────────────

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    /** For the public notice-and-action form (non-users). */
    reporterContact: text("reporter_contact"),
    targetType: reportTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: reportReason("reason").notNull(),
    details: text("details").notNull().default(""),
    /** 0 = P0 imminent harm … 3 = standard. */
    priority: smallint("priority").notNull(),
    weight: smallint("weight").notNull().default(1),
    status: reportStatus("status").notNull().default("open"),
    resolvedAt: ts("resolved_at"),
    resolvedBy: uuid("resolved_by"),
    resolutionNote: text("resolution_note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("reports_queue_idx").on(t.status, t.priority, t.createdAt),
    index("reports_target_idx").on(t.targetType, t.targetId),
    uniqueIndex("reports_dedupe_uq")
      .on(t.reporterId, t.targetType, t.targetId)
      .where(sql`${t.status} = 'open' and ${t.reporterId} is not null`),
  ],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    reasonCode: text("reason_code").notNull(),
    /** Shown to the affected user. */
    publicReason: text("public_reason").notNull(),
    /** Staff-only. */
    internalNote: text("internal_note"),
    reportId: uuid("report_id"),
    reversedAt: ts("reversed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("moderation_actions_target_user_idx").on(t.targetUserId, t.createdAt),
    index("moderation_actions_created_idx").on(t.createdAt),
  ],
);

export const strikes = pgTable(
  "strikes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actionId: uuid("action_id")
      .notNull()
      .references(() => moderationActions.id),
    severity: smallint("severity").notNull(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("strikes_user_idx").on(t.userId, t.expiresAt)],
);

export const appeals = pgTable(
  "appeals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actionId: uuid("action_id")
      .notNull()
      .references(() => moderationActions.id),
    statement: text("statement").notNull(),
    status: appealStatus("status").notNull().default("open"),
    decidedBy: uuid("decided_by"),
    decidedAt: ts("decided_at"),
    decisionNote: text("decision_note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("appeals_action_uq").on(t.actionId), index("appeals_status_idx").on(t.status, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

// ─── Platform: audit, rate limits, jobs, settings ──────────────────────────

/**
 * Append-only, hash-chained audit log. The runtime DB role has INSERT/SELECT only
 * (see deploy/postgres/grants.sql) and a trigger rejects UPDATE/DELETE for everyone.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    occurredAt: ts("occurred_at").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    index("audit_actor_idx").on(t.actorId, t.occurredAt),
    index("audit_action_idx").on(t.action, t.occurredAt),
    uniqueIndex("audit_hash_uq").on(t.hash),
  ],
);

/** IP hashes live outside the chained table so they can be purged (90 days) without breaking the chain. */
export const auditIp = pgTable("audit_ip", {
  auditId: bigint("audit_id", { mode: "number" })
    .primaryKey()
    .references(() => auditLog.id),
  ipHash: text("ip_hash").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_expires_idx").on(t.expiresAt)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    runAt: ts("run_at").notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    lockedAt: ts("locked_at"),
    lastError: text("last_error"),
    doneAt: ts("done_at"),
    failedAt: ts("failed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("jobs_ready_idx").on(t.runAt).where(sql`${t.doneAt} is null and ${t.failedAt} is null`)],
);

/** Runtime kill switches and settings, editable by admins without a deploy. */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});
