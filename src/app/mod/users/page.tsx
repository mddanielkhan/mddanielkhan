import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { searchUsers, userModerationHistory } from "@/lib/moderation/service";
import { audit } from "@/lib/audit/audit";
import { Form } from "@/components/form";
import { UserActionForm } from "@/components/user-action-form";
import { Avatar, EmptyState, Flash, Notice, PageHeader, Pill, formatDateTime } from "@/components/ui";
import { Eye, Icon, Search, Users } from "@/components/icons";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Members", robots: { index: false } };

export default async function ModUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("staff.moderate", "/mod/users");
  const params = await searchParams;
  const q = sp(params.q) ?? "";
  const rows = q.length >= 2 ? await searchUsers(q) : [];
  if (q.length >= 2) await audit({ action: "staff.member_search", actorId: actor.user.id, meta: { q, results: rows.length } });
  const histories = await Promise.all(rows.slice(0, 10).map((u) => userModerationHistory(u.id)));
  const back = `/mod/users?q=${encodeURIComponent(q)}`;
  return (
    <>
      <PageHeader title="Members" subtitle="Search by username, display name or email." />
      <Flash searchParams={params} />
      <Notice tone="info" icon={Eye}>
        Every search and every record you open here is written to the audit log. Look only when you have a reason.
      </Notice>
      <form method="get" action="/mod/users" role="search" className="mb-6 flex max-w-xl gap-2">
        <label htmlFor="mu-q" className="sr-only">
          Search members
        </label>
        <div className="relative min-w-0 flex-1">
          <Icon icon={Search} className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
          <input id="mu-q" name="q" defaultValue={q} className="input pl-10" placeholder="Username, name or email" maxLength={60} />
        </div>
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>
      {q.length >= 2 && rows.length === 0 ? (
        <EmptyState title="No members match" icon={Users}>
          Try part of a username or email.
        </EmptyState>
      ) : null}
      <div className="space-y-4">
        {rows.map((u, i) => (
          <article key={u.id} className="card p-5">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar name={u.displayName} size={48} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  <Link href={`/u/${u.username}`} className="text-ink">
                    {u.displayName}
                  </Link>{" "}
                  <span className="font-normal text-muted">@{u.username}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {u.email} · {u.role} · TL{u.trustLevel} · joined {formatDateTime(u.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone={u.status === "active" ? "brand" : "danger"}>{u.status}</Pill>
                  {u.restrictedUntil && u.restrictedUntil > new Date() ? <Pill tone="warn">Restricted until {formatDateTime(u.restrictedUntil)}</Pill> : null}
                  {u.suspendedUntil && u.suspendedUntil > new Date() ? <Pill tone="danger">Suspended until {formatDateTime(u.suspendedUntil)}</Pill> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {u.id !== actor.user.id ? <UserActionForm userId={u.id} back={back} /> : null}
                {actor.user.role === "admin" && u.id !== actor.user.id ? (
                  <Form action="/api/mod/role" back={back} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <label className="sr-only" htmlFor={`role-${u.id}`}>
                      Role
                    </label>
                    <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="input min-h-8 w-36 py-1.5 text-sm">
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className="btn btn-secondary btn-sm" type="submit">
                      Set role
                    </button>
                  </Form>
                ) : null}
              </div>
            </div>
            {histories[i]?.length ? (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Moderation history</h3>
                <ul className="mt-2 space-y-1 text-xs text-ink-soft">
                  {histories[i]!.map((h) => (
                    <li key={h.id}>
                      {formatDateTime(h.createdAt)} · <strong>{h.action}</strong> · {h.reasonCode} {h.reversedAt ? <Pill tone="info">Reversed on appeal</Pill> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
