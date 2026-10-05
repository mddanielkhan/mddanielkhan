import { Card, PageHeader } from "@/components/ui";
import { POLICY_VERSIONS } from "@/lib/config/brand";

export const metadata = { title: "Community guidelines" };

export default function GuidelinesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Community guidelines" subtitle={`Version ${POLICY_VERSIONS.guidelines}. Written to be understood by a first-year student, not a lawyer.`} />
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Our promise to you</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Nobody here may ask you for money. Sessions are free.</li>
          <li>Mentors are verified by a person, and their badges show exactly what was checked.</li>
          <li>We never store your NID number, and we don&apos;t sell or share your data.</li>
          <li>Every moderation decision comes with a reason, and you can appeal it to a different moderator.</li>
        </ol>
      </Card>
      <section className="space-y-4">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Be kind, be useful</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>There are no stupid questions. Mocking someone for asking is a violation.</li>
            <li>Answer from your own experience and say when you&apos;re not sure. Link official sources for rules, fees and deadlines.</li>
            <li>Write in English or Bangla — both are welcome.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Not allowed</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Fraud and deception</strong>: guaranteed visa/admission/job claims, advance-fee requests, fake or “arranged” documents, impersonation.</li>
            <li><strong>Money and off-platform steering</strong>: asking anyone to pay you, sharing payment numbers, pushing people to WhatsApp/Telegram.</li>
            <li><strong>Exam fraud</strong>: proxy test-takers, leaked papers, guaranteed scores. (Immediate ban.)</li>
            <li><strong>Harassment, hate, threats, sexual content</strong>, and anything involving minors (immediate ban and report to authorities).</li>
            <li><strong>Doxxing</strong>: sharing anyone&apos;s private information, including phone numbers.</li>
            <li><strong>Unlabelled advertising</strong>, MLM or recruitment schemes, spam.</li>
            <li><strong>Presenting legal, immigration, medical or financial advice as authoritative</strong> without the qualification to give it.</li>
            <li><strong>Political and religious debate</strong> — this is a study and careers community; those topics are out of scope for now.</li>
            <li><strong>Undeclared AI-generated content</strong> that could mislead.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Grey areas, made explicit</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Your own agent experience</strong>: allowed as a personal story (“I used X, here&apos;s what happened”). No promotion, no contact details, no fees.</li>
            <li><strong>Criticising an agency or university</strong>: allowed if it&apos;s first-hand and factual. Moderators may ask for evidence, and the organisation may reply. Unverified accusations may be labelled or removed.</li>
            <li><strong>Mental-health struggles</strong>: never off-topic here. We will reach out with support, not take action against you.</li>
          </ul>
        </Card>
        <Card>
          <h2 id="mentors" className="mb-2 text-lg font-semibold">
            Mentor code
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Never ask a student for money, gifts, documents, or contact outside the platform.</li>
            <li>Never promise outcomes. Share experience, not guarantees.</li>
            <li>Stay within your declared scope; refer legal and immigration questions to qualified professionals.</li>
            <li>Disclose any commission or benefit from universities, agencies or employers (shown on your profile).</li>
            <li>Show up. Repeated no-shows or late cancellations pause your profile automatically.</li>
            <li>Respect and safety come first — one low safety rating triggers a review.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">How enforcement works</h2>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-[var(--color-line)]">
              <tr><td className="py-1 pr-3 font-medium">Warning</td><td>Private notice for a first, minor issue.</td></tr>
              <tr><td className="py-1 pr-3 font-medium">Strike 1</td><td>Posting and booking restricted for 7 days.</td></tr>
              <tr><td className="py-1 pr-3 font-medium">Strike 2</td><td>Restricted for 30 days.</td></tr>
              <tr><td className="py-1 pr-3 font-medium">Strike 3</td><td>Account suspended for 90 days.</td></tr>
              <tr><td className="py-1 pr-3 font-medium">Strike 4 / fraud</td><td>Permanent ban. Fraud, exam fraud, threats and anything involving minors skip straight to a ban.</td></tr>
            </tbody>
          </table>
          <p className="muted mt-2 text-sm">Strikes expire after 12 months. You can appeal any decision within 30 days; a different moderator decides. False or malicious reports are themselves a violation.</p>
        </Card>
      </section>
    </div>
  );
}
