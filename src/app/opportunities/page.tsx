import Link from "next/link";
import { listOpportunities } from "@/lib/content/service";
import { EmptyState, Flash, Notice, PageHeader, Pill, formatDate } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Opportunities & deadlines" };

export default async function OpportunitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const verifiedOnly = sp(params.verified) !== "all";
  const items = await listOpportunities({ verifiedOnly });
  return (
    <>
      <PageHeader
        title="Opportunities & deadlines"
        subtitle="Scholarships, internships, fellowships and competitions shared by the community. Verified ones were checked by a moderator against the official source."
        actions={
          <>
            <Link href="/posts/new?type=opportunity" className="btn btn-primary">
              Share an opportunity
            </Link>
            <a href="/opportunities/calendar.ics" className="btn btn-secondary">
              📅 Subscribe to deadlines
            </a>
          </>
        }
      />
      <Flash searchParams={params} />
      <Notice tone="warn">Real opportunities never ask you to pay a person, never guarantee results, and can always be confirmed on the official website.</Notice>
      <div className="mb-4 flex gap-4 text-sm">
        <Link href="/opportunities" className={verifiedOnly ? "font-semibold" : "muted"}>
          Verified only
        </Link>
        <Link href="/opportunities?verified=all" className={!verifiedOnly ? "font-semibold" : "muted"}>
          Include unverified
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No open opportunities yet">Share one you know about — with the official link.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-line)]">
              <tr>
                <th className="p-3">Opportunity</th>
                <th className="p-3">Organisation</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="p-3">
                    <Link href={`/posts/${o.id}`} className="font-medium">
                      {o.title}
                    </Link>
                    <span className="muted block text-xs">{o.topicName}</span>
                  </td>
                  <td className="p-3">{o.orgName}</td>
                  <td className="p-3 whitespace-nowrap">{o.deadline ? formatDate(o.deadline) : "Rolling"}</td>
                  <td className="p-3">
                    {o.verifiedAt ? <Pill tone="brand">✓ Verified</Pill> : <Pill tone="warn">Unverified</Pill>} {o.involvesFee ? <Pill tone="warn">Fee</Pill> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
