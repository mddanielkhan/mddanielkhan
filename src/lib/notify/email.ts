import { createTransport, type Transporter } from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { BRAND } from "@/lib/config/brand";
import { enqueue, registerJob } from "@/lib/jobs/queue";
import type { DbOrTx } from "@/lib/db/client";

/**
 * Transactional email.
 *
 * ANTI-PHISHING RULE: emails never contain user-generated text and only ever
 * link to our own APP_URL. A scammer cannot use our notifications to deliver
 * their message or link — and users learn that a real PeerLink email never asks
 * for money, passwords or codes.
 */

export type EmailTemplate =
  | { kind: "verify_email"; link: string }
  | { kind: "reset_password"; link: string }
  | { kind: "password_changed" }
  | { kind: "institution_email"; link: string }
  | { kind: "change_email"; link: string }
  | { kind: "email_changed_notice" }
  | { kind: "new_login"; when: string }
  | { kind: "notification"; title: string; link: string };

const FOOTER = `\n\n—\n${BRAND.name} will never ask you for money, your password or a verification code.\nIf you didn't expect this email, you can ignore it.`;

export function renderEmail(t: EmailTemplate): { subject: string; text: string } {
  switch (t.kind) {
    case "verify_email":
      return { subject: `Verify your email for ${BRAND.name}`, text: `Welcome to ${BRAND.name}!\n\nConfirm your email address (link valid for 24 hours):\n${t.link}${FOOTER}` };
    case "reset_password":
      return { subject: `Reset your ${BRAND.name} password`, text: `Someone asked to reset your password. If it was you, use this link (valid for 30 minutes):\n${t.link}\n\nIf it wasn't you, your password is unchanged.${FOOTER}` };
    case "password_changed":
      return { subject: `Your ${BRAND.name} password was changed`, text: `Your password was just changed and all other sessions were signed out.\nIf this wasn't you, reset your password immediately and contact support.${FOOTER}` };
    case "institution_email":
      return { subject: `Confirm your institutional email`, text: `Confirm that this mailbox belongs to you to receive the verified-institution badge (link valid for 24 hours):\n${t.link}${FOOTER}` };
    case "change_email":
      return { subject: `Confirm your new email address`, text: `Confirm this new address for your ${BRAND.name} account (valid for 24 hours):\n${t.link}${FOOTER}` };
    case "email_changed_notice":
      return { subject: `Your ${BRAND.name} email address was changed`, text: `The email address on your account was changed. If this wasn't you, contact ${env().SUPPORT_EMAIL} immediately.${FOOTER}` };
    case "new_login":
      return { subject: `New sign-in to your ${BRAND.name} account`, text: `Your account was signed in at ${t.when} (UTC). If this wasn't you, change your password and review your devices in Settings → Security.${FOOTER}` };
    case "notification":
      // Title strings are composed by our code from fixed templates, never from user content.
      return { subject: `${BRAND.name}: ${t.title}`, text: `${t.title}\n\nOpen ${BRAND.name} to see details:\n${t.link}${FOOTER}` };
  }
}

let transporter: Transporter | undefined;

async function deliver(to: string, t: EmailTemplate) {
  const { subject, text } = renderEmail(t);
  const mode = env().EMAIL_TRANSPORT;
  if (mode === "console") {
    console.info(JSON.stringify({ level: "info", msg: "email (console transport)", to, subject, text }));
    return;
  }
  if (mode === "file") {
    const dir = path.resolve(env().EMAIL_FILE_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`), JSON.stringify({ to, subject, text, kind: t.kind }));
    return;
  }
  transporter ??= createTransport(env().SMTP_URL!);
  await transporter.sendMail({ from: env().EMAIL_FROM, to, subject, text, disableFileAccess: true, disableUrlAccess: true });
}

registerJob("email", async (payload) => {
  await deliver(String(payload.to), payload.template as EmailTemplate);
});

export async function sendEmail(to: string, template: EmailTemplate, tx?: DbOrTx) {
  await enqueue("email", { to, template }, { tx });
}

export function appLink(pathname: string) {
  return new URL(pathname, env().APP_URL).toString();
}
