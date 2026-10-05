// Production migration runner (plain JS, no tsx): applies ./drizzle, then re-grants the runtime role.
// Run as the OWNER role:  DATABASE_URL=$OWNER_URL node scripts/migrate.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
  if (process.env.GRANT_APP_ROLE === "true") {
    await pool.query(readFileSync("./deploy/postgres/grant-app.sql", "utf8"));
    console.log("runtime role grants refreshed");
  }
} finally {
  await pool.end();
}
