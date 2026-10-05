import { requirePermission } from "@/lib/auth/current";
import { getSettings, KILL_SWITCHES } from "@/lib/settings";
import { listBlockedDomains } from "@/lib/moderation/service";
import { ActionButton, Form } from "@/components/form";
import { ModNav } from "@/components/mod-nav";
import { Card, Flash, PageHeader, Pill, TextField, formatDateTime } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Safety settings", robots: { index: false } };

export default async function ModSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("staff.moderate", "/mod/settings");
  const [settings, domains] = await Promise.all([getSettings(), listBlockedDomains()]);
  const admin = actor.user.role === "admin";
  return (
    <>
      <PageHeader title="Safety settings" />
      <ModNav current="settings" />
      <Flash searchParams={await searchParams} />
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Kill switches {admin ? "" : "(admins only)"}</h2>
        <p className="muted mb-3 text-sm">Use during an incident (spam wave, scam campaign, legal order) to pause part of the platform without a deploy. Every change is audited.</p>
        <ul className="divide-y divide-[var(--color-line)]">
          {(Object.entries(KILL_SWITCHES) as Array<[keyof typeof KILL_SWITCHES, string]>).map(([key, label]) => {
            const on = settings.get(key) === true;
            return (
              <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {label} {on ? <Pill tone="danger">PAUSED</Pill> : <Pill tone="brand">running</Pill>}
                </span>
                {admin ? (
                  <ActionButton action="/api/mod/settings" fields={{ key, value: on ? "off" : "on" }} variant={on ? "primary" : "danger"}>
                    {on ? "Resume" : "Pause"}
                  </ActionButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Blocked domains</h2>
        <p className="muted mb-3 text-sm">Posts linking to these domains (or their subdomains) are rejected automatically. Add fake consultancy sites, phishing pages and lookalike domains.</p>
        <Form action="/api/mod/domains" back="/mod/settings" className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField label="Domain" name="domain" required placeholder="fake-visa-agency.example" />
          <TextField label="Reason" name="reason" required minLength={5} maxLength={300} />
          <button className="btn btn-primary mb-4" type="submit">
            Block
          </button>
        </Form>
        <ul className="divide-y divide-[var(--color-line)] text-sm">
          {domains.map((d) => (
            <li key={d.domain} className="flex items-center justify-between gap-2 py-2">
              <span>
                <strong>{d.domain}</strong> <span className="muted">— {d.reason} · {formatDateTime(d.createdAt)}</span>
              </span>
              {admin ? (
                <ActionButton action="/api/mod/domains/remove" fields={{ domain: d.domain }} variant="link">
                  Unblock
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
