import Link from "next/link";
import { ActionButton, Form } from "@/components/form";
import { Checkbox, EmptyState, Flash, Notice, PageHeader, Panel, Pill, SelectField, Stars, Stat, TextArea, TextField, timeAgo } from "@/components/ui";
import { ArrowUpRight, CalendarCheck, CalendarDays, Clock, GraduationCap, Icon, KeyRound, Plus, Star, Trash, TrendingUp } from "@/components/icons";
import { requireActor } from "@/lib/auth/current";
import { getMentorProfile, listOfferings, mentorStats } from "@/lib/mentors/service";
import { listMyBookings } from "@/lib/booking/service";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Mentor dashboard", robots: { index: false } };

export default async function MentorDashboard({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/mentor");
  const m = await getMentorProfile(actor.user.id);
  const params = await searchParams;
  if (!m) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Mentor dashboard" />
        <Flash searchParams={params} />
        <EmptyState
          title="You're not a mentor yet"
          icon={GraduationCap}
          action={
            <Link href="/mentors/apply" className="btn btn-primary">
              Apply to mentor
            </Link>
          }
        >
          Help students the way you wish someone had helped you. Applications are reviewed by hand, usually within 5 days.
        </EmptyState>
      </div>
    );
  }
  const [offerings, stats, bookings] = await Promise.all([listOfferings(actor.user.id), mentorStats(actor.user.id), listMyBookings(actor.user.id)]);
  const pending = bookings.filter((b) => b.status === "requested" && b.mentorId === actor.user.id);
  const live = m.status === "approved" && !!actor.user.totpEnabledAt;
  const manageable = m.status === "approved" || m.status === "paused";

  return (
    <>
      <PageHeader
        eyebrow="Mentoring"
        title="Mentor dashboard"
        subtitle={m.headline}
        actions={
          <>
            <Link href={`/u/${actor.user.username}`} className="btn btn-secondary">
              Public profile <Icon icon={ArrowUpRight} />
            </Link>
            <Link href="/bookings" className="btn btn-primary">
              <Icon icon={CalendarDays} />
              Session requests
              {pending.length ? <span className="count bg-white text-brand-800">{pending.length}</span> : null}
            </Link>
          </>
        }
      />
      <Flash searchParams={params} />
      {m.status === "pending" ? <Notice tone="info" title="Application under review">We&apos;ll email you when a moderator has looked at your evidence — usually within 5 days.</Notice> : null}
      {m.status === "rejected" ? <Notice tone="warn" title="Not approved this time">{m.reviewNote}</Notice> : null}
      {m.status === "revoked" ? <Notice tone="danger" title="Mentor status revoked">{m.reviewNote}</Notice> : null}
      {m.status === "paused" ? <Notice tone="warn" title="Paused by moderators">{m.reviewNote}</Notice> : null}
      {m.status === "approved" && !actor.user.totpEnabledAt ? (
        <Notice tone="warn" title="One step left: turn on two-factor login" icon={KeyRound}>
          Verified mentors are the accounts scammers most want to steal. You won&apos;t appear in the directory until 2FA is on.{" "}
          <Link href="/settings/security" className="font-semibold">
            Set up 2FA →
          </Link>
        </Notice>
      ) : null}
      {live ? <Notice tone="success">You&apos;re live in the mentor directory.</Notice> : null}

      <section aria-label="Your record" className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Requests waiting" value={pending.length} icon={Clock} tone={pending.length ? "gold" : "neutral"} href="/bookings" />
        <Stat label="Completed (12 months)" value={stats.completed} icon={CalendarCheck} />
        <Stat
          label="Rating"
          value={stats.rating.display ? stats.rating.score.toFixed(1) : "—"}
          hint={stats.rating.display ? `${stats.rating.reviews} reviews · ${Math.round(stats.rating.responseRate * 100)}% reviewed` : `Shown after 3 reviews (${stats.rating.reviews} so far)`}
          icon={Star}
          tone="gold"
        />
        <Stat label="Reliability" value={stats.reliability.display ? `${stats.reliability.percent}%` : "—"} hint={stats.reliability.display ? stats.reliability.band.replace("_", " ") : "Shown after 3 sessions"} icon={TrendingUp} tone="info" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {manageable ? (
          <section aria-labelledby="types" className="space-y-4">
            <div>
              <h2 id="types" className="text-lg font-bold">
                Session types
              </h2>
              <p className="mt-1 text-sm text-muted">What students can request. Up to 5, always free.</p>
            </div>
            {offerings.map((o) => (
              <div key={o.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{o.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill icon={Clock}>{o.durationMin} min</Pill>
                      <Pill tone="brand">Free</Pill>
                    </div>
                  </div>
                  <ActionButton action="/api/mentors/offerings/remove" fields={{ id: o.id }} variant="ghost" size="sm" icon={Trash}>
                    Remove
                  </ActionButton>
                </div>
                <p className="prose-user mt-3 text-sm leading-relaxed text-muted">{o.description}</p>
              </div>
            ))}
            <details className="card p-5" open={offerings.length === 0}>
              <summary className="flex items-center gap-2 font-bold text-brand-ink">
                <Icon icon={Plus} className="h-4.5 w-4.5" />
                Add a session type
              </summary>
              <Form action="/api/mentors/offerings" back="/mentor" className="mt-4">
                <TextField label="Title" name="title" required minLength={5} maxLength={80} placeholder="30-min German admissions Q&A" />
                <TextArea label="What students can expect" name="description" required minLength={20} maxLength={1000} rows={3} />
                <SelectField label="Duration" name="durationMin" options={[15, 30, 45, 60].map((d) => ({ value: d, label: `${d} minutes` }))} defaultValue={30} fieldClassName="max-w-xs" />
                <button className="btn btn-primary" type="submit">
                  Add session type
                </button>
              </Form>
            </details>
          </section>
        ) : null}

        <div className="space-y-6">
          {manageable ? (
            <Panel title="Availability & disclosures" description="Your scope and conflict-of-interest statements are shown publicly on your profile.">
              <Form action="/api/mentors/settings" back="/mentor">
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 sm:items-end">
                  <TextField label="Max sessions per week" name="weeklyCapacity" type="number" min={1} max={20} defaultValue={m.weeklyCapacity} required />
                  <div className="field">
                    <Checkbox name="acceptingRequests" defaultChecked={m.acceptingRequests} label="Accepting new requests" />
                  </div>
                </div>
                <TextArea label="Scope of advice" name="scopeStatement" rows={3} required minLength={30} maxLength={1000} defaultValue={m.scopeStatement} />
                <TextArea label="Conflict of interest" name="conflictOfInterest" rows={2} required minLength={4} maxLength={1000} defaultValue={m.conflictOfInterest} />
                <button className="btn btn-primary" type="submit">
                  Save
                </button>
              </Form>
            </Panel>
          ) : null}

          {stats.reviews.length ? (
            <Panel title="Recent feedback" description="Anonymous, from verified sessions only.">
              <ul className="-my-3 divide-y divide-line">
                {stats.reviews.slice(0, 6).map((r) => {
                  const avg = (r.helpfulness + r.knowledge + r.respect) / 3;
                  return (
                    <li key={r.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Stars score={avg} className="h-3.5 w-3.5" />
                        <span className="text-muted">
                          Helpfulness {r.helpfulness} · Knowledge {r.knowledge} · Respect {r.respect} · {timeAgo(r.createdAt)}
                        </span>
                      </div>
                      {r.comment ? <p className="prose-user mt-1.5 text-sm leading-relaxed text-ink-soft">{r.comment}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
