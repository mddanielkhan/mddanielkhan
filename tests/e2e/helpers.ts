import { expect, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { MAIL_DIR } from "../../playwright.config";

export const DEMO_PASSWORD = "demo passphrase for local dev";

/** Minimal RFC 6238 implementation for tests (independent of the app's code on purpose). */
export function totp(secretB32: string, stepOffset = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretB32) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Math.floor(Date.now() / 30000) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const o = mac[mac.length - 1]! & 15;
  return (((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000) + "").padStart(6, "0");
}

export function lastMail(to: string, kind?: string): { subject: string; text: string } | null {
  let files: string[] = [];
  try {
    files = readdirSync(MAIL_DIR).sort().reverse();
  } catch {
    return null;
  }
  for (const f of files) {
    const m = JSON.parse(readFileSync(`${MAIL_DIR}/${f}`, "utf8"));
    if (m.to === to && (!kind || m.kind === kind)) return m;
  }
  return null;
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD, totpSecret?: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  if (totpSecret) {
    await expect(page).toHaveURL(/\/login\/2fa/);
    await page.getByLabel(/6-digit code/).fill(totp(totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();
  }
  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
}

/** Fail the test on any CSP violation or uncaught page error. */
export function watchForErrors(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) problems.push(`csp: ${m.text()}`);
  });
  return problems;
}
