import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db/client";
import { notifications, profiles, users } from "@/lib/db/schema";
import { appLink, sendEmail } from "./email";

/**
 * In-app notifications, optionally mirrored to email (respecting the user's
 * preference). Titles are composed from fixed templates — never user text.
 */
export async function notify(
  userId: string,
  n: { kind: string; title: string; body?: string; link?: string; email?: boolean },
  tx: DbOrTx = db(),
) {
  await tx.insert(notifications).values({ userId, kind: n.kind, title: n.title, body: n.body ?? "", link: n.link ?? null });
  if (n.email) {
    const [u] = await tx
      .select({ email: users.email, status: users.status, wants: profiles.emailNotifications, verified: users.emailVerifiedAt })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, userId));
    if (u && u.status !== "deleted" && u.verified && u.wants !== false) {
      await sendEmail(u.email, { kind: "notification", title: n.title, link: appLink(n.link ?? "/notifications") }, tx);
    }
  }
}

export async function unreadCount(userId: string) {
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function listNotifications(userId: string, limit = 50) {
  return db().select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markAllRead(userId: string) {
  await db().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
