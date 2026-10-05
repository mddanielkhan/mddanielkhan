import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { blockedIdentifiers, consentRecords, emailTokens, profiles, recoveryCodes, sessions, users } from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";
import { checkPasswordPolicy, hashPassword, isBreachedPassword, needsRehash, verifyDummy, verifyPassword, type PasswordIssue } from "@/lib/auth/password";
import { createSession, markReauthenticated, recentlyReauthenticated, revokeAllSessions, revokeSession, type ResolvedSession } from "@/lib/auth/session";
import { generateRecoveryCodes, generateTotpSecret, normaliseRecoveryCode, verifyTotp } from "@/lib/auth/totp";
import { decryptField, encryptField, hashIdentifier, randomToken, sha256Hex } from "@/lib/security/crypto";
import { appLink, sendEmail } from "@/lib/notify/email";
import { AppError } from "@/lib/http/errors";
import { POLICY_VERSIONS } from "@/lib/config/brand";
import { isPaused } from "@/lib/settings";
import { env } from "@/lib/env";

/**
 * Authentication flows. Security properties enforced here:
 *  - No account enumeration: registration, login and password reset give the
 *    same response whether or not an email is registered.
 *  - Timing equalisation on unknown accounts (dummy Argon2 verify).
 *  - Email/reset tokens: 256-bit random, stored as SHA-256 only, single-use, short-lived.
 *  - Session rotation on every privilege change (login, MFA step-up, password change).
 */

const TOKEN_TTL = { verify_email: 24 * 3600_000, reset_password: 30 * 60_000, institution_email: 24 * 3600_000, change_email: 24 * 3600_000 } as const;

export const PASSWORD_MESSAGES: Record<PasswordIssue, string> = {
  too_short: "Use at least 15 characters. Tip: a passphrase of 3–4 random words is strong and easy to remember.",
  too_long: "Use at most 128 characters.",
  common: "That password is too common. Choose something unique to you.",
  contains_personal_info: "Don't include your username or email in your password.",
  repetitive: "That password is too repetitive.",
  breached: "That password has appeared in a known data breach. Please choose a different one.",
};

async function assertStrongPassword(password: string, context: { email?: string; username?: string }) {
  const issue = checkPasswordPolicy(password, context);
  if (issue) throw new AppError(`password_${issue}`, 400, PASSWORD_MESSAGES[issue]);
  if (await isBreachedPassword(password)) throw new AppError("password_breached", 400, PASSWORD_MESSAGES.breached);
}

export async function issueEmailToken(userId: string, purpose: keyof typeof TOKEN_TTL, emailAddress?: string) {
  const token = randomToken(32);
  await db().transaction(async (tx) => {
    // Invalidate older unused tokens of the same purpose (only the newest link works).
    await tx
      .update(emailTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose), isNull(emailTokens.usedAt)));
    await tx.insert(emailTokens).values({
      userId,
      purpose,
      tokenHash: sha256Hex(token),
      email: emailAddress ?? null,
      expiresAt: new Date(Date.now() + TOKEN_TTL[purpose]),
    });
  });
  return token;
}

/** Atomically consume a token (single use even under concurrent clicks). */
export async function consumeEmailToken(token: string, purpose: keyof typeof TOKEN_TTL) {
  const [row] = await db()
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailTokens.tokenHash, sha256Hex(token)), eq(emailTokens.purpose, purpose), isNull(emailTokens.usedAt), gt(emailTokens.expiresAt, new Date())))
    .returning();
  return row ?? null;
}

// ─── Registration ───────────────────────────────────────────────────────────

export async function verifyTurnstile(token: string | undefined, ip: string | null) {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // fail closed for bot protection on signup
  }
}

export async function register(input: { email: string; username: string; displayName: string; password: string }, ctx: { ipHash: string | null }) {
  if (await isPaused("registrations_paused")) throw new AppError("registrations_paused", 503);
  await assertStrongPassword(input.password, { email: input.email, username: input.username });

  const [banned] = await db().select().from(blockedIdentifiers).where(eq(blockedIdentifiers.valueHash, hashIdentifier("email", input.email)));
  if (banned) {
    await audit({ action: "user.register_blocked", meta: { reason: "banned_identifier" }, ipHash: ctx.ipHash });
    return; // same response as success; no account created
  }

  const [usernameTaken] = await db().select({ id: users.id }).from(users).where(eq(users.username, input.username));
  if (usernameTaken) throw new AppError("username_taken", 409, "That username is taken.");

  const [existing] = await db().select({ id: users.id, status: users.status }).from(users).where(eq(users.email, input.email));
  if (existing) {
    // Anti-enumeration: tell the mailbox owner, not the requester.
    if (existing.status !== "deleted") {
      await sendEmail(input.email, { kind: "notification", title: "Someone tried to create an account with your email", link: appLink("/login") });
    }
    await audit({ action: "user.register_duplicate_email", actorId: existing.id, ipHash: ctx.ipHash });
    return;
  }

  const passwordHash = await hashPassword(input.password);
  const userId = await db().transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ email: input.email, username: input.username, displayName: input.displayName, passwordHash, adultAttestedAt: new Date() })
      .returning({ id: users.id });
    await tx.insert(profiles).values({ userId: u!.id });
    await tx.insert(consentRecords).values(
      (Object.entries(POLICY_VERSIONS) as Array<[string, string]>).map(([document, version]) => ({ userId: u!.id, document, version })),
    );
    await audit({ action: "user.registered", actorId: u!.id, targetType: "user", targetId: u!.id, ipHash: ctx.ipHash }, tx);
    return u!.id;
  });
  const token = await issueEmailToken(userId, "verify_email");
  await sendEmail(input.email, { kind: "verify_email", link: appLink(`/verify-email/confirm?token=${token}`) });
}

export async function verifyEmail(token: string) {
  const row = await consumeEmailToken(token, "verify_email");
  if (!row) throw new AppError("token_invalid", 400, "This link is invalid or has expired. Request a new one.");
  await db().update(users).set({ emailVerifiedAt: new Date() }).where(and(eq(users.id, row.userId), isNull(users.emailVerifiedAt)));
  await audit({ action: "user.email_verified", actorId: row.userId, targetType: "user", targetId: row.userId });
  return row.userId;
}

export async function resendVerification(userId: string) {
  const [u] = await db().select().from(users).where(eq(users.id, userId));
  if (!u || u.emailVerifiedAt) return;
  const token = await issueEmailToken(userId, "verify_email");
  await sendEmail(u.email, { kind: "verify_email", link: appLink(`/verify-email/confirm?token=${token}`) });
}

// ─── Login ──────────────────────────────────────────────────────────────────

export type LoginOutcome = { kind: "ok"; token: string; maxAgeSec: number } | { kind: "mfa"; token: string; maxAgeSec: number };

export async function login(input: { email: string; password: string }, ctx: { ipHash: string | null; userAgent: string | null }): Promise<LoginOutcome> {
  const [u] = await db().select().from(users).where(eq(users.email, input.email));
  if (!u || u.status === "deleted") {
    await verifyDummy(input.password);
    await audit({ action: "auth.login_failed", meta: { reason: "unknown_account" }, ipHash: ctx.ipHash });
    throw new AppError("invalid_credentials", 401, "Email or password is incorrect.");
  }
  const valid = await verifyPassword(u.passwordHash, input.password);
  if (!valid) {
    await audit({ action: "auth.login_failed", actorId: u.id, meta: { reason: "bad_password" }, ipHash: ctx.ipHash });
    throw new AppError("invalid_credentials", 401, "Email or password is incorrect.");
  }
  if (u.status === "banned") {
    await audit({ action: "auth.login_banned", actorId: u.id, ipHash: ctx.ipHash });
    throw new AppError("account_banned", 403, "This account has been banned. You can appeal by emailing support.");
  }
  if (needsRehash(u.passwordHash)) {
    await db().update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, u.id));
  }

  const mfa = !!u.totpEnabledAt;
  const isNewDevice = await isUnfamiliarDevice(u.id, ctx.userAgent);
  const { token, expiresAt } = await createSession({ userId: u.id, role: u.role, mfaState: mfa ? "pending" : "none", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  await audit({ action: mfa ? "auth.login_password_ok_mfa_pending" : "auth.login_success", actorId: u.id, ipHash: ctx.ipHash });
  if (!mfa && isNewDevice && u.emailVerifiedAt) {
    await sendEmail(u.email, { kind: "new_login", when: new Date().toISOString().slice(0, 16).replace("T", " ") });
  }
  const maxAgeSec = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return mfa ? { kind: "mfa", token, maxAgeSec } : { kind: "ok", token, maxAgeSec };
}

async function isUnfamiliarDevice(userId: string, userAgent: string | null) {
  if (!userAgent) return true;
  const [seen] = await db()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.userAgent, userAgent.slice(0, 200)), gt(sessions.createdAt, new Date(Date.now() - 90 * 86400_000))))
    .limit(1);
  return !seen;
}

/** Second factor at login: TOTP code or a single-use recovery code. Rotates the session on success. */
export async function completeMfa(pending: ResolvedSession, code: string, ctx: { ipHash: string | null; userAgent: string | null }) {
  if (pending.session.mfaState !== "pending") throw new AppError("no_pending_mfa", 400);
  const ok = await checkSecondFactor(pending.user, code);
  if (!ok) {
    await audit({ action: "auth.mfa_failed", actorId: pending.user.id, ipHash: ctx.ipHash });
    throw new AppError("invalid_code", 401, "That code is not valid. Check your authenticator app's time is correct.");
  }
  await revokeSession(pending.session.id, "mfa_upgraded");
  const { token, expiresAt } = await createSession({ userId: pending.user.id, role: pending.user.role, mfaState: "verified", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  await audit({ action: "auth.login_success", actorId: pending.user.id, meta: { mfa: true }, ipHash: ctx.ipHash });
  return { token, maxAgeSec: Math.floor((expiresAt.getTime() - Date.now()) / 1000) };
}

async function checkSecondFactor(user: ResolvedSession["user"], code: string): Promise<boolean> {
  if (!user.totpSecretEnc || !user.totpEnabledAt) return false;
  const digits = code.replace(/\s+/g, "");
  if (/^\d{6}$/.test(digits)) {
    const secret = decryptField(user.totpSecretEnc, `totp:${user.id}`);
    const step = verifyTotp(secret, digits, user.totpLastStep ?? null);
    if (step === null) return false;
    // Persist the step atomically to defeat replays across concurrent requests.
    const updated = await db()
      .update(users)
      .set({ totpLastStep: step })
      .where(and(eq(users.id, user.id), sql`coalesce(${users.totpLastStep}, -1) < ${step}`))
      .returning({ id: users.id });
    return updated.length === 1;
  }
  const normalised = normaliseRecoveryCode(code);
  if (normalised.length !== 12) return false;
  const [used] = await db()
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(recoveryCodes.userId, user.id), eq(recoveryCodes.codeHash, sha256Hex(normalised)), isNull(recoveryCodes.usedAt)))
    .returning({ id: recoveryCodes.id });
  if (used) await audit({ action: "auth.recovery_code_used", actorId: user.id });
  return !!used;
}

export async function logout(session: ResolvedSession["session"]) {
  await revokeSession(session.id, "logout");
  await audit({ action: "auth.logout", actorId: session.userId });
}

// ─── Password reset & change ────────────────────────────────────────────────

export async function forgotPassword(emailAddress: string, ctx: { ipHash: string | null }) {
  const [u] = await db().select().from(users).where(eq(users.email, emailAddress));
  if (!u || u.status === "deleted" || u.status === "banned") {
    await audit({ action: "auth.reset_requested_unknown", ipHash: ctx.ipHash });
    return; // identical response
  }
  const token = await issueEmailToken(u.id, "reset_password");
  await sendEmail(u.email, { kind: "reset_password", link: appLink(`/reset-password?token=${token}`) });
  await audit({ action: "auth.reset_requested", actorId: u.id, ipHash: ctx.ipHash });
}

export async function resetPassword(token: string, newPassword: string, ctx: { ipHash: string | null }) {
  // Peek first so a weak password doesn't burn the single-use token.
  const [peek] = await db()
    .select({ userId: emailTokens.userId })
    .from(emailTokens)
    .where(and(eq(emailTokens.tokenHash, sha256Hex(token)), eq(emailTokens.purpose, "reset_password"), isNull(emailTokens.usedAt), gt(emailTokens.expiresAt, new Date())));
  if (!peek) throw new AppError("token_invalid", 400, "This reset link is invalid or has expired.");
  const [u] = await db().select().from(users).where(eq(users.id, peek.userId));
  if (!u) throw new AppError("token_invalid", 400);
  await assertStrongPassword(newPassword, { email: u.email, username: u.username });
  const row = await consumeEmailToken(token, "reset_password");
  if (!row) throw new AppError("token_invalid", 400, "This reset link is invalid or has expired.");
  const passwordHash = await hashPassword(newPassword);
  await db().transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(users.id, u.id));
    await revokeAllSessions(u.id, "password_reset", undefined, tx);
    await audit({ action: "auth.password_reset", actorId: u.id, ipHash: ctx.ipHash }, tx);
  });
  await sendEmail(u.email, { kind: "password_changed" });
}

export async function changePassword(actor: ResolvedSession, current: string, next: string, ctx: { ipHash: string | null; userAgent: string | null }) {
  if (!(await verifyPassword(actor.user.passwordHash, current))) throw new AppError("invalid_credentials", 401, "Your current password is incorrect.");
  await assertStrongPassword(next, { email: actor.user.email, username: actor.user.username });
  const passwordHash = await hashPassword(next);
  const changedAt = new Date();
  await db().transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, passwordChangedAt: changedAt }).where(eq(users.id, actor.user.id));
    await revokeAllSessions(actor.user.id, "password_changed", undefined, tx);
    await audit({ action: "auth.password_changed", actorId: actor.user.id, ipHash: ctx.ipHash }, tx);
  });
  await sendEmail(actor.user.email, { kind: "password_changed" });
  // Fresh session for the current device (rotation).
  const mfaState = actor.user.totpEnabledAt ? "verified" : "none";
  const { token, expiresAt } = await createSession({ userId: actor.user.id, role: actor.user.role, mfaState, ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  return { token, maxAgeSec: Math.floor((expiresAt.getTime() - Date.now()) / 1000) };
}

/** Step-up re-authentication for sensitive actions (delete account, disable 2FA, change email). */
export async function reauthenticate(actor: ResolvedSession, password: string, code: string | undefined) {
  if (!(await verifyPassword(actor.user.passwordHash, password))) throw new AppError("invalid_credentials", 401, "Password is incorrect.");
  if (actor.user.totpEnabledAt && !(await checkSecondFactor(actor.user, code ?? ""))) throw new AppError("invalid_code", 401, "Enter a valid 2FA code.");
  await markReauthenticated(actor.session.id);
  await audit({ action: "auth.reauthenticated", actorId: actor.user.id });
}

export function requireRecentReauth(actor: ResolvedSession) {
  if (!recentlyReauthenticated(actor.session)) throw new AppError("reauth_required", 401, "Please confirm your password to continue.");
}

// ─── TOTP enrolment ─────────────────────────────────────────────────────────

export async function beginTotpEnrollment(actor: ResolvedSession) {
  if (actor.user.totpEnabledAt) throw new AppError("totp_already_enabled", 409);
  const secret = generateTotpSecret();
  await db()
    .update(users)
    .set({ totpSecretEnc: encryptField(secret, `totp:${actor.user.id}`), totpLastStep: null })
    .where(eq(users.id, actor.user.id));
  return secret;
}

export function pendingTotpSecret(user: ResolvedSession["user"]): string | null {
  if (!user.totpSecretEnc || user.totpEnabledAt) return null;
  return decryptField(user.totpSecretEnc, `totp:${user.id}`);
}

export async function confirmTotpEnrollment(actor: ResolvedSession, code: string) {
  const secret = pendingTotpSecret(actor.user);
  if (!secret) throw new AppError("totp_not_started", 400, "Start 2FA setup first.");
  const step = verifyTotp(secret, code, null);
  if (step === null) throw new AppError("invalid_code", 400, "That code didn't match. Make sure your phone's clock is set automatically.");
  const codes = generateRecoveryCodes();
  await db().transaction(async (tx) => {
    await tx.update(users).set({ totpEnabledAt: new Date(), totpLastStep: step }).where(eq(users.id, actor.user.id));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, actor.user.id));
    await tx.insert(recoveryCodes).values(codes.map((c) => ({ userId: actor.user.id, codeHash: sha256Hex(normaliseRecoveryCode(c)) })));
    await tx.update(sessions).set({ mfaState: "verified", reauthenticatedAt: new Date() }).where(eq(sessions.id, actor.session.id));
    await audit({ action: "auth.totp_enabled", actorId: actor.user.id }, tx);
  });
  return codes;
}

export async function disableTotp(actor: ResolvedSession, password: string, code: string) {
  if (actor.user.role !== "member") throw new AppError("staff_mfa_mandatory", 403, "Staff accounts cannot disable 2FA.");
  if (!(await verifyPassword(actor.user.passwordHash, password))) throw new AppError("invalid_credentials", 401, "Password is incorrect.");
  if (!(await checkSecondFactor(actor.user, code))) throw new AppError("invalid_code", 401, "Enter a valid 2FA or recovery code.");
  await db().transaction(async (tx) => {
    await tx.update(users).set({ totpEnabledAt: null, totpSecretEnc: null, totpLastStep: null }).where(eq(users.id, actor.user.id));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, actor.user.id));
    await audit({ action: "auth.totp_disabled", actorId: actor.user.id }, tx);
  });
}

export async function remainingRecoveryCodes(userId: string) {
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
  return r?.n ?? 0;
}

// ─── Devices ────────────────────────────────────────────────────────────────

export async function listSessions(userId: string) {
  return db()
    .select({ id: sessions.id, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt, userAgent: sessions.userAgent, mfaState: sessions.mfaState })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastSeenAt));
}

export async function revokeOwnSession(userId: string, sessionId: string) {
  const res = await db()
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: "user_revoked" })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  if (res.length === 0) throw new AppError("not_found", 404);
  await audit({ action: "auth.session_revoked", actorId: userId });
}

export async function revokeOtherSessions(actor: ResolvedSession) {
  await revokeAllSessions(actor.user.id, "user_revoked_all", actor.session.id);
  await audit({ action: "auth.other_sessions_revoked", actorId: actor.user.id });
}
