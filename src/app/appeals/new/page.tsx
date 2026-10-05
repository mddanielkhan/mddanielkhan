import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth/current";
import { getAppealableAction } from "@/lib/moderation/service";
import { Form } from "@/components/form";
import { Card, Flash, Notice, PageHeader, TextArea, formatDate } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Appeal a decision", robots: { index: false } };

export default async function NewAppealPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actionId = sp(params.action) ?? "";
  if (!/^[0-9a-f-]{36}$/.test(actionId)) notFound();
  const actor = await requireActor(`/appeals/new?action=${actionId}`);
  const found = await getAppealableAction(actor, actionId);
  if (!found) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Appeal a moderation decision" subtitle="A different moderator from the one who made the decision will review your appeal." />
      <Flash searchParams={params} />
      <Card className="mb-4">
        <p className="text-sm">
          <strong>Decision:</strong> {found.action.action.replace(/_/g, " ")} · {formatDate(found.action.createdAt)}
        </p>
        <p className="prose-user mt-1 text-sm">
          <strong>Reason given:</strong> {found.action.publicReason}
        </p>
      </Card>
      {found.existing ? (
        <Notice tone="info">You appealed this decision on {formatDate(found.existing.createdAt)}. Status: {found.existing.status}.{found.existing.decisionNote ? ` Note: ${found.existing.decisionNote}` : ""}</Notice>
      ) : found.expired ? (
        <Notice tone="warn">The 30-day appeal window for this decision has closed.</Notice>
      ) : (
        <Card>
          <Form action="/api/appeals" back={`/appeals/new?action=${actionId}`}>
            <input type="hidden" name="actionId" value={actionId} />
            <TextArea label="Why should this decision be changed?" name="statement" required minLength={20} maxLength={2000} rows={6} hint="Explain the context. Be specific — you get one appeal per decision." />
            <button className="btn btn-primary" type="submit">
              Submit appeal
            </button>
          </Form>
        </Card>
      )}
    </div>
  );
}
