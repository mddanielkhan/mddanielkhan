import Link from "next/link";
import { redirect } from "next/navigation";
import { Form } from "@/components/form";
import { AuthShell } from "@/components/auth-shell";
import { Flash, TextField } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { safeBackPath } from "@/lib/http/urls";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (await getActor()) redirect(safeBackPath(sp(params.next), "/feed"));
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to ask questions, answer others and manage your sessions."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-semibold">
            Create a free account
          </Link>
        </>
      }
    >
      <Flash searchParams={params} />
      <Form action="/api/auth/login" back="/login">
        <input type="hidden" name="next" value={safeBackPath(sp(params.next), "/feed")} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required maxLength={128} fieldClassName="mb-2" />
        <p className="mb-5 text-right text-sm">
          <Link href="/forgot-password" className="font-semibold no-underline hover:underline">
            Forgot password?
          </Link>
        </p>
        <button className="btn btn-primary btn-lg w-full" type="submit">
          Log in
        </button>
      </Form>
    </AuthShell>
  );
}
