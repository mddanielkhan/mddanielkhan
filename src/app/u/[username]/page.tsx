import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles, users } from "@/lib/db/schema";
import { getActor } from "@/lib/auth/current";
import { activeBadges, getMentorProfile, listOfferings, mentorStats } from "@/lib/mentors/service";
import { postsByAuthor } from "@/lib/content/service";
import { gatherTrustInputs, reputationByTopic } from "@/lib/trust/reputation";
import { explainTrustLevel } from "@/lib/trust/trust-level";
import { ReportControl } from "@/components/report";
import { BadgeCard } from "@/components/badges";
import { Avatar, Flash, Meter, Panel, Pill, Stars, TrustPill, formatDate, timeAgo } from "@/components/ui";
import { Award, BadgeCheck, Building, Calendar, CircleCheck, Clock, ExternalLink, Globe, GraduationCap, Icon, Languages, Lock, MapPin, Pencil, Quote, Scale, Video } from "@/components/icons";
import type { Params, SearchParams } from "@/lib/http/page";

async function load(username: string) {
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return null;
  const [row] = await db().select({ user: users, profile: profiles }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.username, username));
  if (!row || row.user.status === "deleted" || row.user.status === "banned") return null;
  return row;
}

export async function generateMetadata({ params }: { params: Params<"username"> }): Promise<Metadata> {
  const row = await load((await params).username);
  if (!row) return { title: "Not found", robots: { index: false } };
  // Privacy by default: profiles are hidden from search engines unless the member opts in.
  return { title: row.user.displayName, robots: { index: !!row.profile?.allowSearchIndexing, follow: false } };
}

const GENDER: Record<string, string> = { woman: "Woman", man: "Man", non_binary: "Non-binary" };

export default async function ProfilePage({ params, searchParams }: { params: Params<"username">; searchParams: SearchParams }) {
  const { username } = await params;
  const row = await load(username);
  if (!row) notFound();
  const { user, profile } = row;
  const actor = await getActor();
  const isSelf = actor?.user.id === user.id;
  const [badges, mentor, posts, byTopic] = await Promise.all([activeBadges(user.id), getMentorProfile(user.id), postsByAuthor(user.id, 10), reputationByTopic(user.id)]);
  const mentorLive = mentor?.status === "approved" && !!user.totpEnabledAt;
  const [offerings, stats] = mentorLive ? await Promise.all([listOfferings(user.id), mentorStats(user.id)]) : [[], null];
  const trust = isSelf ? explainTrustLevel((await gatherTrustInputs(user.id))!) : null;
  const here = `/u/${user.username}`;
  const topicRep = byTopic.filter((t) => t.topicId);
  const maxRep = Math.max(1, ...topicRep.map((t) => t.points));
  const canRequest = mentorLive && mentor?.acceptingRequests && !isSelf && offerings.length > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <Flash searchParams={await searchParams} />

      <section className="card overflow-hidden" aria-labelledby="profile-name">
        <div className="band-brand relative h-28 sm:h-36" aria-hidden="true">
          <div className="grid-texture absolute inset-0 opacity-20" />
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <div className="relative -mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-14">
            <Avatar name={user.displayName} size={96} ring />
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {canRequest ? (
                <a href="#sessions" className="btn btn-primary">
                  <Icon icon={Video} />
                  Request a free session
                </a>
              ) : null}
              {isSelf ? (
                <Link href="/settings" className="btn btn-secondary">
                  <Icon icon={Pencil} />
                  Edit profile
                </Link>
              ) : actor ? (
                <ReportControl targetType="user" targetId={user.id} back={here} align="right" />
              ) : null}
            </div>
          </div>
          <h1 id="profile-name" className="mt-4 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {user.displayName}
            {mentorLive ? <Icon icon={BadgeCheck} className="h-6 w-6 text-brand-600" label="Verified mentor" /> : null}
          </h1>
          <p className="text-muted">@{user.username}</p>
          {profile?.headline ? <p className="mt-2 max-w-2xl text-[1.0625rem] text-ink-soft">{profile.headline}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <TrustPill level={user.trustLevel} />
            <Pill tone="gold" icon={Award}>
              {user.reputation} reputation
            </Pill>
            {profile?.showGender && profile.gender && GENDER[profile.gender] ? <Pill>{GENDER[profile.gender]}</Pill> : null}
            <span className="flex items-center gap-1.5 text-muted">
              <Icon icon={Calendar} className="h-4 w-4" />
              Joined {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          {badges.length ? (
            <section aria-labelledby="facts">
              <h2 id="facts" className="text-lg font-bold">
                Verified facts & achievements
              </h2>
              <p className="mt-1 text-sm text-muted">Each badge links to a public record of what was checked, how and when.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {badges.map((b) => (
                  <BadgeCard key={b.id} b={b} />
                ))}
              </div>
            </section>
          ) : null}

          {trust?.next ? (
            <Panel title={`Your next trust level: TL${trust.next.level} · ${trust.next.name}`} description={`You're TL${trust.current} · ${trust.currentName}. Trust levels unlock privileges and are earned by behaviour — they can't be bought.`}>
              <ul className="space-y-2.5 text-sm">
                {trust.next.requirements.map((r) => (
                  <li key={r.label} className="flex items-start gap-2.5">
                    <Icon icon={CircleCheck} className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${r.met ? "text-brand-600" : "text-line-strong"}`} />
                    <span className={r.met ? "text-ink" : "text-ink-soft"}>
                      {r.label} <span className="text-muted">({r.progress})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {profile?.bio ? (
            <section aria-labelledby="about">
              <h2 id="about" className="text-lg font-bold">
                About
              </h2>
              <p className="prose-user mt-3 leading-7 text-ink-soft">{profile.bio}</p>
            </section>
          ) : null}

          {mentorLive && mentor ? (
            <>
              <Panel
                title={
                  <span className="flex items-center gap-2">
                    <Icon icon={BadgeCheck} className="h-5 w-5 text-brand-600" />
                    Verified mentor
                  </span>
                }
                description={mentor.headline}
              >
                <div className="flex flex-wrap gap-1.5">
                  {mentor.topics.map((t) => (
                    <Pill key={t.id}>{t.name}</Pill>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold">Scope of advice</h3>
                    <p className="prose-user mt-1 text-sm leading-relaxed text-ink-soft">{mentor.scopeStatement}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Conflict of interest</h3>
                    <p className="prose-user mt-1 text-sm leading-relaxed text-ink-soft">{mentor.conflictOfInterest}</p>
                  </div>
                </div>
                <p className="mt-5 flex items-start gap-2 rounded-lg bg-subtle px-3.5 py-2.5 text-xs leading-relaxed text-muted">
                  <Icon icon={Scale} className="mt-0.5 h-4 w-4 shrink-0" />
                  Mentors share personal experience. This is not legal, immigration, medical or financial advice — always confirm with official sources.
                </p>
              </Panel>

              <section id="sessions" aria-labelledby="sessions-h" className="scroll-mt-24">
                <h2 id="sessions-h" className="text-lg font-bold">
                  Free sessions
                </h2>
                <p className="mt-1 text-sm text-muted">Online, in a private video room. You&apos;ll propose up to three times; the mentor picks one.</p>
                {offerings.length ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {offerings.map((o) => (
                      <div key={o.id} className="card flex flex-col p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill icon={Clock}>{o.durationMin} min</Pill>
                          <Pill tone="brand">Free</Pill>
                          <Pill icon={Video}>Online</Pill>
                        </div>
                        <h3 className="mt-3 font-bold leading-snug">{o.title}</h3>
                        <p className="prose-user mt-1.5 flex-1 text-sm leading-relaxed text-muted">{o.description}</p>
                        {mentor.acceptingRequests && !isSelf ? (
                          <Link href={`/book/${o.id}`} className="btn btn-primary mt-4">
                            Request this session
                          </Link>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="panel-subtle mt-4 p-5 text-sm text-muted">No session types published yet.</p>
                )}
                {!mentor.acceptingRequests ? <p className="mt-3 text-sm text-muted">{user.displayName.split(" ")[0]} isn&apos;t taking new requests right now.</p> : null}
              </section>

              {stats ? (
                <section aria-labelledby="reviews" className="card p-5 sm:p-6">
                  <h2 id="reviews" className="text-lg font-bold">
                    Track record
                  </h2>
                  {stats.rating.display ? (
                    <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
                      <div>
                        <p className="text-5xl font-extrabold tracking-tight tabular-nums">{stats.rating.score.toFixed(1)}</p>
                        <Stars score={stats.rating.score} className="mt-1 h-4.5 w-4.5" />
                        <p className="mt-2 text-sm text-muted">
                          {stats.rating.reviews} verified-session reviews · {Math.round(stats.rating.responseRate * 100)}% of sessions reviewed
                        </p>
                      </div>
                      <div className="space-y-3 text-sm">
                        {(
                          [
                            ["Helpfulness", stats.rating.axes.helpfulness],
                            ["Knowledge", stats.rating.axes.knowledge],
                            ["Respect & safety", stats.rating.axes.respect],
                          ] as const
                        ).map(([label, v]) => (
                          <div key={label}>
                            <div className="mb-1 flex justify-between">
                              <span className="font-medium text-ink-soft">{label}</span>
                              <span className="font-semibold tabular-nums">{v.toFixed(1)}</span>
                            </div>
                            <Meter value={v / 5} label={`${label} ${v.toFixed(1)} out of 5`} />
                          </div>
                        ))}
                        <p className="pt-1 text-muted">
                          {stats.reliability.display ? (
                            <>
                              Reliability <strong className="text-ink">{stats.reliability.percent}%</strong> — sessions held as planned (of {stats.reliability.basis})
                            </>
                          ) : (
                            <>{stats.completed} completed sessions</>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">New mentor — ratings appear after 3 reviewed sessions. {stats.completed} completed so far.</p>
                  )}
                  {stats.reviews.length ? (
                    <ul className="mt-6 divide-y divide-line border-t border-line">
                      {stats.reviews.slice(0, 10).map((r) => {
                        const avg = Math.round(((r.helpfulness + r.knowledge + r.respect) / 3) * 10) / 10;
                        return (
                          <li key={r.id} className="py-4">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Stars score={avg} className="h-3.5 w-3.5" />
                              <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
                              <span className="text-muted">· Verified session · {timeAgo(r.createdAt)}</span>
                            </div>
                            {r.comment ? (
                              <p className="prose-user mt-2 flex gap-2 text-sm leading-relaxed text-ink-soft">
                                <Icon icon={Quote} className="mt-0.5 h-4 w-4 shrink-0 text-line-strong" />
                                <span>{r.comment}</span>
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                    <Icon icon={Lock} className="h-3.5 w-3.5" />
                    Only students whose session both sides confirmed can leave a review. Reviews are anonymous.
                  </p>
                </section>
              ) : null}
            </>
          ) : null}

          <section aria-labelledby="posts">
            <h2 id="posts" className="text-lg font-bold">
              Recent posts
            </h2>
            {posts.length ? (
              <ul className="card mt-3 divide-y divide-line">
                {posts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/posts/${p.id}`} className="block px-5 py-3.5 no-underline hover:bg-subtle">
                      <span className="block font-semibold leading-snug text-ink">{p.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {formatDate(p.createdAt)} · {p.answerCount} {p.answerCount === 1 ? "answer" : "answers"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-subtle mt-3 p-5 text-sm text-muted">No posts yet.</p>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="text-sm font-bold">Details</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {profile?.institution ? (
                <li className="flex items-start gap-2.5">
                  <Icon icon={Building} className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <span>
                    {profile.institution} <span className="block text-xs text-muted">Self-described</span>
                  </span>
                </li>
              ) : null}
              {profile?.fieldOfStudy ? (
                <li className="flex items-start gap-2.5">
                  <Icon icon={GraduationCap} className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {profile.fieldOfStudy}
                </li>
              ) : null}
              {profile?.location ? (
                <li className="flex items-start gap-2.5">
                  <Icon icon={MapPin} className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {profile.location}
                </li>
              ) : null}
              {profile?.languages.length ? (
                <li className="flex items-start gap-2.5">
                  <Icon icon={Languages} className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {profile.languages.join(", ")}
                </li>
              ) : null}
              {profile?.linkedinUrl ? (
                <li className="flex items-start gap-2.5">
                  <Icon icon={Globe} className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <a href={profile.linkedinUrl} rel="nofollow noopener noreferrer ugc me" target="_blank" className="inline-flex items-center gap-1">
                    LinkedIn <Icon icon={ExternalLink} className="h-3.5 w-3.5" />
                  </a>
                </li>
              ) : null}
              {!profile?.institution && !profile?.fieldOfStudy && !profile?.location && !profile?.languages.length && !profile?.linkedinUrl ? <li className="text-muted">No details shared.</li> : null}
            </ul>
          </div>
          {topicRep.length ? (
            <div className="card p-5">
              <h2 className="text-sm font-bold">Reputation by topic</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {topicRep.map((t) => (
                  <li key={t.topicId}>
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="text-ink-soft">{t.name}</span>
                      <span className="font-semibold tabular-nums">{t.points}</span>
                    </div>
                    <Meter value={t.points / maxRep} label={`${t.name}: ${t.points} points`} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="panel-subtle p-5 text-sm leading-relaxed text-muted">
            <p className="flex items-center gap-2 font-bold text-ink">
              <Icon icon={Lock} className="h-4 w-4 text-brand-600" />
              Sessions are free
            </p>
            <p className="mt-1.5">If anyone asks you for money, documents or to move to WhatsApp, stop and report it.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
