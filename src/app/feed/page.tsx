import Link from "next/link";
import { listFeed } from "@/lib/content/service";
import { listTopics } from "@/lib/content/topics";
import { PostCard } from "@/components/post-card";
import { EmptyState, Flash, PageHeader, POST_TYPE_LABEL } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Community" };

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const topic = sp(params.topic);
  const type = sp(params.type);
  const q = sp(params.q);
  const sort = (["new", "top", "unanswered"] as const).find((s) => s === sp(params.sort)) ?? "new";
  const page = Math.max(1, Number(sp(params.page) ?? "1") || 1);
  const [topics, feed] = await Promise.all([listTopics(), listFeed({ topic, type, q, sort, page })]);
  const qs = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { topic, type, q, sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `/feed?${u.toString()}`;
  };
  return (
    <>
      <PageHeader title="Community" subtitle="Questions, guides, discussions and success stories. Be kind — there are no stupid questions here." actions={<Link href="/posts/new" className="btn btn-primary">Ask or share</Link>} />
      <Flash searchParams={params} />
      <form method="get" action="/feed" className="mb-4 flex flex-wrap gap-2" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Search questions, guides, opportunities…" className="input max-w-md flex-1" aria-label="Search" maxLength={100} />
        {topic ? <input type="hidden" name="topic" value={topic} /> : null}
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Topics" className="text-sm">
          <p className="mb-2 font-semibold">Topics</p>
          <ul className="space-y-1">
            <li>
              <Link href={qs({ topic: undefined, page: undefined })} className={!topic ? "font-semibold" : ""}>
                All topics
              </Link>
            </li>
            {topics.map((t) => (
              <li key={t.id}>
                <Link href={qs({ topic: t.slug, page: undefined })} className={topic === t.slug ? "font-semibold" : ""}>
                  {t.nameEn}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mb-2 mt-6 font-semibold">Type</p>
          <ul className="space-y-1">
            <li>
              <Link href={qs({ type: undefined, page: undefined })}>Everything</Link>
            </li>
            {Object.entries(POST_TYPE_LABEL).map(([k, v]) => (
              <li key={k}>
                <Link href={qs({ type: k, page: undefined })} className={type === k ? "font-semibold" : ""}>
                  {v}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section>
          <div className="mb-3 flex gap-4 text-sm" aria-label="Sort">
            {(["new", "top", "unanswered"] as const).map((s) => (
              <Link key={s} href={qs({ sort: s, page: undefined })} className={sort === s ? "font-semibold" : "muted"} aria-current={sort === s ? "page" : undefined}>
                {s === "new" ? "Newest" : s === "top" ? "Most helpful" : "Unanswered"}
              </Link>
            ))}
          </div>
          <div className="space-y-3">
            {feed.items.map((p) => (
              <PostCard key={p.id} p={p} />
            ))}
          </div>
          {feed.items.length === 0 ? <EmptyState title="Nothing here yet">Try another topic, or start the conversation.</EmptyState> : null}
          <div className="mt-6 flex justify-between">
            {page > 1 ? <Link href={qs({ page: String(page - 1) })}>← Newer</Link> : <span />}
            {feed.hasMore ? <Link href={qs({ page: String(page + 1) })}>Older →</Link> : null}
          </div>
        </section>
      </div>
    </>
  );
}
