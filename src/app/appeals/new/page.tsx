import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth/current";
import { getAppealableAction } from "@/lib/moderation/service";
import { Form } from "@/components/form";
import { DescriptionList, Flash, Notice, PageHeader, Panel, TextArea, formatDate } from "@/components/ui";
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
      <Panel title="The decision" className="mb-6">
        <DescriptionList
          items={[
            ["Decision", <span key="d" className="font-semibold capitalize">{found.action.action.replace(/_/g, " ")}</span>],
            ["Date", formatDate(found.action.createdAt)],
            ["Reason given", <span key="r" className="prose-user">{found.action.publicReason}</span>],
          ]}
        />
      </Panel>
      {found.existing ? (
        <Notice tone="info" title={`You appealed on ${formatDate(found.existing.createdAt)}`}>
          Status: {found.existing.status}.{found.existing.decisionNote ? ` Note: ${found.existing.decisionNote}` : ""}
        </Notice>
      ) : found.expired ? (
        <Notice tone="warn">The 30-day appeal window for this decision has closed.</Notice>
      ) : (
        <Panel title="Your appeal" description="You get one appeal per decision. Be specific — explain the context the moderator may have missed.">
          <Form action="/api/appeals" back={`/appeals/new?action=${actionId}`}>
            <input type="hidden" name="actionId" value={actionId} />
            <TextArea label="Why should this decision be changed?" name="statement" required minLength={20} maxLength={2000} rows={6} />
            <button className="btn btn-primary" type="submit">
              Submit appeal
            </button>
          </Form>
        </Panel>
      )}
    </div>
  );
}
