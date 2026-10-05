import Link from "next/link";
import { listFeed, listOpportunities } from "@/lib/content/service";
import { platformStats } from "@/lib/content/stats";
import { listDirectory } from "@/lib/mentors/service";
import { listMyBookings } from "@/lib/booking/service";
import { RULES } from "@/lib/booking/state-machine";
import { PostCard } from "@/components/post-card";
import { MentorCard } from "@/components/mentor-card";
import { Avatar, DeadlinePill, Flash, Pill, Section, Stars, formatDate, formatSlot } from "@/components/ui";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  Compass,
  GraduationCap,
  HeartHandshake,
  Icon,
  Landmark,
  Lock,
  MessageSquareText,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "@/components/icons";
import { BRAND } from "@/lib/config/brand";
import { getActor } from "@/lib/auth/current";
import type { SearchParams } from "@/lib/http/page";

type Booking = Awaited<ReturnType<typeof listMyBookings>>[number];

function sessionSummary(rows: Booking[], userId: string) {
  const now = Date.now();
  const upcoming = rows
    .filter((b) => b.status === "accepted" && b.scheduledAt && now < b.scheduledAt.getTime() + RULES.outcomeGraceMs)
    .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime());
  const waitingOnMe = rows.filter((b) => b.status === "requested" && b.mentorId === userId).length;
  return { next: upcoming[0] ?? null, upcomingCount: upcoming.length, waitingOnMe };
}

const STEPS = [
  { icon: MessageSquareText, title: "Ask the community", body: "Post a question in English or Bangla. Students and mentors who've been through it answer — and the best answer is marked by the person who asked." },
  { icon: GraduationCap, title: "Book a verified mentor", body: "Choose a mentor whose credentials a moderator checked by hand. Send your prepared questions and propose a time. It's free." },
  { icon: HeartHandshake, title: "Meet, then pay it forward", body: "Talk in a private video room. Afterwards, both of you confirm it happened and you leave feedback that helps the next student choose well." },
];

const PROTECTIONS = [
  { icon: Lock, title: "Money never changes hands", body: "Sessions are free. Anyone who asks for payment, documents or a move to WhatsApp is breaking the rules." },
  { icon: BadgeCheck, title: "People verify mentors", body: "Evidence is reviewed by a moderator, 2FA is mandatory, and every badge links to a public record of what was checked." },
  { icon: ShieldAlert, title: "Scams are stopped early", body: "An explainable filter reads English, Bangla and Banglish and holds suspicious posts for a human before anyone sees them." },
  { icon: Scale, title: "Every decision is accountable", body: "Moderators give reasons, a different moderator hears appeals, and our enforcement numbers are public." },
];

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const [actor, feed, opps, mentors, stats] = await Promise.all([getActor(), listFeed({ sort: "new" }), listOpportunities({ verifiedOnly: true }), listDirectory({}), platformStats()]);
  const featured = [...mentors.established, ...mentors.newMentors].slice(0, 3);
  const spotlight = featured[0];
  const sessions = actor ? sessionSummary(await listMyBookings(actor.user.id), actor.user.id) : null;

  return (
    <>
      <Flash searchParams={await searchParams} />

      {actor && sessions ? (
        <section aria-labelledby="welcome" className="mb-12 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="card relative overflow-hidden p-6 sm:p-8">
            <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
            <div className="relative">
              <p className="eyebrow">Welcome back</p>
              <h1 id="welcome" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Good to see you, {actor.user.displayName.split(" ")[0]}.
              </h1>
              <p className="mt-2 max-w-xl text-ink-soft">Pick up where you left off — or ask something new. There are no small questions here.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/posts/new" className="btn btn-primary">
                  <Icon icon={Plus} />
                  Ask a question
                </Link>
                <Link href="/mentors" className="btn btn-secondary">
                  <Icon icon={GraduationCap} />
                  Find a mentor
                </Link>
                <Link href="/opportunities" className="btn btn-secondary">
                  <Icon icon={Compass} />
                  Opportunities
                </Link>
              </div>
            </div>
          </div>
          <div className="card flex flex-col p-6">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Icon icon={CalendarCheck} className="h-4.5 w-4.5 text-brand-ink" />
              Your next session
            </p>
            {sessions.next ? (
              <Link href={`/bookings/${sessions.next.id}`} className="mt-3 block rounded-xl border border-line bg-subtle p-4 no-underline hover:border-line-strong">
                <span className="block font-semibold text-ink">{sessions.next.subject}</span>
                <span className="mt-1 block text-sm text-muted">
                  {formatSlot(sessions.next.scheduledAt)} · {sessions.next.durationMin} min
                </span>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-muted">Nothing scheduled. Browse verified mentors and request a free session when you&apos;re ready.</p>
            )}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
              {sessions.waitingOnMe ? <Pill tone="warn">{sessions.waitingOnMe} request{sessions.waitingOnMe === 1 ? "" : "s"} waiting for your reply</Pill> : <span className="text-muted">{sessions.upcomingCount} upcoming</span>}
              <Link href="/bookings" className="font-semibold no-underline">
                All sessions →
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section aria-labelledby="hero" className="bleed hero-surface relative -mt-8 mb-14 border-b border-line sm:-mt-10">
          <div className="grid-texture pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="container-app relative grid grid-cols-1 items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:py-24">
            <div>
              <p className="badge badge-brand mb-6 px-3 py-1 text-[0.8125rem]">
                <Icon icon={ShieldCheck} />
                Free · Verified · Built for students in Bangladesh
              </p>
              <h1 id="hero" className="text-[2.5rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Honest guidance from people who&apos;ve <span className="text-brand-ink">been there.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">Ask about admissions, scholarships, higher study abroad and careers. Get answers from the community and book free sessions with mentors whose credentials we check by hand.</p>
              <p lang="bn" className="mt-3 max-w-xl text-muted">
                {BRAND.taglineBn}
              </p>
              <form method="get" action="/feed" role="search" className="mt-8 flex max-w-xl gap-2">
                <label htmlFor="hero-search" className="sr-only">
                  Search questions, guides and opportunities
                </label>
                <div className="relative min-w-0 flex-1">
                  <Icon icon={Search} className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input id="hero-search" type="search" name="q" maxLength={100} placeholder="e.g. MEXT scholarship, BUET admission, German visa" className="input min-h-12 pl-11" />
                </div>
                <button type="submit" className="btn btn-primary btn-lg">
                  Search
                </button>
              </form>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/register" className="btn btn-primary btn-lg">
                  Join free
                  <Icon icon={ArrowRight} />
                </Link>
                <Link href="/mentors" className="btn btn-secondary btn-lg">
                  Meet verified mentors
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-soft">
                {["Sessions are always free", "Mentors reviewed by people", "2-factor login for every mentor"].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <Icon icon={CircleCheck} className="h-4.5 w-4.5 text-brand-600" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="What you'll find on Shikor">
              <div className="space-y-4">
                {spotlight ? (
                  <div className="card p-5 shadow-lg">
                    <div className="flex items-start gap-4">
                      <Avatar name={spotlight.displayName} size={56} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-bold">
                          {spotlight.displayName}
                          <Icon icon={BadgeCheck} className="h-4.5 w-4.5 text-brand-600" label="Verified mentor" />
                        </p>
                        <p className="line-clamp-2 text-sm text-ink-soft">{spotlight.headline}</p>
                        {spotlight.showRating ? (
                          <p className="mt-2 flex items-center gap-2 text-sm">
                            <Stars score={spotlight.rating} />
                            <strong>{spotlight.rating.toFixed(1)}</strong>
                            <span className="text-muted">· {spotlight.completed} free sessions</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Link href={`/u/${spotlight.username}#sessions`} className="btn btn-primary mt-4 w-full">
                      Request a free session
                    </Link>
                  </div>
                ) : null}
                {opps[0] ? (
                  <Link href={`/posts/${opps[0].id}`} className="card card-interactive flex items-center gap-4 p-4 no-underline sm:ml-10">
                    <span className="icon-tile icon-tile-info">
                      <Icon icon={Landmark} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{opps[0].title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Pill tone="brand" icon={BadgeCheck}>
                          Verified
                        </Pill>
                        {opps[0].deadline ? <DeadlinePill deadline={opps[0].deadline} /> : null}
                      </span>
                    </span>
                  </Link>
                ) : null}
                <div className="card flex items-start gap-3 border-[var(--color-danger-line)] p-4 sm:mr-10">
                  <span className="icon-tile icon-tile-danger">
                    <Icon icon={ShieldAlert} />
                  </span>
                  <p className="text-sm">
                    <span className="block font-bold text-ink">Scams are held before anyone sees them</span>
                    <span className="text-muted">For example, a post promising a “100% visa guarantee” for a bKash fee is stopped for review — and the author is told why.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section aria-label={`${BRAND.name} in numbers`} className="mb-16 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: "Verified mentors", value: stats.mentors, icon: BadgeCheck },
          { label: "Free sessions completed", value: stats.sessions, icon: CalendarCheck },
          { label: "Verified opportunities open", value: stats.opportunities, icon: Compass },
          { label: "Questions resolved", value: stats.answered, icon: Users },
        ].map((s) => (
          <div key={s.label} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
            <span className="icon-tile">
              <Icon icon={s.icon} />
            </span>
            <div>
              <p className="text-2xl font-extrabold tracking-tight tabular-nums">{s.value.toLocaleString("en-US")}</p>
              <p className="text-sm text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </section>

      {actor ? null : (
        <Section title="How Shikor works" description="Three steps from question to a conversation with someone who has done it." className="mb-16">
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="icon-tile">
                    <Icon icon={s.icon} />
                  </span>
                  <span className="text-sm font-bold text-muted">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {featured.length ? (
        <Section
          title="Meet verified mentors"
          description="Ranked only by completed-session feedback and reliability — never by payment."
          action={
            <Link href="/mentors" className="btn btn-ghost btn-sm">
              All mentors <Icon icon={ArrowRight} />
            </Link>
          }
          className="mb-16"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((m) => (
              <MentorCard key={m.userId} m={m} />
            ))}
          </div>
        </Section>
      ) : null}

      <div className="mb-16 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section
          title="Latest from the community"
          action={
            <Link href="/feed" className="btn btn-ghost btn-sm">
              See all <Icon icon={ArrowRight} />
            </Link>
          }
        >
          <div className="space-y-3">
            {feed.items
              .filter((p) => p.status === "published")
              .slice(0, 6)
              .map((p) => (
              <PostCard key={p.id} p={p} />
            ))}
            {feed.items.length === 0 ? <p className="card p-6 text-sm text-muted">No posts yet — be the first to ask a question.</p> : null}
          </div>
        </Section>
        <Section
          title="Verified deadlines"
          action={
            <Link href="/opportunities" className="btn btn-ghost btn-sm">
              All <Icon icon={ArrowRight} />
            </Link>
          }
        >
          <div className="card divide-y divide-line">
            {opps.slice(0, 6).map((o) => (
              <Link key={o.id} href={`/posts/${o.id}`} className="flex items-start gap-3 p-4 no-underline hover:bg-subtle">
                <span className="icon-tile icon-tile-info mt-0.5 h-9 w-9">
                  <Icon icon={Landmark} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-snug text-ink">{o.title}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {o.orgName}
                    {o.deadline ? ` · ${formatDate(o.deadline)}` : ""}
                  </span>
                </span>
                <DeadlinePill deadline={o.deadline} />
              </Link>
            ))}
            {opps.length === 0 ? <p className="p-5 text-sm text-muted">No verified opportunities yet.</p> : null}
          </div>
          <a href="/opportunities/calendar.ics" className="mt-3 flex items-center gap-2 text-sm font-semibold no-underline">
            <Icon icon={CalendarDays} className="h-4 w-4" />
            Add every verified deadline to your calendar
          </a>
        </Section>
      </div>

      <section aria-labelledby="protect" className="band-brand mb-16 overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-200">Safety by design</p>
            <h2 id="protect" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Built so nobody can scam you here.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-[#cfe9db]">Fake agents cost Bangladeshi families their savings every year. Every part of {BRAND.name} — from sign-up to the session itself — is designed around that risk.</p>
            <Link href="/safety" className="btn btn-lg mt-8 bg-white text-brand-800 hover:bg-brand-50 hover:text-brand-900">
              Learn the scam red flags
              <Icon icon={ArrowRight} />
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PROTECTIONS.map((p) => (
              <li key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <Icon icon={p.icon} className="h-6 w-6 text-brand-200" />
                <h3 className="mt-3 font-bold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#cfe9db]">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {actor ? null : (
        <section aria-labelledby="cta" className="card relative overflow-hidden px-6 py-12 text-center sm:px-12">
          <div className="grid-texture pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="relative">
            <h2 id="cta" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Your questions deserve honest answers.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">Join free in under a minute. No phone number, no NID, no fees — ever.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn btn-primary btn-lg">
                Create your free account
              </Link>
              <Link href="/mentors/apply" className="btn btn-secondary btn-lg">
                Become a mentor
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
