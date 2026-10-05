import Link from "next/link";
import { requireActor } from "@/lib/auth/current";
import { listMyBookings } from "@/lib/booking/service";
import { Card, EmptyState, Flash, PageHeader, Pill, formatDateTime } from "@/components/ui";
import { STATUS_LABEL } from "@/components/booking-status";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "My sessions", robots: { index: false } };



export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/bookings");
  const rows = await listMyBookings(actor.user.id);
  const asMentor = rows.filter((b) => b.mentorId === actor.user.id);
  const asMentee = rows.filter((b) => b.menteeId === actor.user.id);
  const list = (items: typeof rows, empty: string) =>
    items.length ? (
      <div className="space-y-2">
        {items.map((b) => (
          <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <Link href={`/bookings/${b.id}`} className="font-medium">
                {b.subject}
              </Link>
              <p className="muted text-sm">{b.scheduledAt ? formatDateTime(b.scheduledAt) : `${b.proposedTimes.length} proposed time(s)`} · {b.durationMin} min</p>
            </div>
            <Pill tone={STATUS_LABEL[b.status]?.tone}>{STATUS_LABEL[b.status]?.label ?? b.status}</Pill>
          </Card>
        ))}
      </div>
    ) : (
      <EmptyState title={empty} />
    );
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My sessions" actions={<Link href="/mentors" className="btn btn-secondary">Find a mentor</Link>} />
      <Flash searchParams={await searchParams} />
      {asMentor.length ? (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-bold">As a mentor</h2>
          {list(asMentor, "No requests yet")}
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-lg font-bold">As a student</h2>
        {list(asMentee, "You haven't requested a session yet")}
      </section>
    </div>
  );
}
