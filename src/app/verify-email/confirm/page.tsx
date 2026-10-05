import { Form } from "@/components/form";
import { AuthCard } from "@/components/auth-shell";
import { Flash } from "@/components/ui";
import { Icon, MailCheck } from "@/components/icons";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Confirm your email", robots: { index: false } };

/** The link opens this page; the state change happens on POST (scanners that prefetch links can't burn the token). */
export default async function ConfirmEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = sp(params.token) ?? "";
  return (
    <AuthCard
      title="Confirm your email address"
      subtitle="Press the button to confirm this address belongs to you."
      icon={
        <span className="icon-tile h-12 w-12 rounded-2xl">
          <Icon icon={MailCheck} className="h-6 w-6" />
        </span>
      }
    >
      <Flash searchParams={params} />
      <Form action="/api/auth/verify-email" back="/verify-email">
        <input type="hidden" name="token" value={token} />
        <button className="btn btn-primary btn-lg w-full" type="submit">
          Confirm my email
        </button>
      </Form>
    </AuthCard>
  );
}
