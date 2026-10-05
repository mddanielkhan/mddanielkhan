import { requirePermission } from "@/lib/auth/current";
import { activeBadges } from "@/lib/mentors/service";
import { Form } from "@/components/form";
import { Flash, Notice, PageHeader, Panel, TextField, formatDate } from "@/components/ui";
import { Icon, Send } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Verify your institution", robots: { index: false } };

export default async function VerifyInstitutionPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("profile.update", "/settings/verify-institution");
  const current = (await activeBadges(actor.user.id)).filter((b) => b.kind === "institution_email");
  return (
    <>
      <PageHeader title="Verify your institution" subtitle="Prove you study or work at a university by confirming an institutional email address. We show only the domain — never the address." />
      <Flash searchParams={await searchParams} />
      {current.map((b) => (
        <Notice key={b.id} tone="success" title={b.label}>
          Verified {formatDate(b.grantedAt)}
          {b.expiresAt ? ` · renew by ${formatDate(b.expiresAt)}` : ""}
        </Notice>
      ))}
      <Panel title="Institutional email" description="University and college addresses (…ac.bd, …edu.bd, …edu, …ac.uk and similar). Free providers like Gmail can't be used." footer="No institutional email? Many Bangladeshi students don't have one — that's fine. You can still take part fully; mentors are verified by a manual evidence review instead.">
        <Form action="/api/account/institution" back="/settings/verify-institution" className="max-w-md">
          <TextField label="Institutional email" name="email" type="email" required maxLength={254} placeholder="you@du.ac.bd" />
          <button className="btn btn-primary" type="submit">
            <Icon icon={Send} />
            Send confirmation link
          </button>
        </Form>
      </Panel>
    </>
  );
}
