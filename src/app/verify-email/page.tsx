import { ActionButton } from "@/components/form";
import { Card, Flash, PageHeader } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await getActor();
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Verify your email" />
      <Flash searchParams={params} />
      <Card>
        {actor?.user.emailVerifiedAt ? (
          <p>Your email is verified. You&apos;re all set.</p>
        ) : (
          <>
            <p className="mb-4">We sent a link to your email address. Open it and press “Confirm” to finish. The link is valid for 24 hours.</p>
            <ul className="muted mb-4 list-disc pl-5 text-sm">
              <li>Check your spam or promotions folder.</li>
              <li>Our emails never ask for money, passwords or codes.</li>
            </ul>
            {actor ? <ActionButton action="/api/auth/resend-verification">Send a new link</ActionButton> : <p className="text-sm">Log in to request a new link.</p>}
          </>
        )}
      </Card>
    </div>
  );
}
