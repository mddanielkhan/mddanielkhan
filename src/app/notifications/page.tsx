import Link from "next/link";
import { requireActor } from "@/lib/auth/current";
import { listNotifications } from "@/lib/notify/notifications";
import { ActionButton } from "@/components/form";
import { EmptyState, Flash, PageHeader, formatDate, timeAgo } from "@/components/ui";
import { Award, BadgeCheck, Bell, CalendarDays, CheckCheck, Icon, LifeBuoy, MessageSquare, Scale, ShieldCheck, type IconNode } from "@/components/icons";
import { safeBackPath } from "@/lib/http/urls";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Notifications", robots: { index: false } };

type Item = Awaited<ReturnType<typeof listNotifications>>[number];

function iconFor(kind: string): { icon: IconNode; tile: string } {
  if (kind.startsWith("booking") || kind === "session_completed" || kind === "dispute_resolved") return { icon: CalendarDays, tile: "icon-tile" };
  if (kind.startsWith("feedback") || kind.startsWith("answer")) return { icon: MessageSquare, tile: "icon-tile icon-tile-info" };
  if (["moderation", "report_outcome", "fraud_confirmed", "policy", "reversal", "appeal", "role"].includes(kind)) return { icon: Scale, tile: "icon-tile icon-tile-neutral" };
  if (["security", "new_login", "mfa", "password_changed", "email_changed_notice"].includes(kind)) return { icon: ShieldCheck, tile: "icon-tile icon-tile-danger" };
  if (["top_helper", "opportunity_scout", "founding_mentor", "expert_verified", "mentor_review"].includes(kind)) return { icon: Award, tile: "icon-tile icon-tile-gold" };
  if (kind === "opportunity_verified") return { icon: BadgeCheck, tile: "icon-tile" };
  if (kind === "support") return { icon: LifeBuoy, tile: "icon-tile icon-tile-info" };
  return { icon: Bell, tile: "icon-tile icon-tile-neutral" };
}

/** Group by calendar day in Dhaka: Today, Yesterday, then dates. */
function byDay(items: Item[]) {
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86_400_000));
  const groups: Array<{ label: string; items: Item[] }> = [];
  for (const n of items) {
    const d = formatDate(n.createdAt);
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : d;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/notifications");
  const items = await listNotifications(actor.user.id);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread ? (
            <ActionButton action="/api/notifications/read-all" icon={CheckCheck}>
              Mark all read
            </ActionButton>
          ) : null
        }
      />
      <Flash searchParams={await searchParams} />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet" icon={Bell}>
          We&apos;ll let you know about answers, session requests and decisions here.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {byDay(items).map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">{g.label}</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {g.items.map((n) => {
                  const look = iconFor(n.kind);
                  const body = (
                    <>
                      <span className={`${look.tile} h-9 w-9`}>
                        <Icon icon={look.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block leading-snug ${n.readAt ? "font-medium text-ink-soft" : "font-bold text-ink"}`}>{n.title}</span>
                        {n.body ? <span className="prose-user mt-0.5 block text-sm text-muted">{n.body}</span> : null}
                        <span className="mt-1 block text-xs text-muted">{timeAgo(n.createdAt)}</span>
                      </span>
                      {n.readAt ? null : (
                        <>
                          <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
                          <span className="sr-only">Unread</span>
                        </>
                      )}
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link href={safeBackPath(n.link)} className={`flex items-start gap-4 px-5 py-4 no-underline hover:bg-subtle ${n.readAt ? "" : "bg-brand-50/40"}`}>
                          {body}
                        </Link>
                      ) : (
                        <div className={`flex items-start gap-4 px-5 py-4 ${n.readAt ? "" : "bg-brand-50/40"}`}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
