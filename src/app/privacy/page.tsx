import { Card, PageHeader } from "@/components/ui";
import { BRAND, POLICY_VERSIONS } from "@/lib/config/brand";
import { env } from "@/lib/env";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Privacy policy" subtitle={`Version ${POLICY_VERSIONS.privacy}. Plain-language summary first; details below.`} />
      <Card className="mb-6 bg-[var(--color-brand-50)]">
        <h2 className="mb-2 font-semibold">In one minute</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>We collect the minimum: your email, a username, a display name, what you choose to post, and how you use sessions.</li>
          <li>We never collect your NID number, birthdate, phone number or ID documents in this phase.</li>
          <li>No ads, no trackers, no data selling — ever.</li>
          <li>Download or delete your data any time from Settings → Privacy.</li>
        </ul>
        <p lang="bn" className="muted mt-2 text-sm">
          সংক্ষেপে: আমরা খুব কম তথ্য রাখি, কখনো বিক্রি করি না, বিজ্ঞাপন বা ট্র্যাকার নেই। আপনি যেকোনো সময় নিজের তথ্য ডাউনলোড বা মুছে ফেলতে পারবেন।
        </p>
      </Card>
      <div className="space-y-4 text-sm">
        <Card>
          <h2 className="mb-2 text-base font-semibold">Who we are</h2>
          <p>
            {BRAND.name} is the data controller. Grievance / data-protection contact: {env().GRIEVANCE_OFFICER_NAME}, <a href={`mailto:${env().GRIEVANCE_OFFICER_EMAIL}`}>{env().GRIEVANCE_OFFICER_EMAIL}</a>. You may also complain to the data protection authority established under Bangladesh&apos;s Personal Data Protection Act 2026.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">What we collect and why</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="py-1 pr-2">Data</th>
                <th className="py-1 pr-2">Purpose</th>
                <th className="py-1">Kept for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              <tr><td className="py-1 pr-2">Email, username, display name, password hash</td><td className="pr-2">Your account (contract)</td><td>Until you delete your account</td></tr>
              <tr><td className="py-1 pr-2">Adult attestation (not your birthdate)</td><td className="pr-2">Legal age requirement</td><td>Account lifetime</td></tr>
              <tr><td className="py-1 pr-2">Profile, posts, answers, votes</td><td className="pr-2">The community (contract)</td><td>Until you delete them or your account</td></tr>
              <tr><td className="py-1 pr-2">Session requests, messages, feedback</td><td className="pr-2">Mentoring, safety and disputes</td><td>Account lifetime; messages may be preserved as evidence in an open safety case</td></tr>
              <tr><td className="py-1 pr-2">Institutional email (domain shown only)</td><td className="pr-2">Verification badge (consent)</td><td>Badge expires after 12 months</td></tr>
              <tr><td className="py-1 pr-2">Keyed hashes of IP addresses, device type</td><td className="pr-2">Security, abuse prevention (legitimate interest)</td><td>90 days</td></tr>
              <tr><td className="py-1 pr-2">Moderation and audit records</td><td className="pr-2">Safety, legal obligations, appeals</td><td>Up to 2 years</td></tr>
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Automated decisions & profiling</h2>
          <p>
            We use an automatic, rule-based safety filter that can hold or reject posts that look like scams, and we compute trust levels, reputation and mentor ratings from your activity. These are explained on your profile and in our guidelines. You can always ask for a human review, and every moderation decision can be appealed.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Who we share data with</h2>
          <p>Only the service providers needed to run the platform (hosting, email delivery, network protection), under contract, and authorities when the law requires it — each request is reviewed by counsel and counted in our transparency report. We never sell data and run no advertising or third-party tracking.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Children</h2>
          <p>In this phase you must be 18 or older. Under the Personal Data Protection Act 2026, people under 18 are children whose data may only be processed with verifiable guardian consent; we will open a guardian-consented, restricted experience for younger students once that process is in place. If we learn an account belongs to someone under 18, we delete it.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Your rights</h2>
          <p>Access and portability (Settings → Privacy → Download), correction (edit your profile), erasure (delete your account), withdrawal of consent, objection to processing, and complaint to the authority. Contact the grievance officer for anything else; we respond within 30 days.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Security</h2>
          <p>Passwords are hashed with Argon2id; session and email tokens are stored only as hashes; 2FA secrets are encrypted; IP addresses are stored only as keyed hashes; all traffic is encrypted. If a breach affects you, we will notify you and the authority as the law requires.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Cookies</h2>
          <p>Only strictly necessary cookies: your sign-in session, a security token that protects forms, and your language choice. No analytics or advertising cookies.</p>
        </Card>
      </div>
    </div>
  );
}
