import QRCode from "qrcode";
import { requireActor } from "@/lib/auth/current";
import { listSessions, pendingTotpSecret, remainingRecoveryCodes } from "@/lib/account/auth-service";
import { otpauthUri } from "@/lib/auth/totp";
import { BRAND } from "@/lib/config/brand";
import { isStaffRole } from "@/lib/policy/policy";
import { ActionButton, Form } from "@/components/form";
import { SettingsNav } from "@/components/settings-nav";
import { Card, Flash, Notice, PageHeader, Pill, TextField, formatDateTime } from "@/components/ui";
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
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Security & devices" />
      <SettingsNav current="security" />
      <Flash searchParams={await searchParams} />

      <Card className="mb-6">
        <h2 id="totp" className="mb-2 text-lg font-semibold">
          Two-factor authentication {actor.user.totpEnabledAt ? <Pill tone="brand">On</Pill> : <Pill tone="warn">Off</Pill>}
        </h2>
        {staff || !actor.user.totpEnabledAt ? (
          <p className="muted mb-3 text-sm">Required for mentors and moderators. Strongly recommended for everyone: it stops someone who learns your password from getting in.</p>
        ) : null}
        {actor.user.totpEnabledAt ? (
          <>
            <p className="text-sm">Enabled {formatDateTime(actor.user.totpEnabledAt)}. Recovery codes remaining: {recovery}.</p>
            {recovery <= 3 ? <Notice tone="warn">You are running low on recovery codes. Turn 2FA off and on again to get a fresh set.</Notice> : null}
            {!staff ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm">Turn off two-factor authentication</summary>
                <Form action="/api/auth/totp/disable" back="/settings/security" className="mt-3">
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
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL, not a remote image */}
            <img src={qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-lg bg-white p-2" />
            <div>
              <ol className="mb-3 list-decimal pl-5 text-sm">
                <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, Aegis…).</li>
                <li>Scan this QR code, or type the key below.</li>
                <li>Enter the 6-digit code it shows.</li>
              </ol>
              <p className="mb-3 break-all font-mono text-sm">{pending.match(/.{1,4}/g)?.join(" ")}</p>
              <Form action="/api/auth/totp/confirm" back="/settings/security">
                <TextField label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={10} />
                <button className="btn btn-primary" type="submit">
                  Turn on 2FA
                </button>
              </Form>
            </div>
          </div>
        ) : (
          <ActionButton action="/api/auth/totp/begin" variant="primary">
            Set up two-factor authentication
          </ActionButton>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Change password</h2>
        <Form action="/api/auth/change-password" back="/settings/security">
          <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />
          <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} hint="At least 15 characters. Other devices will be signed out." />
          <button className="btn btn-primary" type="submit">
            Change password
          </button>
        </Form>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Signed-in devices</h2>
          {devices.length > 1 ? <ActionButton action="/api/auth/sessions/revoke-others">Sign out all other devices</ActionButton> : null}
        </div>
        <ul className="divide-y divide-[var(--color-line)]">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {deviceName(d.userAgent)} {d.id === actor.session.id ? <Pill tone="brand">This device</Pill> : null}
                <span className="muted block">Last active {formatDateTime(d.lastSeenAt)} · signed in {formatDateTime(d.createdAt)}</span>
              </span>
              {d.id !== actor.session.id ? (
                <ActionButton action="/api/auth/sessions/revoke" fields={{ sessionId: d.id }}>
                  Sign out
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
