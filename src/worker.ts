/**
 * Background worker: runs queued jobs and scheduled maintenance.
 * Start with `npm run worker` (production) or `npm run worker:dev`.
 * Safe to run more than one instance: jobs use SKIP LOCKED and scheduled tasks
 * take a Postgres advisory lock so each runs once per interval cluster-wide.
 */
import "@/lib/cli/load-env"; // must stay first: loads .env before any module reads config
import "@/lib/jobs/handlers";
import { sql } from "drizzle-orm";
import { db, closeDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { processDueJobs } from "@/lib/jobs/queue";
import { SCHEDULE } from "@/lib/jobs/maintenance";

let stopping = false;
const lastRun = new Map<string, number>();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, ts: new Date().toISOString(), ...extra }));
}

async function runScheduled() {
  for (const task of SCHEDULE) {
    const last = lastRun.get(task.name) ?? 0;
    if (Date.now() - last < task.everyMs) continue;
    lastRun.set(task.name, Date.now());
    const lockKey = [...task.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
    const got = await db().execute<{ ok: boolean }>(sql`select pg_try_advisory_lock(${lockKey}) as ok`);
    if (!got.rows[0]?.ok) continue;
    const started = Date.now();
    try {
      const result = await task.run();
      log("info", "scheduled task done", { task: task.name, ms: Date.now() - started, result: typeof result === "object" ? result : String(result ?? "") });
    } catch (err) {
      log("error", "scheduled task failed", { task: task.name, err: err instanceof Error ? err.message : String(err) });
    } finally {
      await db().execute(sql`select pg_advisory_unlock(${lockKey})`);
    }
  }
}

async function main() {
  env(); // fail fast on bad configuration
  log("info", "worker started");
  process.on("SIGTERM", () => (stopping = true));
  process.on("SIGINT", () => (stopping = true));
  while (!stopping) {
    try {
      const ran = await processDueJobs(20);
      await runScheduled();
      if (ran === 0) await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      log("error", "worker loop error", { err: err instanceof Error ? err.message : String(err) });
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  await closeDb();
  log("info", "worker stopped");
}

main().catch((err) => {
  log("error", "worker crashed", { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
