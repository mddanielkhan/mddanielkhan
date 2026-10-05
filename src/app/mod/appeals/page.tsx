import { requirePermission } from "@/lib/auth/current";
import { openAppeals } from "@/lib/moderation/service";
import { Form } from "@/components/form";
import { ModNav } from "@/components/mod-nav";
import { Card, EmptyState, Flash, PageHeader, TextArea, formatDateTime } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Appeals", robots: { index: false } };

export default async function AppealsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("staff.moderate", "/mod/appeals");
  const rows = await openAppeals();
  return (
    <>
      <PageHeader title="Appeals" subtitle="Appeals must be decided by a different moderator than the one who acted (enforced)." />
      <ModNav current="appeals" />
      <Flash searchParams={await searchParams} />
      {rows.length === 0 ? <EmptyState title="No open appeals" /> : null}
      <div className="space-y-3">
        {rows.map(({ appeal, action, user }) => (
          <Card key={appeal.id}>
            <p className="muted text-xs">
              {user.displayName} (@{user.username}) · appealed {formatDateTime(appeal.createdAt)} · original action {action.action} on {formatDateTime(action.createdAt)}
              {action.actorId === actor.user.id ? " · ⚠ you took the original action" : ""}
            </p>
            <p className="prose-user mt-2 text-sm">
              <strong>Original reason:</strong> {action.publicReason}
            </p>
            <p className="prose-user mt-2 text-sm">
              <strong>Member&apos;s statement:</strong> {appeal.statement}
            </p>
            <Form action="/api/mod/appeals/decide" back="/mod/appeals" className="mt-3">
              <input type="hidden" name="appealId" value={appeal.id} />
              <TextArea label="Decision note (shown to the member)" name="note" required minLength={5} maxLength={1000} rows={2} />
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit" name="decision" value="granted">
                  Grant — reverse the action
                </button>
                <button className="btn btn-secondary" type="submit" name="decision" value="denied">
                  Deny
                </button>
              </div>
            </Form>
          </Card>
        ))}
      </div>
    </>
  );
}
