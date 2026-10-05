import Link from "next/link";
import { Avatar, DeadlinePill, Pill, PostTypeBadge, TrustPill, formatDate, timeAgo } from "./ui";
import { BadgeCheck, CircleCheck, Icon, Landmark, MessageSquare, ThumbsUp, TriangleAlert } from "./icons";

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

/** A feed item. The title link is stretched over the whole card; inner links sit above it. */
export function PostCard({ p, compact = false }: { p: PostCardData; compact?: boolean }) {
  return (
    <article className={`card card-interactive relative ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <PostTypeBadge type={p.type} />
        {p.type === "opportunity" ? (
          p.verifiedAt ? (
            <Pill tone="brand" icon={BadgeCheck} title="A moderator checked this against the official source">
              Verified
            </Pill>
          ) : (
            <Pill tone="warn" icon={TriangleAlert} title="Not yet checked by a moderator — always confirm on the official website">
              Unverified
            </Pill>
          )
        ) : null}
        {p.status === "flagged" ? (
          <Pill tone="warn" icon={TriangleAlert} title="Members reported this post. A moderator is reviewing it — be careful.">
            Under review
          </Pill>
        ) : null}
        {p.acceptedAnswerId ? (
          <Pill tone="brand" icon={CircleCheck}>
            Answered
          </Pill>
        ) : null}
        <Link href={`/feed?topic=${p.topicSlug}`} className="relative z-10 text-xs font-semibold text-muted no-underline hover:text-ink">
          {p.topicName}
        </Link>
      </div>
      <h3 className={`mt-2.5 font-bold leading-snug ${compact ? "text-base" : "text-[1.0625rem]"}`}>
        <Link href={`/posts/${p.id}`} className="text-ink no-underline after:absolute after:inset-0 after:rounded-[var(--radius-card)] hover:text-brand-ink">
          {p.title}
        </Link>
      </h3>
      {p.orgName ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-ink-soft">
          <Icon icon={Landmark} className="h-4 w-4 text-muted" />
          {p.orgName}
          {p.deadline ? (
            <>
              <span className="text-muted">· Deadline {formatDate(p.deadline)}</span>
              <DeadlinePill deadline={p.deadline} />
            </>
          ) : null}
        </p>
      ) : null}
      {compact ? null : <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{p.body}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <Avatar name={p.authorName} size={24} />
          <Link href={`/u/${p.authorUsername}`} className="relative z-10 font-semibold text-ink-soft no-underline hover:text-ink hover:underline">
            {p.authorName}
          </Link>
          {compact ? null : <TrustPill level={p.authorTrust} />}
        </span>
        <span>{timeAgo(p.createdAt)}</span>
        <span className="flex items-center gap-1" title="Answers">
          <Icon icon={MessageSquare} className="h-3.5 w-3.5" />
          {p.answerCount}
          <span className="sr-only"> answers</span>
        </span>
        <span className="flex items-center gap-1" title="Found helpful">
          <Icon icon={ThumbsUp} className="h-3.5 w-3.5" />
          {p.helpfulCount}
          <span className="sr-only"> found helpful</span>
        </span>
        {compact
          ? null
          : p.tags.slice(0, 3).map((t) => (
              <span key={t} className="font-medium">
                #{t}
              </span>
            ))}
      </div>
    </article>
  );
}
