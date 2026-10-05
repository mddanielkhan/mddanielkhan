import { requireActor } from "@/lib/auth/current";
import { Form } from "@/components/form";
import { Flash, PageHeader, Panel } from "@/components/ui";
import { GraduationCap, Icon } from "@/components/icons";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Confirm institution email", robots: { index: false } };

export default async function ConfirmInstitutionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = sp(params.token) ?? "";
  await requireActor(`/settings/verify-institution/confirm?token=${encodeURIComponent(token)}`);
  return (
    <>
      <PageHeader title="Confirm your institutional email" />
      <Flash searchParams={params} />
      <Panel title="Add the verified-institution badge" description="Your profile will show the domain you verified (for example du.ac.bd) — never the full address.">
        <Form action="/api/account/institution/confirm" back="/settings/verify-institution">
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-primary" type="submit">
            <Icon icon={GraduationCap} />
            Confirm
          </button>
        </Form>
      </Panel>
    </>
  );
}
