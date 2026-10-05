import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle has the same query API as the db. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as { __peerlinkPool?: pg.Pool; __peerlinkDb?: Db };

function createPool() {
  const pool = new pg.Pool({
    connectionString: env().DATABASE_URL,
    max: env().DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Bound runaway queries: a slow query must never hold a connection forever.
    statement_timeout: 15_000,
    application_name: "peerlink",
  });
  pool.on("error", (err) => {
    console.error(JSON.stringify({ level: "error", msg: "pg pool error", err: err.message }));
  });
  return pool;
}

export function pool(): pg.Pool {
  if (!globalForDb.__peerlinkPool) globalForDb.__peerlinkPool = createPool();
  return globalForDb.__peerlinkPool;
}

export function db(): Db {
  if (!globalForDb.__peerlinkDb) globalForDb.__peerlinkDb = drizzle(pool(), { schema });
  return globalForDb.__peerlinkDb;
}

export async function closeDb() {
  await globalForDb.__peerlinkPool?.end();
  globalForDb.__peerlinkPool = undefined;
  globalForDb.__peerlinkDb = undefined;
}

export { schema };
