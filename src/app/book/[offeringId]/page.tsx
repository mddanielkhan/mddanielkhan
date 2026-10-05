import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mentorProfiles, offerings, users } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/current";
import { Form } from "@/components/form";
import { Avatar, Flash, Notice, PageHeader, Pill, TextArea, TextField } from "@/components/ui";
import { BadgeCheck, CalendarClock, Clock, Icon, Lock, Video } from "@/components/icons";
import type { Params, SearchParams } from "@/lib/http/page";

export const metadata = { title: "Request a session", robots: { index: false } };

function bdNowPlus(hours: number) {
  return new Date(Date.now() + hours * 3600_000 + 6 * 3600_000).toISOString().slice(0, 16);
}

const NEXT_STEPS = [
  ["Your request is sent", "The mentor sees your questions and proposed times."],
  ["The mentor picks a time", "Within 72 hours, or the request expires and you can try someone else."],
  ["You meet online", "In a private video room. Only the two of you get the link."],
  ["Both confirm, then review", "Feedback opens only after both of you confirm it happened."],
] as const;

export default async function BookPage({ params, searchParams }: { params: Params<"offeringId">; searchParams: SearchParams }) {
  const { offeringId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(offeringId)) notFound();
  await requirePermission("booking.request", `/book/${offeringId}`);
  const [row] = await db()
    .select({ offering: offerings, mentor: { username: users.username, displayName: users.displayName }, headline: mentorProfiles.headline })
    .from(offerings)
    .innerJoin(users, eq(users.id, offerings.mentorId))
    .leftJoin(mentorProfiles, eq(mentorProfiles.userId, offerings.mentorId))
    .where(eq(offerings.id, offeringId));
  if (!row || !row.offering.active) notFound();
  const min = bdNowPlus(13);
  const max = bdNowPlus(24 * 30);
  return (
    <>
      <PageHeader
        title="Request a free session"
        subtitle="Come prepared: a clear goal and specific questions make the most of a mentor's time."
        breadcrumbs={[
          { href: "/mentors", label: "Mentors" },
          { href: `/u/${row.mentor.username}`, label: row.mentor.displayName },
          { label: "Request" },
        ]}
      />
      <Flash searchParams={await searchParams} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="card p-5 sm:p-7">
          <Form action="/api/bookings" back={`/book/${offeringId}`}>
            <input type="hidden" name="offeringId" value={offeringId} />
            <TextField label="What do you want help with?" name="subject" required minLength={5} maxLength={120} placeholder="Choosing between two MSc offers" />
            <TextArea
              label="Your prepared questions"
              name="message"
              required
              minLength={40}
              maxLength={2000}
              rows={7}
              placeholder={"My background: …\n1. …\n2. …"}
              hint="Mentors give their time for free — come prepared. Share your background and 2–4 specific questions. Don't include phone numbers or ID numbers."
            />
            <fieldset className="fieldset">
              <legend>
                <span className="flex items-center gap-2">
                  <Icon icon={CalendarClock} className="h-4.5 w-4.5 text-brand-ink" />
                  Propose 1–3 times
                </span>
              </legend>
              <p className="mb-4 text-sm text-muted">Bangladesh time (UTC+6), at least 12 hours from now. More options make it easier to say yes.</p>
              <div className="grid grid-cols-1 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-muted ring-1 ring-line">{i + 1}</span>
                    <input type="datetime-local" name="times[]" min={min} max={max} required={i === 0} className="input" aria-label={`Proposed time ${i + 1}`} />
                  </div>
                ))}
              </div>
            </fieldset>
            <Notice tone="info" icon={Lock}>
              Sessions are always free. If anyone asks you for money, documents or to move to WhatsApp/Telegram, stop and report it.
            </Notice>
            <button className="btn btn-primary btn-lg" type="submit">
              Send request
            </button>
          </Form>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <Avatar name={row.mentor.displayName} size={48} />
              <div className="min-w-0">
                <Link href={`/u/${row.mentor.username}`} className="flex items-center gap-1.5 font-bold text-ink no-underline hover:underline">
                  {row.mentor.displayName}
                  <Icon icon={BadgeCheck} className="h-4 w-4 text-brand-600" label="Verified mentor" />
                </Link>
                {row.headline ? <p className="line-clamp-2 text-xs text-muted">{row.headline}</p> : null}
              </div>
            </div>
            <div className="divider my-4" />
            <p className="font-bold leading-snug">{row.offering.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill icon={Clock}>{row.offering.durationMin} min</Pill>
              <Pill tone="brand">Free</Pill>
              <Pill icon={Video}>Online</Pill>
            </div>
            {row.offering.description ? <p className="prose-user mt-3 text-sm leading-relaxed text-muted">{row.offering.description}</p> : null}
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-bold">What happens next</h2>
            <ol className="mt-4 space-y-4">
              {NEXT_STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-800">{i + 1}</span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
