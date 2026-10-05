import Link from "next/link";
import { Form } from "@/components/form";
import { AuthCard } from "@/components/auth-shell";
import { Flash, TextField } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter the email you signed up with. If it belongs to an account, we'll send a reset link that works for 30 minutes."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold">
            Back to log in
          </Link>
        </>
      }
    >
      <Flash searchParams={await searchParams} />
      <Form action="/api/auth/forgot-password" back="/forgot-password">
        <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
        <button className="btn btn-primary btn-lg w-full" type="submit">
          Send reset link
        </button>
      </Form>
    </AuthCard>
  );
}
