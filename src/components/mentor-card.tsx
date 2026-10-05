import Link from "next/link";
import { Avatar, Pill } from "./ui";

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
  return (
    <article className="card flex flex-col p-4">
      <div className="flex items-start gap-3">
        <Avatar name={m.displayName} size={48} />
        <div className="min-w-0">
          <h3 className="font-semibold">
            <Link href={`/u/${m.username}`}>{m.displayName}</Link>
          </h3>
          <p className="muted text-sm">{m.headline}</p>
          {m.institution ? <p className="text-sm">{m.institution}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <Pill tone="brand" title="Credentials reviewed by a moderator">🛡️ Verified mentor</Pill>
        {m.founding ? <Pill>🌱 Founding</Pill> : null}
        {m.topics.map((t) => (
          <Pill key={t.slug}>{t.name}</Pill>
        ))}
      </div>
      <p className="mt-3 text-sm">
        {m.showRating ? (
          <>
            ⭐ <strong>{m.rating.toFixed(1)}</strong> from {m.reviews} reviews · {m.completed} sessions
          </>
        ) : (
          <>New mentor · {m.completed} sessions</>
        )}
        {m.languages?.length ? <span className="muted"> · {m.languages.join(", ")}</span> : null}
      </p>
      <div className="mt-auto pt-3">
        {m.accepting ? (
          <Link href={`/u/${m.username}#sessions`} className="btn btn-primary">
            Request a free session
          </Link>
        ) : (
          <span className="muted text-sm">Not taking requests right now</span>
        )}
      </div>
    </article>
  );
}
