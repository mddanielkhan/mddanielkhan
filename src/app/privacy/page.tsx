import { DocLayout, Summary } from "@/components/doc";
import { BRAND, POLICY_VERSIONS } from "@/lib/config/brand";
import { env } from "@/lib/env";

export const metadata = { title: "Privacy policy" };

const TOC = [
  { id: "who", label: "Who we are" },
  { id: "collect", label: "What we collect and why" },
  { id: "automated", label: "Automated decisions" },
  { id: "sharing", label: "Who we share data with" },
  { id: "children", label: "Children" },
  { id: "rights", label: "Your rights" },
  { id: "security", label: "Security" },
  { id: "cookies", label: "Cookies" },
];

const DATA: Array<[string, string, string]> = [
  ["Email, username, display name, password hash", "Your account (contract)", "Until you delete your account"],
  ["Adult attestation (not your birthdate)", "Legal age requirement", "Account lifetime"],
  ["Profile, posts, answers, votes", "The community (contract)", "Until you delete them or your account"],
  ["Session requests, messages, feedback", "Mentoring, safety and disputes", "Account lifetime; messages may be preserved as evidence in an open safety case"],
  ["Institutional email (domain shown only)", "Verification badge (consent)", "Badge expires after 12 months"],
  ["Keyed hashes of IP addresses, device type", "Security, abuse prevention (legitimate interest)", "90 days"],
  ["Moderation and audit records", "Safety, legal obligations, appeals", "Up to 2 years"],
];

export default function PrivacyPage() {
  const e = env();
  return (
    <DocLayout
      eyebrow="Policies"
      title="Privacy policy"
      intro="Plain-language summary first; details below."
      meta={`Version ${POLICY_VERSIONS.privacy}`}
      toc={TOC}
      summary={
        <Summary title="In one minute" bn="সংক্ষেপে: আমরা খুব কম তথ্য রাখি, কখনো বিক্রি করি না, বিজ্ঞাপন বা ট্র্যাকার নেই। আপনি যেকোনো সময় নিজের তথ্য ডাউনলোড বা মুছে ফেলতে পারবেন।">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>We collect the minimum: your email, a username, a display name, what you choose to post, and how you use sessions.</li>
            <li>We never collect your NID number, birthdate, phone number or ID documents in this phase.</li>
            <li>No ads, no trackers, no data selling — ever.</li>
            <li>Download or delete your data any time from Settings → Privacy.</li>
          </ul>
        </Summary>
      }
    >
      <h2 id="who">Who we are</h2>
      <p>
        {BRAND.name} is the data controller. Grievance and data-protection contact: {e.GRIEVANCE_OFFICER_NAME}, <a href={`mailto:${e.GRIEVANCE_OFFICER_EMAIL}`}>{e.GRIEVANCE_OFFICER_EMAIL}</a>. You may also complain to the data protection authority established under Bangladesh&apos;s Personal Data Protection Act 2026.
      </p>

      <h2 id="collect">What we collect and why</h2>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Purpose</th>
              <th>Kept for</th>
            </tr>
          </thead>
          <tbody>
            {DATA.map(([d, p, k]) => (
              <tr key={d}>
                <td className="font-medium text-ink">{d}</td>
                <td className="text-ink-soft">{p}</td>
                <td className="text-ink-soft">{k}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="automated">Automated decisions &amp; profiling</h2>
      <p>We use an automatic, rule-based safety filter that can hold or reject posts that look like scams, and we compute trust levels, reputation and mentor ratings from your activity. These are explained on your profile and in our guidelines. You can always ask for a human review, and every moderation decision can be appealed.</p>

      <h2 id="sharing">Who we share data with</h2>
      <p>Only the service providers needed to run the platform (hosting, email delivery, network protection), under contract, and authorities when the law requires it — each request is reviewed by counsel and counted in our transparency report. We never sell data and run no advertising or third-party tracking.</p>

      <h2 id="children">Children</h2>
      <p>In this phase you must be 18 or older. Under the Personal Data Protection Act 2026, people under 18 are children whose data may only be processed with verifiable guardian consent; we will open a guardian-consented, restricted experience for younger students once that process is in place. If we learn an account belongs to someone under 18, we delete it.</p>

      <h2 id="rights">Your rights</h2>
      <p>Access and portability (Settings → Privacy → Download), correction (edit your profile), erasure (delete your account), withdrawal of consent, objection to processing, and complaint to the authority. Contact the grievance officer for anything else; we respond within 30 days.</p>

      <h2 id="security">Security</h2>
      <p>Passwords are hashed with Argon2id; session and email tokens are stored only as hashes; 2FA secrets are encrypted; IP addresses are stored only as keyed hashes; all traffic is encrypted. If a breach affects you, we will notify you and the authority as the law requires.</p>

      <h2 id="cookies">Cookies</h2>
      <p>Only strictly necessary cookies: your sign-in session, a security token that protects forms, and your language choice. No analytics or advertising cookies.</p>
    </DocLayout>
  );
}
