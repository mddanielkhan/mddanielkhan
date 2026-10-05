import { Form } from "@/components/form";
import { Card, Flash, PageHeader, TextField } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = sp(params.token) ?? "";
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Choose a new password" />
      <Flash searchParams={params} />
      <Card>
        <Form action="/api/auth/reset-password" back={`/reset-password?token=${encodeURIComponent(token)}`}>
          <input type="hidden" name="token" value={token} />
          <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} hint="At least 15 characters — a passphrase of a few random words works well." />
          <button className="btn btn-primary w-full" type="submit">
            Save new password
          </button>
        </Form>
        <p className="muted mt-3 text-sm">After resetting, every device signed in to your account is signed out.</p>
      </Card>
    </div>
  );
}
