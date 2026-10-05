import Link from "next/link";
import { Pill, POST_TYPE_LABEL, TrustPill, formatDate } from "./ui";

export type PostCardData = {
  id: string;
  type: string;
  title: string;
  body: string;
  tags: string[];
  answerCount: number;
  helpfulCount: number;
  acceptedAnswerId: string | null;
  verifiedAt: Date | null;
  deadline: string | null;
  orgName: string | null;
  createdAt: Date;
  topicSlug: string;
  topicName: string;
  authorUsername: string;
  authorName: string;
  authorTrust: number;
  status: string;
};

export function PostCard({ p }: { p: PostCardData }) {
  return (
    <article className="card p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <Pill tone={p.type === "opportunity" ? "info" : p.type === "safety_alert" ? "danger" : "neutral"}>{POST_TYPE_LABEL[p.type] ?? p.type}</Pill>
        {p.type === "opportunity" ? (
          p.verifiedAt ? (
            <Pill tone="brand" title="A moderator checked this against the official source">
              ✓ Verified opportunity
            </Pill>
          ) : (
            <Pill tone="warn" title="Not yet checked by a moderator — always confirm on the official website">
              Unverified — check the official site
            </Pill>
          )
        ) : null}
        {p.acceptedAnswerId ? <Pill tone="brand">✓ Answered</Pill> : null}
        <Link href={`/feed?topic=${p.topicSlug}`} className="muted">
          {p.topicName}
        </Link>
      </div>
      <h2 className="text-lg font-semibold leading-snug">
        <Link href={`/posts/${p.id}`} className="text-[var(--color-ink)] no-underline hover:underline">
          {p.title}
        </Link>
      </h2>
      {p.orgName ? <p className="text-sm font-medium">{p.orgName}{p.deadline ? ` · Deadline ${formatDate(p.deadline)}` : ""}</p> : null}
      <p className="muted mt-1 line-clamp-2 text-sm">{p.body}</p>
      <div className="muted mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span>
          by <Link href={`/u/${p.authorUsername}`}>{p.authorName}</Link>
        </span>
        <TrustPill level={p.authorTrust} />
        <span>{formatDate(p.createdAt)}</span>
        <span>{p.answerCount} answers</span>
        <span>{p.helpfulCount} found helpful</span>
        {p.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
      </div>
    </article>
  );
}
