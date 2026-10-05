import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { siteSettings } from "@/lib/db/schema";
import { audit } from "@/lib/audit/audit";

/**
 * Runtime kill switches (incident response without a deploy). Defaults are
 * "open"; an admin flips a switch in /mod/settings and the change is audited.
 */
export const KILL_SWITCHES = {
  registrations_paused: "Pause new registrations",
  posting_paused: "Pause new posts and answers (read-only community)",
  opportunities_paused: "Pause new opportunity posts",
  bookings_paused: "Pause new booking requests",
} as const;

export type KillSwitch = keyof typeof KILL_SWITCHES;

let cache: { at: number; values: Map<string, unknown> } | undefined;
const TTL_MS = 10_000;

export async function getSettings(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const rows = await db().select().from(siteSettings);
  cache = { at: Date.now(), values: new Map(rows.map((r) => [r.key, r.value])) };
  return cache.values;
}

export async function isPaused(sw: KillSwitch): Promise<boolean> {
  return (await getSettings()).get(sw) === true;
}

export async function setSwitch(sw: KillSwitch, value: boolean, actorId: string) {
  await db()
    .insert(siteSettings)
    .values({ key: sw, value, updatedBy: actorId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
  cache = undefined;
  await audit({ action: "settings.kill_switch", actorId, targetType: "setting", targetId: sw, meta: { value } });
}

export function invalidateSettingsCache() {
  cache = undefined;
}

export async function getSetting(key: string) {
  const [row] = await db().select().from(siteSettings).where(eq(siteSettings.key, key));
  return row?.value;
}
