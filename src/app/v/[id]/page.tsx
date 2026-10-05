import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { badges, users } from "@/lib/db/schema";
import { BADGE_INFO, badgeState } from "@/lib/trust/badges";
import { BADGE_ICON } from "@/components/badges";
import { DescriptionList, Notice, formatDate } from "@/components/ui";
import { Icon, Lock } from "@/components/icons";
import { BRAND } from "@/lib/config/brand";
import type { Params } from "@/lib/http/page";

export const metadata = { title: "Credential", robots: { index: false } };

const METHOD_LABEL: Record<string, string> = {
  institution_email: "Mailbox control at an institutional email domain",
  manual_review: "Manual review of evidence by a moderator",
  computed: "Computed automatically from confirmed platform activity",
  staff_designation: "Designated by the platform team",
};

/** Public, inspectable proof of a badge: what was verified, how, when — never the underlying documents. */
export default async function CredentialPage({ params }: { params: Params<"id"> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db()
    .select({ badge: badges, user: { username: users.username, displayName: users.displayName, status: users.status } })
    .from(badges)
    .innerJoin(users, eq(users.id, badges.userId))
    .where(eq(badges.id, id));
  if (!row) notFound();
  const { badge: b, user } = row;
  const state = badgeState(b);
  const info = BADGE_INFO[b.kind];
  const look = BADGE_ICON[b.kind];
  return (
    <div className="mx-auto max-w-2xl">
      <article className="card overflow-hidden">
        <header className="band-brand relative px-6 py-10 text-center sm:px-10">
          <div className="grid-texture pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative">
            <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/25">
              <Icon icon={look.icon} className="h-8 w-8" />
            </span>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-brand-200">{BRAND.name} credential</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{info.title}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#cfe9db]">{info.meaning}</p>
          </div>
        </header>
        <div className="p-6 sm:p-8">
          {state === "active" ? (
            <Notice tone="success" title="Active credential">
              This record is current. It is removed automatically if the badge expires or is revoked.
            </Notice>
          ) : state === "expired" ? (
            <Notice tone="warn" title="Expired">
              This credential has passed its renewal date.
            </Notice>
          ) : (
            <Notice tone="danger" title="Revoked">
              This credential is no longer valid.
            </Notice>
          )}
          <DescriptionList
            items={[
              ["Holder", user.status === "deleted" ? "Deleted member" : <Link key="h" href={`/u/${user.username}`} className="font-semibold">{user.displayName}</Link>],
              ["Credential", <span key="c" className="font-semibold">{b.label}</span>],
              ["How it was verified", METHOD_LABEL[b.method] ?? b.method],
              ["Granted", formatDate(b.grantedAt)],
              b.expiresAt ? ["Expires", formatDate(b.expiresAt)] : null,
              ["Credential ID", <code key="i" className="break-all font-mono text-xs">{b.id}</code>],
            ]}
          />
          <p className="mt-6 flex items-start gap-2 rounded-lg bg-subtle px-3.5 py-3 text-xs leading-relaxed text-muted">
            <Icon icon={Lock} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            We publish the fact and method of verification only. Documents used in a review are never published and are not stored after the decision.
          </p>
        </div>
      </article>
      <p className="mt-5 text-center text-sm text-muted">Checking someone&apos;s badge? Open it from their {BRAND.name} profile. A screenshot proves nothing — this page does.</p>
    </div>
  );
}
