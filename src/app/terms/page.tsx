import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { BRAND, POLICY_VERSIONS } from "@/lib/config/brand";

export const metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Terms of use" subtitle={`Version ${POLICY_VERSIONS.terms}. Governing law: Bangladesh. Must be reviewed by a licensed Bangladeshi advocate before public launch.`} />
      <div className="space-y-4 text-sm">
        <Card>
          <h2 className="mb-2 text-base font-semibold">1. The service</h2>
          <p>{BRAND.name} is a community where students ask questions, share opportunities and book free mentoring sessions with mentors whose credentials we review. We provide the platform; members provide the content and advice.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">2. Eligibility & accounts</h2>
          <p>You must be 18 or older and give accurate information. One person, one account. Keep your password private and turn on two-factor authentication — it is required for mentors and staff.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">3. Advice is peer guidance</h2>
          <p>Mentors and members share personal experience. Nothing on {BRAND.name} is legal, immigration, medical, psychological or financial advice. Always confirm rules, fees and deadlines with official sources. Verification confirms specific facts (shown on each badge) — not that every piece of advice is correct.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">4. No payments between members</h2>
          <p>Sessions are free during this phase. Requesting, offering or accepting payment, gifts or commissions through or because of the platform is prohibited and leads to a ban.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">5. Your content</h2>
          <p>You own what you post. You give us a non-exclusive, worldwide, royalty-free licence to host, display and distribute it on the service. You confirm you have the right to post it and that it follows our <Link href="/guidelines">Community Guidelines</Link>.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">6. Moderation, notice & action</h2>
          <p>We may hold, remove or label content and restrict, suspend or ban accounts under the published guidelines. You will be told why and may appeal. Anyone can report unlawful content through our <Link href="/report-concern">report form</Link>; we act on valid notices promptly and keep records.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">7. Liability</h2>
          <p>To the extent permitted by law, we are not liable for advice given by members or for decisions you make based on it. Nothing limits liability that cannot be limited by law, including under the Consumer Rights Protection Act 2009.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">8. Changes & ending</h2>
          <p>We give 14 days&apos; notice of material changes and ask you to accept them. You may delete your account at any time. These terms are governed by the laws of Bangladesh.</p>
        </Card>
      </div>
    </div>
  );
}
