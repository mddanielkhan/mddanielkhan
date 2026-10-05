import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { queueCounts } from "@/lib/moderation/service";
import { failedJobCount } from "@/lib/jobs/queue";
import { ModNav } from "@/components/mod-nav";
import { Card, Flash, Notice, PageHeader } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Moderation", robots: { index: false } };

export default async function ModDashboard({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod");
  const [c, failedJobs] = await Promise.all([queueCounts(), failedJobCount()]);
  const tiles = [
    ["Held content", c.held, "/mod/queue"],
    ["Open reports", c.openReports, "/mod/reports"],
    ["Urgent (P0)", c.p0, "/mod/reports"],
    ["Mentor applications", c.pendingMentors, "/mod/mentors"],
    ["Appeals", c.openAppeals, "/mod/appeals"],
    ["Disputes", c.disputes, "/mod/disputes"],
  ] as const;
  return (
    <>
      <PageHeader title="Moderation" subtitle="Targets: P0 (imminent harm) within 1 hour · P1 (scams) within 4 hours · held content within 24 hours · appeals within 5 days." />
      <ModNav current="dashboard" counts={{ reports: c.p0, queue: c.held }} />
      <Flash searchParams={await searchParams} />
      {c.p0 ? <Notice tone="danger" title="Urgent safety reports waiting">Handle P0 reports first. For self-harm reports: reach out with support resources — never punish.</Notice> : null}
      {failedJobs ? <Notice tone="warn">{failedJobs} background job(s) failed permanently (e.g. emails). Check worker logs.</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map(([label, n, href]) => (
          <Link key={label} href={href} className="no-underline">
            <Card>
              <p className="muted text-sm">{label}</p>
              <p className="text-3xl font-bold text-[var(--color-ink)]">{n}</p>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-6 text-sm">
        <h2 className="mb-2 font-semibold">Moderator code</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Decide on evidence, cite the guideline, and write a reason the member will understand.</li>
          <li>Never act on content or people you have a personal or commercial connection with.</li>
          <li>Scams: remove, ban the account, add the domain to the blocklist, and consider a pattern-based Safety alert (no names).</li>
          <li>Every action is recorded in the tamper-evident audit log and can be appealed to a different moderator.</li>
        </ul>
      </Card>
    </>
  );
}
