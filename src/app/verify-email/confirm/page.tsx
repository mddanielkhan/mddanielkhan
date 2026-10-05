import { Form } from "@/components/form";
import { Card, Flash, PageHeader } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Confirm your email", robots: { index: false } };

/** The link opens this page; the state change happens on POST (scanners that prefetch links can't burn the token). */
export default async function ConfirmEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = sp(params.token) ?? "";
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Confirm your email address" />
      <Flash searchParams={params} />
      <Card>
        <Form action="/api/auth/verify-email" back="/verify-email">
          <input type="hidden" name="token" value={token} />
          <p className="mb-4">Press the button to confirm this email address belongs to you.</p>
          <button className="btn btn-primary" type="submit">
            Confirm my email
          </button>
        </Form>
      </Card>
    </div>
  );
}
