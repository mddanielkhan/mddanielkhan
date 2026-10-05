import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { env } from "@/lib/env";

/**
 * Postgres-backed job queue (FOR UPDATE SKIP LOCKED). One fewer service than
 * Redis/BullMQ to run, secure and back up. Enqueue inside the business
 * transaction (outbox pattern): either the change AND its email happen, or
 * neither does.
 */

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;
const handlers = new Map<string, JobHandler>();

export function registerJob(kind: string, handler: JobHandler) {
  handlers.set(kind, handler);
}

export async function enqueue(kind: string, payload: Record<string, unknown>, opts: { runAt?: Date; tx?: DbOrTx } = {}) {
  const tx = opts.tx ?? db();
  const [row] = await tx.insert(jobs).values({ kind, payload, runAt: opts.runAt ?? new Date() }).returning({ id: jobs.id });
  if (env().JOBS_INLINE && !opts.tx && handlers.has(kind)) {
    // Test/dev convenience only (refused in production by env validation).
    await runJob(row!.id);
  }
  return row!.id;
}

async function runJob(id: number) {
  const [job] = await db().select().from(jobs).where(eq(jobs.id, id));
  if (!job || job.doneAt) return;
  const handler = handlers.get(job.kind);
  if (!handler) return;
  try {
    await handler(job.payload);
    await db().update(jobs).set({ doneAt: new Date(), attempts: job.attempts + 1 }).where(eq(jobs.id, id));
  } catch (err) {
    await db()
      .update(jobs)
      .set({ attempts: job.attempts + 1, lastError: err instanceof Error ? err.message.slice(0, 500) : "error" })
      .where(eq(jobs.id, id));
  }
}

/** Claim and run up to `limit` due jobs. Returns how many ran. */
export async function processDueJobs(limit = 10): Promise<number> {
  const claimed = await db().execute<{ id: number; kind: string; payload: Record<string, unknown>; attempts: number; max_attempts: number }>(sql`
    update jobs set locked_at = now()
    where id in (
      select id from jobs
      where done_at is null and failed_at is null and run_at <= now()
        and (locked_at is null or locked_at < now() - interval '5 minutes')
      order by run_at
      limit ${limit}
      for update skip locked
    )
    returning id, kind, payload, attempts, max_attempts
  `);
  for (const job of claimed.rows) {
    const handler = handlers.get(job.kind);
    const attempts = job.attempts + 1;
    try {
      if (!handler) throw new Error(`no handler for ${job.kind}`);
      await handler(job.payload);
      await db().update(jobs).set({ doneAt: new Date(), attempts, lockedAt: null }).where(eq(jobs.id, job.id));
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : "error";
      const exhausted = attempts >= job.max_attempts;
      // Exponential backoff: 30s, 1m, 2m, 4m … capped at 1h.
      const delayMs = Math.min(3600_000, 30_000 * 2 ** (attempts - 1));
      await db()
        .update(jobs)
        .set({
          attempts,
          lastError: message,
          lockedAt: null,
          runAt: new Date(Date.now() + delayMs),
          ...(exhausted ? { failedAt: new Date() } : {}),
        })
        .where(eq(jobs.id, job.id));
      console.error(JSON.stringify({ level: exhausted ? "error" : "warn", msg: "job failed", kind: job.kind, id: job.id, attempts, err: message }));
    }
  }
  return claimed.rows.length;
}

export async function failedJobCount() {
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(isNull(jobs.doneAt), sql`${jobs.failedAt} is not null`));
  return r?.n ?? 0;
}

export async function purgeOldJobs() {
  await db().execute(sql`delete from jobs where done_at < now() - interval '14 days' or failed_at < now() - interval '60 days'`);
}
