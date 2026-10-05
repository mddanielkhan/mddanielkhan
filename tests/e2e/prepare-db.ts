/** Runs before the E2E server starts: fresh schema, migrations, deterministic seed. */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import pg from "pg";
import { ADMIN_TOTP, MENTOR_TOTP } from "./fixtures";

const url = process.env.DATABASE_URL ?? "postgres://peerlink:peerlink@localhost:5432/peerlink_e2e";
if (!/e2e|test/.test(url)) throw new Error(`Refusing to reset a non-test database: ${url}`);

async function main() {
  rmSync(process.env.EMAIL_FILE_DIR ?? "test-results/mail-e2e", { recursive: true, force: true });
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await client.end();
  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: "development", SEED_ADMIN_TOTP: ADMIN_TOTP, SEED_MENTOR_TOTP: MENTOR_TOTP } as NodeJS.ProcessEnv;
  execSync("npx tsx scripts/migrate.ts", { stdio: "inherit", env });
  execSync("npx tsx scripts/seed.ts", { stdio: "inherit", env });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
