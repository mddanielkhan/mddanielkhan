import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { heldQueue } from "@/lib/moderation/service";
import { ActionButton, Form } from "@/components/form";
import { EmptyState, Flash, PageHeader, Pill, PostTypeBadge, TextField, formatDateTime, timeAgo } from "@/components/ui";
import { BadgeCheck, CircleCheck, ExternalLink, Icon, Inbox, Trash } from "@/components/icons";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Review queue", robots: { index: false } };

function Signals({ list }: { list: Array<{ code: string; weight: number }> }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-semibold text-muted">Signals</span>
      {list.length ? (
        list.map((s) => (
          <code key={s.code} className="rounded-md border border-line bg-subtle px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-soft">
            {s.code} <span className="text-muted">+{s.weight}</span>
          </code>
        ))
      ) : (
        <span className="text-muted">none (community-hidden or review requested)</span>
      )}
    </div>
  );
}

function Risk({ score }: { score: number }) {
  return <Pill tone={score >= 70 ? "danger" : score >= 45 ? "warn" : "neutral"}>Risk {score}</Pill>;
}

function RemoveForm({ targetType, targetId }: { targetType: string; targetId: string }) {
  return (
    <details className="relative inline-block">
      <summary className="btn btn-danger btn-sm">
        <Icon icon={Trash} />
        Remove…
      </summary>
      <div className="popover left-0">
        <Form action="/api/mod/content" back="/mod/queue">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="decision" value="remove" />
          <input type="hidden" name="_back" value="/mod/queue" />
          <label className="label text-sm" htmlFor={`rc-${targetId}`}>
            Reason
          </label>
          <select id={`rc-${targetId}`} name="reasonCode" className="input mb-4">
            <option value="scam">Scam / fraud (−50 reputation)</option>
            <option value="policy">Guideline violation (−10)</option>
            <option value="spam">Spam (−10)</option>
            <option value="contact_details">Contact details / off-platform (−10)</option>
            <option value="harassment">Harassment (−10)</option>
          </select>
          <TextField id={`pr-${targetId}`} label="Message to the member" name="publicReason" maxLength={500} placeholder="Your post asked for an advance fee, which is not allowed." hint="Shown to them and used on appeal." />
          <button className="btn btn-danger w-full" type="submit">
            Remove
          </button>
        </Form>
      </div>
    </details>
  );
}

export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("staff.moderate", "/mod/queue");
  const q = await heldQueue();
  const total = q.posts.length + q.answers.length + q.messages.length + q.feedback.length;
  return (
    <>
      <PageHeader title="Review queue" subtitle="Held before publication, highest risk first. For opportunities, check the official source before verifying." />
      <Flash searchParams={await searchParams} />
      {total === 0 ? (
        <EmptyState title="Queue is clear" icon={CircleCheck}>
          Nothing is waiting for review.
        </EmptyState>
      ) : null}
      <div className="space-y-4">
        {q.posts.map((p) => (
          <article key={p.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <PostTypeBadge type={p.type} />
              <Risk score={p.riskScore} />
              <span className="text-xs text-muted">
                @{p.author} · TL{p.authorTrust} · account since {formatDateTime(p.authorCreated)} · posted {timeAgo(p.createdAt)}
              </span>
            </div>
            <h2 className="mt-2.5 text-base font-bold">
              <Link href={`/posts/${p.id}`} className="text-ink">
                {p.title}
              </Link>
            </h2>
            {p.type === "opportunity" ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                <span className="font-semibold">{p.orgName}</span>·
                <a href={p.officialUrl ?? "#"} rel="nofollow noopener noreferrer" target="_blank" className="inline-flex items-center gap-1 break-all">
                  {p.officialUrl} <Icon icon={ExternalLink} className="h-3 w-3" />
                </a>
                · fee: {p.involvesFee ? "yes" : "no"} {p.deadline ? `· deadline ${p.deadline}` : ""}
              </p>
            ) : null}
            <p className="prose-user mt-2 line-clamp-6 rounded-lg bg-subtle p-3 text-sm leading-relaxed text-ink-soft">{p.body}</p>
            <Signals list={p.riskSignals} />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "approve", _back: "/mod/queue" }} size="sm" icon={CircleCheck}>
                Approve
              </ActionButton>
              {p.type === "opportunity" ? (
                <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "approve_verify", reasonCode: "verified", publicReason: "Checked against the official source.", _back: "/mod/queue" }} variant="primary" size="sm" icon={BadgeCheck}>
                  Approve + verify
                </ActionButton>
              ) : null}
              <RemoveForm targetType="post" targetId={p.id} />
            </div>
          </article>
        ))}
        {q.answers.map((a) => (
          <article key={a.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill>Answer</Pill>
              <Risk score={a.riskScore} />
              <span className="text-xs text-muted">
                @{a.author} · TL{a.authorTrust} · on <Link href={`/posts/${a.postId}`}>this post</Link>
              </span>
            </div>
            <p className="prose-user mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed text-ink-soft">{a.body}</p>
            <Signals list={a.riskSignals} />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <ActionButton action="/api/mod/content" fields={{ targetType: "answer", targetId: a.id, decision: "approve", _back: "/mod/queue" }} size="sm" icon={CircleCheck}>
                Approve
              </ActionButton>
              <RemoveForm targetType="answer" targetId={a.id} />
            </div>
          </article>
        ))}
        {q.messages.map((m) => (
          <article key={m.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="info">Private session message</Pill>
              <span className="text-xs text-muted">
                @{m.author} · <Link href={`/bookings/${m.bookingId}`}>session</Link> · {timeAgo(m.createdAt)}
              </span>
            </div>
            <p className="prose-user mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed text-ink-soft">{m.body}</p>
            <Signals list={m.riskSignals} />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <ActionButton action="/api/mod/content" fields={{ targetType: "booking_message", targetId: m.id, decision: "approve", _back: "/mod/queue" }} size="sm" icon={CircleCheck}>
                Deliver
              </ActionButton>
              <RemoveForm targetType="booking_message" targetId={m.id} />
            </div>
          </article>
        ))}
        {q.feedback.map((f) => (
          <article key={f.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="info">Feedback comment</Pill>
              <span className="text-xs text-muted">
                <Link href={`/bookings/${f.bookingId}`}>Session</Link>
              </span>
            </div>
            <p className="prose-user mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed text-ink-soft">{f.comment}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <ActionButton action="/api/mod/content" fields={{ targetType: "feedback", targetId: f.id, decision: "approve", _back: "/mod/queue" }} size="sm" icon={CircleCheck}>
                Publish
              </ActionButton>
              <RemoveForm targetType="feedback" targetId={f.id} />
            </div>
          </article>
        ))}
      </div>
      {total ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <Icon icon={Inbox} className="h-4 w-4" />
          {total} item{total === 1 ? "" : "s"} waiting
        </p>
      ) : null}
    </>
  );
}
