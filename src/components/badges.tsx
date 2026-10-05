import Link from "next/link";
import { BADGE_INFO } from "@/lib/trust/badges";
import { formatDate } from "./ui";
import { BadgeCheck, Briefcase, Compass, GraduationCap, Handshake, Icon, Medal, Scale, Sprout, Star, type IconNode } from "./icons";

type Kind = keyof typeof BADGE_INFO;

export const BADGE_ICON: Record<Kind, { icon: IconNode; tile: string }> = {
  institution_email: { icon: GraduationCap, tile: "icon-tile" },
  professional_verified: { icon: Briefcase, tile: "icon-tile" },
  expert_verified: { icon: BadgeCheck, tile: "icon-tile" },
  founding_mentor: { icon: Sprout, tile: "icon-tile icon-tile-gold" },
  moderator: { icon: Scale, tile: "icon-tile icon-tile-info" },
  sessions_10: { icon: Handshake, tile: "icon-tile icon-tile-gold" },
  sessions_50: { icon: Handshake, tile: "icon-tile icon-tile-gold" },
  sessions_100: { icon: Medal, tile: "icon-tile icon-tile-gold" },
  top_helper: { icon: Star, tile: "icon-tile icon-tile-gold" },
  opportunity_scout: { icon: Compass, tile: "icon-tile icon-tile-gold" },
};

/** A badge as a verifiable fact: links to its public credential page. */
export function BadgeCard({ b }: { b: { id: string; kind: Kind; label: string; grantedAt: Date } }) {
  const info = BADGE_INFO[b.kind];
  const look = BADGE_ICON[b.kind];
  return (
    <Link href={`/v/${b.id}`} className="card card-interactive flex items-start gap-3 p-4 no-underline" title={info.meaning}>
      <span className={look.tile}>
        <Icon icon={look.icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">{info.title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          {b.label} · {formatDate(b.grantedAt)}
        </span>
        <span className="mt-1 block text-xs font-semibold text-brand-ink">View credential →</span>
      </span>
    </Link>
  );
}
