import Link from "next/link";
import { Avatar, Pill, Stars } from "./ui";
import { BadgeCheck, Building, Icon, Languages, Sprout } from "./icons";

export type MentorCardData = {
  userId: string;
  username: string;
  displayName: string;
  headline: string;
  institution: string | null;
  languages: string[] | null;
  accepting: boolean;
  founding: boolean;
  rating: number;
  reviews: number;
  completed: number;
  showRating: boolean;
  topics: Array<{ name: string; slug: string }>;
};

export function MentorCard({ m }: { m: MentorCardData }) {
  const extraTopics = Math.max(0, m.topics.length - 3);
  return (
    <article className="card card-interactive relative flex flex-col p-5">
      <div className="flex items-start gap-4">
        <Avatar name={m.displayName} size={56} />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-base font-bold leading-snug">
            <Link href={`/u/${m.username}`} className="text-ink no-underline after:absolute after:inset-0 after:rounded-[var(--radius-card)] hover:text-brand-ink">
              {m.displayName}
            </Link>
            <Icon icon={BadgeCheck} className="h-4.5 w-4.5 shrink-0 text-brand-600" label="Verified mentor" />
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">{m.headline}</p>
          {m.institution ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <Icon icon={Building} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{m.institution}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {m.founding ? (
          <Pill tone="gold" icon={Sprout}>
            Founding mentor
          </Pill>
        ) : null}
        {m.topics.slice(0, 3).map((t) => (
          <Pill key={t.slug}>{t.name}</Pill>
        ))}
        {extraTopics ? <Pill>+{extraTopics}</Pill> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {m.showRating ? (
          <span className="flex items-center gap-2">
            <Stars score={m.rating} />
            <strong className="tabular-nums">{m.rating.toFixed(1)}</strong>
            <span className="text-muted">({m.reviews} reviews)</span>
          </span>
        ) : (
          <Pill tone="info">New mentor</Pill>
        )}
        <span className="text-muted">
          {m.completed} {m.completed === 1 ? "session" : "sessions"}
        </span>
      </div>
      {m.languages?.length ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <Icon icon={Languages} className="h-3.5 w-3.5" />
          {m.languages.join(", ")}
        </p>
      ) : null}

      <div className="mt-auto pt-5">
        {m.accepting ? (
          <Link href={`/u/${m.username}#sessions`} className="btn btn-primary relative z-10 w-full">
            Request a free session
          </Link>
        ) : (
          <p className="rounded-lg bg-subtle px-3 py-2 text-center text-sm text-muted">Not taking requests right now</p>
        )}
      </div>
    </article>
  );
}
