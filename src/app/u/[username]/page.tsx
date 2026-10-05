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
import { BADGE_INFO } from "@/lib/trust/badges";
import { ReportControl } from "@/components/report";
import { Avatar, Card, Flash, Pill, TrustPill, formatDate } from "@/components/ui";
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

  return (
    <div className="mx-auto max-w-4xl">
      <Flash searchParams={await searchParams} />
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <Avatar name={user.displayName} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{user.displayName}</h1>
          <p className="muted">@{user.username}</p>
          {profile?.headline ? <p className="mt-1">{profile.headline}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <TrustPill level={user.trustLevel} />
            <Pill>{user.reputation} reputation</Pill>
            {profile?.showGender && profile.gender ? <Pill>{profile.gender === "woman" ? "Woman" : profile.gender === "man" ? "Man" : profile.gender === "non_binary" ? "Non-binary" : ""}</Pill> : null}
            <span className="muted">Joined {formatDate(user.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isSelf ? (
            <Link href="/settings" className="btn btn-secondary">
              Edit profile
            </Link>
          ) : actor ? (
            <ReportControl targetType="user" targetId={user.id} back={here} />
          ) : null}
        </div>
      </div>

      {badges.length ? (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Verified facts & achievements</h2>
          <ul className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <li key={b.id}>
                <Link href={`/v/${b.id}`} className="card inline-flex items-center gap-2 px-3 py-1.5 text-sm no-underline" title={BADGE_INFO[b.kind].meaning}>
                  <span aria-hidden="true">{BADGE_INFO[b.kind].icon}</span>
                  <span>
                    <span className="block font-medium text-[var(--color-ink)]">{BADGE_INFO[b.kind].title}</span>
                    <span className="muted block text-xs">
                      {b.label} · {formatDate(b.grantedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {trust?.next ? (
        <Card className="mb-6">
          <h2 className="mb-2 font-semibold">
            Your trust level: TL{trust.current} {trust.currentName} → next: TL{trust.next.level} {trust.next.name}
          </h2>
          <ul className="space-y-1 text-sm">
            {trust.next.requirements.map((r) => (
              <li key={r.label}>
                {r.met ? "✅" : "⬜"} {r.label} <span className="muted">({r.progress})</span>
              </li>
            ))}
          </ul>
          <p className="muted mt-2 text-sm">Trust levels unlock privileges (sharing opportunities, more posts, stronger reports). They are earned by behaviour and can&apos;t be bought.</p>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {profile?.bio ? (
            <Card>
              <h2 className="mb-2 font-semibold">About</h2>
              <p className="prose-user">{profile.bio}</p>
            </Card>
          ) : null}

          {mentorLive && mentor ? (
            <section id="sessions" className="space-y-4">
              <Card>
                <h2 className="mb-2 font-semibold">🛡️ Verified mentor</h2>
                <p className="text-sm">{mentor.headline}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {mentor.topics.map((t) => (
                    <Pill key={t.id}>{t.name}</Pill>
                  ))}
                </div>
                <h3 className="mt-4 text-sm font-semibold">Scope of advice</h3>
                <p className="prose-user text-sm">{mentor.scopeStatement}</p>
                <h3 className="mt-3 text-sm font-semibold">Conflict of interest</h3>
                <p className="prose-user text-sm">{mentor.conflictOfInterest}</p>
                <p className="muted mt-3 text-xs">Mentors share personal experience. This is not legal, immigration, medical or financial advice — always confirm with official sources.</p>
              </Card>
              {stats ? (
                <Card>
                  <h2 className="mb-2 font-semibold">Track record</h2>
                  <p className="text-sm">
                    {stats.rating.display ? (
                      <>
                        ⭐ <strong>{stats.rating.score}</strong> / 5 from {stats.rating.reviews} verified-session reviews ({Math.round(stats.rating.responseRate * 100)}% of sessions reviewed) · helpfulness {stats.rating.axes.helpfulness}, knowledge {stats.rating.axes.knowledge}, respect {stats.rating.axes.respect}
                      </>
                    ) : (
                      <>New mentor — ratings appear after 3 reviewed sessions.</>
                    )}
                  </p>
                  <p className="mt-1 text-sm">
                    {stats.reliability.display ? (
                      <>
                        Reliability: <strong>{stats.reliability.percent}%</strong> of {stats.reliability.basis} sessions held as planned
                      </>
                    ) : (
                      <>{stats.completed} completed sessions</>
                    )}
                  </p>
                </Card>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {offerings.map((o) => (
                  <Card key={o.id}>
                    <p className="font-semibold">{o.title}</p>
                    <p className="muted text-sm">{o.durationMin} min · Free · Online</p>
                    <p className="prose-user mt-2 text-sm">{o.description}</p>
                    {mentor.acceptingRequests && !isSelf ? (
                      <Link href={`/book/${o.id}`} className="btn btn-primary mt-3">
                        Request this session
                      </Link>
                    ) : null}
                  </Card>
                ))}
              </div>
              {stats?.reviews.length ? (
                <Card>
                  <h2 className="mb-2 font-semibold">What students said</h2>
                  <ul className="space-y-3 text-sm">
                    {stats.reviews.slice(0, 10).map((r) => (
                      <li key={r.id}>
                        <span className="muted">Verified session · {formatDate(r.createdAt)} · </span>
                        {Math.round(((r.helpfulness + r.knowledge + r.respect) / 3) * 10) / 10}/5
                        {r.comment ? <p className="prose-user">{r.comment}</p> : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </section>
          ) : null}

          <section>
            <h2 className="mb-2 font-semibold">Recent posts</h2>
            <Card>
              {posts.length ? (
                <ul className="space-y-2">
                  {posts.map((p) => (
                    <li key={p.id}>
                      <Link href={`/posts/${p.id}`}>{p.title}</Link> <span className="muted text-sm">· {formatDate(p.createdAt)} · {p.answerCount} answers</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted text-sm">No posts yet.</p>
              )}
            </Card>
          </section>
        </div>
        <aside className="space-y-4">
          <Card>
            <h2 className="mb-2 font-semibold">Details</h2>
            <dl className="space-y-1 text-sm">
              {profile?.institution ? (
                <>
                  <dt className="muted">Institution (self-described)</dt>
                  <dd>{profile.institution}</dd>
                </>
              ) : null}
              {profile?.fieldOfStudy ? (
                <>
                  <dt className="muted">Field</dt>
                  <dd>{profile.fieldOfStudy}</dd>
                </>
              ) : null}
              {profile?.location ? (
                <>
                  <dt className="muted">Location</dt>
                  <dd>{profile.location}</dd>
                </>
              ) : null}
              {profile?.languages.length ? (
                <>
                  <dt className="muted">Languages</dt>
                  <dd>{profile.languages.join(", ")}</dd>
                </>
              ) : null}
              {profile?.linkedinUrl ? (
                <dd>
                  <a href={profile.linkedinUrl} rel="nofollow noopener noreferrer ugc me" target="_blank">
                    LinkedIn
                  </a>
                </dd>
              ) : null}
            </dl>
          </Card>
          {byTopic.filter((t) => t.topicId).length ? (
            <Card>
              <h2 className="mb-2 font-semibold">Reputation by topic</h2>
              <ul className="space-y-1 text-sm">
                {byTopic
                  .filter((t) => t.topicId)
                  .map((t) => (
                    <li key={t.topicId} className="flex justify-between gap-2">
                      <span>{t.name}</span>
                      <span>{t.points}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
