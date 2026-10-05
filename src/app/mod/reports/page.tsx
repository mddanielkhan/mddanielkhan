import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { openReports } from "@/lib/moderation/service";
import { REASON_LABELS, SLA_HOURS } from "@/lib/reports/service";
import { ActionButton, Form } from "@/components/form";
import { ModNav } from "@/components/mod-nav";
import { UserActionForm } from "@/components/user-action-form";
import { Card, EmptyState, Flash, PageHeader, Pill, TextField, formatDateTime } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Reports", robots: { index: false } };

function targetLink(type: string, id: string) {
  if (type === "post") return `/posts/${id}`;
  if (type === "booking") return `/bookings/${id}`;
  return null;
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod/reports");
  const rows = await openReports();
  return (
    <>
      <PageHeader title="Reports" subtitle="Ordered by priority, then age. Self-harm reports: contact the member privately with support resources — never take enforcement action." />
      <ModNav current="reports" />
      <Flash searchParams={await searchParams} />
      {rows.length === 0 ? <EmptyState title="No open reports" /> : null}
      <div className="space-y-3">
        {rows.map(({ report: r, targetUser, ageHours }) => {
          const ageH = Number(ageHours);
          const breached = ageH > (SLA_HOURS[r.priority] ?? 48);
          const link = targetLink(r.targetType, r.targetId);
          return (
            <Card key={r.id}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <Pill tone={r.priority === 0 ? "danger" : r.priority === 1 ? "warn" : "neutral"}>P{r.priority}</Pill>
                <Pill>{REASON_LABELS[r.reason]}</Pill>
                {breached ? <Pill tone="danger">SLA breached ({Math.round(ageH)}h)</Pill> : <span className="muted">{Math.round(ageH * 10) / 10}h old</span>}
                <span className="muted">
                  {r.targetType} · {r.reporterId ? `member report (weight ${r.weight})` : r.reporterContact ? "public notice" : "automatic"} · {formatDateTime(r.createdAt)}
                </span>
              </div>
              <p className="text-sm">
                Target: {link ? <Link href={link}>{r.targetType}</Link> : r.targetType} {targetUser ? <>· member <Link href={`/u/${targetUser.username}`}>{targetUser.displayName}</Link> ({targetUser.status})</> : null}
              </p>
              {r.details ? <p className="prose-user mt-1 text-sm">{r.details}</p> : null}
              {r.reporterContact ? <p className="muted text-xs">Reply to: {r.reporterContact}</p> : null}
              <div className="mt-3 flex flex-wrap items-start gap-2">
                {r.targetType === "post" || r.targetType === "answer" ? (
                  <ActionButton action="/api/mod/content" fields={{ targetType: r.targetType, targetId: r.targetId, decision: "remove", reasonCode: r.reason === "scam" || r.reason === "fake_opportunity" ? "scam" : "policy", reportId: r.id, _back: "/mod/reports" }} variant="danger">
                    Remove content
                  </ActionButton>
                ) : null}
                {r.targetUserId ? <UserActionForm userId={r.targetUserId} back="/mod/reports" reportId={r.id} /> : null}
                <Form action="/api/mod/reports/resolve" back="/mod/reports" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reportId" value={r.id} />
                  <TextField label="Note" name="note" maxLength={500} />
                  <button className="btn btn-secondary" type="submit" name="resolution" value="dismiss">
                    Dismiss
                  </button>
                  <button className="btn btn-secondary" type="submit" name="resolution" value="actioned">
                    Mark handled
                  </button>
                </Form>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
