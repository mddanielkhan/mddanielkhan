import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ActionButton, Form } from "@/components/form";
import { ReportControl } from "@/components/report";
import { Card, Flash, Notice, Pill, POST_TYPE_LABEL, TextArea, TrustPill, formatDate } from "@/components/ui";
import { getActor } from "@/lib/auth/current";
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
  return (
    <article className="mx-auto max-w-3xl">
      <Flash searchParams={await searchParams} />
      {isAuthor && p.status === "held" ? <Notice tone="warn" title="Waiting for a moderator">Only you can see this post until it is reviewed. {reasons.length ? `Why: ${reasons.join(" ")}` : ""}</Notice> : null}
      {isAuthor && p.status === "rejected" ? (
        <Notice tone="danger" title="Not published">
          <p>{reasons.join(" ") || "This post matches patterns we don't allow."}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`${here}/edit`} className="btn btn-secondary">
              Edit it
            </Link>
            <ActionButton action="/api/posts/request-review" fields={{ id: p.id }} back={here}>
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

      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <Pill tone={p.type === "opportunity" ? "info" : p.type === "safety_alert" ? "danger" : "neutral"}>{POST_TYPE_LABEL[p.type]}</Pill>
        <Link href={`/feed?topic=${topic.slug}`}>{topic.nameEn}</Link>
        {topic.highRisk ? <Pill tone="warn" title="Peer experience, not legal or immigration advice">Peer advice — verify officially</Pill> : null}
      </div>
      <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{p.title}</h1>
      <div className="muted mb-4 mt-2 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/u/${author.username}`}>{author.displayName}</Link>
        <TrustPill level={author.trustLevel} />
        <span>{formatDate(p.createdAt)}</span>
        {p.editedAt ? <span>edited {formatDate(p.editedAt)}</span> : null}
      </div>

      {p.type === "opportunity" ? (
        <Card className="mb-4">
          <div className="mb-2 flex flex-wrap gap-2">
            {p.verifiedAt ? <Pill tone="brand">✓ Verified by moderators on {formatDate(p.verifiedAt)}</Pill> : <Pill tone="warn">Unverified — check the official site yourself</Pill>}
            {p.involvesFee ? <Pill tone="warn">Involves a fee</Pill> : <Pill>Free to apply</Pill>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium">Organisation</dt>
            <dd>{p.orgName}</dd>
            <dt className="font-medium">Official link</dt>
            <dd className="break-all">
              <a href={p.officialUrl ?? "#"} rel="nofollow noopener noreferrer ugc" target="_blank">
                {p.officialUrl}
              </a>{" "}
              <span className="muted">(external site)</span>
            </dd>
            {p.deadline ? (
              <>
                <dt className="font-medium">Deadline</dt>
                <dd>{formatDate(p.deadline)}</dd>
              </>
            ) : null}
          </dl>
          <p className="muted mt-3 text-sm">Real opportunities never ask you to pay an individual, never guarantee results, and are always confirmable on the official website. <Link href="/safety">Scam red flags →</Link></p>
        </Card>
      ) : null}

      <div className="prose-user mb-4 text-[1.05rem]">{p.body}</div>

      {p.type === "guide" && p.sources.length ? (
        <Card className="mb-4">
          <p className="mb-1 font-semibold">Official sources</p>
          <ul className="list-disc pl-5 text-sm">
            {p.sources.map((s) => (
              <li key={s} className="break-all">
                <a href={s} rel="nofollow noopener noreferrer ugc" target="_blank">
                  {s}
                </a>
              </li>
            ))}
          </ul>
          {p.lastVerifiedOn ? <p className="muted mt-2 text-sm">Last verified {formatDate(p.lastVerifiedOn)}. Rules and fees change — always double-check.</p> : null}
        </Card>
      ) : null}

      <div className="mb-8 flex flex-wrap items-center gap-3 text-sm">
        {p.tags.map((t) => (
          <span key={t} className="muted">
            #{t}
          </span>
        ))}
        {actor && !isAuthor && (p.status === "published" || p.status === "flagged") ? (
          <ActionButton action="/api/votes" fields={{ targetType: "post", targetId: p.id, _back: here }} back={here}>
            {votedIds.has(p.id) ? "★ Helpful" : "☆ Helpful"} · {p.helpfulCount}
          </ActionButton>
        ) : (
          <span className="muted">{p.helpfulCount} found helpful</span>
        )}
        {isAuthor ? (
          <>
            <Link href={`${here}/edit`}>Edit</Link>
            <ActionButton action="/api/posts/delete" fields={{ id: p.id }} variant="link">
              Delete
            </ActionButton>
          </>
        ) : null}
        {actor && !isAuthor ? <ReportControl targetType="post" targetId={p.id} back={here} /> : null}
        {isStaff && (p.status === "held" || p.status === "flagged" || p.status === "rejected") ? (
          <span className="flex gap-2">
            <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "approve", _back: here }} back={here}>
              Approve
            </ActionButton>
            {p.type === "opportunity" ? (
              <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "approve_verify", reasonCode: "verified", publicReason: "Checked against the official source.", _back: here }} back={here} variant="primary">
                Approve + verify
              </ActionButton>
            ) : null}
            <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "remove", reasonCode: "policy", _back: here }} back={here} variant="danger">
              Remove
            </ActionButton>
          </span>
        ) : null}
      </div>

      <section aria-labelledby="answers">
        <h2 id="answers" className="mb-3 text-xl font-bold">
          {answers.length} {answers.length === 1 ? "answer" : "answers"}
        </h2>
        <div className="space-y-3">
          {answers.map(({ answer: a, author: aa }) => {
            const accepted = p.acceptedAnswerId === a.id;
            const mine = actor?.user.id === a.authorId;
            return (
              <div key={a.id} id={`answer-${a.id}`} className={`card p-4 ${accepted ? "border-[var(--color-brand-600)]" : ""}`}>
                {accepted ? <Pill tone="brand">✓ Accepted answer</Pill> : null}
                {a.status === "held" ? <Pill tone="warn">Waiting for review — only you can see this</Pill> : null}
                <div className="prose-user mt-2">{a.body}</div>
                <div className="muted mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/u/${aa.username}`}>{aa.displayName}</Link>
                  <TrustPill level={aa.trustLevel} />
                  <span>{formatDate(a.createdAt)}</span>
                  {actor && !mine && a.status !== "held" ? (
                    <ActionButton action="/api/votes" fields={{ targetType: "answer", targetId: a.id, _back: `${here}#answer-${a.id}` }} back={here}>
                      {votedIds.has(a.id) ? "★" : "☆"} Helpful · {a.helpfulCount}
                    </ActionButton>
                  ) : (
                    <span>{a.helpfulCount} found helpful</span>
                  )}
                  {isAuthor && p.type === "question" && !accepted && !mine && a.status !== "held" ? (
                    <ActionButton action="/api/answers/accept" fields={{ postId: p.id, answerId: a.id }} back={here} variant="primary">
                      Accept answer
                    </ActionButton>
                  ) : null}
                  {mine ? (
                    <ActionButton action="/api/answers/delete" fields={{ id: a.id }} variant="link">
                      Delete
                    </ActionButton>
                  ) : null}
                  {actor && !mine ? <ReportControl targetType="answer" targetId={a.id} back={here} /> : null}
                  {isStaff && a.status === "held" ? (
                    <>
                      <ActionButton action="/api/mod/content" fields={{ targetType: "answer", targetId: a.id, decision: "approve", _back: here }} back={here}>
                        Approve
                      </ActionButton>
                      <ActionButton action="/api/mod/content" fields={{ targetType: "answer", targetId: a.id, decision: "remove", reasonCode: "policy", _back: here }} back={here} variant="danger">
                        Remove
                      </ActionButton>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {actor && (p.status === "published" || p.status === "flagged") ? (
          <Card className="mt-6">
            <h3 className="mb-2 font-semibold">Your answer</h3>
            <Form action="/api/answers" back={here}>
              <input type="hidden" name="postId" value={p.id} />
              <TextArea label="Share what you know — be specific and kind" name="body" required minLength={2} maxLength={10000} rows={6} hint="Link official sources where you can. Don't share phone numbers or ask anyone to contact you privately." />
              <button className="btn btn-primary" type="submit">
                Post answer
              </button>
            </Form>
          </Card>
        ) : !actor ? (
          <p className="mt-6">
            <Link href={`/login?next=${encodeURIComponent(here)}`}>Log in</Link> to answer.
          </p>
        ) : null}
      </section>
    </article>
  );
}
