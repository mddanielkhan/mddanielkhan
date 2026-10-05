import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/current";
import { verifyAuditChain } from "@/lib/audit/audit";
import { Notice, PageHeader, formatDateTime } from "@/components/ui";
import { Link2, ShieldAlert } from "@/components/icons";

export const metadata = { title: "Audit log", robots: { index: false } };

export default async function AuditPage() {
  await requirePermission("staff.admin", "/mod/audit");
  const [chain, rows] = await Promise.all([verifyAuditChain(), db().select().from(auditLog).orderBy(desc(auditLog.id)).limit(100)]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Append-only and hash-chained. Any edit or deletion of a past entry breaks the chain and is detected here and by the daily check." />
      {chain.ok ? (
        <Notice tone="success" icon={Link2}>
          Chain intact — {chain.checked} entries verified.
        </Notice>
      ) : (
        <Notice tone="danger" icon={ShieldAlert} title="CHAIN BROKEN — start the incident runbook">
          Break at entry #{chain.brokenAtId}: {chain.reason}
        </Notice>
      )}
      <div className="card overflow-x-auto">
        <table className="table table-tight text-xs">
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono tabular-nums text-muted">{r.id}</td>
                <td className="whitespace-nowrap">{formatDateTime(r.occurredAt)}</td>
                <td>
                  <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-ink">{r.action}</code>
                </td>
                <td className="font-mono text-muted">{r.actorId?.slice(0, 8) ?? "system"}</td>
                <td className="whitespace-nowrap text-muted">
                  {r.targetType} <span className="font-mono">{r.targetId?.slice(0, 8)}</span>
                </td>
                <td className="font-mono text-muted">{r.hash.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
