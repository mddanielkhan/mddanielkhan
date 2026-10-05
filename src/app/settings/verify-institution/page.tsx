import { requirePermission } from "@/lib/auth/current";
import { activeBadges } from "@/lib/mentors/service";
import { Form } from "@/components/form";
import { SettingsNav } from "@/components/settings-nav";
import { Card, Flash, Notice, PageHeader, TextField, formatDate } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Verify your institution", robots: { index: false } };

export default async function VerifyInstitutionPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("profile.update", "/settings/verify-institution");
  const current = (await activeBadges(actor.user.id)).filter((b) => b.kind === "institution_email");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Verify your institution" subtitle="Prove you study or work at a university by confirming an institutional email address. We show only the domain — never the address." />
      <SettingsNav current="institution" />
      <Flash searchParams={await searchParams} />
      {current.map((b) => (
        <Notice key={b.id} tone="success">
          {b.label} · verified {formatDate(b.grantedAt)}
          {b.expiresAt ? ` · renew by ${formatDate(b.expiresAt)}` : ""}
        </Notice>
      ))}
      <Card>
        <Form action="/api/account/institution" back="/settings/verify-institution">
          <TextField label="Institutional email" name="email" type="email" required maxLength={254} placeholder="you@du.ac.bd" hint="University and college addresses (…ac.bd, …edu.bd, …edu, …ac.uk and similar). Free providers like Gmail can't be used." />
          <button className="btn btn-primary" type="submit">
            Send confirmation link
          </button>
        </Form>
        <p className="muted mt-3 text-sm">No institutional email? Many Bangladeshi students don&apos;t have one — that&apos;s fine. You can still take part fully; mentors are verified by a manual evidence review instead.</p>
      </Card>
    </div>
  );
}
