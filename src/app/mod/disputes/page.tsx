import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { listDisputes } from "@/lib/booking/service";
import { Form } from "@/components/form";
import { EmptyState, Flash, PageHeader, SelectField, TextArea, formatDateTime } from "@/components/ui";
import { ClipboardCheck } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Session disputes", robots: { index: false } };

const OUTCOME = { happened: "It happened", no_show: "The other side didn't show" } as Record<string, string>;

export default async function DisputesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod/disputes");
  const rows = await listDisputes();
  return (
    <>
      <PageHeader title="Session disputes" subtitle="The two sides reported different outcomes. Read the session messages, ask both sides if needed, then decide." />
      <Flash searchParams={await searchParams} />
      {rows.length === 0 ? (
        <EmptyState title="No disputes" icon={ClipboardCheck}>
          Conflicting session outcomes appear here.
        </EmptyState>
      ) : null}
      <div className="space-y-5">
        {rows.map((b) => (
          <article key={b.id} className="card overflow-hidden">
            <div className="border-b border-line p-5">
              <h2 className="font-bold">
                <Link href={`/bookings/${b.id}`} className="text-ink">
                  {b.subject}
                </Link>
              </h2>
              <p className="mt-0.5 text-xs text-muted">Scheduled {formatDateTime(b.scheduledAt)}</p>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-subtle p-3">
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">Mentor says</dt>
                  <dd className="mt-1 font-semibold">{b.mentorOutcome ? (OUTCOME[b.mentorOutcome] ?? b.mentorOutcome) : "No answer"}</dd>
                </div>
                <div className="rounded-lg bg-subtle p-3">
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">Student says</dt>
                  <dd className="mt-1 font-semibold">{b.menteeOutcome ? (OUTCOME[b.menteeOutcome] ?? b.menteeOutcome) : "No answer"}</dd>
                </div>
              </dl>
            </div>
            <Form action="/api/mod/disputes/resolve" back="/mod/disputes" className="bg-subtle p-5">
              <input type="hidden" name="id" value={b.id} />
              <div className="grid grid-cols-1 gap-x-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                <SelectField
                  id={`res-${b.id}`}
                  label="Resolution"
                  name="resolution"
                  options={[
                    { value: "completed", label: "Session happened (completed)" },
                    { value: "no_show_mentor", label: "Mentor didn't show" },
                    { value: "no_show_mentee", label: "Student didn't show" },
                    { value: "cancelled_by_mentor", label: "Treat as cancelled by mentor" },
                    { value: "cancelled_by_mentee", label: "Treat as cancelled by student" },
                  ]}
                />
                <TextArea id={`note-${b.id}`} label="Note to both parties" name="note" required minLength={5} maxLength={1000} rows={2} />
              </div>
              <button className="btn btn-primary btn-sm" type="submit">
                Resolve dispute
              </button>
            </Form>
          </article>
        ))}
      </div>
    </>
  );
}
