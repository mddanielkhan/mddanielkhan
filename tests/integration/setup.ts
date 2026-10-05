import { afterAll, beforeAll } from "vitest";
import { sql } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://shikor:shikor@localhost:5432/shikor_test";
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.EMAIL_TRANSPORT = "file";
process.env.EMAIL_FILE_DIR = "test-results/mail-integration";
process.env.APP_URL = "http://localhost:3000";

const { db, closeDb } = await import("@/lib/db/client");
const { resetEnvCache } = await import("@/lib/env");
const { invalidateSettingsCache } = await import("@/lib/settings");

beforeAll(async () => {
  resetEnvCache();
  invalidateSettingsCache();
  // The audit log is append-only (triggers reject UPDATE/DELETE/TRUNCATE). Only the table OWNER can disable
  // them — which is exactly why production runs the app as a non-owner role (deploy/postgres/grants.sql).
  await db().execute(sql`alter table audit_log disable trigger user`);
  await db().execute(sql`
    truncate table audit_ip, audit_log, appeals, strikes, moderation_actions, reports, notifications, feedback, booking_messages,
      bookings, offerings, mentor_topics, mentor_profiles, badges, reputation_events, votes, answers, posts, blocked_domains,
      blocked_identifiers, consent_records, recovery_codes, email_tokens, sessions, profiles, users, rate_limits, jobs, site_settings
    restart identity cascade
  `);
  await db().execute(sql`alter table audit_log enable trigger user`);
  const { seedTopics } = await import("@/lib/content/topics");
  await seedTopics();
});

afterAll(async () => {
  await closeDb();
});
