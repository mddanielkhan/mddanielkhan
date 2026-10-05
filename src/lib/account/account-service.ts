import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  answers,
  badges,
  blockedIdentifiers,
  bookingMessages,
  bookings,
  consentRecords,
  feedback,
  mentorProfiles,
  mentorTopics,
  moderationActions,
  notifications,
  offerings,
  posts,
  profiles,
  recoveryCodes,
  reputationEvents,
  sessions,
  strikes,
  users,
  votes,
  appeals,
} from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";
import { verifyPassword } from "@/lib/auth/password";
import { revokeAllSessions, type ResolvedSession } from "@/lib/auth/session";
import { hashIdentifier, randomToken } from "@/lib/security/crypto";
import { AppError } from "@/lib/http/errors";
import { appLink, sendEmail } from "@/lib/notify/email";
import { consumeEmailToken, issueEmailToken } from "./auth-service";
import { evaluateRisk } from "@/lib/risk/engine";
import { grantBadge } from "@/lib/trust/badges";

// ─── Profile ────────────────────────────────────────────────────────────────

export type ProfileInput = {
  displayName: string;
  headline: string;
  bio: string;
  institution: string;
  fieldOfStudy: string;
  location: string;
  languages: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  gender?: string;
  showGender: boolean;
  allowSearchIndexing: boolean;
  emailNotifications: boolean;
  locale?: "en" | "bn";
};

export async function updateProfile(actor: ResolvedSession, input: ProfileInput) {
  // Bios are public: screen them like posts (scam funnels love profile bios).
  const risk = evaluateRisk({
    text: `${input.displayName}\n${input.headline}\n${input.bio}`,
    surface: "profile",
    authorTrustLevel: actor.user.trustLevel,
    authorAccountAgeMs: Date.now() - actor.user.createdAt.getTime(),
    extraUrls: [input.websiteUrl].filter((u): u is string => !!u),
  });
  if (risk.decision === "hold" || risk.decision === "reject") {
    throw new AppError("profile_rejected", 400, "Your profile contains contact details, payment requests or links we don't allow in bios. Please remove them.");
  }
  const languages = input.languages
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  await db().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ displayName: input.displayName, ...(input.locale ? { locale: input.locale } : {}) })
      .where(eq(users.id, actor.user.id));
    await tx
      .update(profiles)
      .set({
        headline: input.headline,
        bio: input.bio,
        institution: input.institution,
        fieldOfStudy: input.fieldOfStudy,
        location: input.location,
        languages,
        linkedinUrl: input.linkedinUrl ?? null,
        websiteUrl: input.websiteUrl ?? null,
        gender: input.gender ? input.gender : null,
        showGender: input.showGender && !!input.gender,
        allowSearchIndexing: input.allowSearchIndexing,
        emailNotifications: input.emailNotifications,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, actor.user.id));
    await audit({ action: "profile.updated", actorId: actor.user.id, targetType: "user", targetId: actor.user.id }, tx);
  });
}

// ─── Institutional email verification (badge: fact, not claim) ─────────────

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "proton.me", "protonmail.com", "aol.com", "gmx.com", "yandex.com", "mail.com", "zoho.com"]);
const ACADEMIC_SUFFIXES = ["edu", "edu.bd", "ac.bd", "ac.uk", "edu.au", "ac.jp", "ac.kr", "edu.my", "ac.in", "edu.cn", "edu.sg", "ac.nz", "edu.pk", "ac.id", "edu.tr", "ac.at", "ac.be"];
/** Bangladeshi universities that use their own (non-.ac.bd/.edu.bd) domains. Extend via moderators as needed. */
const KNOWN_ACADEMIC_DOMAINS = new Set(["northsouth.edu", "aiub.edu", "ewubd.edu", "iub.edu.bd", "uiu.ac.bd", "diu.edu.bd", "ulab.edu.bd", "aust.edu", "nsu.edu.bd"]);

export function isAcademicDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (FREE_MAIL.has(d)) return false;
  if (KNOWN_ACADEMIC_DOMAINS.has(d) || [...KNOWN_ACADEMIC_DOMAINS].some((k) => d.endsWith(`.${k}`))) return true;
  return ACADEMIC_SUFFIXES.some((s) => d.endsWith(`.${s}`));
}

export async function requestInstitutionVerification(actor: ResolvedSession, address: string) {
  const domain = address.split("@")[1] ?? "";
  if (!isAcademicDomain(domain)) {
    throw new AppError("not_academic_domain", 400, "Use an email address issued by a university or college (for example …@du.ac.bd). Free email providers can't be used.");
  }
  const token = await issueEmailToken(actor.user.id, "institution_email", address);
  await sendEmail(address, { kind: "institution_email", link: appLink(`/settings/verify-institution/confirm?token=${token}`) });
  await audit({ action: "verification.institution_requested", actorId: actor.user.id, meta: { domain } });
}

export async function confirmInstitutionVerification(actor: ResolvedSession, token: string) {
  const row = await consumeEmailToken(token, "institution_email");
  if (!row || row.userId !== actor.user.id || !row.email) throw new AppError("token_invalid", 400, "This link is invalid, expired, or belongs to a different account.");
  const domain = row.email.split("@")[1]!.toLowerCase();
  // We store and display only the DOMAIN — the fact we verified — never the mailbox address.
  await grantBadge({
    userId: actor.user.id,
    kind: "institution_email",
    label: `Verified email at ${domain}`,
    method: "institution_email",
    expiresAt: new Date(Date.now() + 365 * 86400_000),
  });
  await audit({ action: "verification.institution_confirmed", actorId: actor.user.id, meta: { domain } });
}

// ─── Data rights (PDPA 2026: access & portability, erasure) ─────────────────

export async function exportUserData(userId: string) {
  const [u] = await db().select().from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("not_found", 404);
  const [profile] = await db().select().from(profiles).where(eq(profiles.userId, userId));
  const strip = <T extends Record<string, unknown>>(row: T, keys: string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
  const [myPosts, myAnswers, myBookings, given, received, notes, consents, rep, myBadges, mySessions, actions, myAppeals, mentor] = await Promise.all([
    db().select().from(posts).where(eq(posts.authorId, userId)),
    db().select().from(answers).where(eq(answers.authorId, userId)),
    db().select().from(bookings).where(or(eq(bookings.menteeId, userId), eq(bookings.mentorId, userId))),
    db().select().from(feedback).where(eq(feedback.menteeId, userId)),
    db().select({ helpfulness: feedback.helpfulness, knowledge: feedback.knowledge, respect: feedback.respect, comment: feedback.comment, createdAt: feedback.createdAt }).from(feedback).where(eq(feedback.mentorId, userId)),
    db().select().from(notifications).where(eq(notifications.userId, userId)),
    db().select().from(consentRecords).where(eq(consentRecords.userId, userId)),
    db().select().from(reputationEvents).where(eq(reputationEvents.userId, userId)),
    db().select().from(badges).where(eq(badges.userId, userId)),
    db().select({ createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt, userAgent: sessions.userAgent, revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.userId, userId)),
    db().select({ action: moderationActions.action, publicReason: moderationActions.publicReason, createdAt: moderationActions.createdAt }).from(moderationActions).where(eq(moderationActions.targetUserId, userId)),
    db().select().from(appeals).where(eq(appeals.userId, userId)),
    db().select().from(mentorProfiles).where(eq(mentorProfiles.userId, userId)),
  ]);
  const bookingIds = myBookings.map((b) => b.id);
  const messages = bookingIds.length ? await db().select().from(bookingMessages).where(and(inArray(bookingMessages.bookingId, bookingIds), eq(bookingMessages.senderId, userId))) : [];
  await audit({ action: "privacy.data_exported", actorId: userId });
  return {
    exportedAt: new Date().toISOString(),
    format: "peerlink-export-v1",
    note: "This file contains the personal data we hold about you. Feedback you received is anonymised to protect reviewers.",
    account: strip(u as unknown as Record<string, unknown>, ["passwordHash", "totpSecretEnc", "totpLastStep"]),
    profile,
    mentorProfile: mentor[0] ?? null,
    posts: myPosts,
    answers: myAnswers,
    bookings: myBookings,
    bookingMessagesSent: messages,
    feedbackGiven: given,
    feedbackReceived: received,
    notifications: notes,
    consents,
    reputationEvents: rep,
    badges: myBadges,
    sessions: mySessions,
    moderationActionsOnYourAccount: actions,
    appeals: myAppeals,
  };
}

/**
 * Account deletion (right to erasure). Personal data is erased immediately;
 * community threads keep the author's contributions as "Deleted member" unless
 * the user also asks to delete their content. A banned user's email hash is
 * kept in blocked_identifiers so deletion cannot be used for ban evasion.
 */
export async function deleteAccount(actor: ResolvedSession, password: string, deleteContent: boolean) {
  if (!(await verifyPassword(actor.user.passwordHash, password))) throw new AppError("invalid_credentials", 401, "Password is incorrect.");
  if (actor.user.role === "admin") throw new AppError("admin_cannot_self_delete", 403, "Transfer admin rights before deleting this account.");
  const userId = actor.user.id;
  const tombstone = `deleted_${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "")}`.slice(0, 24);
  await db().transaction(async (tx) => {
    // Cancel open bookings so counterparties are not left waiting.
    const open = await tx
      .select({ id: bookings.id, mentorId: bookings.mentorId, menteeId: bookings.menteeId })
      .from(bookings)
      .where(and(or(eq(bookings.menteeId, userId), eq(bookings.mentorId, userId)), inArray(bookings.status, ["requested", "accepted"])));
    for (const b of open) {
      await tx
        .update(bookings)
        .set({ status: b.mentorId === userId ? "cancelled_by_mentor" : "cancelled_by_mentee", cancelReason: "account_deleted", closedAt: new Date(), updatedAt: new Date() })
        .where(eq(bookings.id, b.id));
    }
    await tx.update(offerings).set({ active: false }).where(eq(offerings.mentorId, userId));
    await tx.delete(mentorTopics).where(eq(mentorTopics.userId, userId));
    await tx.delete(mentorProfiles).where(eq(mentorProfiles.userId, userId));
    await tx.delete(profiles).where(eq(profiles.userId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await tx.delete(votes).where(eq(votes.userId, userId));
    await tx.update(badges).set({ revokedAt: new Date(), revokeReason: "account_deleted" }).where(and(eq(badges.userId, userId), isNull(badges.revokedAt)));
    if (deleteContent) {
      await tx.update(posts).set({ status: "deleted", updatedAt: new Date() }).where(eq(posts.authorId, userId));
      await tx.update(answers).set({ status: "deleted", updatedAt: new Date() }).where(eq(answers.authorId, userId));
    }
    const hasActiveStrike = await tx.select({ id: strikes.id }).from(strikes).where(and(eq(strikes.userId, userId), sql`${strikes.expiresAt} > now()`)).limit(1);
    if (hasActiveStrike.length > 0) {
      await tx
        .insert(blockedIdentifiers)
        .values({ valueHash: hashIdentifier("email", actor.user.email), kind: "email", reason: "deleted_with_active_strike" })
        .onConflictDoNothing();
    }
    await tx
      .update(users)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        email: `${tombstone}@deleted.invalid`,
        username: tombstone,
        displayName: "Deleted member",
        passwordHash: "!deleted",
        totpSecretEnc: null,
        totpEnabledAt: null,
        emailVerifiedAt: null,
      })
      .where(eq(users.id, userId));
    await revokeAllSessions(userId, "account_deleted", undefined, tx);
    await audit({ action: "privacy.account_deleted", actorId: userId, meta: { deleteContent } }, tx);
  });
}

// ─── Locale ─────────────────────────────────────────────────────────────────

export const LOCALE_COOKIE = "peerlink_locale";

export async function setUserLocale(userId: string, locale: "en" | "bn") {
  await db().update(users).set({ locale }).where(eq(users.id, userId));
}
