import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { secureCookiesEnabled } from "@/lib/env";
import { randomToken, sha256Hex } from "@/lib/security/crypto";

/**
 * Opaque, server-side sessions (not JWTs).
 *
 * The cookie holds 256 random bits; the database stores only SHA-256(token),
 * so a database leak does not yield usable session cookies. Every request
 * re-reads the user row, so a ban, suspension, role change or password reset
 * takes effect on the very next request — no stale-claims window (the classic
 * JWT failure mode, and a gap in token-version JWT designs).
 */

export const SESSION_POLICY = {
  member: { absoluteMs: 30 * 86400_000, idleMs: 14 * 86400_000 },
  // Staff accounts are the highest-value targets: short sessions, MFA mandatory.
  staff: { absoluteMs: 12 * 3600_000, idleMs: 30 * 60_000 },
  mfaPending: { absoluteMs: 10 * 60_000, idleMs: 10 * 60_000 },
  touchEveryMs: 5 * 60_000,
  reauthWindowMs: 15 * 60_000,
} as const;

export function sessionCookieName() {
  return secureCookiesEnabled() ? "__Host-shikor_sid" : "shikor_sid";
}

export function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export type SessionUser = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type ResolvedSession = { session: SessionRow; user: SessionUser };

function isStaff(role: string) {
  return role === "moderator" || role === "admin";
}

export async function createSession(
  input: { userId: string; role: string; mfaState: "none" | "pending" | "verified"; ipHash: string | null; userAgent: string | null },
  tx: DbOrTx = db(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const policy = input.mfaState === "pending" ? SESSION_POLICY.mfaPending : isStaff(input.role) ? SESSION_POLICY.staff : SESSION_POLICY.member;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + policy.absoluteMs);
  await tx.insert(sessions).values({
    id: sha256Hex(token),
    userId: input.userId,
    mfaState: input.mfaState,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    reauthenticatedAt: input.mfaState === "pending" ? null : now,
    ipHash: input.ipHash,
    userAgent: input.userAgent?.slice(0, 200) ?? null,
  });
  return { token, expiresAt };
}

/**
 * Resolve a cookie token to a live session + fresh user row.
 * Returns null (and revokes where appropriate) for anything invalid.
 */
export async function resolveSession(token: string | undefined | null): Promise<ResolvedSession | null> {
  if (!token || token.length < 40 || token.length > 60) return null;
  const id = sha256Hex(token);
  const rows = await db()
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const { session, user } = row;
  const now = Date.now();

  if (session.expiresAt.getTime() <= now) return null;
  const policy = session.mfaState === "pending" ? SESSION_POLICY.mfaPending : isStaff(user.role) ? SESSION_POLICY.staff : SESSION_POLICY.member;
  if (now - session.lastSeenAt.getTime() > policy.idleMs) {
    await revokeSession(id, "idle_timeout");
    return null;
  }
  if (user.status === "banned" || user.status === "deleted") {
    await revokeSession(id, `account_${user.status}`);
    return null;
  }
  // Sessions created before the last password change are dead.
  if (user.passwordChangedAt && session.createdAt < user.passwordChangedAt) {
    await revokeSession(id, "password_changed");
    return null;
  }

  if (now - session.lastSeenAt.getTime() > SESSION_POLICY.touchEveryMs) {
    await touch(session, user);
  }
  return { session, user };
}

async function touch(session: SessionRow, user: SessionUser) {
  const today = new Date().toISOString().slice(0, 10);
  await db().update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, session.id));
  if (user.lastVisitedOn !== today) {
    await db()
      .update(users)
      .set({ lastVisitedOn: today, daysVisited: sql`${users.daysVisited} + 1` })
      .where(and(eq(users.id, user.id), or(isNull(users.lastVisitedOn), lt(users.lastVisitedOn, today))));
  }
}

export async function revokeSession(sessionId: string, reason: string) {
  await db().update(sessions).set({ revokedAt: new Date(), revokedReason: reason }).where(eq(sessions.id, sessionId));
}

export async function revokeSessionByToken(token: string, reason: string) {
  await revokeSession(sha256Hex(token), reason);
}

export async function revokeAllSessions(userId: string, reason: string, exceptSessionId?: string, tx: DbOrTx = db()) {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (exceptSessionId) conditions.push(sql`${sessions.id} <> ${exceptSessionId}`);
  await tx
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(...conditions));
}

export async function markMfaVerified(sessionId: string) {
  await db().update(sessions).set({ mfaState: "verified", reauthenticatedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function markReauthenticated(sessionId: string) {
  await db().update(sessions).set({ reauthenticatedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export function recentlyReauthenticated(session: SessionRow) {
  return !!session.reauthenticatedAt && Date.now() - session.reauthenticatedAt.getTime() < SESSION_POLICY.reauthWindowMs;
}

export async function purgeExpiredSessions() {
  await db()
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, new Date()), lt(sessions.revokedAt, new Date(Date.now() - 30 * 86400_000))));
}
