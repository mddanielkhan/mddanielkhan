import Link from "next/link";
import { requireActor } from "@/lib/auth/current";
import { listNotifications } from "@/lib/notify/notifications";
import { ActionButton } from "@/components/form";
import { Card, EmptyState, Flash, PageHeader, formatDateTime } from "@/components/ui";
import { safeBackPath } from "@/lib/http/urls";
import type { SearchParams } from "@/lib/http/page";

export const metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/notifications");
  const items = await listNotifications(actor.user.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" actions={items.some((n) => !n.readAt) ? <ActionButton action="/api/notifications/read-all">Mark all read</ActionButton> : null} />
      <Flash searchParams={await searchParams} />
      {items.length === 0 ? <EmptyState title="You're all caught up" /> : null}
      <div className="space-y-2">
        {items.map((n) => (
          <Card key={n.id} className={`p-4 ${n.readAt ? "" : "border-[var(--color-brand-600)]"}`}>
            <p className="font-medium">{n.link ? <Link href={safeBackPath(n.link)}>{n.title}</Link> : n.title}</p>
            {n.body ? <p className="prose-user muted mt-1 text-sm">{n.body}</p> : null}
            <p className="muted mt-1 text-xs">{formatDateTime(n.createdAt)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
