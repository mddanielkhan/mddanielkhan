import { cookies } from "next/headers";
import Link from "next/link";
import { requireActor } from "@/lib/auth/current";
import { decryptField } from "@/lib/security/crypto";
import { RECOVERY_CODES_COOKIE } from "@/lib/http/cookies";
import { Card, Flash, Notice, PageHeader } from "@/components/ui";
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
    <div className="mx-auto max-w-xl">
      <PageHeader title="Save your recovery codes" />
      <Flash searchParams={await searchParams} />
      {codes.length ? (
        <>
          <Notice tone="warn">Each code works once if you lose your phone. Write them down or store them in a password manager. They won&apos;t be shown again.</Notice>
          <Card>
            <ul className="grid grid-cols-2 gap-2 font-mono">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <Notice tone="info">Recovery codes are only shown right after you turn on 2FA.</Notice>
      )}
      <p className="mt-4">
        <Link href="/settings/security">← Back to security</Link>
      </p>
    </div>
  );
}
