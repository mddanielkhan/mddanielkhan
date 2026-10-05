import Link from "next/link";
import { redirect } from "next/navigation";
import { Form } from "@/components/form";
import { Card, Flash, TextField } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import { safeBackPath } from "@/lib/http/urls";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (await getActor()) redirect(safeBackPath(sp(params.next), "/feed"));
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <Flash searchParams={params} />
      <Card>
        <Form action="/api/auth/login" back="/login">
          <input type="hidden" name="next" value={safeBackPath(sp(params.next), "/feed")} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
          <button className="btn btn-primary w-full" type="submit">
            Log in
          </button>
        </Form>
        <div className="mt-4 flex justify-between text-sm">
          <Link href="/forgot-password">Forgot password?</Link>
          <Link href="/register">Create an account</Link>
        </div>
      </Card>
      <p className="muted mt-4 text-sm">We will never ask for your password or a code by phone, email or message.</p>
    </div>
  );
}
