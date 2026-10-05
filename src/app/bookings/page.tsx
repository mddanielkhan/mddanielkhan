import Link from "next/link";
import { requireActor } from "@/lib/auth/current";
import { listMyBookings } from "@/lib/booking/service";
import { RULES } from "@/lib/booking/state-machine";
import { Avatar, EmptyState, Flash, PageHeader, Pill, Section, formatSlot } from "@/components/ui";
import { STATUS_LABEL } from "@/components/booking-status";
import { CalendarDays, ChevronRight, GraduationCap, Icon } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "My sessions", robots: { index: false } };

type Row = Awaited<ReturnType<typeof listMyBookings>>[number];

function group(rows: Row[], me: string) {
  const now = Date.now();
  const myOutcome = (b: Row) => (b.mentorId === me ? b.mentorOutcome : b.menteeOutcome);
  const needsAction = rows.filter(
    (b) => (b.status === "requested" && b.mentorId === me) || (b.status === "accepted" && b.scheduledAt && now >= b.scheduledAt.getTime() + RULES.outcomeGraceMs && !myOutcome(b)),
  );
  const upcoming = rows
    .filter((b) => (b.status === "accepted" && b.scheduledAt && now < b.scheduledAt.getTime() + RULES.outcomeGraceMs) || (b.status === "requested" && b.menteeId === me))
    .sort((a, b) => (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity));
  const shown = new Set([...needsAction, ...upcoming].map((b) => b.id));
  const past = rows.filter((b) => !shown.has(b.id));
  return { needsAction, upcoming, past };
}

function BookingRow({ b, me }: { b: Row; me: string }) {
  const asMentor = b.mentorId === me;
  const other = asMentor ? b.menteeName : b.mentorName;
  const status = STATUS_LABEL[b.status];
  return (
    <li>
      <Link href={`/bookings/${b.id}`} className="flex items-center gap-4 px-5 py-4 no-underline hover:bg-subtle">
        <Avatar name={other} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{b.subject}</span>
          <span className="mt-0.5 block truncate text-sm text-muted">
            {asMentor ? "With student" : "With mentor"} {other} · {b.scheduledAt ? formatSlot(b.scheduledAt) : `${b.proposedTimes.length} proposed time${b.proposedTimes.length === 1 ? "" : "s"}`} · {b.durationMin} min
          </span>
        </span>
        <Pill tone={status?.tone}>{status?.label ?? b.status}</Pill>
        <Icon icon={ChevronRight} className="hidden h-4 w-4 text-muted sm:block" />
      </Link>
    </li>
  );
}

export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/bookings");
  const rows = await listMyBookings(actor.user.id);
  const me = actor.user.id;
  const { needsAction, upcoming, past } = group(rows, me);
  const list = (items: Row[]) => (
    <ul className="card divide-y divide-line overflow-hidden">
      {items.map((b) => (
        <BookingRow key={b.id} b={b} me={me} />
      ))}
    </ul>
  );
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My sessions"
        subtitle="Requests, upcoming sessions and your history — as a student and as a mentor."
        actions={
          <Link href="/mentors" className="btn btn-secondary">
            <Icon icon={GraduationCap} />
            Find a mentor
          </Link>
        }
      />
      <Flash searchParams={await searchParams} />
      {rows.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          icon={CalendarDays}
          action={
            <Link href="/mentors" className="btn btn-primary">
              Browse verified mentors
            </Link>
          }
        >
          Find a mentor who has done what you want to do, and request a free session with your prepared questions.
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {needsAction.length ? (
            <Section title="Needs your action" description="Requests waiting for your reply (they expire after 72 hours) and sessions to confirm as happened.">
              {list(needsAction)}
            </Section>
          ) : null}
          <Section title="Upcoming" description="Confirmed sessions and requests waiting for a mentor.">
            {upcoming.length ? list(upcoming) : <p className="panel-subtle p-5 text-sm text-muted">Nothing upcoming.</p>}
          </Section>
          {past.length ? <Section title="Past">{list(past)}</Section> : null}
        </div>
      )}
    </div>
  );
}
