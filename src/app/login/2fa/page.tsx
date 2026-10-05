import Link from "next/link";
import { redirect } from "next/navigation";
import { Form } from "@/components/form";
import { AuthCard } from "@/components/auth-shell";
import { Flash, TextField } from "@/components/ui";
import { Icon, KeyRound } from "@/components/icons";
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
    <AuthCard
      title="Enter your verification code"
      subtitle="Open your authenticator app and enter the 6-digit code for PeerLink."
      icon={
        <span className="icon-tile h-12 w-12 rounded-2xl">
          <Icon icon={KeyRound} className="h-6 w-6" />
        </span>
      }
      footer={
        <>
          Not you?{" "}
          <Link href="/login" className="font-semibold">
            Start again
          </Link>
        </>
      }
    >
      <Flash searchParams={params} />
      <Form action="/api/auth/2fa" back="/login/2fa">
        <input type="hidden" name="next" value={safeBackPath(sp(params.next), "/feed")} />
        <TextField
          label="6-digit code from your authenticator app"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={20}
          autoFocus
          placeholder="123 456"
          hint="Lost your phone? Enter one of your recovery codes instead (xxxx-xxxx-xxxx)."
        />
        <button className="btn btn-primary btn-lg w-full" type="submit">
          Verify
        </button>
      </Form>
    </AuthCard>
  );
}
