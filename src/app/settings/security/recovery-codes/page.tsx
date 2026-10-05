import { cookies } from "next/headers";
import Link from "next/link";
import { requireActor } from "@/lib/auth/current";
import { decryptField } from "@/lib/security/crypto";
import { RECOVERY_CODES_COOKIE } from "@/lib/http/cookies";
import { Flash, Notice, PageHeader, Panel } from "@/components/ui";
import { ArrowLeft, Icon } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Recovery codes", robots: { index: false } };

export default async function RecoveryCodesPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/settings/security");
  const raw = (await cookies()).get(RECOVERY_CODES_COOKIE)?.value;
  let codes: string[] = [];
  try {
    codes = raw ? (JSON.parse(decryptField(raw, `rc:${actor.user.id}`)) as string[]) : [];
  } catch {
    codes = [];
  }
  return (
    <>
      <PageHeader title="Save your recovery codes" breadcrumbs={[{ href: "/settings/security", label: "Security & devices" }, { label: "Recovery codes" }]} />
      <Flash searchParams={await searchParams} />
      {codes.length ? (
        <>
          <Notice tone="warn" title="Shown once">
            Each code works one time if you lose your phone. Write them down or store them in a password manager — they won&apos;t be shown again.
          </Notice>
          <Panel title="Your recovery codes">
            <ul className="grid grid-cols-2 gap-2 font-mono text-[0.9375rem] tracking-wider">
              {codes.map((c) => (
                <li key={c} className="rounded-lg border border-line bg-subtle px-3 py-2 text-center">
                  {c}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : (
        <Notice tone="info">Recovery codes are only shown right after you turn on 2FA.</Notice>
      )}
      <Link href="/settings/security" className="btn btn-secondary mt-6">
        <Icon icon={ArrowLeft} />
        Back to security
      </Link>
    </>
  );
}
