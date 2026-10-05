import Link from "next/link";
import { listFeed } from "@/lib/content/service";
import { listTopics } from "@/lib/content/topics";
import { PostCard } from "@/components/post-card";
import { EmptyState, Flash, PageHeader, POST_TYPE_LABEL, Tabs } from "@/components/ui";
import { ArrowLeft, ArrowRight, Hash, Icon, Lightbulb, Plus, Search, ShieldCheck } from "@/components/icons";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Community" };

const SORTS = [
  ["new", "Newest"],
  ["top", "Most helpful"],
  ["unanswered", "Unanswered"],
] as const;

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const topic = sp(params.topic);
  const type = sp(params.type);
  const q = sp(params.q);
  const sort = SORTS.map(([s]) => s).find((s) => s === sp(params.sort)) ?? "new";
  const page = Math.max(1, Number(sp(params.page) ?? "1") || 1);
  const [topics, feed] = await Promise.all([listTopics(), listFeed({ topic, type, q, sort, page })]);
  const qs = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { topic, type, q, sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "sort" && v === "new")) u.set(k, v);
    const s = u.toString();
    return s ? `/feed?${s}` : "/feed";
  };
  const currentTopic = topics.find((t) => t.slug === topic);

  return (
    <>
      <PageHeader
        eyebrow="Community"
        title={currentTopic ? currentTopic.nameEn : q ? `Results for “${q}”` : "Ask, answer and share"}
        subtitle={currentTopic ? <span lang="bn">{currentTopic.nameBn}</span> : "Questions, guides, discussions and success stories from students and verified mentors. There are no stupid questions here."}
        actions={
          <Link href="/posts/new" className="btn btn-primary">
            <Icon icon={Plus} />
            Ask or share
          </Link>
        }
      />
      <Flash searchParams={params} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[13.5rem_minmax(0,1fr)_17rem]">
        <aside className="hidden lg:block">
          <nav aria-label="Topics" className="sticky top-24">
            <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-muted">Topics</p>
            <ul className="space-y-0.5">
              <li>
                <Link href={qs({ topic: undefined, page: undefined })} className="nav-link" aria-current={!topic ? "page" : undefined}>
                  <Icon icon={Hash} />
                  All topics
                </Link>
              </li>
              {topics.map((t) => (
                <li key={t.id}>
                  <Link href={qs({ topic: t.slug, page: undefined })} className="nav-link" aria-current={topic === t.slug ? "page" : undefined}>
                    <span className="truncate">{t.nameEn}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section aria-label="Posts" className="min-w-0">
          <form method="get" action="/feed" role="search" className="mb-4 flex gap-2">
            <label htmlFor="feed-search" className="sr-only">
              Search the community
            </label>
            <div className="relative min-w-0 flex-1">
              <Icon icon={Search} className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
              <input id="feed-search" type="search" name="q" defaultValue={q} maxLength={100} placeholder="Search questions, guides, opportunities…" className="input pl-10" />
            </div>
            {topic ? <input type="hidden" name="topic" value={topic} /> : null}
            <button className="btn btn-secondary" type="submit">
              Search
            </button>
          </form>

          <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Topics">
            <Link href={qs({ topic: undefined, page: undefined })} className="chip" aria-current={!topic ? "page" : undefined}>
              All topics
            </Link>
            {topics.map((t) => (
              <Link key={t.id} href={qs({ topic: t.slug, page: undefined })} className="chip" aria-current={topic === t.slug ? "page" : undefined}>
                {t.nameEn}
              </Link>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Tabs label="Sort" items={SORTS.map(([s, label]) => ({ href: qs({ sort: s, page: undefined }), label, current: sort === s }))} />
            <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1" aria-label="Post type">
              <Link href={qs({ type: undefined, page: undefined })} className="chip" aria-current={!type ? "page" : undefined}>
                Everything
              </Link>
              {Object.entries(POST_TYPE_LABEL).map(([k, v]) => (
                <Link key={k} href={qs({ type: k, page: undefined })} className="chip" aria-current={type === k ? "page" : undefined}>
                  {v}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {feed.items.map((p) => (
              <PostCard key={p.id} p={p} />
            ))}
          </div>
          {feed.items.length === 0 ? (
            <EmptyState
              title={q ? "No posts match your search" : "Nothing here yet"}
              action={
                <Link href="/posts/new" className="btn btn-primary">
                  Start the conversation
                </Link>
              }
            >
              {q ? "Try different words, or ask the question yourself — someone will know." : "Try another topic, or be the first to post."}
            </EmptyState>
          ) : null}

          {page > 1 || feed.hasMore ? (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
              {page > 1 ? (
                <Link href={qs({ page: String(page - 1) })} className="btn btn-secondary">
                  <Icon icon={ArrowLeft} />
                  Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted">Page {page}</span>
              {feed.hasMore ? (
                <Link href={qs({ page: String(page + 1) })} className="btn btn-secondary">
                  Older
                  <Icon icon={ArrowRight} />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>

        <aside className="hidden space-y-4 xl:block">
          <div className="card sticky top-24 p-5">
            <span className="icon-tile">
              <Icon icon={Lightbulb} />
            </span>
            <h2 className="mt-3 font-bold">Get a better answer</h2>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
              <li>Say where you are now: degree, results, budget and timeline.</li>
              <li>Ask one clear question in the title.</li>
              <li>Link the official page you&apos;re unsure about.</li>
            </ul>
            <Link href="/posts/new" className="btn btn-primary mt-4 w-full">
              Ask a question
            </Link>
            <div className="divider my-5" />
            <p className="flex items-start gap-2 text-sm text-muted">
              <Icon icon={ShieldCheck} className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                Never share phone numbers or pay anyone you meet here. <Link href="/safety">Scam red flags</Link>
              </span>
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
