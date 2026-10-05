import { Card, PageHeader } from "@/components/ui";
import { env } from "@/lib/env";

export const metadata = { title: "Security" };

export default function SecurityPage() {
  const rows = [
    ["Passwords", "Argon2id hashing (OWASP parameters); 15+ character minimum per NIST SP 800-63B-4; breached-password screening."],
    ["Sign-in", "Opaque server-side sessions (revocable instantly), rotated on every privilege change; short sessions and mandatory 2FA for staff and mentors."],
    ["Two-factor", "TOTP authenticator apps with replay protection and single-use recovery codes."],
    ["Tokens", "Email and reset links are single-use, short-lived and stored only as SHA-256 hashes."],
    ["Web protections", "Strict nonce-based Content-Security-Policy, CSRF tokens + origin checks, HSTS, clickjacking protection, no third-party scripts."],
    ["Access control", "One central, deny-by-default permission policy; every API route is verified by an automated build check."],
    ["Abuse", "Rate limits per account and network, anti-scam screening in English, Bangla and Banglish, human review."],
    ["Data minimisation", "No NID numbers, birthdates, phone numbers or ID documents collected; IPs stored only as keyed hashes for 90 days."],
    ["Integrity", "Tamper-evident, hash-chained audit log of security and moderation events, verified daily."],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Security" subtitle="What we do to protect you — and how to report a vulnerability." />
      <Card className="mb-6">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-[var(--color-line)]">
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="py-2 pr-4 align-top font-medium">{k}</td>
                <td className="py-2">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Report a vulnerability</h2>
        <p className="text-sm">
          Email <a href={`mailto:${env().SECURITY_EMAIL}`}>{env().SECURITY_EMAIL}</a> with steps to reproduce. We acknowledge within 3 working days, won&apos;t pursue good-faith research that avoids privacy harm and service disruption, and will credit you if you wish. Please don&apos;t access other people&apos;s data, run denial-of-service tests or social-engineer our members or staff. See also <a href="/.well-known/security.txt">security.txt</a>.
        </p>
      </Card>
    </div>
  );
}
