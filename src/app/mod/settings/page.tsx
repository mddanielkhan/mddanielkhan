import { requirePermission } from "@/lib/auth/current";
import { getSettings, KILL_SWITCHES } from "@/lib/settings";
import { listBlockedDomains } from "@/lib/moderation/service";
import { ActionButton, Form } from "@/components/form";
import { Flash, PageHeader, Panel, Pill, TextField, formatDateTime } from "@/components/ui";
import { Ban, Icon, Power } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Safety settings", robots: { index: false } };

export default async function ModSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("staff.moderate", "/mod/settings");
  const [settings, domains] = await Promise.all([getSettings(), listBlockedDomains()]);
  const admin = actor.user.role === "admin";
  return (
    <>
      <PageHeader title="Safety settings" subtitle="Incident controls and the domain blocklist. Every change is audited." />
      <Flash searchParams={await searchParams} />
      <div className="space-y-6">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Icon icon={Power} className="h-5 w-5 text-brand-ink" />
              Kill switches
            </span>
          }
          description={`Pause part of the platform during an incident (spam wave, scam campaign, legal order) without a deploy.${admin ? "" : " Only admins can change these."}`}
        >
          <ul className="-my-3 divide-y divide-line">
            {(Object.entries(KILL_SWITCHES) as Array<[keyof typeof KILL_SWITCHES, string]>).map(([key, label]) => {
              const on = settings.get(key) === true;
              return (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? "bg-[var(--color-danger-600)]" : "bg-brand-500"}`} aria-hidden="true" />
                    <span className="text-sm font-medium text-ink">{label}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {on ? <Pill tone="danger">Paused</Pill> : <Pill tone="brand">Running</Pill>}
                    {admin ? (
                      <ActionButton action="/api/mod/settings" fields={{ key, value: on ? "off" : "on" }} variant={on ? "primary" : "danger-soft"} size="sm">
                        {on ? "Resume" : "Pause"}
                      </ActionButton>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Icon icon={Ban} className="h-5 w-5 text-brand-ink" />
              Blocked domains
            </span>
          }
          description="Posts linking to these domains (or their subdomains) are rejected automatically. Add fake consultancy sites, phishing pages and lookalike domains."
        >
          <Form action="/api/mod/domains" back="/mod/settings" className="grid grid-cols-1 gap-x-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
            <TextField label="Domain" name="domain" required placeholder="fake-visa-agency.example" />
            <TextField label="Reason" name="reason" required minLength={5} maxLength={300} placeholder="Advance-fee visa scam" />
            <button className="btn btn-primary sm:mt-[1.9rem]" type="submit">
              Block
            </button>
          </Form>
          {domains.length ? (
            <div className="-mx-5 mt-2 overflow-x-auto border-t border-line sm:-mx-6">
              <table className="table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Reason</th>
                    <th>Added</th>
                    {admin ? <th className="text-right">Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {domains.map((d) => (
                    <tr key={d.domain}>
                      <td className="font-mono text-xs font-semibold">{d.domain}</td>
                      <td className="text-ink-soft">{d.reason}</td>
                      <td className="whitespace-nowrap text-muted">{formatDateTime(d.createdAt)}</td>
                      {admin ? (
                        <td className="text-right">
                          <ActionButton action="/api/mod/domains/remove" fields={{ domain: d.domain }} variant="ghost" size="sm">
                            Unblock
                          </ActionButton>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">No domains blocked yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
