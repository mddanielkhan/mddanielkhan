import { createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "@/lib/security/crypto";

/**
 * TOTP (RFC 6238, SHA-1, 6 digits, 30 s) — compatible with Google Authenticator,
 * Microsoft Authenticator, Aegis, 1Password, etc.
 *
 * Replay protection: the caller persists the last accepted time-step and passes
 * it back; a code for the same or an earlier step is rejected even if valid.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20)); // 160-bit, per RFC 4226 recommendation
}

export function hotp(secretB32: string, counter: number): string {
  const key = base32Decode(secretB32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const code =
    (((mac[offset]! & 0x7f) << 24) | ((mac[offset + 1]! & 0xff) << 16) | ((mac[offset + 2]! & 0xff) << 8) | (mac[offset + 3]! & 0xff)) %
    10 ** DIGITS;
  return code.toString().padStart(DIGITS, "0");
}

export function currentStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

export function totpAt(secretB32: string, nowMs = Date.now()): string {
  return hotp(secretB32, currentStep(nowMs));
}

/**
 * Verify a code allowing ±1 step of clock drift.
 * Returns the matched step (persist it as lastStep) or null.
 */
export function verifyTotp(secretB32: string, code: string, lastStep: number | null, nowMs = Date.now()): number | null {
  const normalised = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalised)) return null;
  const step = currentStep(nowMs);
  for (const candidate of [step - 1, step, step + 1]) {
    if (lastStep !== null && candidate <= lastStep) continue; // replay
    if (safeEqual(hotp(secretB32, candidate), normalised)) return candidate;
  }
  return null;
}

export function otpauthUri(secretB32: string, accountName: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({ secret: secretB32, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Ten single-use recovery codes, formatted xxxx-xxxx-xxxx. Only hashes are stored. */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(8)).slice(0, 12).toLowerCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

export function normaliseRecoveryCode(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-z2-7]/g, "");
}
