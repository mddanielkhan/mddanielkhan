import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { listOpportunities } from "@/lib/content/service";
import { env } from "@/lib/env";
import { BRAND } from "@/lib/config/brand";

/** Subscribable deadline calendar (RFC 5545). Only moderator-verified opportunities. */
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export const GET = defineRoute({
  method: "GET",
  auth: { kind: "public" },
  schema: z.object({}).passthrough(),
  handler: async () => {
    const items = (await listOpportunities({ verifiedOnly: true })).filter((o) => o.deadline);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${BRAND.name}//Verified deadlines//EN`, "CALSCALE:GREGORIAN", `X-WR-CALNAME:${BRAND.name} verified deadlines`];
    for (const o of items) {
      const d = o.deadline!.replace(/-/g, "");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${o.id}@${new URL(env().APP_URL).hostname}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${d}`,
        `SUMMARY:${esc(`Deadline: ${o.title}`)}`,
        `DESCRIPTION:${esc(`${o.orgName ?? ""} — verified by ${BRAND.name} moderators. Always confirm on the official site: ${o.officialUrl ?? ""}`)}`,
        `URL:${env().APP_URL}/posts/${o.id}`,
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    return { body: lines.join("\r\n"), contentType: "text/calendar; charset=utf-8", headers: { "cache-control": "public, max-age=900" } };
  },
});
