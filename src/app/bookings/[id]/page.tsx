import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth/current";
import { getBookingForViewer } from "@/lib/booking/service";
import { canLeaveFeedback, canMessage, RULES } from "@/lib/booking/state-machine";
import { reasonsForCodes } from "@/lib/risk/engine";
import { ActionButton, Form } from "@/components/form";
import { ReportControl } from "@/components/report";
import { Card, Flash, Notice, PageHeader, Pill, SelectField, TextArea, TextField, formatDateTime } from "@/components/ui";
import { STATUS_LABEL } from "@/components/booking-status";
import type { Params, SearchParams } from "@/lib/http/page";

export const metadata = { title: "Session", robots: { index: false } };

export default async function BookingPage({ params, searchParams }: { params: Params<"id">; searchParams: SearchParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const actor = await requireActor(`/bookings/${id}`);
  const data = await getBookingForViewer(id, actor);
  if (!data) notFound();
  const { booking: b, party, mentor, mentee, messages, feedback, offering } = data;
  const now = new Date();
  const here = `/bookings/${b.id}`;
  const started = !!b.scheduledAt && now.getTime() >= b.scheduledAt.getTime() + RULES.outcomeGraceMs;
  const myOutcome = party === "mentor" ? b.mentorOutcome : party === "mentee" ? b.menteeOutcome : null;
  const other = party === "mentor" ? mentee : mentor;
  const signals = reasonsForCodes(b.riskSignals.map((s) => s.code));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={b.subject}
        subtitle={
          <>
            {offering?.title} · {b.durationMin} min · mentor <Link href={`/u/${mentor.username}`}>{mentor.displayName}</Link> · student {mentee.displayName}
          </>
        }
        actions={<Pill tone={STATUS_LABEL[b.status]?.tone}>{STATUS_LABEL[b.status]?.label ?? b.status}</Pill>}
      />
      <Flash searchParams={await searchParams} />
      {party === "mentor" && signals.length ? <Notice tone="warn" title="Safety check">Our filter noticed: {signals.join(" ")} Stay on the platform and never accept or request payment.</Notice> : null}

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Request</h2>
        <p className="prose-user text-sm">{b.message}</p>
        {b.status === "requested" ? (
          <p className="muted mt-2 text-sm">Proposed: {b.proposedTimes.map((t) => formatDateTime(t)).join(" · ")}. Expires {formatDateTime(b.requestExpiresAt)}.</p>
        ) : null}
        {b.scheduledAt ? <p className="mt-2 font-medium">🗓️ {formatDateTime(b.scheduledAt)}</p> : null}
        {b.status === "accepted" && b.meetingUrl ? (
          <p className="mt-2">
            <a href={b.meetingUrl} rel="noopener noreferrer" target="_blank" className="btn btn-primary">
              Join the video call
            </a>{" "}
            <span className="muted text-sm">Opens {new URL(b.meetingUrl).hostname}</span>
          </p>
        ) : null}
      </Card>

      {party === "mentor" && b.status === "requested" ? (
        <Card className="mb-4">
          <h2 className="mb-2 font-semibold">Accept or decline</h2>
          <Form action="/api/bookings/accept" back={here}>
            <input type="hidden" name="id" value={b.id} />
            <SelectField label="Choose a time" name="slot" options={b.proposedTimes.map((t) => ({ value: t.toISOString(), label: formatDateTime(t) }))} />
            <TextField label="Meeting link (optional)" name="meetingUrl" type="url" placeholder="Leave empty for a private Jitsi room" hint="Allowed: Jitsi, Google Meet, Zoom, Microsoft Teams, Whereby." />
            <button className="btn btn-primary" type="submit">
              Accept
            </button>
          </Form>
          <Form action="/api/bookings/decline" back={here} className="mt-4">
            <input type="hidden" name="id" value={b.id} />
            <TextField label="Reason (optional, private)" name="note" maxLength={300} />
            <button className="btn btn-secondary" type="submit">
              Decline
            </button>
          </Form>
        </Card>
      ) : null}

      {party && (b.status === "requested" || (b.status === "accepted" && !started)) && !(party === "mentor" && b.status === "requested") ? (
        <Card className="mb-4">
          <Form action="/api/bookings/cancel" back={here}>
            <input type="hidden" name="id" value={b.id} />
            <TextField label="Cancel this session — reason (optional)" name="reason" maxLength={300} hint={party === "mentor" ? "Cancelling less than 24 hours before the session affects your public reliability." : undefined} />
            <button className="btn btn-secondary" type="submit">
              Cancel session
            </button>
          </Form>
        </Card>
      ) : null}

      {party && b.status === "accepted" && started && !myOutcome ? (
        <Card className="mb-4">
          <h2 className="mb-2 font-semibold">Did the session happen?</h2>
          <p className="muted mb-3 text-sm">Both of you confirm. If one side doesn&apos;t answer within 72 hours, the other side&apos;s answer stands. Conflicting answers go to a moderator.</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton action="/api/bookings/outcome" fields={{ id: b.id, outcome: "happened" }} back={here} variant="primary">
              Yes, it happened
            </ActionButton>
            <ActionButton action="/api/bookings/outcome" fields={{ id: b.id, outcome: "no_show" }} back={here}>
              {other.displayName} didn&apos;t show up
            </ActionButton>
          </div>
        </Card>
      ) : null}
      {myOutcome && b.status === "accepted" ? <Notice tone="info">You recorded: {myOutcome === "happened" ? "the session happened" : "the other person didn't show"}. Waiting for {other.displayName}.</Notice> : null}
      {b.status === "disputed" ? <Notice tone="warn">Your reports didn&apos;t match. A moderator will review and decide — you&apos;ll be notified.</Notice> : null}

      {party === "mentee" && canLeaveFeedback(b, "mentee", now) && !feedback ? (
        <Card className="mb-4">
          <h2 id="feedback" className="mb-2 font-semibold">
            Rate your session
          </h2>
          <p className="muted mb-3 text-sm">Your feedback is shown anonymously as “verified session”. It can&apos;t be edited later. A low respect score always triggers a safety review.</p>
          <Form action="/api/bookings/feedback" back={here}>
            <input type="hidden" name="id" value={b.id} />
            {(
              [
                ["helpfulness", "Helpfulness — did it move you forward?"],
                ["knowledge", "Knowledge — was the information accurate?"],
                ["respect", "Respect & safety — did you feel safe and respected?"],
              ] as const
            ).map(([name, label]) => (
              <SelectField key={name} label={label} name={name} options={[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} — ${["", "Poor", "Weak", "OK", "Good", "Excellent"][n]}` }))} />
            ))}
            <TextArea label="Comment (optional)" name="comment" maxLength={1000} rows={3} />
            <button className="btn btn-primary" type="submit">
              Submit feedback
            </button>
          </Form>
        </Card>
      ) : null}
      {feedback && party ? <Notice tone="success">Feedback submitted. Thank you.</Notice> : null}

      <section id="messages" className="mb-4">
        <h2 className="mb-2 font-semibold">Messages</h2>
        <Card className="space-y-3">
          {messages.length === 0 ? <p className="muted text-sm">No messages yet. Use this space to share agenda details — never payment or personal contact details.</p> : null}
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <p>
                <strong>{m.senderId === mentor.id ? mentor.displayName : mentee.displayName}</strong> <span className="muted">· {formatDateTime(m.createdAt)}</span>
                {m.status === "held" ? <Pill tone="warn">Held for review — not delivered</Pill> : null}
              </p>
              <p className="prose-user">{m.body}</p>
              {party && m.senderId !== actor.user.id && m.status !== "held" ? <ReportControl targetType="booking_message" targetId={m.id} back={here} /> : null}
            </div>
          ))}
          {party && canMessage(b, now) ? (
            <Form action="/api/bookings/message" back={here}>
              <input type="hidden" name="id" value={b.id} />
              <TextArea label="Write a message" name="body" required maxLength={2000} rows={3} />
              <button className="btn btn-secondary" type="submit">
                Send
              </button>
            </Form>
          ) : null}
        </Card>
      </section>

      {party ? (
        <p className="text-sm">
          Something wrong? <ReportControl targetType="booking" targetId={b.id} back={here} />
        </p>
      ) : null}
    </div>
  );
}
