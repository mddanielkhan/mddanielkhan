import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mentorProfiles, mentorTopics, offerings, profiles, topics, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession, resolveSession, type ResolvedSession } from "@/lib/auth/session";
import { encryptField } from "@/lib/security/crypto";
import { generateTotpSecret } from "@/lib/auth/totp";

let n = 0;
let cachedHash: string | undefined;

export async function makeUser(over: Partial<typeof users.$inferInsert> = {}, opts: { mfa?: boolean } = {}): Promise<ResolvedSession> {
  n++;
  cachedHash ??= await hashPassword("correct horse battery staple 42");
  const [u] = await db()
    .insert(users)
    .values({
      email: `user${n}_${Date.now()}@example.com`,
      username: `user${n}_${Math.random().toString(36).slice(2, 8)}`,
      displayName: `User ${n}`,
      passwordHash: cachedHash,
      adultAttestedAt: new Date(),
      emailVerifiedAt: new Date(),
      createdAt: new Date(Date.now() - 60 * 86400_000),
      trustLevel: 2,
      ...over,
    })
    .returning();
  await db().insert(profiles).values({ userId: u!.id });
  if (opts.mfa) {
    await db().update(users).set({ totpSecretEnc: encryptField(generateTotpSecret(), `totp:${u!.id}`), totpEnabledAt: new Date() }).where(eq(users.id, u!.id));
  }
  const { token } = await createSession({ userId: u!.id, role: u!.role, mfaState: opts.mfa ? "verified" : "none", ipHash: null, userAgent: "test" });
  return (await resolveSession(token))!;
}

export async function refresh(actor: ResolvedSession): Promise<ResolvedSession> {
  const [u] = await db().select().from(users).where(eq(users.id, actor.user.id));
  return { session: actor.session, user: u! };
}

export async function topicId(slug = "higher-study-abroad") {
  const [t] = await db().select().from(topics).where(eq(topics.slug, slug));
  return t!.id;
}

export async function makeMentor(): Promise<{ mentor: ResolvedSession; offeringId: string }> {
  const mentor = await makeUser({}, { mfa: true });
  await db().insert(mentorProfiles).values({ userId: mentor.user.id, status: "approved", headline: "MSc at TU Munich", credentials: "x".repeat(50), scopeStatement: "y".repeat(40), conflictOfInterest: "None" });
  await db().insert(mentorTopics).values({ userId: mentor.user.id, topicId: await topicId() });
  const [o] = await db().insert(offerings).values({ mentorId: mentor.user.id, title: "30-min admissions chat", description: "Ask me about German admissions.", durationMin: 30 }).returning();
  return { mentor: await refresh(mentor), offeringId: o!.id };
}

/** Datetime-local string (Bangladesh time) `hours` from now. */
export function bdLocal(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 3600_000 + 6 * 3600_000);
  return d.toISOString().slice(0, 16);
}
