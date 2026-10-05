import { transparencyStats } from "@/lib/moderation/service";
import { REASON_LABELS } from "@/lib/reports/service";
import { Card, PageHeader } from "@/components/ui";

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

export default async function TransparencyPage() {
  const s = await transparencyStats(90);
  const fmtH = (h: number | null) => (h === null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : `${Math.round(h * 10) / 10} h`);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Transparency report" subtitle={`Live figures for the last ${s.days} days. Published because trust has to be checkable.`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="muted text-sm">Median time to act on a report</p>
          <p className="text-2xl font-bold">{fmtH(s.timing.medianHours ? Number(s.timing.medianHours) : null)}</p>
        </Card>
        <Card>
          <p className="muted text-sm">90th percentile</p>
          <p className="text-2xl font-bold">{fmtH(s.timing.p90Hours ? Number(s.timing.p90Hours) : null)}</p>
        </Card>
        <Card>
          <p className="muted text-sm">Posts held by the scam filter</p>
          <p className="text-2xl font-bold">{s.autoHeld}</p>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Moderation actions</h2>
          <ul className="space-y-1 text-sm">
            {s.actions.length === 0 ? <li className="muted">None yet.</li> : null}
            {s.actions.map((a) => (
              <li key={a.action} className="flex justify-between">
                <span>{ACTION_LABEL[a.action] ?? a.action}</span>
                <span>{a.n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Reports received, by reason</h2>
          <ul className="space-y-1 text-sm">
            {s.reasons.length === 0 ? <li className="muted">None yet.</li> : null}
            {s.reasons.map((r) => (
              <li key={r.reason} className="flex justify-between">
                <span>{REASON_LABELS[r.reason]}</span>
                <span>{r.n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Appeals</h2>
          <ul className="space-y-1 text-sm">
            {s.appeals.length === 0 ? <li className="muted">None yet.</li> : null}
            {s.appeals.map((a) => (
              <li key={a.status} className="flex justify-between">
                <span>{a.status === "granted" ? "Granted (decision reversed)" : a.status === "denied" ? "Denied" : "Pending"}</span>
                <span>{a.n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Government & legal requests</h2>
          <p className="text-sm">Requests are logged, reviewed by counsel and reported here each quarter. Quarterly reports also include confirmed scam incidents and what we changed as a result.</p>
        </Card>
      </div>
    </div>
  );
}
