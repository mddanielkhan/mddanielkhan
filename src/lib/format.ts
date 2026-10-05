/**
 * Date formatting for a Bangladeshi audience. Every date is shown in Dhaka time
 * (UTC+6, no DST) regardless of the server's or viewer's timezone, so a session
 * time reads the same for the student, the mentor and the email reminder.
 */
const BD_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });
const BD_DATETIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
const BD_WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short" });
const BD_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: true });

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return BD_DATE.format(typeof d === "string" ? new Date(d) : d);
}
export function formatDateTime(d: Date | null | undefined) {
  if (!d) return "";
  return `${BD_DATETIME.format(d)} (BD time)`;
}
/** "Tue 7 Oct · 05:30 pm" — compact, for schedules. */
export function formatSlot(d: Date | null | undefined) {
  if (!d) return "";
  return `${BD_WEEKDAY.format(d)} · ${BD_TIME.format(d)}`;
}

/** Whole days from today (Dhaka) until a YYYY-MM-DD deadline; negative when past. */
export function daysUntil(deadline: string | Date, now: Date = new Date()) {
  const target = typeof deadline === "string" ? new Date(`${deadline.slice(0, 10)}T23:59:59+06:00`) : deadline;
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

/** "3 days ago" style relative time, falling back to a date after a month. */
export function timeAgo(d: Date, now: Date = new Date()) {
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;
  return formatDate(d);
}
