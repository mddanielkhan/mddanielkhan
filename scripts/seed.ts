/**
 * Development seed: topics + realistic demo content. Refuses to run in production
 * (production gets topics only, via `npm run db:seed -- --topics-only`).
 *
 * Demo logins (password for all: "demo passphrase for local dev"):
 *   admin@shikor.local   (admin; TOTP secret printed below)
 *   mentor@shikor.local  (verified mentor; TOTP secret printed below)
 *   student@shikor.local (member)
 */
import { eq } from "drizzle-orm";
import { db, closeDb } from "@/lib/db/client";
import { answers, badges, mentorProfiles, mentorTopics, offerings, posts, profiles, topics, users } from "@/lib/db/schema";
import { seedTopics } from "@/lib/content/topics";
import { hashPassword } from "@/lib/auth/password";
import { encryptField } from "@/lib/security/crypto";
import { generateTotpSecret } from "@/lib/auth/totp";

const topicsOnly = process.argv.includes("--topics-only");

async function main() {
  await seedTopics();
  console.log("topics seeded");
  if (topicsOnly) return;
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production. Use --topics-only.");

  const [already] = await db().select().from(users).where(eq(users.email, "admin@shikor.local"));
  if (already) {
    console.log("demo data already present");
    return;
  }
  const hash = await hashPassword("demo passphrase for local dev");
  const tid = async (slug: string) => (await db().select().from(topics).where(eq(topics.slug, slug)))[0]!.id;
  const old = new Date(Date.now() - 120 * 86400_000);

  const mk = async (email: string, username: string, displayName: string, extra: Partial<typeof users.$inferInsert> = {}, profile: Partial<typeof profiles.$inferInsert> = {}) => {
    const [u] = await db()
      .insert(users)
      .values({ email, username, displayName, passwordHash: hash, emailVerifiedAt: new Date(), adultAttestedAt: new Date(), createdAt: old, trustLevel: 2, daysVisited: 30, ...extra })
      .returning();
    await db().insert(profiles).values({ userId: u!.id, ...profile });
    return u!;
  };

  // E2E runs pin the secrets so tests can compute codes; normal dev seeds get random ones.
  const adminSecret = process.env.SEED_ADMIN_TOTP ?? generateTotpSecret();
  const mentorSecret = process.env.SEED_MENTOR_TOTP ?? generateTotpSecret();
  const admin = await mk("admin@shikor.local", "founder", "Founder", { role: "admin", trustLevel: 4 });
  await db().update(users).set({ totpSecretEnc: encryptField(adminSecret, `totp:${admin.id}`), totpEnabledAt: new Date() }).where(eq(users.id, admin.id));
  const mentor = await mk("mentor@shikor.local", "nusrat_tum", "Nusrat Jahan", { trustLevel: 3 }, { headline: "MSc Informatics, TU Munich · ex-BUET CSE", institution: "Technical University of Munich", fieldOfStudy: "Informatics", languages: ["Bangla", "English", "German"], gender: "woman", showGender: true });
  await db().update(users).set({ totpSecretEnc: encryptField(mentorSecret, `totp:${mentor.id}`), totpEnabledAt: new Date() }).where(eq(users.id, mentor.id));
  const student = await mk("student@shikor.local", "rafi_ruet", "Rafi Ahmed", {}, { headline: "EEE, RUET · aiming for an MSc abroad", institution: "RUET" });
  const helper = await mk("helper@shikor.local", "tanvir_mext", "Tanvir Hasan", { trustLevel: 2 }, { headline: "MEXT scholar, Tohoku University" });

  await db().insert(mentorProfiles).values({
    userId: mentor.id,
    status: "approved",
    headline: "MSc Informatics, TU Munich · ex-BUET CSE",
    credentials: "Completed BSc CSE at BUET (2021) and MSc Informatics at TU Munich (2024). Went through uni-assist, APS and the German student visa process from Dhaka.",
    evidenceLinks: ["https://www.linkedin.com/in/example"],
    scopeStatement: "I can advise on German master's admissions, SOPs, APS/uni-assist and student life. I'm not an immigration lawyer and can't advise on visa refusals or appeals.",
    conflictOfInterest: "None — I receive no money or commission from any university or agency.",
    weeklyCapacity: 4,
    founding: true,
    reviewedAt: new Date(),
    reviewedBy: admin.id,
  });
  await db().insert(mentorTopics).values([{ userId: mentor.id, topicId: await tid("higher-study-abroad") }, { userId: mentor.id, topicId: await tid("student-visa") }]);
  await db().insert(offerings).values([
    { mentorId: mentor.id, title: "30-min German admissions Q&A", description: "Bring your profile and target programmes; we'll go through shortlisting, APS/uni-assist and timelines.", durationMin: 30 },
    { mentorId: mentor.id, title: "SOP review call", description: "Send your SOP in the session messages beforehand and we'll walk through structure and clarity together.", durationMin: 45 },
  ]);
  await db().insert(badges).values([
    { userId: mentor.id, kind: "expert_verified", topicId: await tid("higher-study-abroad"), label: "MSc Informatics, TU Munich · Higher study abroad", method: "manual_review", grantedBy: admin.id, expiresAt: new Date(Date.now() + 365 * 86400_000) },
    { userId: mentor.id, kind: "founding_mentor", label: "Founding mentor", method: "staff_designation", grantedBy: admin.id },
    { userId: mentor.id, kind: "institution_email", label: "Verified email at tum.de", method: "institution_email", expiresAt: new Date(Date.now() + 365 * 86400_000) },
  ]);

  const [q1] = await db()
    .insert(posts)
    .values({ authorId: student.id, topicId: await tid("higher-study-abroad"), type: "question", title: "How much do I need in a German blocked account for 2027 intake?", body: "I got an admit for an MSc in Electrical Engineering in Germany for the winter intake. How much do I need to deposit in the blocked account, and which providers do Bangladeshi students use? Is there anything I should know before transferring money from Bangladesh?", tags: ["germany", "blocked-account"], answerCount: 1 })
    .returning();
  await db().insert(answers).values({ postId: q1!.id, authorId: mentor.id, body: "Check the current amount on the German Federal Foreign Office website — it is revised every year, so don't trust old posts (including this one!). Use only providers listed by the German embassy in Dhaka, and pay from your own or your sponsor's account through official banking channels. Never pay anyone who offers to 'arrange' the blocked account or bank statement for you." });
  await db().insert(posts).values([
    { authorId: helper.id, topicId: await tid("scholarships"), type: "story", title: "How I got the MEXT scholarship from Bangladesh (embassy route)", body: "I applied through the Embassy of Japan in Dhaka. The written exam was in English and maths, then an interview. My advice: start your research proposal early, read the official MEXT guidelines line by line, and ignore anyone who says they can 'guarantee' selection for a fee.", tags: ["mext", "japan"] },
    { authorId: mentor.id, topicId: await tid("scholarships"), type: "opportunity", title: "DAAD EPOS scholarships — development-related postgraduate courses", body: "DAAD's EPOS programme funds master's and PhD programmes with a development focus for professionals from developing countries, including Bangladesh. Each course has its own deadline; read the official call and apply only through the course's official process.", tags: ["daad", "germany"], orgName: "DAAD", officialUrl: "https://www.daad.de/en/", involvesFee: false, deadline: new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10), verifiedAt: new Date(), verifiedBy: admin.id },
    { authorId: admin.id, topicId: await tid("student-visa"), type: "safety_alert", title: "Safety alert: 'guaranteed visa' agents asking for advance bKash payments", body: "We are seeing posts and messages from agents promising guaranteed student visas in exchange for an advance 'processing fee' sent to a personal bKash number. No one can guarantee a visa. Never pay a person; pay only through official portals. Report anyone who asks.", tags: ["scam-alert"], verifiedAt: new Date(), verifiedBy: admin.id },
  ]);
  await db().insert(posts).values({ authorId: student.id, topicId: await tid("student-visa"), type: "discussion", title: "100% visa guarantee for Canada — contact WhatsApp", body: "100% visa guarantee for Canada, no IELTS. Pay advance processing fee to our bKash 01712345678 and WhatsApp us.", status: "held", riskScore: 100, riskSignals: [{ code: "GUARANTEED_OUTCOME", weight: 25 }, { code: "ADVANCE_FEE", weight: 30 }, { code: "SCAM_SIGNATURE_COMBINATION", weight: 60 }] });

  console.log("demo data seeded");
  console.log(`  admin@shikor.local  TOTP secret: ${adminSecret}`);
  console.log(`  mentor@shikor.local TOTP secret: ${mentorSecret}`);
  console.log('  password for all demo accounts: "demo passphrase for local dev"');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
