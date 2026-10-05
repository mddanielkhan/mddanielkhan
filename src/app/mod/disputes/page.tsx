import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { listDisputes } from "@/lib/booking/service";
import { Form } from "@/components/form";
import { ModNav } from "@/components/mod-nav";
import { Card, EmptyState, Flash, PageHeader, SelectField, TextArea, formatDateTime } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Session disputes", robots: { index: false } };

export default async function DisputesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod/disputes");
  const rows = await listDisputes();
  return (
    <>
      <PageHeader title="Session disputes" subtitle="The two sides reported different outcomes. Read the session messages, ask both sides if needed, then decide." />
      <ModNav current="disputes" />
      <Flash searchParams={await searchParams} />
      {rows.length === 0 ? <EmptyState title="No disputes" /> : null}
      <div className="space-y-3">
        {rows.map((b) => (
          <Card key={b.id}>
            <p className="font-semibold">
              <Link href={`/bookings/${b.id}`}>{b.subject}</Link>
            </p>
            <p className="muted text-sm">
              Scheduled {formatDateTime(b.scheduledAt)} · mentor says: {b.mentorOutcome ?? "—"} · student says: {b.menteeOutcome ?? "—"}
            </p>
            <Form action="/api/mod/disputes/resolve" back="/mod/disputes" className="mt-3">
              <input type="hidden" name="id" value={b.id} />
              <SelectField
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
              <TextArea label="Note to both parties" name="note" required minLength={5} maxLength={1000} rows={2} />
              <button className="btn btn-primary" type="submit">
                Resolve
              </button>
            </Form>
          </Card>
        ))}
      </div>
    </>
  );
}
