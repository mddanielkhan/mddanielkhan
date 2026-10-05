import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { readdir, readFile, rm } from "node:fs/promises";
import { db } from "@/lib/db/client";
import { auditLog, emailTokens, sessions, users } from "@/lib/db/schema";
import { register, login, verifyEmail, forgotPassword, resetPassword, completeMfa, beginTotpEnrollment, confirmTotpEnrollment } from "@/lib/account/auth-service";
import { resolveSession } from "@/lib/auth/session";
import { processDueJobs } from "@/lib/jobs/queue";
import "@/lib/jobs/handlers";
import { totpAt } from "@/lib/auth/totp";
import { verifyAuditChain } from "@/lib/audit/audit";
import { AppError } from "@/lib/http/errors";

const MAIL_DIR = "test-results/mail-integration";
const PASSWORD = "purple tiger river 1987";

async function lastMailTo(to: string, kind?: string) {
  await processDueJobs(50);
  const files = (await readdir(MAIL_DIR).catch(() => [])).sort();
  for (const f of files.reverse()) {
    const m = JSON.parse(await readFile(`${MAIL_DIR}/${f}`, "utf8"));
    if (m.to === to && (!kind || m.kind === kind)) return m as { subject: string; text: string; kind: string };
  }
  return null;
}
const tokenFrom = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";

describe("registration → verification → login", () => {
  it("registers without revealing whether an email exists, and verifies by single-use link", async () => {
    await rm(MAIL_DIR, { recursive: true, force: true });
    await register({ email: "rahima@example.com", username: "rahima", displayName: "Rahima", password: PASSWORD }, { ipHash: null });
    const mail = await lastMailTo("rahima@example.com", "verify_email");
    expect(mail?.kind).toBe("verify_email");
    const token = tokenFrom(mail!.text);
    // Tokens are stored hashed only.
    const rows = await db().select().from(emailTokens);
    expect(rows.every((r) => r.tokenHash !== token && r.tokenHash.length === 64)).toBe(true);

    // Duplicate registration: same (void) result, no second account, owner is told.
    await register({ email: "rahima@example.com", username: "rahima2", displayName: "Someone", password: PASSWORD }, { ipHash: null });
    const count = await db().select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.email, "rahima@example.com"));
    expect(count[0]!.n).toBe(1);
    expect((await lastMailTo("rahima@example.com"))?.subject).toMatch(/Shikor: Someone tried/);

    await verifyEmail(token);
    await expect(verifyEmail(token)).rejects.toBeInstanceOf(AppError); // single use
    const [u] = await db().select().from(users).where(eq(users.email, "rahima@example.com"));
    expect(u!.emailVerifiedAt).not.toBeNull();
    expect(u!.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("rejects weak passwords with NIST-aligned guidance", async () => {
    await expect(register({ email: "weak@example.com", username: "weakpw", displayName: "Weak", password: "short123" }, { ipHash: null })).rejects.toMatchObject({ code: "password_too_short" });
  });

  it("gives identical errors for unknown email and wrong password", async () => {
    const a = await login({ email: "nobody@example.com", password: PASSWORD }, { ipHash: null, userAgent: "t" }).catch((e) => e);
    const b = await login({ email: "rahima@example.com", password: "wrong password here!!" }, { ipHash: null, userAgent: "t" }).catch((e) => e);
    expect(a.code).toBe("invalid_credentials");
    expect(b.code).toBe("invalid_credentials");
    expect(a.message).toBe(b.message);
  });

  it("logs in and resolves an opaque session whose token is never stored", async () => {
    const r = await login({ email: "rahima@example.com", password: PASSWORD }, { ipHash: null, userAgent: "vitest" });
    expect(r.kind).toBe("ok");
    const s = await resolveSession(r.token);
    expect(s?.user.email).toBe("rahima@example.com");
    const stored = await db().select({ id: sessions.id }).from(sessions);
    expect(stored.some((x) => x.id === r.token)).toBe(false);
  });

  it("password reset revokes every existing session", async () => {
    const before = await login({ email: "rahima@example.com", password: PASSWORD }, { ipHash: null, userAgent: "vitest" });
    await forgotPassword("rahima@example.com", { ipHash: null });
    const mail = await lastMailTo("rahima@example.com", "reset_password");
    expect(mail?.kind).toBe("reset_password");
    await resetPassword(tokenFrom(mail!.text), "a brand new long passphrase", { ipHash: null });
    expect(await resolveSession(before.token)).toBeNull();
    await expect(login({ email: "rahima@example.com", password: PASSWORD }, { ipHash: null, userAgent: "t" })).rejects.toMatchObject({ code: "invalid_credentials" });
    expect((await login({ email: "rahima@example.com", password: "a brand new long passphrase" }, { ipHash: null, userAgent: "t" })).kind).toBe("ok");
  });

  it("enrols TOTP and then requires it at login, rejecting code replay", async () => {
    const first = await login({ email: "rahima@example.com", password: "a brand new long passphrase" }, { ipHash: null, userAgent: "t" });
    const actor = (await resolveSession(first.token))!;
    const secret = await beginTotpEnrollment(actor);
    const codes = await confirmTotpEnrollment((await resolveSession(first.token))!, totpAt(secret));
    expect(codes).toHaveLength(10);

    const second = await login({ email: "rahima@example.com", password: "a brand new long passphrase" }, { ipHash: null, userAgent: "t" });
    expect(second.kind).toBe("mfa");
    const pending = (await resolveSession(second.token))!;
    expect(pending.session.mfaState).toBe("pending");
    // The code used at enrolment was consumed; replay fails. A recovery code works once.
    await expect(completeMfa(pending, totpAt(secret), { ipHash: null, userAgent: "t" })).rejects.toMatchObject({ code: "invalid_code" });
    const done = await completeMfa(pending, codes[0]!, { ipHash: null, userAgent: "t" });
    expect((await resolveSession(done.token))?.session.mfaState).toBe("verified");
    expect(await resolveSession(second.token)).toBeNull(); // pending session rotated out

    const third = await login({ email: "rahima@example.com", password: "a brand new long passphrase" }, { ipHash: null, userAgent: "t" });
    await expect(completeMfa((await resolveSession(third.token))!, codes[0]!, { ipHash: null, userAgent: "t" })).rejects.toMatchObject({ code: "invalid_code" });
  });

  it("keeps an intact, verifiable audit chain that rejects tampering", async () => {
    const result = await verifyAuditChain();
    expect(result.ok).toBe(true);
    expect(result.checked).toBeGreaterThan(5);
    const cause = (e: unknown) => String((e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message);
    expect(cause(await db().execute(sql`update audit_log set action = 'tampered' where id = 1`).catch((e) => e))).toMatch(/append-only/);
    expect(cause(await db().execute(sql`delete from audit_log where id = 1`).catch((e) => e))).toMatch(/append-only/);
    const [row] = await db().select().from(auditLog).limit(1);
    expect(row!.prevHash).toBe("0".repeat(64));
  });
});
