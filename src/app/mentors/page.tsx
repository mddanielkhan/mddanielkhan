import Link from "next/link";
import { listDirectory } from "@/lib/mentors/service";
import { listTopics } from "@/lib/content/topics";
import { MentorCard } from "@/components/mentor-card";
import { EmptyState, Flash, PageHeader, Section } from "@/components/ui";
import { BadgeCheck, GraduationCap, Icon, KeyRound, ListFilter, Lock, Search } from "@/components/icons";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Verified mentors" };

export default async function MentorsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const topic = sp(params.topic);
  const q = sp(params.q);
  const language = sp(params.language);
  const women = sp(params.women) === "1";
  const [topics, dir] = await Promise.all([listTopics(), listDirectory({ topic, q, language, women })]);
  const filtered = !!(topic || q || language || women);
  const total = dir.established.length + dir.newMentors.length;
  return (
    <>
      <PageHeader
        eyebrow="Verified mentors"
        title="Talk to someone who has done it"
        subtitle="Every mentor here passed a manual credential review and signs in with two-factor authentication. Sessions are always free."
        actions={
          <Link href="/mentors/apply" className="btn btn-secondary">
            <Icon icon={GraduationCap} />
            Become a mentor
          </Link>
        }
      />
      <Flash searchParams={params} />

      <ul className="mb-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        {[
          { icon: BadgeCheck, text: "Credentials checked by a moderator" },
          { icon: KeyRound, text: "Two-factor login on every mentor account" },
          { icon: Lock, text: "Ranked by feedback — never by payment" },
        ].map((x) => (
          <li key={x.text} className="flex items-center gap-2.5 font-medium text-ink-soft">
            <Icon icon={x.icon} className="h-4.5 w-4.5 shrink-0 text-brand-600" />
            {x.text}
          </li>
        ))}
      </ul>

      <form method="get" action="/mentors" role="search" className="card mb-8 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-center">
        <div className="relative">
          <label htmlFor="m-q" className="sr-only">
            Search mentors
          </label>
          <Icon icon={Search} className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
          <input id="m-q" name="q" defaultValue={q} placeholder="Name, university or field" className="input pl-10" maxLength={60} />
        </div>
        <div>
          <label htmlFor="m-topic" className="sr-only">
            Topic
          </label>
          <select id="m-topic" name="topic" defaultValue={topic ?? ""} className="input">
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="m-lang" className="sr-only">
            Language
          </label>
          <input id="m-lang" name="language" defaultValue={language} placeholder="Language, e.g. Bangla" className="input" maxLength={30} />
        </div>
        <label className="choice px-1 text-sm font-medium">
          <input type="checkbox" name="women" value="1" defaultChecked={women} />
          Women mentors
        </label>
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" type="submit">
            <Icon icon={ListFilter} />
            Filter
          </button>
          {filtered ? (
            <Link href="/mentors" className="btn btn-ghost">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {total === 0 ? (
        <EmptyState
          title={filtered ? "No mentors match these filters" : "Our founding mentors are being verified"}
          icon={GraduationCap}
          action={
            <Link href="/posts/new" className="btn btn-primary">
              Ask the community instead
            </Link>
          }
        >
          {filtered ? "Try fewer filters — or post your question in the community, where mentors also answer." : "Check back soon, or post your question in the community."}
        </EmptyState>
      ) : null}

      {dir.established.length ? (
        <Section title="Rated by students" description="Ordered by verified-session feedback and reliability." className="mb-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dir.established.map((m) => (
              <MentorCard key={m.userId} m={m} />
            ))}
          </div>
        </Section>
      ) : null}
      {dir.newMentors.length ? (
        <Section title="New verified mentors" description="Fewer than 3 reviews so far — the same verification, and often more availability.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dir.newMentors.map((m) => (
              <MentorCard key={m.userId} m={m} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
