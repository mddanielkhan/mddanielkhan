import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ActionButton, Form } from "@/components/form";
import { ReportControl } from "@/components/report";
import { Avatar, DeadlinePill, DescriptionList, Flash, Notice, Pill, PostTypeBadge, TextArea, TrustPill, formatDate, timeAgo } from "@/components/ui";
import { BadgeCheck, CircleCheck, ExternalLink, Icon, Landmark, Library, Pencil, ShieldCheck, ThumbsUp, Trash, TriangleAlert } from "@/components/icons";
import { getActor } from "@/lib/auth/current";
import { BRAND } from "@/lib/config/brand";
import { getPostForViewer } from "@/lib/content/service";
import { reasonsForCodes } from "@/lib/risk/engine";
import type { Params, SearchParams } from "@/lib/http/page";

export async function generateMetadata({ params }: { params: Params<"id"> }): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return { title: "Not found" };
  const data = await getPostForViewer(id, null);
  return data ? { title: data.post.title, description: data.post.body.slice(0, 160) } : { title: "Not found", robots: { index: false } };
}

export default async function PostPage({ params, searchParams }: { params: Params<"id">; searchParams: SearchParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const actor = await getActor();
  const data = await getPostForViewer(id, actor);
  if (!data) notFound();
  const { post: p, topic, author, answers, votedIds, isAuthor, isStaff } = data;
  const here = `/posts/${p.id}`;
  const reasons = reasonsForCodes(p.riskSignals.map((s) => s.code));
  const open = p.status === "published" || p.status === "flagged";

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Link href="/feed" className="font-medium text-muted no-underline hover:text-ink">
            Community
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/feed?topic=${topic.slug}`} className="font-medium text-muted no-underline hover:text-ink">
            {topic.nameEn}
          </Link>
        </nav>

        <Flash searchParams={await searchParams} />
        {isAuthor && p.status === "held" ? (
          <Notice tone="warn" title="Waiting for a moderator">
            Only you can see this post until it is reviewed. {reasons.length ? `Why: ${reasons.join(" ")}` : ""}
          </Notice>
        ) : null}
        {isAuthor && p.status === "rejected" ? (
          <Notice tone="danger" title="Not published">
            <p>{reasons.join(" ") || "This post matches patterns we don't allow."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`${here}/edit`} className="btn btn-secondary btn-sm">
                <Icon icon={Pencil} />
                Edit it
              </Link>
              <ActionButton action="/api/posts/request-review" fields={{ id: p.id }} back={here} size="sm">
                Ask a human to review
              </ActionButton>
            </div>
          </Notice>
        ) : null}
        {isStaff && p.status !== "published" ? (
          <Notice tone="info" title={`Staff view · status: ${p.status} · risk ${p.riskScore}`}>
            Signals: {p.riskSignals.map((s) => `${s.code} (${s.weight})`).join(", ") || "none"}
          </Notice>
        ) : null}

        <header>
          <div className="flex flex-wrap items-center gap-2">
            <PostTypeBadge type={p.type} />
            {topic.highRisk ? (
              <Pill tone="warn" icon={TriangleAlert} title="Peer experience, not legal or immigration advice">
                Peer advice — verify officially
              </Pill>
            ) : null}
          </div>
          <h1 className="mt-3 text-[1.75rem] font-bold leading-tight tracking-tight sm:text-[2.125rem]">{p.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Avatar name={author.displayName} size={36} />
            <Link href={`/u/${author.username}`} className="font-semibold text-ink no-underline hover:underline">
              {author.displayName}
            </Link>
            <TrustPill level={author.trustLevel} />
            <span className="text-muted">
              {formatDate(p.createdAt)}
              {p.editedAt ? ` · edited ${formatDate(p.editedAt)}` : ""}
            </span>
          </div>
        </header>

        {p.type === "opportunity" ? (
          <section aria-label="Opportunity details" className="card mt-6 overflow-hidden">
            <div className={`flex flex-wrap items-center gap-2 border-b px-5 py-3 text-sm font-semibold ${p.verifiedAt ? "border-brand-200 bg-brand-50 text-brand-800" : "border-[var(--color-warn-line)] bg-[var(--color-warn-bg)] text-[var(--color-warn-ink)]"}`}>
              <Icon icon={p.verifiedAt ? BadgeCheck : TriangleAlert} className="h-4.5 w-4.5" />
              {p.verifiedAt ? `Verified by moderators on ${formatDate(p.verifiedAt)} against the official source` : "Unverified — check the official site yourself before you apply"}
            </div>
            <div className="p-5">
              <DescriptionList
                items={[
                  [
                    "Organisation",
                    <span key="o" className="flex items-center gap-2 font-semibold">
                      <Icon icon={Landmark} className="h-4 w-4 text-muted" />
                      {p.orgName}
                    </span>,
                  ],
                  [
                    "Official link",
                    <a key="l" href={p.officialUrl ?? "#"} rel="nofollow noopener noreferrer ugc" target="_blank" className="inline-flex items-center gap-1 break-all">
                      {p.officialUrl}
                      <Icon icon={ExternalLink} className="h-3.5 w-3.5 shrink-0" />
                    </a>,
                  ],
                  p.deadline
                    ? [
                        "Deadline",
                        <span key="d" className="flex flex-wrap items-center gap-2">
                          {formatDate(p.deadline)} <DeadlinePill deadline={p.deadline} />
                        </span>,
                      ]
                    : null,
                  ["Fees", p.involvesFee ? <Pill key="f" tone="warn">Involves a fee — confirm on the official site</Pill> : <Pill key="f" tone="brand">Free to apply</Pill>],
                ]}
              />
              <p className="mt-4 rounded-lg bg-subtle px-3.5 py-2.5 text-sm text-muted">
                Real opportunities never ask you to pay an individual, never guarantee results, and are always confirmable on the official website. <Link href="/safety">Scam red flags →</Link>
              </p>
            </div>
          </section>
        ) : null}

        <div className="prose-user mt-6 text-[1.0625rem] leading-8 text-ink">{p.body}</div>

        {p.type === "guide" && p.sources.length ? (
          <section aria-label="Official sources" className="panel-subtle mt-6 p-5">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Icon icon={Library} className="h-4.5 w-4.5 text-brand-ink" />
              Official sources
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {p.sources.map((s) => (
                <li key={s} className="break-all">
                  <a href={s} rel="nofollow noopener noreferrer ugc" target="_blank" className="inline-flex items-center gap-1">
                    {s}
                    <Icon icon={ExternalLink} className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
            {p.lastVerifiedOn ? <p className="mt-3 text-xs text-muted">Last verified {formatDate(p.lastVerifiedOn)}. Rules and fees change — always double-check.</p> : null}
          </section>
        ) : null}

        {p.tags.length ? (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <Link key={t} href={`/feed?q=${encodeURIComponent(t)}`} className="chip">
                #{t}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-3">
          {actor && !isAuthor && open ? (
            <ActionButton action="/api/votes" fields={{ targetType: "post", targetId: p.id, _back: here }} back={here} size="sm" variant={votedIds.has(p.id) ? "primary" : "secondary"} icon={ThumbsUp}>
              {votedIds.has(p.id) ? "Helpful" : "Mark helpful"} · {p.helpfulCount}
            </ActionButton>
          ) : (
            <span className="flex items-center gap-1.5 px-1 text-sm text-muted">
              <Icon icon={ThumbsUp} className="h-4 w-4" />
              {p.helpfulCount} found helpful
            </span>
          )}
          {isAuthor ? (
            <>
              <Link href={`${here}/edit`} className="btn btn-ghost btn-sm">
                <Icon icon={Pencil} />
                Edit
              </Link>
              <ActionButton action="/api/posts/delete" fields={{ id: p.id }} variant="ghost" size="sm" icon={Trash}>
                Delete
              </ActionButton>
            </>
          ) : null}
          {actor && !isAuthor ? <ReportControl targetType="post" targetId={p.id} back={here} /> : null}
          {isStaff && (p.status === "held" || p.status === "flagged" || p.status === "rejected") ? (
            <span className="ml-auto flex flex-wrap gap-2">
              <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "approve", _back: here }} back={here} size="sm">
                Approve
              </ActionButton>
              {p.type === "opportunity" ? (
                <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "approve_verify", reasonCode: "verified", publicReason: "Checked against the official source.", _back: here }} back={here} variant="primary" size="sm">
                  Approve + verify
                </ActionButton>
              ) : null}
              <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "remove", reasonCode: "policy", _back: here }} back={here} variant="danger" size="sm">
                Remove
              </ActionButton>
            </span>
          ) : null}
        </div>

        <section aria-labelledby="answers" className="mt-10">
          <h2 id="answers" className="text-xl font-bold tracking-tight">
            {answers.length} {answers.length === 1 ? "answer" : "answers"}
          </h2>
          <div className="mt-4 space-y-4">
            {answers.map(({ answer: a, author: aa }) => {
              const accepted = p.acceptedAnswerId === a.id;
              const mine = actor?.user.id === a.authorId;
              return (
                <div key={a.id} id={`answer-${a.id}`} className={`card overflow-hidden ${accepted ? "border-brand-300 ring-1 ring-brand-200" : ""}`}>
                  {accepted ? (
                    <p className="flex items-center gap-2 border-b border-brand-200 bg-brand-50 px-5 py-2 text-sm font-bold text-brand-800">
                      <Icon icon={CircleCheck} className="h-4.5 w-4.5" />
                      Accepted answer
                    </p>
                  ) : null}
                  <div className="p-5">
                    {a.status === "held" ? (
                      <Pill tone="warn" className="mb-3">
                        Waiting for review — only you can see this
                      </Pill>
                    ) : null}
                    <div className="prose-user leading-7 text-ink">{a.body}</div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Avatar name={aa.displayName} size={32} />
                        <Link href={`/u/${aa.username}`} className="font-semibold text-ink no-underline hover:underline">
                          {aa.displayName}
                        </Link>
                      </span>
                      <TrustPill level={aa.trustLevel} />
                      <span className="text-muted">{timeAgo(a.createdAt)}</span>
                      <span className="ml-auto flex flex-wrap items-center gap-1.5">
                        {actor && !mine && a.status !== "held" ? (
                          <ActionButton action="/api/votes" fields={{ targetType: "answer", targetId: a.id, _back: `${here}#answer-${a.id}` }} back={here} size="sm" variant={votedIds.has(a.id) ? "primary" : "secondary"} icon={ThumbsUp}>
                            {a.helpfulCount}
                            <span className="sr-only"> found helpful — {votedIds.has(a.id) ? "remove your vote" : "mark helpful"}</span>
                          </ActionButton>
                        ) : (
                          <span className="flex items-center gap-1 text-muted">
                            <Icon icon={ThumbsUp} className="h-4 w-4" />
                            {a.helpfulCount}
                          </span>
                        )}
                        {isAuthor && p.type === "question" && !accepted && !mine && a.status !== "held" ? (
                          <ActionButton action="/api/answers/accept" fields={{ postId: p.id, answerId: a.id }} back={here} variant="primary" size="sm" icon={CircleCheck}>
                            Accept answer
                          </ActionButton>
                        ) : null}
                        {mine ? (
                          <ActionButton action="/api/answers/delete" fields={{ id: a.id }} variant="ghost" size="sm" icon={Trash}>
                            Delete
                          </ActionButton>
                        ) : null}
                        {actor && !mine ? <ReportControl targetType="answer" targetId={a.id} back={here} align="right" /> : null}
                        {isStaff && a.status === "held" ? (
                          <>
                            <ActionButton action="/api/mod/content" fields={{ targetType: "answer", targetId: a.id, decision: "approve", _back: here }} back={here} size="sm">
                              Approve
                            </ActionButton>
                            <ActionButton action="/api/mod/content" fields={{ targetType: "answer", targetId: a.id, decision: "remove", reasonCode: "policy", _back: here }} back={here} variant="danger" size="sm">
                              Remove
                            </ActionButton>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {answers.length === 0 && open ? <p className="panel-subtle p-5 text-sm text-muted">No answers yet. If you&apos;ve been through something similar, your experience could really help.</p> : null}
          </div>

          {actor && open ? (
            <div className="card mt-6 p-5 sm:p-6">
              <h3 className="text-base font-bold">Your answer</h3>
              <p className="mt-1 text-sm text-muted">Share what you know from experience. Link official sources for rules, fees and deadlines.</p>
              <Form action="/api/answers" back={here} className="mt-4">
                <input type="hidden" name="postId" value={p.id} />
                <TextArea label="Share what you know — be specific and kind" name="body" required minLength={2} maxLength={10000} rows={6} hint="Don't share phone numbers or ask anyone to contact you privately." />
                <button className="btn btn-primary" type="submit">
                  Post answer
                </button>
              </Form>
            </div>
          ) : !actor ? (
            <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
              <p className="text-sm text-ink-soft">Know the answer? Join free to help — it takes a minute.</p>
              <div className="flex gap-2">
                <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-secondary btn-sm">
                  Log in
                </Link>
                <Link href="/register" className="btn btn-primary btn-sm">
                  Join free
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      </article>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Posted by</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={author.displayName} size={48} />
            <div className="min-w-0">
              <Link href={`/u/${author.username}`} className="block truncate font-bold text-ink no-underline hover:underline">
                {author.displayName}
              </Link>
              <p className="truncate text-sm text-muted">@{author.username}</p>
            </div>
          </div>
          <div className="mt-3">
            <TrustPill level={author.trustLevel} />
          </div>
          <Link href={`/u/${author.username}`} className="btn btn-secondary btn-sm mt-4 w-full">
            View profile
          </Link>
        </div>
        <div className="card p-5">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Icon icon={ShieldCheck} className="h-4.5 w-4.5 text-brand-600" />
            Stay safe
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
            <li>Nobody here may ask you for money.</li>
            <li>Keep conversations on {BRAND.name} — not WhatsApp or Telegram.</li>
            <li>Confirm rules and deadlines on official sites.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
