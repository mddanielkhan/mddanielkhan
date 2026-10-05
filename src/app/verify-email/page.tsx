import Link from "next/link";
import { ActionButton } from "@/components/form";
import { AuthCard } from "@/components/auth-shell";
import { Flash } from "@/components/ui";
import { CircleCheck, Icon, MailCheck } from "@/components/icons";
import { getActor } from "@/lib/auth/current";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await getActor();
  const verified = !!actor?.user.emailVerifiedAt || sp(params.n) === "email_verified";
  return (
    <AuthCard
      title={verified ? "Your email is verified" : "Check your inbox"}
      subtitle={verified ? (actor ? "You're all set — you can post, answer and book sessions." : "Log in to start posting, answering and booking sessions.") : "We sent you a link. Open it and press “Confirm” to finish. It's valid for 24 hours."}
      icon={
        <span className="icon-tile h-12 w-12 rounded-2xl">
          <Icon icon={verified ? CircleCheck : MailCheck} className="h-6 w-6" />
        </span>
      }
    >
      <Flash searchParams={params} />
      {verified ? (
        <Link href={actor ? "/feed" : "/login"} className="btn btn-primary btn-lg w-full">
          {actor ? "Go to the community" : "Log in"}
        </Link>
      ) : (
        <>
          <ul className="mb-6 space-y-2 rounded-xl bg-subtle p-4 text-sm text-muted">
            <li>Check your spam or promotions folder.</li>
            <li>Our emails only link to our own website and never ask for money, passwords or codes.</li>
          </ul>
          {actor ? (
            <ActionButton action="/api/auth/resend-verification" className="w-full">
              Send a new link
            </ActionButton>
          ) : (
            <p className="text-sm text-muted">
              <Link href="/login?next=/verify-email" className="font-semibold">
                Log in
              </Link>{" "}
              to request a new link.
            </p>
          )}
        </>
      )}
    </AuthCard>
  );
}
