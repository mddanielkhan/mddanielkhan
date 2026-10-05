import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth/current";
import { getBookingForViewer } from "@/lib/booking/service";
import { canLeaveFeedback, canMessage, RULES } from "@/lib/booking/state-machine";
import { reasonsForCodes } from "@/lib/risk/engine";
import { ActionButton, Form } from "@/components/form";
import { ReportControl } from "@/components/report";
import { Avatar, Flash, Notice, PageHeader, Panel, Pill, SelectField, Steps, TextArea, TextField, formatDateTime, formatSlot, timeAgo } from "@/components/ui";
import { STATUS_LABEL } from "@/components/booking-status";
import { CalendarClock, CircleCheck, Clock, ExternalLink, Icon, Lock, MessagesSquare, Send, ShieldAlert, Video } from "@/components/icons";
import type { Params, SearchParams } from "@/lib/http/page";

export const metadata = { title: "Session", robots: { index: false } };

type StepState = "done" | "current" | "todo" | "stopped";

function progress(status: string, started: boolean, hasFeedback: boolean): StepState[] {
  switch (status) {
    case "requested":
      return ["current", "todo", "todo", "todo"];
    case "accepted":
      return started ? ["done", "done", "current", "todo"] : ["done", "current", "todo", "todo"];
    case "completed":
      return ["done", "done", "done", hasFeedback ? "done" : "current"];
    case "disputed":
      return ["done", "done", "current", "todo"];
    case "no_show_mentor":
    case "no_show_mentee":
      return ["done", "done", "stopped", "todo"];
    default:
      return ["done", "stopped", "todo", "todo"];
  }
}

function timeline(scheduledAt: Date | null) {
  const now = Date.now();
  return { now: new Date(now), started: !!scheduledAt && now >= scheduledAt.getTime() + RULES.outcomeGraceMs };
}

export default async function BookingPage({ params, searchParams }: { params: Params<"id">; searchParams: SearchParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const actor = await requireActor(`/bookings/${id}`);
  const data = await getBookingForViewer(id, actor);
  if (!data) notFound();
  const { booking: b, party, mentor, mentee, messages, feedback, offering } = data;
  const { now, started } = timeline(b.scheduledAt);
  const here = `/bookings/${b.id}`;
  const myOutcome = party === "mentor" ? b.mentorOutcome : party === "mentee" ? b.menteeOutcome : null;
  const other = party === "mentor" ? mentee : mentor;
  const signals = reasonsForCodes(b.riskSignals.map((s) => s.code));
  const status = STATUS_LABEL[b.status];
  const steps = progress(b.status, started, !!feedback);
  const canCancel = party && (b.status === "requested" || (b.status === "accepted" && !started)) && !(party === "mentor" && b.status === "requested");

  return (
    <>
      <PageHeader
        title={b.subject}
        breadcrumbs={[{ href: "/bookings", label: "My sessions" }, { label: offering?.title ?? "Session" }]}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9375rem]">
            <span>{offering?.title}</span>
            <span className="flex items-center gap-1">
              <Icon icon={Clock} className="h-4 w-4" />
              {b.durationMin} min
            </span>
            <span className="flex items-center gap-1">
              <Icon icon={Video} className="h-4 w-4" />
              Online
            </span>
          </span>
        }
        actions={<Pill tone={status?.tone} className="px-3 py-1 text-sm">{status?.label ?? b.status}</Pill>}
      />
      <Flash searchParams={await searchParams} />

      <div className="card mb-8 p-5">
        <Steps
          label="Session progress"
          steps={["Requested", "Scheduled", "Happened", "Reviewed"].map((label, i) => ({ label, state: steps[i]! }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          {party === "mentor" && signals.length ? (
            <Notice tone="warn" title="Safety check" icon={ShieldAlert}>
              Our filter noticed: {signals.join(" ")} Stay on the platform and never accept or request payment.
            </Notice>
          ) : null}

          {b.scheduledAt ? (
            <section className="card overflow-hidden" aria-labelledby="when">
              <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
                <span className="icon-tile h-12 w-12 rounded-2xl">
                  <Icon icon={CalendarClock} className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="when" className="text-xs font-bold uppercase tracking-wider text-muted">
                    Scheduled for
                  </h2>
                  <p className="mt-0.5 text-lg font-bold">{formatSlot(b.scheduledAt)}</p>
                  <p className="text-sm text-muted">{formatDateTime(b.scheduledAt)}</p>
                </div>
                {b.status === "accepted" && b.meetingUrl ? (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <a href={b.meetingUrl} rel="noopener noreferrer" target="_blank" className="btn btn-primary">
                      <Icon icon={Video} />
                      Join the video call
                    </a>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      Opens {new URL(b.meetingUrl).hostname} <Icon icon={ExternalLink} className="h-3 w-3" />
                    </span>
                  </div>
                ) : null}
              </div>
              {b.status === "accepted" ? (
                <p className="flex items-start gap-2 border-t border-line bg-subtle px-5 py-3 text-xs leading-relaxed text-muted sm:px-6">
                  <Icon icon={Lock} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Only the two of you can see this link. Never share your screen with banking apps open, and never send money or documents.
                </p>
              ) : null}
            </section>
          ) : null}

          <Panel title="The request" description={`From ${mentee.displayName} · ${timeAgo(b.createdAt)}`}>
            <p className="prose-user leading-7 text-ink-soft">{b.message}</p>
            {b.status === "requested" ? (
              <div className="mt-5">
                <p className="text-sm font-bold">Proposed times</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {b.proposedTimes.map((t) => (
                    <li key={t.toISOString()} className="chip">
                      {formatSlot(t)}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted">Bangladesh time. The request expires {formatDateTime(b.requestExpiresAt)}.</p>
              </div>
            ) : null}
          </Panel>

          {party === "mentor" && b.status === "requested" ? (
            <Panel title="Accept or decline" description="Pick one of the proposed times. Leave the link empty and we create a private Jitsi room.">
              <Form action="/api/bookings/accept" back={here}>
                <input type="hidden" name="id" value={b.id} />
                <SelectField label="Choose a time" name="slot" options={b.proposedTimes.map((t) => ({ value: t.toISOString(), label: formatDateTime(t) }))} />
                <TextField label="Meeting link (optional)" name="meetingUrl" type="url" placeholder="Leave empty for a private Jitsi room" hint="Allowed: Jitsi, Google Meet, Zoom, Microsoft Teams, Whereby." />
                <button className="btn btn-primary" type="submit">
                  Accept
                </button>
              </Form>
              <details className="mt-5 border-t border-line pt-4">
                <summary className="text-sm font-semibold text-muted hover:text-ink">Can&apos;t help this time? Decline</summary>
                <Form action="/api/bookings/decline" back={here} className="mt-4">
                  <input type="hidden" name="id" value={b.id} />
                  <TextField label="Reason (optional, private)" name="note" maxLength={300} />
                  <button className="btn btn-secondary" type="submit">
                    Decline
                  </button>
                </Form>
              </details>
            </Panel>
          ) : null}

          {party && b.status === "accepted" && started && !myOutcome ? (
            <Panel title="Did the session happen?" description="Both of you answer. If one side doesn't answer within 72 hours, the other side's answer stands. Conflicting answers go to a moderator.">
              <div className="flex flex-wrap gap-2">
                <ActionButton action="/api/bookings/outcome" fields={{ id: b.id, outcome: "happened" }} back={here} variant="primary" icon={CircleCheck}>
                  Yes, it happened
                </ActionButton>
                <ActionButton action="/api/bookings/outcome" fields={{ id: b.id, outcome: "no_show" }} back={here}>
                  {other.displayName} didn&apos;t show up
                </ActionButton>
              </div>
            </Panel>
          ) : null}
          {myOutcome && b.status === "accepted" ? (
            <Notice tone="info">
              You recorded: {myOutcome === "happened" ? "the session happened" : "the other person didn't show"}. Waiting for {other.displayName}.
            </Notice>
          ) : null}
          {b.status === "disputed" ? <Notice tone="warn">Your reports didn&apos;t match. A moderator will review and decide — you&apos;ll be notified.</Notice> : null}

          {party === "mentee" && canLeaveFeedback(b, "mentee", now) && !feedback ? (
            <Panel id="feedback" title="Rate your session" description="Shown anonymously as a “verified session”. It can't be edited later. A low respect score always triggers a safety review.">
              <Form action="/api/bookings/feedback" back={here}>
                <input type="hidden" name="id" value={b.id} />
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
                  {(
                    [
                      ["helpfulness", "Helpfulness"],
                      ["knowledge", "Knowledge"],
                      ["respect", "Respect & safety"],
                    ] as const
                  ).map(([name, label]) => (
                    <SelectField key={name} label={label} name={name} options={[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} — ${["", "Poor", "Weak", "OK", "Good", "Excellent"][n]}` }))} />
                  ))}
                </div>
                <TextArea label="Comment" name="comment" maxLength={1000} rows={3} optional hint="What helped? Other students will read this." />
                <button className="btn btn-primary" type="submit">
                  Submit feedback
                </button>
              </Form>
            </Panel>
          ) : null}
          {feedback && party ? <Notice tone="success">Feedback submitted. Thank you.</Notice> : null}

          <section id="messages" aria-labelledby="messages-h" className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4 sm:px-6">
              <Icon icon={MessagesSquare} className="h-5 w-5 text-muted" />
              <h2 id="messages-h" className="text-base font-bold">
                Messages
              </h2>
            </div>
            <div className="space-y-4 px-5 py-5 sm:px-6">
              {messages.length === 0 ? <p className="text-sm text-muted">No messages yet. Use this space for agenda details — never payment or personal contact details.</p> : null}
              {messages.map((m) => {
                const mine = m.senderId === actor.user.id;
                const sender = m.senderId === mentor.id ? mentor : mentee;
                return (
                  <div key={m.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                    <Avatar name={sender.displayName} size={32} />
                    <div className={`min-w-0 max-w-[85%] ${mine ? "text-right" : ""}`}>
                      <p className="text-xs text-muted">
                        <span className="font-semibold text-ink-soft">{mine ? "You" : sender.displayName}</span> · {timeAgo(m.createdAt)}
                      </p>
                      <div className={`mt-1 inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${mine ? "rounded-tr-md bg-brand-600 text-white" : "rounded-tl-md bg-subtle text-ink"}`}>
                        <p className="prose-user">{m.body}</p>
                      </div>
                      {m.status === "held" ? (
                        <p className="mt-1">
                          <Pill tone="warn">Held for review — not delivered</Pill>
                        </p>
                      ) : null}
                      {party && !mine && m.status !== "held" ? (
                        <div className="mt-1">
                          <ReportControl targetType="booking_message" targetId={m.id} back={here} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {party && canMessage(b, now) ? (
              <div className="border-t border-line bg-subtle px-5 py-4 sm:px-6">
                <Form action="/api/bookings/message" back={here}>
                  <input type="hidden" name="id" value={b.id} />
                  <TextArea label="Write a message" name="body" required maxLength={2000} rows={3} fieldClassName="mb-3" />
                  <button className="btn btn-secondary" type="submit">
                    <Icon icon={Send} />
                    Send
                  </button>
                </Form>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="text-sm font-bold">People</h2>
            <ul className="mt-3 space-y-3">
              {[
                ["Mentor", mentor],
                ["Student", mentee],
              ].map(([role, p]) => {
                const person = p as typeof mentor;
                return (
                  <li key={role as string} className="flex items-center gap-3">
                    <Avatar name={person.displayName} size={40} />
                    <div className="min-w-0">
                      <Link href={`/u/${person.username}`} className="block truncate font-semibold text-ink no-underline hover:underline">
                        {person.displayName}
                      </Link>
                      <p className="text-xs text-muted">{role as string}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="panel-subtle p-5 text-sm leading-relaxed text-muted">
            <p className="flex items-center gap-2 font-bold text-ink">
              <Icon icon={Lock} className="h-4 w-4 text-brand-600" />
              Session rules
            </p>
            <ul className="mt-2 space-y-1.5">
              <li>Sessions are free — no payment, gifts or commissions.</li>
              <li>Keep contact on the platform.</li>
              <li>Mentors share experience, not guarantees.</li>
            </ul>
          </div>
          {canCancel ? (
            <details className="card p-5">
              <summary className="text-sm font-semibold text-muted hover:text-ink">Cancel this session</summary>
              <Form action="/api/bookings/cancel" back={here} className="mt-4">
                <input type="hidden" name="id" value={b.id} />
                <TextField label="Reason (optional)" name="reason" maxLength={300} hint={party === "mentor" ? "Cancelling less than 24 hours before the session affects your public reliability." : undefined} />
                <button className="btn btn-danger-soft w-full" type="submit">
                  Cancel session
                </button>
              </Form>
            </details>
          ) : null}
          {party ? (
            <div className="flex items-center justify-between rounded-xl border border-line px-4 py-2 text-sm text-muted">
              <span>Something wrong?</span>
              <ReportControl targetType="booking" targetId={b.id} back={here} align="right" />
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
