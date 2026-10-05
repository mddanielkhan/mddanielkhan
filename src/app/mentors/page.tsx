import Link from "next/link";
import { listDirectory } from "@/lib/mentors/service";
import { listTopics } from "@/lib/content/topics";
import { MentorCard } from "@/components/mentor-card";
import { EmptyState, Flash, PageHeader } from "@/components/ui";
import { sp, type SearchParams } from "@/lib/http/page";

export const metadata = { title: "Verified mentors" };

export default async function MentorsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const topic = sp(params.topic);
  const q = sp(params.q);
  const language = sp(params.language);
  const women = sp(params.women) === "1";
  const [topics, dir] = await Promise.all([listTopics(), listDirectory({ topic, q, language, women })]);
  return (
    <>
      <PageHeader
        title="Verified mentors"
        subtitle="Every mentor here passed a manual credential review and uses two-factor login. Sessions are free. Ranking is based only on completed-session feedback and reliability — never on payment."
        actions={
          <Link href="/mentors/apply" className="btn btn-secondary">
            Become a mentor
          </Link>
        }
      />
      <Flash searchParams={params} />
      <form method="get" action="/mentors" className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <input name="q" defaultValue={q} placeholder="Name, university, field…" className="input" aria-label="Search mentors" maxLength={60} />
        <select name="topic" defaultValue={topic ?? ""} className="input" aria-label="Topic">
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.nameEn}
            </option>
          ))}
        </select>
        <input name="language" defaultValue={language} placeholder="Language (e.g. Bangla)" className="input" aria-label="Language" maxLength={30} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="women" value="1" defaultChecked={women} /> Women mentors
        </label>
        <button className="btn btn-primary" type="submit">
          Filter
        </button>
      </form>
      {dir.established.length + dir.newMentors.length === 0 ? (
        <EmptyState title="No mentors match yet">Try fewer filters — or post your question in the community.</EmptyState>
      ) : null}
      {dir.established.length ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Rated by students</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dir.established.map((m) => (
              <MentorCard key={m.userId} m={m} />
            ))}
          </div>
        </section>
      ) : null}
      {dir.newMentors.length ? (
        <section>
          <h2 className="mb-1 text-lg font-bold">New verified mentors</h2>
          <p className="muted mb-3 text-sm">Fewer than 3 reviews so far. Same verification, fresh availability.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dir.newMentors.map((m) => (
              <MentorCard key={m.userId} m={m} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
