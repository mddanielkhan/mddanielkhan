import Link from "next/link";
import { requirePermission } from "@/lib/auth/current";
import { heldQueue } from "@/lib/moderation/service";
import { ActionButton, Form } from "@/components/form";
import { ModNav } from "@/components/mod-nav";
import { Card, EmptyState, Flash, PageHeader, Pill, POST_TYPE_LABEL, TextField, formatDateTime } from "@/components/ui";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Review queue", robots: { index: false } };

function Signals({ list }: { list: Array<{ code: string; weight: number }> }) {
  return (
    <p className="muted text-xs">
      Signals: {list.length ? list.map((s) => `${s.code} (${s.weight})`).join(", ") : "none (community-hidden or review requested)"}
    </p>
  );
}

function RemoveForm({ targetType, targetId }: { targetType: string; targetId: string }) {
  return (
    <details className="inline-block">
      <summary className="btn btn-danger cursor-pointer">Remove…</summary>
      <div className="card mt-2 w-80 p-3">
        <Form action="/api/mod/content" back="/mod/queue">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="decision" value="remove" />
          <input type="hidden" name="_back" value="/mod/queue" />
          <label className="mb-1 block text-sm font-medium" htmlFor={`rc-${targetId}`}>
            Reason
          </label>
          <select id={`rc-${targetId}`} name="reasonCode" className="input mb-2">
            <option value="scam">Scam / fraud (−50 reputation)</option>
            <option value="policy">Guideline violation (−10)</option>
            <option value="spam">Spam (−10)</option>
            <option value="contact_details">Contact details / off-platform (−10)</option>
            <option value="harassment">Harassment (−10)</option>
          </select>
          <TextField label="Message to the member" name="publicReason" maxLength={500} placeholder="Your post asked for an advance fee, which is not allowed." />
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
  const empty = q.posts.length + q.answers.length + q.messages.length + q.feedback.length === 0;
  return (
    <>
      <PageHeader title="Review queue" subtitle="Held before publication. Highest risk first. Check official sources for opportunities before verifying." />
      <ModNav current="queue" />
      <Flash searchParams={await searchParams} />
      {empty ? <EmptyState title="Queue is clear 🎉" /> : null}
      <div className="space-y-4">
        {q.posts.map((p) => (
          <Card key={p.id}>
            <div className="mb-1 flex flex-wrap gap-2 text-xs">
              <Pill>{POST_TYPE_LABEL[p.type]}</Pill>
              <Pill tone={p.riskScore >= 70 ? "danger" : "warn"}>risk {p.riskScore}</Pill>
              <span className="muted">
                @{p.author} · TL{p.authorTrust} · account since {formatDateTime(p.authorCreated)} · posted {formatDateTime(p.createdAt)}
              </span>
            </div>
            <h2 className="font-semibold">
              <Link href={`/posts/${p.id}`}>{p.title}</Link>
            </h2>
            {p.type === "opportunity" ? (
              <p className="text-sm">
                {p.orgName} · <span className="break-all">{p.officialUrl}</span> · fee: {p.involvesFee ? "yes" : "no"} {p.deadline ? `· deadline ${p.deadline}` : ""}
              </p>
            ) : null}
            <p className="prose-user mt-2 line-clamp-6 text-sm">{p.body}</p>
            <Signals list={p.riskSignals} />
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "approve", _back: "/mod/queue" }}>
                Approve
              </ActionButton>
              {p.type === "opportunity" ? (
                <ActionButton action="/api/mod/content" fields={{ targetType: "post", targetId: p.id, decision: "approve_verify", reasonCode: "verified", publicReason: "Checked against the official source.", _back: "/mod/queue" }} variant="primary">
                  Approve + verify ✓
                </ActionButton>
              ) : null}
              <RemoveForm targetType="post" targetId={p.id} />
            </div>
          </Card>
        ))}
        {q.answers.map((a) => (
          <Card key={a.id}>
            <p className="muted text-xs">
              Answer by @{a.author} · TL{a.authorTrust} · risk {a.riskScore} · on <Link href={`/posts/${a.postId}`}>post</Link>
            </p>
            <p className="prose-user mt-2 text-sm">{a.body}</p>
            <Signals list={a.riskSignals} />
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton action="/api/mod/content" fields={{ targetType: "answer", targetId: a.id, decision: "approve", _back: "/mod/queue" }}>
                Approve
              </ActionButton>
              <RemoveForm targetType="answer" targetId={a.id} />
            </div>
          </Card>
        ))}
        {q.messages.map((m) => (
          <Card key={m.id}>
            <p className="muted text-xs">
              Private session message by @{m.author} · <Link href={`/bookings/${m.bookingId}`}>booking</Link> · {formatDateTime(m.createdAt)}
            </p>
            <p className="prose-user mt-2 text-sm">{m.body}</p>
            <Signals list={m.riskSignals} />
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton action="/api/mod/content" fields={{ targetType: "booking_message", targetId: m.id, decision: "approve", _back: "/mod/queue" }}>
                Deliver
              </ActionButton>
              <RemoveForm targetType="booking_message" targetId={m.id} />
            </div>
          </Card>
        ))}
        {q.feedback.map((f) => (
          <Card key={f.id}>
            <p className="muted text-xs">
              Feedback comment · <Link href={`/bookings/${f.bookingId}`}>booking</Link>
            </p>
            <p className="prose-user mt-2 text-sm">{f.comment}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton action="/api/mod/content" fields={{ targetType: "feedback", targetId: f.id, decision: "approve", _back: "/mod/queue" }}>
                Publish
              </ActionButton>
              <RemoveForm targetType="feedback" targetId={f.id} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
