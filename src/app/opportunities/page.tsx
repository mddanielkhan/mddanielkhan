import Link from "next/link";
import { listOpportunities } from "@/lib/content/service";
import { DeadlinePill, EmptyState, Flash, Notice, PageHeader, Pill, Tabs, formatDate } from "@/components/ui";
import { BadgeCheck, CalendarDays, Compass, Icon, Landmark, Plus, TriangleAlert } from "@/components/icons";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Opportunities & deadlines" };

export default async function OpportunitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const verifiedOnly = sp(params.verified) !== "all";
  const items = await listOpportunities({ verifiedOnly });
  return (
    <>
      <PageHeader
        eyebrow="Opportunities"
        title="Scholarships, internships & deadlines"
        subtitle="Shared by the community. A ✓ means a moderator checked it against the official source — and you can still confirm it there yourself."
        actions={
          <>
            <a href="/opportunities/calendar.ics" className="btn btn-secondary">
              <Icon icon={CalendarDays} />
              Subscribe to deadlines
            </a>
            <Link href="/posts/new?type=opportunity" className="btn btn-primary">
              <Icon icon={Plus} />
              Share an opportunity
            </Link>
          </>
        }
      />
      <Flash searchParams={params} />
      <Notice tone="warn" title="Three rules that stop most scams">
        Real opportunities never ask you to pay a person, never guarantee results, and can always be confirmed on the official website.
      </Notice>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Filter opportunities"
          items={[
            { href: "/opportunities", label: "Verified only", current: verifiedOnly },
            { href: "/opportunities?verified=all", label: "Include unverified", current: !verifiedOnly },
          ]}
        />
        <p className="text-sm text-muted">
          {items.length} open {items.length === 1 ? "opportunity" : "opportunities"} · soonest deadline first
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No open opportunities yet"
          icon={Compass}
          action={
            <Link href="/posts/new?type=opportunity" className="btn btn-primary">
              Share one you know about
            </Link>
          }
        >
          Include the official link so a moderator can verify it.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((o) => (
            <li key={o.id}>
              <article className="card card-interactive relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <span className="icon-tile icon-tile-info h-12 w-12 rounded-2xl">
                  <Icon icon={Landmark} className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold leading-snug">
                    <Link href={`/posts/${o.id}`} className="text-ink no-underline after:absolute after:inset-0 after:rounded-[var(--radius-card)] hover:text-brand-ink">
                      {o.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-semibold text-ink-soft">{o.orgName}</span> · {o.topicName}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {o.verifiedAt ? (
                      <Pill tone="brand" icon={BadgeCheck}>
                        Verified
                      </Pill>
                    ) : (
                      <Pill tone="warn" icon={TriangleAlert}>
                        Unverified — check the official site
                      </Pill>
                    )}
                    {o.involvesFee ? <Pill tone="warn">Involves a fee</Pill> : <Pill>Free to apply</Pill>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                  <p className="text-sm font-semibold tabular-nums text-ink">{o.deadline ? formatDate(o.deadline) : "No fixed deadline"}</p>
                  <DeadlinePill deadline={o.deadline} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
