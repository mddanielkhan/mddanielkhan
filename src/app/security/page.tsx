import { PageHeader, Panel } from "@/components/ui";
import { Activity, Database, FingerprintPattern, Icon, KeyRound, Lock, ScrollText, Shield, ShieldCheck, UserCheck, type IconNode } from "@/components/icons";
import { env } from "@/lib/env";

export const metadata = { title: "Security" };

const PRACTICES: Array<[IconNode, string, string]> = [
  [KeyRound, "Passwords", "Argon2id hashing with OWASP parameters, a 15-character minimum per NIST SP 800-63B-4, and breached-password screening."],
  [FingerprintPattern, "Sign-in", "Opaque server-side sessions you can revoke instantly, rotated on every privilege change. Mandatory 2FA for staff and mentors."],
  [ShieldCheck, "Two-factor", "TOTP authenticator apps with replay protection and single-use recovery codes."],
  [Lock, "Tokens", "Email and reset links are single-use, short-lived and stored only as SHA-256 hashes."],
  [Shield, "Web protections", "A strict nonce-based Content-Security-Policy, CSRF tokens with origin checks, HSTS, clickjacking protection and no third-party scripts."],
  [UserCheck, "Access control", "One central, deny-by-default permission policy, enforced in every route and again in every service. A build check fails if a route bypasses it."],
  [Activity, "Abuse prevention", "Rate limits per account and network, scam screening in English, Bangla and Banglish, and human review."],
  [Database, "Data minimisation", "No NID numbers, birthdates, phone numbers or ID documents. IP addresses are stored only as keyed hashes, for 90 days."],
  [ScrollText, "Integrity", "A tamper-evident, hash-chained audit log of security and moderation events, verified daily."],
];

export default function SecurityPage() {
  const e = env();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Trust" title="Security" subtitle="What we do to protect you — and how to report a vulnerability." />
      <ul className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PRACTICES.map(([icon, title, body]) => (
          <li key={title} className="card p-5">
            <span className="icon-tile">
              <Icon icon={icon} />
            </span>
            <h2 className="mt-4 font-bold">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ul>
      <Panel title="Report a vulnerability" description="Responsible disclosure is welcome. We'd much rather hear from you than from an attacker.">
        <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
          <p>
            Email <a href={`mailto:${e.SECURITY_EMAIL}`}>{e.SECURITY_EMAIL}</a> with steps to reproduce. We acknowledge within 3 working days, won&apos;t pursue good-faith research that avoids privacy harm and service disruption, and will credit you if you wish.
          </p>
          <p>
            Please don&apos;t access other people&apos;s data, run denial-of-service tests or social-engineer our members or staff. See also <a href="/.well-known/security.txt">security.txt</a>.
          </p>
        </div>
      </Panel>
    </div>
  );
}
