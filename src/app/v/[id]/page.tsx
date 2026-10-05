import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { badges, users } from "@/lib/db/schema";
import { BADGE_INFO, badgeState } from "@/lib/trust/badges";
import { Card, PageHeader, Pill, formatDate } from "@/components/ui";
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
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={`${info.icon} ${info.title}`} subtitle={info.meaning} />
      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium">Holder</dt>
          <dd>{user.status === "deleted" ? "Deleted member" : <Link href={`/u/${user.username}`}>{user.displayName}</Link>}</dd>
          <dt className="font-medium">Credential</dt>
          <dd>{b.label}</dd>
          <dt className="font-medium">How it was verified</dt>
          <dd>{METHOD_LABEL[b.method] ?? b.method}</dd>
          <dt className="font-medium">Granted</dt>
          <dd>{formatDate(b.grantedAt)}</dd>
          {b.expiresAt ? (
            <>
              <dt className="font-medium">Expires</dt>
              <dd>{formatDate(b.expiresAt)}</dd>
            </>
          ) : null}
          <dt className="font-medium">Status</dt>
          <dd>{state === "active" ? <Pill tone="brand">Active</Pill> : state === "expired" ? <Pill tone="warn">Expired</Pill> : <Pill tone="danger">Revoked</Pill>}</dd>
          <dt className="font-medium">Credential ID</dt>
          <dd className="font-mono text-xs break-all">{b.id}</dd>
        </dl>
        <p className="muted mt-4 text-xs">We publish the fact and method of verification only. Documents used in a review are never published and are not stored after the decision.</p>
      </Card>
    </div>
  );
}
