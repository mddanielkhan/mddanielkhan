import Link from "next/link";
import { ActionButton, Form } from "@/components/form";
import { Card, Checkbox, Flash, Notice, PageHeader, Pill, SelectField, TextArea, TextField, formatDate } from "@/components/ui";
import { requireActor } from "@/lib/auth/current";
import { getMentorProfile, listOfferings, mentorStats } from "@/lib/mentors/service";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Mentor dashboard", robots: { index: false } };

export default async function MentorDashboard({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/mentor");
  const m = await getMentorProfile(actor.user.id);
  const params = await searchParams;
  if (!m) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Mentor dashboard" />
        <Flash searchParams={params} />
        <Card>
          You haven&apos;t applied to be a mentor yet. <Link href="/mentors/apply">Apply →</Link>
        </Card>
      </div>
    );
  }
  const [offerings, stats] = await Promise.all([listOfferings(actor.user.id), mentorStats(actor.user.id)]);
  const live = m.status === "approved" && !!actor.user.totpEnabledAt;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Mentor dashboard" subtitle={m.headline} actions={<Link href="/bookings" className="btn btn-secondary">Session requests</Link>} />
      <Flash searchParams={params} />
      {m.status === "pending" ? <Notice tone="info">Your application is being reviewed. We&apos;ll notify you by email.</Notice> : null}
      {m.status === "rejected" ? <Notice tone="warn" title="Not approved this time">{m.reviewNote}</Notice> : null}
      {m.status === "revoked" ? <Notice tone="danger" title="Mentor status revoked">{m.reviewNote}</Notice> : null}
      {m.status === "paused" ? <Notice tone="warn" title="Paused by moderators">{m.reviewNote}</Notice> : null}
      {m.status === "approved" && !actor.user.totpEnabledAt ? (
        <Notice tone="warn" title="One step left: turn on two-factor login">
          Verified mentors are the accounts scammers most want to steal. You won&apos;t appear in the directory until 2FA is on. <Link href="/settings/security">Set up 2FA →</Link>
        </Notice>
      ) : null}
      {live ? <Notice tone="success">You&apos;re live in the mentor directory.</Notice> : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Your record</h2>
          <ul className="space-y-1 text-sm">
            <li>Completed sessions (12 months): {stats.completed}</li>
            <li>Rating: {stats.rating.display ? `${stats.rating.score} from ${stats.rating.reviews} reviews (${Math.round(stats.rating.responseRate * 100)}% of sessions reviewed)` : `not shown until 3 reviews (${stats.rating.reviews} so far)`}</li>
            <li>Reliability: {stats.reliability.display ? `${stats.reliability.percent}% (${stats.reliability.band.replace("_", " ")})` : "shown after 3 sessions"}</li>
            <li>Topics: {m.topics.map((t) => t.name).join(", ")}</li>
          </ul>
        </Card>
        {m.status === "approved" || m.status === "paused" ? (
          <Card>
            <h2 className="mb-3 font-semibold">Availability & disclosures</h2>
            <Form action="/api/mentors/settings" back="/mentor">
              <TextField label="Max sessions per week" name="weeklyCapacity" type="number" min={1} max={20} defaultValue={m.weeklyCapacity} required />
              <Checkbox name="acceptingRequests" defaultChecked={m.acceptingRequests} label="Accepting new requests" />
              <TextArea label="Scope of advice" name="scopeStatement" rows={3} required minLength={30} maxLength={1000} defaultValue={m.scopeStatement} />
              <TextArea label="Conflict of interest" name="conflictOfInterest" rows={2} required minLength={4} maxLength={1000} defaultValue={m.conflictOfInterest} />
              <button className="btn btn-primary" type="submit">
                Save
              </button>
            </Form>
          </Card>
        ) : null}
      </div>

      {m.status === "approved" || m.status === "paused" ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Session types</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {offerings.map((o) => (
              <Card key={o.id}>
                <p className="font-semibold">{o.title}</p>
                <p className="muted text-sm">
                  {o.durationMin} min · <Pill tone="brand">Free</Pill>
                </p>
                <p className="prose-user mt-2 text-sm">{o.description}</p>
                <div className="mt-3">
                  <ActionButton action="/api/mentors/offerings/remove" fields={{ id: o.id }} variant="link">
                    Remove
                  </ActionButton>
                </div>
              </Card>
            ))}
            <Card>
              <p className="mb-2 font-semibold">Add a session type</p>
              <Form action="/api/mentors/offerings" back="/mentor">
                <TextField label="Title" name="title" required minLength={5} maxLength={80} placeholder="30-min German admissions Q&A" />
                <TextArea label="What students can expect" name="description" required minLength={20} maxLength={1000} rows={3} />
                <SelectField label="Duration" name="durationMin" options={[15, 30, 45, 60].map((d) => ({ value: d, label: `${d} minutes` }))} defaultValue={30} />
                <button className="btn btn-primary" type="submit">
                  Add
                </button>
              </Form>
            </Card>
          </div>
        </section>
      ) : null}

      {stats.reviews.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Recent feedback</h2>
          <div className="space-y-2">
            {stats.reviews.map((r) => (
              <Card key={r.id}>
                <p className="text-sm">
                  Helpfulness {r.helpfulness}/5 · Knowledge {r.knowledge}/5 · Respect {r.respect}/5 · <span className="muted">{formatDate(r.createdAt)}</span>
                </p>
                {r.comment ? <p className="prose-user mt-1 text-sm">{r.comment}</p> : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
