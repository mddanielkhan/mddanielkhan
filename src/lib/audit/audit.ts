import { createHash } from "node:crypto";
import { asc, desc, gt, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db/client";
import { auditIp, auditLog } from "@/lib/db/schema";

/**
 * Hash-chained, append-only audit log.
 *
 *   hash_n = SHA-256( hash_{n-1} || canonical(entry_n) )
 *
 * Any edit, deletion or re-ordering of a past row breaks every later hash, so
 * tampering by anyone with database access (including a compromised admin)
 * becomes detectable by `npm run audit:verify` and the nightly job.
 *
 * Appends are serialised with a transaction-scoped advisory lock. That is fine
 * for Phase-1 volumes (security/governance events, not page views).
 */

export const GENESIS_HASH = "0".repeat(64);
const AUDIT_LOCK_KEY = 0x5348_4b52; // "SHKR"

export type AuditEvent = {
  action: string;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  ipHash?: string | null;
};

const SENSITIVE_KEY = /pass(word)?|secret|token|otp|code|cookie|authorization/i;

/** Remove anything secret-looking before it can reach the log. */
export function redactMeta(meta: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[redacted]";
    } else if (v instanceof Date) {
      // Must match what jsonb returns on read, or chain verification would fail.
      out[k] = v.toISOString();
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactMeta(v as Record<string, unknown>);
    } else if (typeof v === "string" && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Deterministic JSON: sorted keys at every level. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function computeHash(
  prevHash: string,
  entry: { occurredAt: Date; actorId: string | null; action: string; targetType: string | null; targetId: string | null; meta: Record<string, unknown> },
): string {
  const payload = canonicalJson({
    occurredAt: entry.occurredAt.toISOString(),
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    meta: entry.meta,
  });
  return createHash("sha256").update(prevHash).update("\n").update(payload).digest("hex");
}

async function appendWith(tx: DbOrTx, event: AuditEvent) {
  await tx.execute(sql`select pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`);
  const [last] = await tx.select({ hash: auditLog.hash }).from(auditLog).orderBy(desc(auditLog.id)).limit(1);
  const prevHash = last?.hash ?? GENESIS_HASH;
  // Millisecond precision: Postgres stores microseconds, JS has milliseconds — keep them identical.
  const occurredAt = new Date(Math.floor(Date.now()));
  const entry = {
    occurredAt,
    actorId: event.actorId ?? null,
    action: event.action,
    targetType: event.targetType ?? null,
    targetId: event.targetId ?? null,
    meta: redactMeta(event.meta),
  };
  const hash = computeHash(prevHash, entry);
  const [row] = await tx
    .insert(auditLog)
    .values({ ...entry, prevHash, hash })
    .returning({ id: auditLog.id });
  if (row && event.ipHash) await tx.insert(auditIp).values({ auditId: row.id, ipHash: event.ipHash });
}

/**
 * Append an audit event. Pass a transaction to make the audit record atomic
 * with the business change it describes (preferred for state changes).
 */
export async function audit(event: AuditEvent, tx?: DbOrTx): Promise<void> {
  if (tx) {
    await appendWith(tx, event);
    return;
  }
  await db().transaction(async (t) => appendWith(t, event));
}

export type ChainVerification = { ok: true; checked: number } | { ok: false; checked: number; brokenAtId: number; reason: string };

/** Walk the whole chain in id order, recomputing every hash. */
export async function verifyAuditChain(batchSize = 1000): Promise<ChainVerification> {
  let prevHash = GENESIS_HASH;
  let lastId = 0;
  let checked = 0;
  for (;;) {
    const rows = await db().select().from(auditLog).where(gt(auditLog.id, lastId)).orderBy(asc(auditLog.id)).limit(batchSize);
    if (rows.length === 0) return { ok: true, checked };
    for (const row of rows) {
      if (row.prevHash !== prevHash) return { ok: false, checked, brokenAtId: row.id, reason: "prev_hash mismatch (row removed or reordered)" };
      const expected = computeHash(prevHash, {
        occurredAt: row.occurredAt,
        actorId: row.actorId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        meta: row.meta,
      });
      if (expected !== row.hash) return { ok: false, checked, brokenAtId: row.id, reason: "hash mismatch (row modified)" };
      prevHash = row.hash;
      lastId = row.id;
      checked++;
    }
  }
}
