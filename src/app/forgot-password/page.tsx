import { Form } from "@/components/form";
import { Card, Flash, PageHeader, TextField } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Reset your password" />
      <Flash searchParams={await searchParams} />
      <Card>
        <Form action="/api/auth/forgot-password" back="/forgot-password">
          <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <button className="btn btn-primary w-full" type="submit">
            Send reset link
          </button>
        </Form>
      </Card>
    </div>
  );
}
