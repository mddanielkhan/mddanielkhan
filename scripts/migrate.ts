/**
 * Apply SQL migrations in ./drizzle. Forward-only: never edit a migration that
 * has been applied anywhere; add a new one (expand → migrate → contract).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://shikor:shikor@localhost:5432/shikor";
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
