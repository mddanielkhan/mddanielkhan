import QRCode from "qrcode";
import { requireActor } from "@/lib/auth/current";
import { listSessions, pendingTotpSecret, remainingRecoveryCodes } from "@/lib/account/auth-service";
import { otpauthUri } from "@/lib/auth/totp";
import { BRAND } from "@/lib/config/brand";
import { isStaffRole } from "@/lib/policy/policy";
import { ActionButton, Form } from "@/components/form";
import { Flash, Notice, PageHeader, Panel, Pill, TextField, formatDateTime, timeAgo } from "@/components/ui";
import { CircleCheck, Icon, KeyRound, MonitorSmartphone, ShieldCheck, TriangleAlert } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Security", robots: { index: false } };

function deviceName(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

export default async function SecurityPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/settings/security");
  const [devices, recovery] = await Promise.all([listSessions(actor.user.id), remainingRecoveryCodes(actor.user.id)]);
  const pending = pendingTotpSecret(actor.user);
  const qr = pending ? await QRCode.toDataURL(otpauthUri(pending, actor.user.username, BRAND.name), { margin: 1, width: 220 }) : null;
  const staff = isStaffRole(actor.user.role);
  const on = !!actor.user.totpEnabledAt;
  return (
    <>
      <PageHeader title="Security & devices" subtitle="Protect your account and see where you're signed in." />
      <Flash searchParams={await searchParams} />
      <div className="space-y-6">
        <Panel
          id="totp"
          title={
            <span className="flex items-center gap-2">
              <Icon icon={ShieldCheck} className="h-5 w-5 text-brand-ink" />
              Two-factor authentication
            </span>
          }
          description="Stops someone who learns your password from getting in. Required for mentors and moderators."
          actions={on ? <Pill tone="brand" icon={CircleCheck}>On</Pill> : <Pill tone="warn" icon={TriangleAlert}>Off</Pill>}
        >
          {on ? (
            <>
              <p className="text-sm text-ink-soft">
                Enabled {formatDateTime(actor.user.totpEnabledAt)}. Recovery codes remaining: <strong className="text-ink">{recovery}</strong>.
              </p>
              {recovery <= 3 ? (
                <Notice tone="warn" className="mt-4">
                  You are running low on recovery codes. Turn 2FA off and on again to get a fresh set.
                </Notice>
              ) : null}
              {!staff ? (
                <details className="mt-5 border-t border-line pt-4">
                  <summary className="text-sm font-semibold text-muted hover:text-ink">Turn off two-factor authentication</summary>
                  <Form action="/api/auth/totp/disable" back="/settings/security" className="mt-4 max-w-md">
                    <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
                    <TextField label="Current 6-digit code or a recovery code" name="code" required autoComplete="one-time-code" />
                    <button className="btn btn-danger" type="submit">
                      Turn off 2FA
                    </button>
                  </Form>
                </details>
              ) : null}
            </>
          ) : pending && qr ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[13.75rem_minmax(0,1fr)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL, not a remote image */}
              <img src={qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-xl border border-line bg-white p-2" />
              <div>
                <ol className="space-y-2 text-sm text-ink-soft">
                  <li>
                    <strong className="text-ink">1.</strong> Install an authenticator app (Google Authenticator, Microsoft Authenticator, Aegis…).
                  </li>
                  <li>
                    <strong className="text-ink">2.</strong> Scan this QR code, or type the key below.
                  </li>
                  <li>
                    <strong className="text-ink">3.</strong> Enter the 6-digit code it shows.
                  </li>
                </ol>
                <p className="mt-4 rounded-lg bg-subtle px-3 py-2 font-mono text-sm tracking-wider break-all text-ink">{pending.match(/.{1,4}/g)?.join(" ")}</p>
                <Form action="/api/auth/totp/confirm" back="/settings/security" className="mt-4 max-w-xs">
                  <TextField label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={10} />
                  <button className="btn btn-primary" type="submit">
                    Turn on 2FA
                  </button>
                </Form>
              </div>
            </div>
          ) : (
            <ActionButton action="/api/auth/totp/begin" variant="primary" icon={KeyRound}>
              Set up two-factor authentication
            </ActionButton>
          )}
        </Panel>

        <Panel title="Change password" description="At least 15 characters. Other devices will be signed out.">
          <Form action="/api/auth/change-password" back="/settings/security" className="max-w-md">
            <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />
            <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} />
            <button className="btn btn-primary" type="submit">
              Change password
            </button>
          </Form>
        </Panel>

        <Panel
          title="Signed-in devices"
          description="Sign out anything you don't recognise, then change your password."
          actions={devices.length > 1 ? <ActionButton action="/api/auth/sessions/revoke-others" size="sm">Sign out all other devices</ActionButton> : null}
        >
          <ul className="-my-2 divide-y divide-line">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="icon-tile icon-tile-neutral h-9 w-9">
                  <Icon icon={MonitorSmartphone} />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {deviceName(d.userAgent)}
                    {d.id === actor.session.id ? <Pill tone="brand">This device</Pill> : null}
                  </span>
                  <span className="block text-xs text-muted">
                    Last active {timeAgo(d.lastSeenAt)} · signed in {formatDateTime(d.createdAt)}
                  </span>
                </span>
                {d.id !== actor.session.id ? (
                  <ActionButton action="/api/auth/sessions/revoke" fields={{ sessionId: d.id }} size="sm">
                    Sign out
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
