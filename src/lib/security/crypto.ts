import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Cryptographic primitives. We never hand-roll algorithms: everything here is
 * a thin, well-typed wrapper over node:crypto with safe defaults.
 *
 * Key separation: APP_SECRET is never used directly. Each purpose gets its own
 * HKDF-derived subkey, so a leak or misuse in one context cannot be replayed
 * in another (e.g. a CSRF token can never validate as an IP hash).
 */

export type KeyPurpose = "csrf" | "ip-hash" | "identifier-hash" | "jitsi-room";

const subkeyCache = new Map<string, Buffer>();

export function subkey(purpose: KeyPurpose): Buffer {
  const secret = env().APP_SECRET;
  const cacheKey = `${purpose}:${secret.slice(0, 8)}`;
  let key = subkeyCache.get(cacheKey);
  if (!key) {
    key = Buffer.from(hkdfSync("sha256", Buffer.from(secret, "hex"), Buffer.alloc(0), `shikor:${purpose}:v1`, 32));
    subkeyCache.set(cacheKey, key);
  }
  return key;
}

/** URL-safe random token with `bytes` bytes of entropy (default 32 = 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(purpose: KeyPurpose, input: string): string {
  return createHmac("sha256", subkey(purpose)).update(input).digest("hex");
}

/** Constant-time string comparison (length leak only). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ─── Field encryption (AES-256-GCM) ─────────────────────────────────────────
// Format: v1.<iv b64url>.<ciphertext b64url>.<tag b64url>
// The "v1" prefix allows key rotation: add v2 with a new key and re-encrypt lazily.

function encKey(): Buffer {
  return Buffer.from(env().ENCRYPTION_KEY, "hex");
}

export function encryptField(plaintext: string, aad = ""): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), ct.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decryptField(payload: string, aad = ""): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("unsupported ciphertext format");
  const [, ivB64, ctB64, tagB64] = parts as [string, string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB64, "base64url"));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Keyed hash of an IP address. Raw IPs are never persisted. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return hmacHex("ip-hash", ip).slice(0, 32);
}

/** Keyed hash of an identifier (e.g. a banned user's email) for ban-evasion checks. */
export function hashIdentifier(kind: string, value: string): string {
  return hmacHex("identifier-hash", `${kind}:${value.trim().toLowerCase()}`);
}
