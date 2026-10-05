import { Form } from "@/components/form";
import { AuthCard } from "@/components/auth-shell";
import { Flash, TextField } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = sp(params.token) ?? "";
  return (
    <AuthCard title="Choose a new password" subtitle="After you save it, every device signed in to your account is signed out.">
      <Flash searchParams={params} />
      <Form action="/api/auth/reset-password" back={`/reset-password?token=${encodeURIComponent(token)}`}>
        <input type="hidden" name="token" value={token} />
        <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} hint="At least 15 characters — a passphrase of a few random words works well." />
        <button className="btn btn-primary btn-lg w-full" type="submit">
          Save new password
        </button>
      </Form>
    </AuthCard>
  );
}
