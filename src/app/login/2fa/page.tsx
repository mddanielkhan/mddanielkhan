import { redirect } from "next/navigation";
import { Form } from "@/components/form";
import { Card, Flash, TextField } from "@/components/ui";
import { getRawSession } from "@/lib/auth/current";
import { safeBackPath } from "@/lib/http/urls";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Two-factor verification" };

export default async function TwoFactorPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = await getRawSession();
  if (!raw) redirect("/login");
  if (raw.session.mfaState !== "pending") redirect(safeBackPath(sp(params.next), "/feed"));
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Enter your verification code</h1>
      <Flash searchParams={params} />
      <Card>
        <Form action="/api/auth/2fa" back="/login/2fa">
          <input type="hidden" name="next" value={safeBackPath(sp(params.next), "/feed")} />
          <TextField label="6-digit code from your authenticator app" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={20} hint="Lost your phone? Enter one of your recovery codes instead (xxxx-xxxx-xxxx)." />
          <button className="btn btn-primary w-full" type="submit">
            Verify
          </button>
        </Form>
      </Card>
    </div>
  );
}
