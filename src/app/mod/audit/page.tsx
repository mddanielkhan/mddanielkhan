import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/current";
import { verifyAuditChain } from "@/lib/audit/audit";
import { ModNav } from "@/components/mod-nav";
import { Card, Notice, PageHeader, formatDateTime } from "@/components/ui";

export const metadata = { title: "Audit log", robots: { index: false } };

export default async function AuditPage() {
  await requirePermission("staff.admin", "/mod/audit");
  const [chain, rows] = await Promise.all([verifyAuditChain(), db().select().from(auditLog).orderBy(desc(auditLog.id)).limit(100)]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Append-only and hash-chained. Any edit or deletion of a past entry breaks the chain and is detected." />
      <ModNav current="audit" />
      {chain.ok ? (
        <Notice tone="success">Chain intact — {chain.checked} entries verified.</Notice>
      ) : (
        <Notice tone="danger" title="CHAIN BROKEN — start the incident runbook">
          Break at entry #{chain.brokenAtId}: {chain.reason}
        </Notice>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--color-line)]">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">When</th>
              <th className="p-2">Action</th>
              <th className="p-2">Actor</th>
              <th className="p-2">Target</th>
              <th className="p-2">Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--color-line)]">
                <td className="p-2">{r.id}</td>
                <td className="p-2 whitespace-nowrap">{formatDateTime(r.occurredAt)}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2 font-mono">{r.actorId?.slice(0, 8) ?? "system"}</td>
                <td className="p-2">
                  {r.targetType} {r.targetId?.slice(0, 8)}
                </td>
                <td className="p-2 font-mono">{r.hash.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
