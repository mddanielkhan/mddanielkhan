import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mentorProfiles } from "@/lib/db/schema";

export type PlatformStats = { mentors: number; sessions: number; opportunities: number; answered: number; screened: number };

/**
 * Public, aggregate-only numbers for the home page. Every figure is a count of
 * things that actually happened — nothing is estimated or rounded up.
 */
export async function platformStats(): Promise<PlatformStats> {
  const res = await db().execute<{ mentors: number; sessions: number; opportunities: number; answered: number; screened: number }>(sql`
    select
      (select count(*)::int from mentor_profiles m join users u on u.id = m.user_id
        where m.status = 'approved' and u.status = 'active' and u.totp_enabled_at is not null) as mentors,
      (select count(*)::int from bookings where status = 'completed') as sessions,
      (select count(*)::int from posts where type = 'opportunity' and status = 'published'
        and verified_at is not null and (deadline is null or deadline >= current_date)) as opportunities,
      (select count(*)::int from posts where type = 'question' and status = 'published' and accepted_answer_id is not null) as answered,
      (select count(*)::int from posts where risk_score >= 45 and created_at > now() - interval '90 days') as screened
  `);
  const r = res.rows[0];
  return { mentors: r?.mentors ?? 0, sessions: r?.sessions ?? 0, opportunities: r?.opportunities ?? 0, answered: r?.answered ?? 0, screened: r?.screened ?? 0 };
}

/** Just the status of a member's mentor profile, for navigation (one indexed lookup). */
export async function mentorStatusOf(userId: string): Promise<string | null> {
  const [m] = await db().select({ status: mentorProfiles.status }).from(mentorProfiles).where(eq(mentorProfiles.userId, userId));
  return m?.status ?? null;
}
