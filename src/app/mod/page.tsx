import { requirePermission } from "@/lib/auth/current";
import { queueCounts } from "@/lib/moderation/service";
import { failedJobCount } from "@/lib/jobs/queue";
import { Flash, Notice, PageHeader, Panel, Stat } from "@/components/ui";
import { ClipboardCheck, Flag, GraduationCap, Inbox, Scale, Siren } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Moderation", robots: { index: false } };

const TARGETS = [
  ["P0 · imminent harm", "1 hour"],
  ["P1 · scams & fraud", "4 hours"],
  ["Held content", "24 hours"],
  ["Appeals", "5 days"],
] as const;

export default async function ModDashboard({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod");
  const [c, failedJobs] = await Promise.all([queueCounts(), failedJobCount()]);
  return (
    <>
      <PageHeader title="Overview" subtitle="What needs a human decision right now, highest priority first." />
      <Flash searchParams={await searchParams} />
      {c.p0 ? (
        <Notice tone="danger" title={`${c.p0} urgent safety report${c.p0 === 1 ? "" : "s"} waiting`} icon={Siren}>
          Handle P0 reports first. For self-harm reports: reach out with support resources — never punish.
        </Notice>
      ) : null}
      {failedJobs ? <Notice tone="warn">{failedJobs} background job(s) failed permanently (for example emails). Check the worker logs.</Notice> : null}

      <section aria-label="Queues" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Urgent reports (P0)" value={c.p0} icon={Siren} tone={c.p0 ? "danger" : "neutral"} href="/mod/reports" />
        <Stat label="Held content" value={c.held} icon={Inbox} tone={c.held ? "gold" : "neutral"} href="/mod/queue" />
        <Stat label="Open reports" value={c.openReports} icon={Flag} tone={c.openReports ? "gold" : "neutral"} href="/mod/reports" />
        <Stat label="Mentor applications" value={c.pendingMentors} icon={GraduationCap} tone="info" href="/mod/mentors" />
        <Stat label="Appeals" value={c.openAppeals} icon={Scale} tone="info" href="/mod/appeals" />
        <Stat label="Session disputes" value={c.disputes} icon={ClipboardCheck} tone="info" href="/mod/disputes" />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Response targets" description="Published in the transparency report — keep them.">
          <ul className="-my-2 divide-y divide-line text-sm">
            {TARGETS.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between py-2.5">
                <span className="text-ink-soft">{k}</span>
                <span className="font-bold tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Moderator code">
          <ul className="space-y-2 text-sm leading-relaxed text-ink-soft">
            <li>Decide on evidence, cite the guideline, and write a reason the member will understand.</li>
            <li>Never act on content or people you have a personal or commercial connection with.</li>
            <li>Scams: remove, ban the account, block the domain, and consider a pattern-based safety alert (no names).</li>
            <li>Every action is recorded in the tamper-evident audit log and can be appealed to a different moderator.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
