/**
 * Apply SQL migrations in ./drizzle. Forward-only: never edit a migration that
 * has been applied anywhere; add a new one (expand → migrate → contract).
 */
import "@/lib/cli/load-env"; // must stay first: loads .env before any module reads config
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://peerlink:peerlink@localhost:5432/peerlink";
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
