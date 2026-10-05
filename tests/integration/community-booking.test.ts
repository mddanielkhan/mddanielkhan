import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bookings, feedback, moderationActions, posts, reputationEvents, users, badges, reports } from "@/lib/db/schema";
import { createPost, createAnswer, acceptAnswer, toggleVote, editPost, listFeed, getPostForViewer } from "@/lib/content/service";
import { requestBooking, acceptBooking, reportOutcome, leaveFeedback, cancelBooking, sendBookingMessage, runBookingMaintenance, resolveDispute, getBookingForViewer } from "@/lib/booking/service";
import { createReport } from "@/lib/reports/service";
import { decideContent, actOnUser, createAppeal, decideAppeal } from "@/lib/moderation/service";
import { recomputeTrustLevel } from "@/lib/trust/reputation";
import { listDirectory, mentorStats } from "@/lib/mentors/service";
import { makeMentor, makeUser, refresh, topicId, bdLocal } from "./helpers";

describe("community content", () => {
  it("publishes clean posts, holds scams, and never shows held content to others", async () => {
    const alice = await makeUser();
    const bob = await makeUser({ trustLevel: 1 });
    const t = await topicId();
    const clean = await createPost(alice, { type: "question", topicId: t, title: "How much is the German blocked account in 2026?", body: "I'm applying for a masters in Germany. How much do I need in the blocked account and which providers do students use?", tags: ["germany"] });
    expect(clean.status).toBe("published");
    const scam = await createPost(bob, { type: "discussion", topicId: t, title: "100% visa guarantee for Canada", body: "100% visa guarantee! No IELTS needed. Contact WhatsApp 01712345678 and pay advance fee to our bKash.", tags: [] });
    expect(["held", "rejected"]).toContain(scam.status);
    expect(scam.reasons.length).toBeGreaterThan(0);
    const feed = await listFeed({});
    expect(feed.items.map((p) => p.id)).toContain(clean.id);
    expect(feed.items.map((p) => p.id)).not.toContain(scam.id);
    expect(await getPostForViewer(scam.id, alice)).toBeNull(); // others cannot see it
    expect(await getPostForViewer(scam.id, bob)).not.toBeNull(); // the author can, with reasons
  });

  it("re-screens edits and strips opportunity verification when the text changes", async () => {
    const staff = await makeUser({ role: "moderator" }, { mfa: true });
    const author = await makeUser({ trustLevel: 2 });
    const t = await topicId("scholarships");
    const opp = await createPost(author, { type: "opportunity", topicId: t, title: "DAAD EPOS 2027 call is open", body: "The DAAD EPOS development-related postgraduate scholarship call is open. Read the official call before applying.", tags: [], orgName: "DAAD", officialUrl: "https://www.daad.de/en/", involvesFee: "no" });
    expect(opp.status).toBe("published");
    await decideContent(staff, { targetType: "post", targetId: opp.id, decision: "approve_verify", reasonCode: "verified", publicReason: "Checked against daad.de" });
    let [p] = await db().select().from(posts).where(eq(posts.id, opp.id));
    expect(p!.verifiedAt).not.toBeNull();
    const ev = await db().select().from(reputationEvents).where(and(eq(reputationEvents.userId, author.user.id), eq(reputationEvents.kind, "opportunity_verified")));
    expect(ev).toHaveLength(1);
    const edited = await editPost(author, { id: opp.id, title: "DAAD EPOS 2027 call is open", body: "Send 5000 tk processing fee to my bkash 01712345678 to apply, guaranteed scholarship.", tags: [] });
    expect(["held", "rejected"]).toContain(edited.status);
    [p] = await db().select().from(posts).where(eq(posts.id, opp.id));
    expect(p!.verifiedAt).toBeNull();
  });

  it("awards idempotent, capped reputation for votes and accepted answers", async () => {
    const asker = await makeUser();
    const helper = await makeUser();
    const voter = await makeUser();
    const t = await topicId();
    const q = await createPost(asker, { type: "question", topicId: t, title: "Which documents for uni-assist?", body: "What documents should I send to uni-assist for a masters application from Bangladesh?", tags: [] });
    const a = await createAnswer(helper, { postId: q.id, body: "Certified copies of your transcripts and degree certificate, plus the VPD if required." });
    expect(a.status).toBe("published");
    await toggleVote(voter, { targetType: "answer", targetId: a.id });
    await toggleVote(voter, { targetType: "answer", targetId: a.id }); // unvote
    await toggleVote(voter, { targetType: "answer", targetId: a.id }); // vote again: no new points
    await expect(toggleVote(helper, { targetType: "answer", targetId: a.id })).rejects.toMatchObject({ code: "cannot_vote_own" });
    await acceptAnswer(asker, { postId: q.id, answerId: a.id });
    const [h] = await db().select().from(users).where(eq(users.id, helper.user.id));
    // +2 vote, −2 reversal, (no re-award) +10 accepted = 10
    expect(h!.reputation).toBe(10);
    const ledgerSum = await db().select({ s: sql<number>`sum(points)::int` }).from(reputationEvents).where(eq(reputationEvents.userId, helper.user.id));
    expect(ledgerSum[0]!.s).toBe(h!.reputation); // denormalised score always equals the ledger
  });

  it("hides content after weighted community reports, but not from throwaway accounts", async () => {
    const author = await makeUser();
    const t = await topicId();
    const p = await createPost(author, { type: "discussion", topicId: t, title: "A post that people will report", body: "This post will be reported by several members of the community for testing.", tags: [] });
    for (let i = 0; i < 4; i++) await createReport(await makeUser({ trustLevel: 0 }), { targetType: "post", targetId: p.id, reason: "spam", details: "" });
    let [row] = await db().select().from(posts).where(eq(posts.id, p.id));
    expect(row!.status).toBe("published"); // TL0 reports carry no hiding weight
    await createReport(await makeUser({ trustLevel: 3 }), { targetType: "post", targetId: p.id, reason: "scam", details: "" });
    await createReport(await makeUser({ trustLevel: 1 }), { targetType: "post", targetId: p.id, reason: "scam", details: "" });
    [row] = await db().select().from(posts).where(eq(posts.id, p.id));
    expect(row!.status).toBe("held");
  });
});

describe("mentoring sessions", () => {
  it("runs the full request → accept → both confirm → feedback loop", async () => {
    const { mentor, offeringId } = await makeMentor();
    const student = await makeUser();
    const dir = await listDirectory({});
    expect([...dir.established, ...dir.newMentors].map((m) => m.userId)).toContain(mentor.user.id);

    const id = await requestBooking(student, { offeringId, subject: "Choosing between TU Munich and RWTH", message: "I have admits from both for MSc Informatics and want to compare research groups and costs.", times: [bdLocal(20), bdLocal(30)] });
    await expect(requestBooking(student, { offeringId, subject: "Second request", message: "Trying to open a second request with the same mentor should fail.", times: [bdLocal(40)] })).rejects.toMatchObject({ code: "already_requested" });
    const [b0] = await db().select().from(bookings).where(eq(bookings.id, id));
    await expect(acceptBooking(student, { id, slot: b0!.proposedTimes[0]!.toISOString() })).rejects.toMatchObject({ code: "only_mentor_can_accept" });
    await acceptBooking(mentor, { id, slot: b0!.proposedTimes[0]!.toISOString() });
    const view = await getBookingForViewer(id, student);
    expect(view?.booking.meetingUrl).toMatch(/^https:\/\/meet\.jit\.si\/PeerLink-[0-9a-f]{24}$/);
    expect(await getBookingForViewer(id, await makeUser())).toBeNull(); // IDOR: strangers can't see it

    // Fast-forward: the session happened.
    await db().update(bookings).set({ scheduledAt: new Date(Date.now() - 2 * 3600_000) }).where(eq(bookings.id, id));
    await reportOutcome(mentor, { id, outcome: "happened" });
    let [b] = await db().select().from(bookings).where(eq(bookings.id, id));
    expect(b!.status).toBe("accepted");
    await reportOutcome(student, { id, outcome: "happened" });
    [b] = await db().select().from(bookings).where(eq(bookings.id, id));
    expect(b!.status).toBe("completed");

    await expect(leaveFeedback(mentor, { id, helpfulness: 5, knowledge: 5, respect: 5, comment: "" })).rejects.toMatchObject({ code: "feedback_not_allowed" });
    await leaveFeedback(student, { id, helpfulness: 5, knowledge: 4, respect: 5, comment: "Very clear comparison of the two programmes." });
    await expect(leaveFeedback(student, { id, helpfulness: 1, knowledge: 1, respect: 1, comment: "" })).rejects.toMatchObject({ code: "feedback_exists" });
    const fb = await db().select().from(feedback).where(eq(feedback.bookingId, id));
    expect(fb).toHaveLength(1);
    const stats = await mentorStats(mentor.user.id);
    expect(stats.completed).toBe(1);
    expect(stats.rating.display).toBe(false); // < 3 reviews → "new mentor"
  });

  it("blocks payment requests in private booking channels", async () => {
    const { mentor, offeringId } = await makeMentor();
    const student = await makeUser();
    await expect(
      requestBooking(student, { offeringId, subject: "Visa help please", message: "I will send 5000 tk to your bkash 01712345678 if you can guarantee my visa approval quickly.", times: [bdLocal(20)] }),
    ).rejects.toMatchObject({ code: "booking_request_blocked" });
    const id = await requestBooking(student, { offeringId, subject: "Visa document checklist", message: "Could you walk me through the documents you prepared for your German student visa interview?", times: [bdLocal(20)] });
    const r = await sendBookingMessage(mentor, { id, body: "Before we talk, send money to my bkash 01812345678 as booking fee." });
    expect(["held"]).toContain(r.status);
    const view = await getBookingForViewer(id, student);
    expect(view!.messages.find((m) => m.body.includes("bkash"))).toBeUndefined(); // student never sees it
  });

  it("resolves single-sided reports after 72h and disputes go to staff", async () => {
    const { mentor, offeringId } = await makeMentor();
    const student = await makeUser();
    const staff = await makeUser({ role: "moderator" }, { mfa: true });
    const id = await requestBooking(student, { offeringId, subject: "SOP review for Erasmus", message: "I would like feedback on the structure of my statement of purpose for Erasmus Mundus.", times: [bdLocal(20)] });
    const [b0] = await db().select().from(bookings).where(eq(bookings.id, id));
    await acceptBooking(mentor, { id, slot: b0!.proposedTimes[0]!.toISOString() });
    await db().update(bookings).set({ scheduledAt: new Date(Date.now() - 2 * 3600_000) }).where(eq(bookings.id, id));
    await reportOutcome(student, { id, outcome: "no_show" });
    await reportOutcome(mentor, { id, outcome: "happened" });
    let [b] = await db().select().from(bookings).where(eq(bookings.id, id));
    expect(b!.status).toBe("disputed");
    await expect(resolveDispute(mentor, { id, resolution: "completed", note: "I was there" })).rejects.toMatchObject({ code: "forbidden" });
    await resolveDispute(staff, { id, resolution: "no_show_mentor", note: "Mentor joined 40 minutes late per both accounts." });
    [b] = await db().select().from(bookings).where(eq(bookings.id, id));
    expect(b!.status).toBe("no_show_mentor");

    // Single-sided: mentee reports no-show, mentor silent for 72h → no_show_mentor.
    const id2 = await requestBooking(student, { offeringId, subject: "Follow-up session", message: "A follow-up on the SOP structure after I revised it with your earlier feedback.", times: [bdLocal(25)] });
    const [c0] = await db().select().from(bookings).where(eq(bookings.id, id2));
    await acceptBooking(mentor, { id: id2, slot: c0!.proposedTimes[0]!.toISOString() });
    await db().update(bookings).set({ scheduledAt: new Date(Date.now() - 2 * 3600_000) }).where(eq(bookings.id, id2));
    await reportOutcome(student, { id: id2, outcome: "no_show" });
    await db().update(bookings).set({ outcomeDeadline: new Date(Date.now() - 1000) }).where(eq(bookings.id, id2));
    await runBookingMaintenance();
    const [c] = await db().select().from(bookings).where(eq(bookings.id, id2));
    expect(c!.status).toBe("no_show_mentor");
  });

  it("expires unanswered requests", async () => {
    const { offeringId } = await makeMentor();
    const student = await makeUser();
    const id = await requestBooking(student, { offeringId, subject: "Quick question on IELTS", message: "Which IELTS band did you need for the scholarship and how did you prepare for writing?", times: [bdLocal(20)] });
    await db().update(bookings).set({ requestExpiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, id));
    await runBookingMaintenance();
    const [b] = await db().select().from(bookings).where(eq(bookings.id, id));
    expect(b!.status).toBe("expired");
    await expect(cancelBooking(student, { id, reason: "" })).rejects.toMatchObject({ code: "booking_closed" });
  });
});

describe("moderation & due process", () => {
  it("applies the strike ladder, notifies, and lets a DIFFERENT moderator grant an appeal", async () => {
    const mod1 = await makeUser({ role: "moderator" }, { mfa: true });
    const mod2 = await makeUser({ role: "moderator" }, { mfa: true });
    const member = await makeUser();
    const effect = await actOnUser(mod1, { userId: member.user.id, action: "strike", reasonCode: "spam", publicReason: "Repeated off-topic promotion.", internalNote: "", fraud: false });
    expect(effect).toBe("strike_1_restrict");
    const m = await refresh(member);
    expect(m.user.restrictedUntil!.getTime()).toBeGreaterThan(Date.now() + 6 * 86400_000);
    // Services enforce policy themselves (defence in depth), not only the route pipeline.
    await expect(createPost(m, { type: "question", topicId: await topicId(), title: "Can I still post while restricted?", body: "Testing that restricted members cannot create new posts at all.", tags: [] })).rejects.toMatchObject({ code: "restricted" });
    const [action] = await db().select().from(moderationActions).where(eq(moderationActions.targetUserId, member.user.id));
    const appealId = await createAppeal(m, { actionId: action!.id, statement: "This was my first post and I didn't know the promotion rule. I've removed it." });
    await expect(decideAppeal(mod1, { appealId, decision: "granted", note: "ok" })).rejects.toMatchObject({ code: "independent_review_required" });
    await decideAppeal(mod2, { appealId, decision: "granted", note: "First offence, member corrected it." });
    const after = await refresh(member);
    expect(after.user.restrictedUntil).toBeNull();
  });

  it("bans with full effects: sessions, badges, mentor status, open bookings", async () => {
    const admin = await makeUser({ role: "admin" }, { mfa: true });
    const { mentor, offeringId } = await makeMentor();
    await db().insert(badges).values({ userId: mentor.user.id, kind: "expert_verified", label: "x", method: "manual_review" });
    const student = await makeUser();
    const id = await requestBooking(student, { offeringId, subject: "Scholarship strategy session", message: "I want to plan my scholarship applications for the 2027 intake across three countries.", times: [bdLocal(20)] });
    await actOnUser(admin, { userId: mentor.user.id, action: "ban", reasonCode: "fraud", publicReason: "Solicited payments from students.", internalNote: "Reports R1-R3", fraud: true });
    const [u] = await db().select().from(users).where(eq(users.id, mentor.user.id));
    expect(u!.status).toBe("banned");
    const [b] = await db().select().from(bookings).where(eq(bookings.id, id));
    expect(b!.status).toBe("cancelled_by_mentor");
    const active = await db().select().from(badges).where(and(eq(badges.userId, mentor.user.id), sql`${badges.revokedAt} is null`));
    expect(active).toHaveLength(0);
    const dir = await listDirectory({});
    expect([...dir.established, ...dir.newMentors].map((x) => x.userId)).not.toContain(mentor.user.id);
  });

  it("routes crisis language to support without enforcement", async () => {
    const member = await makeUser();
    const p = await createPost(member, { type: "discussion", topicId: await topicId("student-life"), title: "Failed admission test again", body: "I failed my admission test again and I want to die. I don't know how to tell my parents.", tags: [] });
    expect(p.status).toBe("published");
    const r = await db().select().from(reports).where(and(eq(reports.targetId, p.id), eq(reports.reason, "self_harm")));
    expect(r).toHaveLength(1);
    expect(r[0]!.priority).toBe(0);
  });

  it("promotes trust levels from observable behaviour", async () => {
    const member = await makeUser({ trustLevel: 0, daysVisited: 4, createdAt: new Date(Date.now() - 5 * 86400_000) });
    await createPost(member, { type: "question", topicId: await topicId(), title: "First question from a new member", body: "Hello, this is my first question about studying in Japan with MEXT.", tags: [] });
    expect(await recomputeTrustLevel(member.user.id)).toBe(1);
  });
});
