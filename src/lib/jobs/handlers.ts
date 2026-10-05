/**
 * Registers every job handler. Imported by the worker (and by the request
 * pipeline in JOBS_INLINE dev/test mode) so the same handlers run everywhere.
 */
import "@/lib/notify/email";
import { eq } from "drizzle-orm";
import { registerJob } from "./queue";
import { db } from "@/lib/db/client";
import { bookings } from "@/lib/db/schema";
import { notify } from "@/lib/notify/notifications";

registerJob("booking_reminder", async (payload) => {
  const [b] = await db().select().from(bookings).where(eq(bookings.id, String(payload.bookingId)));
  if (!b || b.status !== "accepted" || !b.scheduledAt) return;
  // Only remind for the slot the reminder was scheduled for (reschedules create new reminders).
  if (payload.scheduledAt && new Date(String(payload.scheduledAt)).getTime() !== b.scheduledAt.getTime()) return;
  const when = payload.kind === "1h" ? "in about an hour" : "tomorrow";
  for (const userId of [b.mentorId, b.menteeId]) {
    await notify(userId, { kind: "booking_reminder", title: `Reminder: your session starts ${when}`, link: `/bookings/${b.id}`, email: true });
  }
});
