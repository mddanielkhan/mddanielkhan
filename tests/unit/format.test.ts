import { describe, expect, it } from "vitest";
import { daysUntil, formatDateTime, formatSlot, timeAgo } from "@/lib/format";

// 2026-10-05 10:00 in Dhaka (UTC+6) = 04:00 UTC.
const NOW = new Date("2026-10-05T04:00:00Z");

describe("daysUntil (Dhaka calendar days)", () => {
  it("counts a deadline later today as 1 day (it closes at 23:59 Dhaka time)", () => {
    expect(daysUntil("2026-10-05", NOW)).toBe(1);
  });
  it("counts whole days ahead", () => {
    expect(daysUntil("2026-10-12", NOW)).toBe(8);
  });
  it("is negative once the deadline day has passed in Dhaka", () => {
    expect(daysUntil("2026-10-04", NOW)).toBeLessThan(1);
  });
  it("accepts a full ISO date string by its date part", () => {
    expect(daysUntil("2026-10-12T00:00:00.000Z", NOW)).toBe(8);
  });
});

describe("timeAgo", () => {
  it("handles seconds, minutes, hours and days", () => {
    expect(timeAgo(new Date(NOW.getTime() - 20_000), NOW)).toBe("just now");
    expect(timeAgo(new Date(NOW.getTime() - 5 * 60_000), NOW)).toBe("5 min ago");
    expect(timeAgo(new Date(NOW.getTime() - 3 * 3600_000), NOW)).toBe("3 h ago");
    expect(timeAgo(new Date(NOW.getTime() - 26 * 3600_000), NOW)).toBe("yesterday");
    expect(timeAgo(new Date(NOW.getTime() - 5 * 86_400_000), NOW)).toBe("5 days ago");
  });
  it("falls back to a date after a month", () => {
    expect(timeAgo(new Date("2026-08-01T04:00:00Z"), NOW)).toBe("1 Aug 2026");
  });
  it("never shows a future time as 'in the past'", () => {
    expect(timeAgo(new Date(NOW.getTime() + 60_000), NOW)).toBe("just now");
  });
});

describe("Dhaka time formatting", () => {
  it("formats in UTC+6 regardless of the server timezone", () => {
    const d = new Date("2026-10-07T11:30:00Z"); // 17:30 in Dhaka
    expect(formatSlot(d)).toBe("Wed 7 Oct · 05:30 pm");
    expect(formatDateTime(d)).toBe("7 Oct 2026, 05:30 pm (BD time)");
  });
});
