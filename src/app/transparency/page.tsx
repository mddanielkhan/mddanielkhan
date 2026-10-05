import { transparencyStats } from "@/lib/moderation/service";
import { REASON_LABELS } from "@/lib/reports/service";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { Clock, ShieldAlert, Timer } from "@/components/icons";

export const metadata = { title: "Transparency report" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  remove_content: "Content removed",
  approve_content: "Held content approved",
  verify_opportunity: "Opportunities verified",
  warn: "Warnings",
  strike: "Strikes",
  suspend: "Suspensions",
  ban: "Bans",
  unban: "Unbans",
  restore: "Restrictions lifted",
  mentor_approve: "Mentors approved",
  mentor_reject: "Mentor applications declined",
  mentor_revoke: "Mentor status revoked",
  mentor_pause: "Mentors paused",
};

function CountTable({ rows, empty }: { rows: Array<[string, number]>; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="-my-2 divide-y divide-line text-sm">
      {rows.map(([k, n]) => (
        <li key={k} className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-ink-soft">{k}</span>
          <span className="font-bold tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function TransparencyPage() {
  const s = await transparencyStats(90);
  const fmtH = (h: number | null) => (h === null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : `${Math.round(h * 10) / 10} h`);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Accountability" title="Transparency report" subtitle={`Live figures for the last ${s.days} days, straight from our moderation records. Published because trust has to be checkable.`} />
      <section aria-label="Headline figures" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Median time to act on a report" value={fmtH(s.timing.medianHours ? Number(s.timing.medianHours) : null)} icon={Timer} />
        <Stat label="90th percentile" value={fmtH(s.timing.p90Hours ? Number(s.timing.p90Hours) : null)} icon={Clock} tone="info" />
        <Stat label="Posts stopped by the scam filter" value={s.autoHeld} icon={ShieldAlert} tone="danger" />
      </section>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title="Moderation actions">
          <CountTable rows={s.actions.map((a) => [ACTION_LABEL[a.action] ?? a.action, a.n])} empty="None yet." />
        </Panel>
        <Panel title="Reports received, by reason">
          <CountTable rows={s.reasons.map((r) => [REASON_LABELS[r.reason], r.n])} empty="None yet." />
        </Panel>
        <Panel title="Appeals">
          <CountTable rows={s.appeals.map((a) => [a.status === "granted" ? "Granted (decision reversed)" : a.status === "denied" ? "Denied" : "Pending", a.n])} empty="None yet." />
        </Panel>
        <Panel title="Government & legal requests">
          <p className="text-sm leading-relaxed text-ink-soft">Requests are logged, reviewed by counsel and reported here each quarter. Quarterly reports also include confirmed scam incidents and what we changed as a result.</p>
        </Panel>
      </div>
    </div>
  );
}
