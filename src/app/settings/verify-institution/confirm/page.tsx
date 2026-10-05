import { requireActor } from "@/lib/auth/current";
import { Form } from "@/components/form";
import { Card, Flash, PageHeader } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Confirm institution email", robots: { index: false } };

export default async function ConfirmInstitutionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = sp(params.token) ?? "";
  await requireActor(`/settings/verify-institution/confirm?token=${encodeURIComponent(token)}`);
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Confirm your institutional email" />
      <Flash searchParams={params} />
      <Card>
        <Form action="/api/account/institution/confirm" back="/settings/verify-institution">
          <input type="hidden" name="token" value={token} />
          <p className="mb-4">Press confirm to add the verified-institution badge to your profile.</p>
          <button className="btn btn-primary" type="submit">
            Confirm
          </button>
        </Form>
      </Card>
    </div>
  );
}
