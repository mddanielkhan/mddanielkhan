import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { offerings, users } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/current";
import { Form } from "@/components/form";
import { Card, Flash, Notice, PageHeader, TextArea, TextField } from "@/components/ui";
import type { Params, SearchParams } from "@/lib/http/page";

export const metadata = { title: "Request a session", robots: { index: false } };

function bdNowPlus(hours: number) {
  return new Date(Date.now() + hours * 3600_000 + 6 * 3600_000).toISOString().slice(0, 16);
}

export default async function BookPage({ params, searchParams }: { params: Params<"offeringId">; searchParams: SearchParams }) {
  const { offeringId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(offeringId)) notFound();
  await requirePermission("booking.request", `/book/${offeringId}`);
  const [row] = await db()
    .select({ offering: offerings, mentor: { username: users.username, displayName: users.displayName } })
    .from(offerings)
    .innerJoin(users, eq(users.id, offerings.mentorId))
    .where(eq(offerings.id, offeringId));
  if (!row || !row.offering.active) notFound();
  const min = bdNowPlus(13);
  const max = bdNowPlus(24 * 30);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Request: ${row.offering.title}`} subtitle={<>with <Link href={`/u/${row.mentor.username}`}>{row.mentor.displayName}</Link> · {row.offering.durationMin} minutes · free · online</>} />
      <Flash searchParams={await searchParams} />
      <Notice tone="info">
        Sessions on this platform are always free. If anyone asks you for money, documents or to move to WhatsApp/Telegram, stop and report it.
      </Notice>
      <Card>
        <Form action="/api/bookings" back={`/book/${offeringId}`}>
          <input type="hidden" name="offeringId" value={offeringId} />
          <TextField label="What do you want help with?" name="subject" required minLength={5} maxLength={120} placeholder="Choosing between two MSc offers" />
          <TextArea
            label="Your prepared questions"
            name="message"
            required
            minLength={40}
            maxLength={2000}
            rows={6}
            hint="Mentors give their time for free — come prepared. Share your background and 2–4 specific questions. Don't include phone numbers or ID numbers."
          />
          <fieldset className="mb-4">
            <legend className="mb-1 font-medium">Propose 1–3 times (Bangladesh time, UTC+6)</legend>
            <p className="muted mb-2 text-sm">At least 12 hours from now. The mentor picks one.</p>
            {[0, 1, 2].map((i) => (
              <input key={i} type="datetime-local" name="times[]" min={min} max={max} required={i === 0} className="input mb-2" aria-label={`Proposed time ${i + 1}`} />
            ))}
          </fieldset>
          <button className="btn btn-primary" type="submit">
            Send request
          </button>
        </Form>
      </Card>
    </div>
  );
}
