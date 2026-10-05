import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { openAppeals } from "@/lib/moderation/service";
import { Form } from "@/components/form";
import { Avatar, EmptyState, Flash, Notice, PageHeader, Pill, TextArea, formatDateTime } from "@/components/ui";
import { Scale, TriangleAlert } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Appeals", robots: { index: false } };

export default async function AppealsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("staff.moderate", "/mod/appeals");
  const rows = await openAppeals();
  return (
    <>
      <PageHeader title="Appeals" subtitle="Each appeal must be decided by a different moderator from the one who acted. The system enforces this." />
      <Flash searchParams={await searchParams} />
      {rows.length === 0 ? (
        <EmptyState title="No open appeals" icon={Scale}>
          Appeals from members appear here.
        </EmptyState>
      ) : null}
      <div className="space-y-5">
        {rows.map(({ appeal, action, user }) => {
          const mine = action.actorId === actor.user.id;
          return (
            <article key={appeal.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
                <Avatar name={user.displayName} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    <Link href={`/u/${user.username}`} className="text-ink">
                      {user.displayName}
                    </Link>{" "}
                    <span className="font-normal text-muted">@{user.username}</span>
                  </p>
                  <p className="text-xs text-muted">
                    Appealed {formatDateTime(appeal.createdAt)} · original action <strong>{action.action}</strong> on {formatDateTime(action.createdAt)}
                  </p>
                </div>
                {mine ? (
                  <Pill tone="warn" icon={TriangleAlert}>
                    You took the original action
                  </Pill>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Original reason</h3>
                  <p className="prose-user mt-1.5 text-sm leading-relaxed text-ink-soft">{action.publicReason}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Member&apos;s statement</h3>
                  <p className="prose-user mt-1.5 text-sm leading-relaxed text-ink-soft">{appeal.statement}</p>
                </div>
              </div>
              <div className="border-t border-line bg-subtle p-5">
                {mine ? (
                  <Notice tone="warn" className="">
                    A different moderator must decide this appeal.
                  </Notice>
                ) : (
                  <Form action="/api/mod/appeals/decide" back="/mod/appeals">
                    <input type="hidden" name="appealId" value={appeal.id} />
                    <TextArea id={`note-${appeal.id}`} label="Decision note (shown to the member)" name="note" required minLength={5} maxLength={1000} rows={2} />
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-primary btn-sm" type="submit" name="decision" value="granted">
                        Grant — reverse the action
                      </button>
                      <button className="btn btn-secondary btn-sm" type="submit" name="decision" value="denied">
                        Deny
                      </button>
                    </div>
                  </Form>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
