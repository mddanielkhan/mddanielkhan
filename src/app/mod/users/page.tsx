import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { searchUsers, userModerationHistory } from "@/lib/moderation/service";
import { audit } from "@/lib/audit/audit";
import { Form } from "@/components/form";
import { ModNav } from "@/components/mod-nav";
import { UserActionForm } from "@/components/user-action-form";
import { Card, Flash, PageHeader, Pill, SelectField, formatDateTime } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Members", robots: { index: false } };

export default async function ModUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("staff.moderate", "/mod/users");
  const params = await searchParams;
  const q = sp(params.q) ?? "";
  const rows = q.length >= 2 ? await searchUsers(q) : [];
  if (q.length >= 2) await audit({ action: "staff.member_search", actorId: actor.user.id, meta: { q, results: rows.length } });
  const histories = await Promise.all(rows.slice(0, 10).map((u) => userModerationHistory(u.id)));
  return (
    <>
      <PageHeader title="Members" subtitle="Search by username, display name or email. Viewing member records is logged." />
      <ModNav current="users" />
      <Flash searchParams={params} />
      <form method="get" action="/mod/users" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} className="input max-w-md" placeholder="Search members…" aria-label="Search members" maxLength={60} />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>
      <div className="space-y-3">
        {rows.map((u, i) => (
          <Card key={u.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  <Link href={`/u/${u.username}`}>{u.displayName}</Link> <span className="muted">@{u.username}</span>
                </p>
                <p className="muted text-xs">
                  {u.email} · {u.role} · TL{u.trustLevel} · joined {formatDateTime(u.createdAt)}
                </p>
                <div className="mt-1 flex gap-1">
                  <Pill tone={u.status === "active" ? "brand" : "danger"}>{u.status}</Pill>
                  {u.restrictedUntil && u.restrictedUntil > new Date() ? <Pill tone="warn">restricted until {formatDateTime(u.restrictedUntil)}</Pill> : null}
                  {u.suspendedUntil && u.suspendedUntil > new Date() ? <Pill tone="danger">suspended until {formatDateTime(u.suspendedUntil)}</Pill> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {u.id !== actor.user.id ? <UserActionForm userId={u.id} back={`/mod/users?q=${encodeURIComponent(q)}`} /> : null}
                {actor.user.role === "admin" && u.id !== actor.user.id ? (
                  <Form action="/api/mod/role" back={`/mod/users?q=${encodeURIComponent(q)}`} className="flex items-end gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <SelectField label="Role" name="role" defaultValue={u.role} options={[{ value: "member", label: "Member" }, { value: "moderator", label: "Moderator" }, { value: "admin", label: "Admin" }]} />
                    <button className="btn btn-secondary mb-4" type="submit">
                      Set role
                    </button>
                  </Form>
                ) : null}
              </div>
            </div>
            {histories[i]?.length ? (
              <ul className="muted mt-2 text-xs">
                {histories[i]!.map((h) => (
                  <li key={h.id}>
                    {formatDateTime(h.createdAt)} · {h.action} · {h.reasonCode} {h.reversedAt ? "(reversed on appeal)" : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
