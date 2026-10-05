import { describe, expect, it, beforeAll } from "vitest";
import { authorize, type Actor } from "@/lib/policy/policy";
import { base32Decode, base32Encode, generateRecoveryCodes, hotp, otpauthUri, totpAt, verifyTotp, currentStep } from "@/lib/auth/totp";
import { checkPasswordPolicy, hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { decryptField, encryptField, hashIp, hmacHex, safeEqual } from "@/lib/security/crypto";
import { csrfTokenForSeed, verifyCsrfToken, verifySameOrigin } from "@/lib/security/csrf";
import { safeBackPath, withParam } from "@/lib/http/urls";
import { canonicalJson, computeHash, GENESIS_HASH, redactMeta } from "@/lib/audit/audit";
import { buildCsp } from "@/lib/security/headers";
import { resetEnvCache } from "@/lib/env";

beforeAll(() => {
  process.env.APP_URL = "http://localhost:3000";
  resetEnvCache();
});

type U = NonNullable<Actor>["user"];
type S = NonNullable<Actor>["session"];
const day = 86400_000;
const user = (over: Partial<U> = {}): U =>
  ({
    id: "u1",
    email: "a@b.c",
    emailVerifiedAt: new Date(),
    role: "member",
    status: "active",
    suspendedUntil: null,
    restrictedUntil: null,
    trustLevel: 1,
    createdAt: new Date(Date.now() - 30 * day),
    totpEnabledAt: null,
    ...over,
  }) as U;
const session = (over: Partial<S> = {}): S => ({ id: "s", userId: "u1", mfaState: "none", ...over }) as S;
const actor = (u: Partial<U> = {}, s: Partial<S> = {}): Actor => ({ user: user(u), session: session(s) });

describe("authorization policy (deny by default)", () => {
  it("requires login", () => {
    expect(authorize(null, "post.create")).toEqual({ ok: false, reason: "login_required" });
  });
  it("requires verified email for community actions", () => {
    expect(authorize(actor({ emailVerifiedAt: null }), "post.create")).toEqual({ ok: false, reason: "email_unverified" });
  });
  it("blocks banned users and pending-MFA sessions from everything", () => {
    expect(authorize(actor({ status: "banned" }), "account.manage").ok).toBe(false);
    expect(authorize(actor({}, { mfaState: "pending" }), "post.create")).toEqual({ ok: false, reason: "mfa_required" });
  });
  it("keeps due-process actions available while suspended", () => {
    const a = actor({ status: "suspended", suspendedUntil: new Date(Date.now() + day) });
    expect(authorize(a, "post.create")).toEqual({ ok: false, reason: "suspended" });
    expect(authorize(a, "appeal.create").ok).toBe(true);
    expect(authorize(a, "account.manage").ok).toBe(true);
  });
  it("treats an expired suspension as lifted", () => {
    expect(authorize(actor({ status: "suspended", suspendedUntil: new Date(Date.now() - 1000) }), "post.create").ok).toBe(true);
  });
  it("restriction blocks posting and booking but not reporting", () => {
    const a = actor({ restrictedUntil: new Date(Date.now() + day) });
    expect(authorize(a, "post.create")).toEqual({ ok: false, reason: "restricted" });
    expect(authorize(a, "booking.request")).toEqual({ ok: false, reason: "restricted" });
    expect(authorize(a, "report.create").ok).toBe(true);
  });
  it("gates opportunity posts on trust level and account age", () => {
    expect(authorize(actor({ trustLevel: 0 }), "post.create.opportunity")).toEqual({ ok: false, reason: "trust_level_too_low" });
    expect(authorize(actor({ createdAt: new Date() }), "post.create.opportunity")).toEqual({ ok: false, reason: "account_too_new" });
    expect(authorize(actor(), "post.create.opportunity").ok).toBe(true);
  });
  it("requires 2FA for mentors managing offerings", () => {
    expect(authorize(actor(), "mentor.manage", { mentorStatus: "approved" })).toEqual({ ok: false, reason: "mfa_required" });
    expect(authorize(actor({ totpEnabledAt: new Date() }), "mentor.manage", { mentorStatus: "approved" }).ok).toBe(true);
    expect(authorize(actor({ totpEnabledAt: new Date() }), "mentor.manage", { mentorStatus: "pending" })).toEqual({ ok: false, reason: "not_mentor" });
  });
  it("requires staff role AND 2FA verified in this session for moderation", () => {
    expect(authorize(actor(), "staff.moderate")).toEqual({ ok: false, reason: "forbidden" });
    expect(authorize(actor({ role: "moderator" }), "staff.moderate")).toEqual({ ok: false, reason: "mfa_required" });
    expect(authorize(actor({ role: "moderator", totpEnabledAt: new Date() }), "staff.moderate")).toEqual({ ok: false, reason: "mfa_required" });
    expect(authorize(actor({ role: "moderator", totpEnabledAt: new Date() }, { mfaState: "verified" }), "staff.moderate").ok).toBe(true);
    expect(authorize(actor({ role: "moderator", totpEnabledAt: new Date() }, { mfaState: "verified" }), "staff.admin")).toEqual({ ok: false, reason: "forbidden" });
    expect(authorize(actor({ role: "admin", totpEnabledAt: new Date() }, { mfaState: "verified" }), "staff.admin").ok).toBe(true);
  });
  it("only staff publish safety alerts", () => {
    expect(authorize(actor(), "post.create.safety_alert")).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("TOTP (RFC 6238)", () => {
  it("matches the RFC 4226 HOTP test vectors", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect([0, 1, 2, 3, 9].map((c) => hotp(secret, c))).toEqual(["755224", "287082", "359152", "969429", "520489"]);
  });
  it("round-trips base32", () => {
    const buf = Buffer.from([1, 2, 3, 250, 255, 0, 7]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });
  it("accepts ±1 step drift and rejects replays", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const t = Date.UTC(2026, 9, 5, 10, 0, 0);
    const code = totpAt(secret, t);
    const step = verifyTotp(secret, code, null, t);
    expect(step).toBe(currentStep(t));
    expect(verifyTotp(secret, code, step, t)).toBeNull(); // replay
    expect(verifyTotp(secret, totpAt(secret, t - 30_000), null, t)).not.toBeNull();
    expect(verifyTotp(secret, totpAt(secret, t - 90_000), null, t)).toBeNull();
    expect(verifyTotp(secret, "12345", null, t)).toBeNull();
  });
  it("builds an otpauth URI and recovery codes", () => {
    expect(otpauthUri("ABC", "rahim", "PeerLink")).toMatch(/^otpauth:\/\/totp\/PeerLink%3Arahim\?secret=ABC&issuer=PeerLink/);
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}$/);
  });
});

describe("passwords", () => {
  it("enforces NIST SP 800-63B-4 length and blocklists", () => {
    expect(checkPasswordPolicy("short")).toBe("too_short");
    expect(checkPasswordPolicy("a".repeat(129))).toBe("too_long");
    expect(checkPasswordPolicy("passwordpassword")).toBe("common");
    expect(checkPasswordPolicy("aaaaaaaaaaaaaaaaaa")).toBe("repetitive");
    expect(checkPasswordPolicy("rahim-loves-dhaka-rain", { username: "rahim" })).toBe("contains_personal_info");
    expect(checkPasswordPolicy("purple tiger river 1987")).toBeNull();
  });
  it("hashes with Argon2id and verifies", async () => {
    const h = await hashPassword("purple tiger river 1987");
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(h, "purple tiger river 1987")).toBe(true);
    expect(await verifyPassword(h, "purple tiger river 1988")).toBe(false);
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
    expect(needsRehash(h)).toBe(false);
    expect(needsRehash("$argon2id$v=19$m=4096,t=1,p=1$abc$def")).toBe(true);
  });
});

describe("crypto, CSRF, redirects", () => {
  it("encrypts with AES-GCM and detects tampering / AAD mismatch", () => {
    const ct = encryptField("JBSWY3DPEHPK3PXP", "user:1");
    expect(decryptField(ct, "user:1")).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptField(ct, "user:2")).toThrow();
    const parts = ct.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptField(parts.join("."), "user:1")).toThrow();
  });
  it("separates HMAC keys by purpose", () => {
    expect(hmacHex("csrf", "x")).not.toBe(hmacHex("ip-hash", "x"));
    expect(hashIp("1.2.3.4")).toHaveLength(32);
    expect(hashIp(null)).toBeNull();
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
  it("verifies signed double-submit tokens", () => {
    const seed = "s".repeat(43);
    expect(verifyCsrfToken(seed, csrfTokenForSeed(seed))).toBe(true);
    expect(verifyCsrfToken(seed, csrfTokenForSeed("t".repeat(43)))).toBe(false);
    expect(verifyCsrfToken(undefined, "x")).toBe(false);
  });
  it("checks Origin / Fetch-Metadata", () => {
    expect(verifySameOrigin(new Headers({ origin: "http://localhost:3000" }))).toBe(true);
    expect(verifySameOrigin(new Headers({ origin: "https://evil.example" }))).toBe(false);
    expect(verifySameOrigin(new Headers({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(verifySameOrigin(new Headers({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(verifySameOrigin(new Headers())).toBe(false);
  });
  it("prevents open redirects", () => {
    expect(safeBackPath("/posts/1?x=1&e=foo")).toBe("/posts/1?x=1");
    expect(safeBackPath("//evil.example/x")).toBe("/");
    expect(safeBackPath("/\\evil.example")).toBe("/");
    expect(safeBackPath("https://evil.example/x")).toBe("/");
    expect(safeBackPath("http://localhost:3000/feed?topic=1")).toBe("/feed?topic=1");
    expect(safeBackPath("javascript:alert(1)")).toBe("/");
    expect(withParam("/a?b=1", "n", "ok")).toBe("/a?b=1&n=ok");
  });
  it("builds a nonce CSP without unsafe-inline", () => {
    const csp = buildCsp("abc", false);
    expect(csp).toContain("upgrade-insecure-requests");
    expect(buildCsp("abc", false, false)).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });
});

describe("audit chain primitives", () => {
  it("canonicalises key order and redacts secrets", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(redactMeta({ password: "x", nested: { token: "y", ok: 1 }, when: new Date(0) })).toEqual({
      password: "[redacted]",
      nested: { token: "[redacted]", ok: 1 },
      when: "1970-01-01T00:00:00.000Z",
    });
  });
  it("changes the hash if anything changes", () => {
    const e = { occurredAt: new Date(0), actorId: null, action: "x", targetType: null, targetId: null, meta: {} };
    const h = computeHash(GENESIS_HASH, e);
    expect(computeHash(GENESIS_HASH, { ...e, action: "y" })).not.toBe(h);
    expect(computeHash("1".repeat(64), e)).not.toBe(h);
  });
});

describe("authorization policy — remaining branches", () => {
  it("assertAllowed throws a typed, user-presentable error", async () => {
    const { assertAllowed } = await import("@/lib/policy/policy");
    expect(() => assertAllowed(null, "post.create")).toThrow(/log in/);
    try {
      assertAllowed(actor({ emailVerifiedAt: null }), "booking.request");
    } catch (e) {
      expect(e).toMatchObject({ code: "email_unverified", status: 403 });
    }
    expect(() => assertAllowed(actor(), "profile.update")).not.toThrow();
  });
  it("allows routine member actions", () => {
    for (const a of ["profile.update", "booking.participate", "mentor.apply", "vote.cast", "answer.create", "booking.request"] as const) {
      expect(authorize(actor(), a).ok, a).toBe(true);
    }
    expect(authorize(actor({ restrictedUntil: new Date(Date.now() + day) }), "mentor.apply")).toEqual({ ok: false, reason: "restricted" });
    expect(authorize(actor({ restrictedUntil: new Date(Date.now() + day) }), "post.create.opportunity")).toEqual({ ok: false, reason: "restricted" });
  });
  it("lets staff share opportunities regardless of trust level and account age", () => {
    expect(authorize(actor({ role: "moderator", trustLevel: 0, createdAt: new Date() }), "post.create.opportunity").ok).toBe(true);
  });
  it("allows staff safety alerts only with MFA", () => {
    expect(authorize(actor({ role: "admin", totpEnabledAt: new Date() }), "post.create.safety_alert")).toEqual({ ok: false, reason: "mfa_required" });
    expect(authorize(actor({ role: "admin", totpEnabledAt: new Date() }, { mfaState: "verified" }), "post.create.safety_alert").ok).toBe(true);
  });
  it("fails closed on malformed input", () => {
    expect(authorize({ user: undefined, session: undefined } as unknown as Actor, "post.create")).toEqual({ ok: false, reason: "forbidden" });
  });
  it("paused mentors can still manage their profile", () => {
    expect(authorize(actor({ totpEnabledAt: new Date() }), "mentor.manage", { mentorStatus: "paused" }).ok).toBe(true);
  });
});

describe("authorization policy — unknown actions", () => {
  it("denies an action that isn't in the policy (runtime exhaustiveness)", () => {
    expect(authorize(actor(), "admin.everything" as never)).toEqual({ ok: false, reason: "forbidden" });
  });
});
