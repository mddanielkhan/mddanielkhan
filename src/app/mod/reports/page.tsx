import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { openReports } from "@/lib/moderation/service";
import { REASON_LABELS, SLA_HOURS } from "@/lib/reports/service";
import { ActionButton, Form } from "@/components/form";
import { UserActionForm } from "@/components/user-action-form";
import { EmptyState, Flash, PageHeader, Pill, formatDateTime } from "@/components/ui";
import { CircleCheck, Clock, Icon, Trash } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Reports", robots: { index: false } };

function targetLink(type: string, id: string) {
  if (type === "post") return `/posts/${id}`;
  if (type === "booking") return `/bookings/${id}`;
  return null;
}

const LANE_TONE = { 0: "danger", 1: "warn", 2: "info", 3: "neutral" } as const;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod/reports");
  const rows = await openReports();
  return (
    <>
      <PageHeader title="Reports" subtitle="Ordered by priority, then age. Self-harm reports: contact the member privately with support resources — never take enforcement action." />
      <Flash searchParams={await searchParams} />
      {rows.length === 0 ? (
        <EmptyState title="No open reports" icon={CircleCheck}>
          Everything reported has been handled.
        </EmptyState>
      ) : null}
      <div className="space-y-4">
        {rows.map(({ report: r, targetUser, ageHours }) => {
          const ageH = Number(ageHours);
          const sla = SLA_HOURS[r.priority] ?? 48;
          const breached = ageH > sla;
          const link = targetLink(r.targetType, r.targetId);
          return (
            <article key={r.id} className={`card overflow-hidden ${r.priority === 0 ? "border-[var(--color-danger-line)]" : ""}`}>
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={LANE_TONE[r.priority as 0 | 1 | 2 | 3] ?? "neutral"}>P{r.priority}</Pill>
                  <Pill>{REASON_LABELS[r.reason]}</Pill>
                  {breached ? (
                    <Pill tone="danger" icon={Clock}>
                      Over target by {Math.round(ageH - sla)}h
                    </Pill>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Icon icon={Clock} className="h-3.5 w-3.5" />
                      {Math.round(ageH * 10) / 10}h old · target {sla}h
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{link ? <Link href={link}>{r.targetType}</Link> : r.targetType}</span>
                  {targetUser ? (
                    <>
                      {" "}
                      by <Link href={`/u/${targetUser.username}`}>{targetUser.displayName}</Link> <span className="text-muted">({targetUser.status})</span>
                    </>
                  ) : null}
                  <span className="text-muted">
                    {" "}
                    · {r.reporterId ? `member report (weight ${r.weight})` : r.reporterContact ? "public notice" : "automatic"} · {formatDateTime(r.createdAt)}
                  </span>
                </p>
                {r.details ? <p className="prose-user mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed text-ink-soft">{r.details}</p> : null}
                {r.reporterContact ? <p className="mt-2 text-xs text-muted">Reply to: {r.reporterContact}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-subtle px-5 py-3">
                {r.targetType === "post" || r.targetType === "answer" ? (
                  <ActionButton
                    action="/api/mod/content"
                    fields={{ targetType: r.targetType, targetId: r.targetId, decision: "remove", reasonCode: r.reason === "scam" || r.reason === "fake_opportunity" ? "scam" : "policy", reportId: r.id, _back: "/mod/reports" }}
                    variant="danger"
                    size="sm"
                    icon={Trash}
                  >
                    Remove content
                  </ActionButton>
                ) : null}
                {r.targetUserId ? <UserActionForm userId={r.targetUserId} back="/mod/reports" reportId={r.id} /> : null}
                <Form action="/api/mod/reports/resolve" back="/mod/reports" className="flex flex-wrap items-center gap-2 lg:ml-auto">
                  <input type="hidden" name="reportId" value={r.id} />
                  <label className="sr-only" htmlFor={`note-${r.id}`}>
                    Resolution note
                  </label>
                  <div className="w-56 max-w-full">
                    <input id={`note-${r.id}`} name="note" maxLength={500} className="input min-h-8 py-1.5 text-sm" placeholder="Resolution note (optional)" />
                  </div>
                  <button className="btn btn-secondary btn-sm" type="submit" name="resolution" value="dismiss">
                    Dismiss
                  </button>
                  <button className="btn btn-secondary btn-sm" type="submit" name="resolution" value="actioned">
                    Mark handled
                  </button>
                </Form>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
