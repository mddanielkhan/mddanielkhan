/**
 * Development seed: topics + realistic demo content. Refuses to run in production
 * (production gets topics only, via `npm run db:seed -- --topics-only`).
 *
 * Demo logins (all share DEMO_PASSWORD, see src/lib/cli/demo-accounts.ts):
 *   admin@peerlink.local   (admin; TOTP secret printed below)
 *   mentor@peerlink.local  (verified mentor, Nusrat; TOTP secret printed below)
 *   student@peerlink.local (member, Raima)
 */
import "@/lib/cli/load-env"; // must stay first: loads .env before any module reads config
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "@/lib/db/client";
import { answers, badges, bookings, feedback, mentorProfiles, mentorTopics, notifications, offerings, posts, profiles, reports, topics, users, votes } from "@/lib/db/schema";
import { award, gatherTrustInputs } from "@/lib/trust/reputation";
import { computeTrustLevel } from "@/lib/trust/trust-level";
import { seedTopics } from "@/lib/content/topics";
import { hashPassword } from "@/lib/auth/password";
import { encryptField } from "@/lib/security/crypto";
import { generateTotpSecret } from "@/lib/auth/totp";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_STUDENT } from "@/lib/cli/demo-accounts";

const topicsOnly = process.argv.includes("--topics-only");

async function main() {
  await seedTopics();
  console.log("topics seeded");
  if (topicsOnly) return;
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production. Use --topics-only.");

  const [already] = await db().select().from(users).where(eq(users.email, DEMO_EMAIL.admin));
  if (already) {
    console.log("demo data already present");
    return;
  }
  const hash = await hashPassword(DEMO_PASSWORD);
  const tid = async (slug: string) => (await db().select().from(topics).where(eq(topics.slug, slug)))[0]!.id;
  const old = new Date(Date.now() - 120 * 86400_000);

  const mk = async (email: string, username: string, displayName: string, extra: Partial<typeof users.$inferInsert> = {}, profile: Partial<typeof profiles.$inferInsert> = {}) => {
    const [u] = await db()
      .insert(users)
      .values({ email, username, displayName, passwordHash: hash, emailVerifiedAt: new Date(), adultAttestedAt: new Date(), createdAt: old, daysVisited: 30, ...extra })
      .returning();
    await db().insert(profiles).values({ userId: u!.id, ...profile });
    return u!;
  };

  // E2E runs pin the secrets so tests can compute codes; normal dev seeds get random ones.
  const adminSecret = process.env.SEED_ADMIN_TOTP ?? generateTotpSecret();
  const mentorSecret = process.env.SEED_MENTOR_TOTP ?? generateTotpSecret();
  const admin = await mk(DEMO_EMAIL.admin, "founder", "Founder", { role: "admin", trustLevel: 4 });
  await db().update(users).set({ totpSecretEnc: encryptField(adminSecret, `totp:${admin.id}`), totpEnabledAt: new Date() }).where(eq(users.id, admin.id));
  const mentor = await mk(DEMO_EMAIL.mentor, "nusrat_tum", "Nusrat Jahan", {}, { headline: "MSc Informatics, TU Munich · ex-BUET CSE", institution: "Technical University of Munich", fieldOfStudy: "Informatics", languages: ["Bangla", "English", "German"], gender: "woman", showGender: true });
  await db().update(users).set({ totpSecretEnc: encryptField(mentorSecret, `totp:${mentor.id}`), totpEnabledAt: new Date() }).where(eq(users.id, mentor.id));
  const student = await mk(DEMO_EMAIL.student, DEMO_STUDENT.username, DEMO_STUDENT.displayName, {}, { headline: "EEE, RUET · aiming for an MSc abroad", institution: "RUET" });
  const helper = await mk("helper@peerlink.local", "tanvir_mext", "Tanvir Hasan", {}, { headline: "MEXT scholar, Tohoku University" });

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

  // ── Richer demo community (so the product looks alive in demos) ─────────────
  const days = (n: number) => new Date(Date.now() - n * 86400_000);
  const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
  const farhan = await mk("farhan@peerlink.local", "farhan_utokyo", "Farhan Kabir", {}, { headline: "PhD candidate, University of Tokyo · MEXT scholar", institution: "University of Tokyo", fieldOfStudy: "Materials Science", languages: ["Bangla", "English", "Japanese"] });
  const sadia = await mk("sadia@peerlink.local", "sadia_dev", "Sadia Islam", {}, { headline: "Software Engineer · ex-BRAC University CSE", institution: "BRAC University", fieldOfStudy: "Computer Science", languages: ["Bangla", "English"], gender: "woman", showGender: true });
  const arif = await mk("arif@peerlink.local", "arif_uoft", "Arif Hossain", {}, { headline: "MEng, University of Toronto · ex-KUET EEE", institution: "University of Toronto", fieldOfStudy: "Electrical Engineering", languages: ["Bangla", "English"] });
  const nadia = await mk("nadia@peerlink.local", "nadia_cu", "Nadia Rahman", { daysVisited: 6 }, { headline: "Chemistry, University of Chittagong", institution: "University of Chittagong" });
  const tamim = await mk("tamim@peerlink.local", "tamim_hsc", "Tamim Chowdhury", { daysVisited: 4 }, { headline: "Preparing for university admission tests" });
  const applicant = await mk("applicant@peerlink.local", "rumana_lund", "Rumana Akter", {}, { headline: "MSc Sustainability, Lund University" });
  const scammy = await mk("visa.fast@peerlink.local", "visa_fast_bd", "Visa Fast BD", { daysVisited: 1, createdAt: days(1) });
  await db().insert(posts).values({ authorId: scammy.id, topicId: await tid("student-visa"), type: "discussion", title: "100% visa guarantee for Canada — contact WhatsApp", body: "100% visa guarantee for Canada, no IELTS. Pay advance processing fee to our bKash 01712345678 and WhatsApp us.", status: "held", riskScore: 100, riskSignals: [{ code: "GUARANTEED_OUTCOME", weight: 25 }, { code: "ADVANCE_FEE", weight: 30 }, { code: "SCAM_SIGNATURE_COMBINATION", weight: 60 }] });

  for (const [u, headline, topicSlugs, credentials, scope, coi, cap] of [
    [farhan, "PhD candidate, University of Tokyo · MEXT scholar", ["scholarships", "research"], "Won the MEXT research scholarship through the Embassy of Japan in Dhaka (2022). Now a PhD candidate in Materials Science at the University of Tokyo.", "I can advise on MEXT (embassy and university routes), research proposals and contacting Japanese professors. I can't advise on Japanese visa refusals.", "None.", 3],
    [sadia, "Software Engineer · ex-BRAC University CSE", ["careers", "study-help"], "Software engineer at a Dhaka fintech for 4 years; interviewed 60+ candidates. BSc CSE, BRAC University.", "I can help with CVs, technical interview preparation and the Bangladesh software job market. I can't help with jobs abroad or work visas.", "None — I don't receive referral bonuses for any recommendation I make here.", 4],
    [arif, "MEng, University of Toronto · ex-KUET EEE", ["higher-study-abroad", "student-visa"], "MEng in Electrical Engineering at the University of Toronto (2025). Applied to 6 Canadian universities from Khulna; went through the study-permit process myself.", "I can advise on Canadian graduate admissions, funding and student life. I'm not a licensed immigration consultant (RCIC) and can't advise on permit refusals.", "None.", 2],
  ] as const) {
    await db().insert(mentorProfiles).values({ userId: u.id, status: "approved", headline, credentials, evidenceLinks: ["https://www.linkedin.com/in/example"], scopeStatement: scope, conflictOfInterest: coi, weeklyCapacity: cap, founding: true, reviewedAt: days(20), reviewedBy: admin.id });
    for (const slug of topicSlugs) await db().insert(mentorTopics).values({ userId: u.id, topicId: await tid(slug) });
    await db().update(users).set({ totpSecretEnc: encryptField(generateTotpSecret(), `totp:${u.id}`), totpEnabledAt: days(19) }).where(eq(users.id, u.id));
    await db().insert(badges).values([
      { userId: u.id, kind: "expert_verified", topicId: await tid(topicSlugs[0]), label: `${headline.split(" · ")[0]} · ${topicSlugs[0].replace(/-/g, " ")}`, method: "manual_review", grantedBy: admin.id, expiresAt: new Date(Date.now() + 340 * 86400_000) },
      { userId: u.id, kind: "founding_mentor", label: "Founding mentor", method: "staff_designation", grantedBy: admin.id },
    ]);
  }
  const [farhanOffer] = await db().insert(offerings).values({ mentorId: farhan.id, title: "MEXT application strategy (embassy route)", description: "Timeline, written exam, research proposal and interview — what worked for me and what to avoid.", durationMin: 45 }).returning();
  await db().insert(offerings).values([
    { mentorId: sadia.id, title: "CV + LinkedIn review", description: "Share your CV in the session messages; we'll make it clear, honest and recruiter-friendly.", durationMin: 30 },
    { mentorId: sadia.id, title: "Mock technical interview", description: "A realistic 45-minute interview for junior software roles with feedback afterwards.", durationMin: 45 },
    { mentorId: arif.id, title: "Canada grad admissions Q&A", description: "Shortlisting, funding (TA/RA), professor emails and the study-permit document checklist.", durationMin: 30 },
  ]);
  await db().insert(mentorProfiles).values({ userId: applicant.id, status: "pending", headline: "MSc Sustainability, Lund University · Swedish Institute scholar", credentials: "Swedish Institute Scholarship for Global Professionals 2024 recipient; MSc at Lund University (2026). Worked 3 years at an NGO in Dhaka before applying.", evidenceLinks: ["https://www.linkedin.com/in/example-rumana", "https://www.lunduniversity.lu.se/"], scopeStatement: "I can advise on the Swedish Institute scholarship, Swedish master's applications and student life in Lund. I can't advise on residence-permit refusals.", conflictOfInterest: "None.", weeklyCapacity: 3, submittedAt: days(1) });
  await db().insert(mentorTopics).values({ userId: applicant.id, topicId: await tid("scholarships") });

  // Completed sessions with verified feedback → ratings, reliability and reputation appear on profiles.
  const [nusratOffer] = await db().select().from(offerings).where(eq(offerings.mentorId, mentor.id)).limit(1);
  const reviewers = [student, helper, nadia, tamim, farhan, arif];
  const reviewTexts = [
    "Very clear comparison of TU Munich and RWTH. She told me honestly that my CGPA was borderline for one programme and helped me find two better fits.",
    "Explained APS and uni-assist step by step. Saved me weeks of confusion.",
    "Kind, patient and realistic. Shared her own SOP structure (without letting me copy it!).",
    "Helped me plan my timeline for next year's intake. Very practical.",
    "",
    "Great session on blocked accounts and health insurance — she insisted I verify everything on official sites.",
  ];
  for (const [i, r] of reviewers.entries()) {
    const when = days(40 - i * 5);
    const [b] = await db()
      .insert(bookings)
      .values({ offeringId: nusratOffer!.id, mentorId: mentor.id, menteeId: r.id, topicId: await tid("higher-study-abroad"), status: "completed", subject: ["Choosing between TU Munich and RWTH", "APS and uni-assist timeline", "SOP structure for informatics", "Planning for the 2027 winter intake", "Life in Munich on a student budget", "Blocked account and insurance"][i]!, message: "Prepared questions shared in advance.", proposedTimes: [when], durationMin: 30, scheduledAt: when, mentorOutcome: "happened", menteeOutcome: "happened", requestExpiresAt: when, acceptedAt: when, completedAt: when, closedAt: when, createdAt: days(45 - i * 5) })
      .returning();
    const scores = { helpfulness: i === 3 ? 4 : 5, knowledge: i === 4 ? 4 : 5, respect: 5 };
    const [f] = await db().insert(feedback).values({ bookingId: b!.id, mentorId: mentor.id, menteeId: r.id, ...scores, comment: reviewTexts[i]!, createdAt: when }).returning();
    await award({ userId: mentor.id, kind: "session_completed", points: 5, sourceType: "booking", sourceId: b!.id, topicId: await tid("higher-study-abroad") });
    await award({ userId: mentor.id, kind: "feedback", points: 5, sourceType: "feedback", sourceId: f!.id, topicId: await tid("higher-study-abroad") });
  }
  // An open request waiting for the mentor (shown on the mentor's dashboard/session page).
  const soon = (h: number) => new Date(Math.ceil((Date.now() + h * 3600_000) / 1800_000) * 1800_000);
  await db().insert(bookings).values({ offeringId: nusratOffer!.id, mentorId: mentor.id, menteeId: nadia.id, topicId: await tid("higher-study-abroad"), status: "requested", subject: "Is a chemistry background OK for an MSc in Materials in Germany?", message: "I'm finishing my BSc in Chemistry at CU with a 3.45 CGPA. Would programmes like Materials Science at KIT or TU Dresden consider me, and should I take extra physics courses first?", proposedTimes: [soon(30), soon(54)], durationMin: 30, requestExpiresAt: new Date(Date.now() + 70 * 3600_000) });
  await db().insert(bookings).values({ offeringId: farhanOffer!.id, mentorId: farhan.id, menteeId: student.id, topicId: await tid("scholarships"), status: "accepted", subject: "MEXT research proposal feedback", message: "I've drafted a 2-page research proposal on power electronics. Could you check whether the scope is realistic for MEXT?", proposedTimes: [soon(50)], durationMin: 45, scheduledAt: soon(50), meetingUrl: "https://meet.jit.si/PeerLink-demo0000000000000000", acceptedAt: new Date(), requestExpiresAt: new Date(Date.now() + 50 * 3600_000) });

  // Community Q&A across topics.
  const q = async (author: typeof student, slug: string, type: "question" | "discussion" | "guide" | "story", title: string, body: string, tags: string[], extra: Partial<typeof posts.$inferInsert> = {}) =>
    (await db().insert(posts).values({ authorId: author.id, topicId: await tid(slug), type, title, body, tags, ...extra }).returning())[0]!;
  const ans = async (postId: string, author: typeof student, body: string, helpful = 0) => {
    const [a] = await db().insert(answers).values({ postId, authorId: author.id, body, helpfulCount: helpful }).returning();
    await db().update(posts).set({ answerCount: sql`${posts.answerCount} + 1` }).where(eq(posts.id, postId));
    return a!;
  };
  const p1 = await q(tamim, "university-admission-bd", "question", "How should I prepare for the BUET admission test in 4 months?", "I finished HSC this year (science). I have around 4 months before the BUET admission test. How should I split my time between physics, chemistry and maths, and which question banks are actually useful?", ["buet", "admission"], { createdAt: days(3), helpfulCount: 7 });
  const a1 = await ans(p1.id, helper, "Do the last 10 years of BUET questions first, timed. Then go back to your HSC textbooks for every topic you got wrong — most questions test fundamentals, not tricks. Maths needs the most daily practice; physics problems reward understanding units and diagrams. Take one full mock every week.", 12);
  await ans(p1.id, sadia, "Also: protect your sleep and take one day off a week. Burnout in the last month costs more marks than any shortcut. You can do this!", 5);
  await db().update(posts).set({ acceptedAnswerId: a1.id }).where(eq(posts.id, p1.id));
  await award({ userId: helper.id, kind: "answer_accepted", points: 10, sourceType: "answer", sourceId: a1.id, topicId: await tid("university-admission-bd") });

  const p2 = await q(nadia, "scholarships", "question", "Is the Commonwealth Master's Scholarship open to Bangladeshi applicants this year?", "I keep seeing Facebook posts saying Commonwealth scholarships need an agent 'processing fee'. Is that true? Where do I apply officially?", ["commonwealth", "uk"], { createdAt: days(2), helpfulCount: 9 });
  const a2 = await ans(p2.id, arif, "Never pay an agent for a scholarship application — Commonwealth scholarships are applied for through the official CSC website and your national nominating body. Check the current call and the eligibility list on cscuk.fcdo.gov.uk. Any 'processing fee' to a person is a scam.", 15);
  await db().update(posts).set({ acceptedAnswerId: a2.id }).where(eq(posts.id, p2.id));

  await q(sadia, "careers", "guide", "A practical CV checklist for fresh CSE graduates in Bangladesh", "1. One page. Put projects above coursework.\n2. For each project: what you built, the tech, and one measurable result.\n3. Link GitHub — and make sure the top 3 repos have READMEs.\n4. No photo, no date of birth, no religion or marital status — they are not relevant to your skills.\n5. Tailor the top summary to each job.\n6. Proofread twice; ask a friend to read it aloud.\n\nNever pay anyone who promises a job in exchange for a 'registration fee'.", ["cv", "jobs"], { createdAt: days(6), helpfulCount: 21, sources: ["https://www.bdjobs.com/"], lastVerifiedOn: inDays(-6) });
  await q(farhan, "research", "discussion", "How do you approach professors in Japan before applying for MEXT (university route)?", "Sharing what worked for me: read 2–3 of the professor's recent papers, write a short email (under 200 words) with a specific question about their work, attach a one-page proposal. Expect replies in 1–3 weeks. What has worked for others?", ["mext", "research"], { createdAt: days(4), helpfulCount: 6 });
  await q(student, "student-visa", "question", "জার্মান স্টুডেন্ট ভিসার ইন্টারভিউতে কী ধরনের প্রশ্ন করা হয়?", "ঢাকার জার্মান দূতাবাসে স্টুডেন্ট ভিসার ইন্টারভিউ সামনে। আপনারা কী কী প্রশ্নের সম্মুখীন হয়েছেন? কোন কাগজপত্র সঙ্গে রাখা দরকার?", ["germany", "visa"], { createdAt: days(1), helpfulCount: 3 });
  await q(arif, "higher-study-abroad", "story", "From KUET to the University of Toronto: what I wish I'd known", "I applied to six universities with a 3.6 CGPA and got two funded offers. The biggest lessons: email professors early, write a specific SOP for each programme, and budget for application fees honestly — they add up. Happy to answer questions here.", ["canada", "masters"], { createdAt: days(8), helpfulCount: 14 });
  await q(tamim, "student-life", "discussion", "How do you deal with pressure from family about admission results?", "Everyone around me compares results. Some days it feels like too much. How do other students handle this?", ["wellbeing"], { createdAt: days(2), helpfulCount: 8 });

  // Opportunities: verified (with deadlines) and one unverified.
  await db().insert(posts).values([
    { authorId: farhan.id, topicId: await tid("scholarships"), type: "opportunity", title: "MEXT Research Scholarship 2027 (Embassy recommendation)", body: "The Embassy of Japan in Bangladesh announces the MEXT research scholarship for 2027. Check eligibility, required documents and the exam schedule on the embassy's official website. The application is free.", tags: ["mext", "japan"], orgName: "Embassy of Japan in Bangladesh / MEXT", officialUrl: "https://www.bd.emb-japan.go.jp/", involvesFee: false, deadline: inDays(28), verifiedAt: days(2), verifiedBy: admin.id, createdAt: days(3) },
    { authorId: arif.id, topicId: await tid("scholarships"), type: "opportunity", title: "Chevening Scholarships — applications for 2027/28", body: "Fully funded one-year master's in the UK for future leaders. Apply only on the official Chevening website; there is no application fee.", tags: ["uk", "chevening"], orgName: "Chevening (UK FCDO)", officialUrl: "https://www.chevening.org/", involvesFee: false, deadline: inDays(36), verifiedAt: days(5), verifiedBy: admin.id, createdAt: days(6) },
    { authorId: sadia.id, topicId: await tid("careers"), type: "opportunity", title: "Summer software internship — Dhaka fintech (paid)", body: "Paid 3-month internship for final-year CSE students. Apply through the company's careers page on bdjobs. There is no fee of any kind.", tags: ["internship"], orgName: "Example Fintech Ltd.", officialUrl: "https://www.bdjobs.com/", involvesFee: false, deadline: inDays(14), createdAt: days(1) },
  ]);

  // Votes from members, a reported post for the moderation demo, notifications for the student.
  await db().insert(votes).values([{ userId: student.id, targetType: "answer", targetId: a1.id }, { userId: nadia.id, targetType: "answer", targetId: a1.id }]).onConflictDoNothing();
  const [reported] = await db().insert(posts).values({ authorId: scammy.id, topicId: await tid("careers"), type: "discussion", title: "Earn from home — join our team today", body: "Work from home and earn daily income. Join our team, limited seats. Message me for details.", status: "flagged", riskScore: 32, riskSignals: [{ code: "MLM_INCOME", weight: 20 }, { code: "URGENCY_PRESSURE", weight: 12 }], createdAt: days(0.5) }).returning();
  await db().insert(reports).values([
    { reporterId: nadia.id, targetType: "post", targetId: reported!.id, targetUserId: scammy.id, reason: "scam", details: "Looks like an MLM recruitment post.", priority: 1, weight: 1, createdAt: new Date(Date.now() - 2 * 3600_000) },
    { reporterId: tamim.id, targetType: "post", targetId: reported!.id, targetUserId: scammy.id, reason: "spam", details: "", priority: 3, weight: 1, createdAt: new Date(Date.now() - 3600_000) },
  ]);
  await db().insert(notifications).values([
    { userId: student.id, kind: "booking_accepted", title: "Your session request was accepted", link: "/bookings", createdAt: days(0.2) },
    { userId: student.id, kind: "answer", title: "Someone answered your post", link: "/feed", createdAt: days(0.5) },
  ]);

  // Trust levels are earned, never granted: store what each member's seeded activity earns, exactly as the daily
  // recompute would (the founder keeps TL4 as an appointed leader).
  for (const u of await db().select({ id: users.id }).from(users)) {
    const inputs = await gatherTrustInputs(u.id);
    if (inputs) await db().update(users).set({ trustLevel: computeTrustLevel(inputs) }).where(eq(users.id, u.id));
  }

  console.log("demo data seeded");
  console.log(`  ${DEMO_EMAIL.admin}  TOTP secret: ${adminSecret}`);
  console.log(`  ${DEMO_EMAIL.mentor} TOTP secret: ${mentorSecret}`);
  console.log(`  password for all demo accounts: "${DEMO_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
