import Link from "next/link";
import { listFeed, listOpportunities } from "@/lib/content/service";
import { listDirectory } from "@/lib/mentors/service";
import { PostCard } from "@/components/post-card";
import { Avatar, Card, Flash, formatDate } from "@/components/ui";
import { BRAND } from "@/lib/config/brand";
import { getActor } from "@/lib/auth/current";
import type { SearchParams } from "@/lib/http/page";

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const [actor, feed, opps, mentors] = await Promise.all([getActor(), listFeed({ sort: "new" }), listOpportunities({ verifiedOnly: true }), listDirectory({})]);
  const featured = [...mentors.established, ...mentors.newMentors].slice(0, 6);
  return (
    <>
      <Flash searchParams={await searchParams} />
      <section className="mb-10 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <p className="mb-2 font-semibold text-[var(--color-brand-700)]">
            {BRAND.nameBn} · {BRAND.name}
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Honest help with studies, admissions, scholarships and careers — from people we&apos;ve verified.</h1>
          <p className="muted mt-4 text-lg">{BRAND.taglineBn}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {actor ? (
              <Link href="/posts/new" className="btn btn-primary">
                Ask a question
              </Link>
            ) : (
              <Link href="/register" className="btn btn-primary">
                Join free
              </Link>
            )}
            <Link href="/mentors" className="btn btn-secondary">
              Find a verified mentor
            </Link>
            <Link href="/opportunities" className="btn btn-secondary">
              Verified opportunities
            </Link>
          </div>
        </div>
        <Card className="bg-[var(--color-brand-50)]">
          <h2 className="mb-3 font-semibold">How we keep you safe</h2>
          <ul className="space-y-2 text-sm">
            <li>🔒 <strong>Sessions are free.</strong> Nobody here may ask you for money.</li>
            <li>🛡️ <strong>Mentors are reviewed by people</strong>, not self-declared — and must use 2-factor login.</li>
            <li>✓ <strong>Opportunities are checked</strong> against official sources before they get a checkmark.</li>
            <li>⭐ <strong>Ratings come only from completed sessions</strong> — they can&apos;t be bought or faked with drive-by reviews.</li>
            <li>⚖️ <strong>Every decision can be appealed</strong>, and we publish our enforcement numbers.</li>
          </ul>
          <Link href="/safety" className="mt-3 inline-block text-sm font-semibold">
            Learn the scam red flags →
          </Link>
        </Card>
      </section>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="latest">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="latest" className="text-xl font-bold">
              Latest from the community
            </h2>
            <Link href="/feed">See all →</Link>
          </div>
          <div className="space-y-3">
            {feed.items.slice(0, 8).map((p) => (
              <PostCard key={p.id} p={p} />
            ))}
            {feed.items.length === 0 ? <Card>No posts yet — be the first to ask a question.</Card> : null}
          </div>
        </section>
        <aside className="space-y-8">
          <section aria-labelledby="opps">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="opps" className="text-xl font-bold">
                Verified deadlines
              </h2>
              <Link href="/opportunities">All →</Link>
            </div>
            <Card className="space-y-3">
              {opps.slice(0, 6).map((o) => (
                <div key={o.id}>
                  <Link href={`/posts/${o.id}`} className="font-medium">
                    {o.title}
                  </Link>
                  <p className="muted text-sm">
                    {o.orgName} {o.deadline ? `· ${formatDate(o.deadline)}` : ""}
                  </p>
                </div>
              ))}
              {opps.length === 0 ? <p className="muted text-sm">No verified opportunities yet.</p> : null}
            </Card>
          </section>
          <section aria-labelledby="mentors">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="mentors" className="text-xl font-bold">
                Verified mentors
              </h2>
              <Link href="/mentors">All →</Link>
            </div>
            <Card className="space-y-3">
              {featured.map((m) => (
                <Link key={m.userId} href={`/u/${m.username}`} className="flex items-center gap-3 text-[var(--color-ink)] no-underline">
                  <Avatar name={m.displayName} size={36} />
                  <span>
                    <span className="block font-medium">{m.displayName}</span>
                    <span className="muted block text-sm">{m.headline}</span>
                  </span>
                </Link>
              ))}
              {featured.length === 0 ? <p className="muted text-sm">Our founding mentors are being verified.</p> : null}
            </Card>
          </section>
        </aside>
      </div>
    </>
  );
}
