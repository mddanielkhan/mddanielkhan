import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle has the same query API as the db. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as { __shikorPool?: pg.Pool; __shikorDb?: Db };

function createPool() {
  const pool = new pg.Pool({
    connectionString: env().DATABASE_URL,
    max: env().DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Bound runaway queries: a slow query must never hold a connection forever.
    statement_timeout: 15_000,
    application_name: "shikor",
  });
  pool.on("error", (err) => {
    console.error(JSON.stringify({ level: "error", msg: "pg pool error", err: err.message }));
  });
  return pool;
}

export function pool(): pg.Pool {
  if (!globalForDb.__shikorPool) globalForDb.__shikorPool = createPool();
  return globalForDb.__shikorPool;
}

export function db(): Db {
  if (!globalForDb.__shikorDb) globalForDb.__shikorDb = drizzle(pool(), { schema });
  return globalForDb.__shikorDb;
}

export async function closeDb() {
  await globalForDb.__shikorPool?.end();
  globalForDb.__shikorPool = undefined;
  globalForDb.__shikorDb = undefined;
}

export { schema };
