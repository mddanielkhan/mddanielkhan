/**
 * One-command local setup:  npm run setup
 *
 *   1. Checks prerequisites (Node version, git-ignored .env).
 *   2. Creates .env from .env.example with fresh, independent secrets
 *      (permissions 600). Never overwrites an existing file or its secrets.
 *   3. Starts PostgreSQL + Mailpit with Docker Compose when Docker is present.
 *   4. Waits for the database, applies migrations, seeds demo data once.
 *   5. Prints demo logins and 2FA QR codes for the seeded staff accounts.
 *
 * Flags:  --no-docker   use DATABASE_URL as-is (your own PostgreSQL)
 *         --no-seed     schema only, no demo data
 *         --reset       wipe the LOCAL database and start over (localhost only)
 *         --help
 *
 * Safe by design: refuses to run with NODE_ENV=production, never prints
 * APP_SECRET or ENCRYPTION_KEY, and only resets a database on this machine.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import QRCode from "qrcode";
import { banner, c, fatal, heading, line, table } from "@/lib/cli/terminal";
import { generateTotpSecret, otpauthUri } from "@/lib/auth/totp";
import { decryptField } from "@/lib/security/crypto";

const ROOT = process.cwd();
const ENV_FILE = resolve(ROOT, ".env");
const EXAMPLE_FILE = resolve(ROOT, ".env.example");
const args = new Set(process.argv.slice(2));
const DEMO_PASSWORD = "demo passphrase for local dev";
const HEX64 = /^[0-9a-f]{64}$/i;

if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: npm run setup [-- --no-docker] [--no-seed] [--reset]

  --no-docker   Don't start Docker services; use DATABASE_URL from .env as-is.
  --no-seed     Apply the schema without demo data.
  --reset       Wipe the local database (localhost only) and set it up again.`);
  process.exit(0);
}

const run = (cmd: string, argv: string[], opts: { quiet?: boolean; env?: NodeJS.ProcessEnv } = {}) =>
  spawnSync(cmd, argv, { stdio: opts.quiet ? "pipe" : "inherit", encoding: "utf8", env: opts.env ?? process.env, shell: process.platform === "win32" });

function setKey(text: string, key: string, value: string) {
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
}

function checkPrerequisites() {
  heading("1. Prerequisites");
  if (process.env.NODE_ENV === "production") fatal("Setup is for local development only.", "In production, provide configuration through your host's secret store and run `npm run doctor`.");
  const [major, minor] = process.versions.node.split(".").map(Number) as [number, number];
  const ok = (major === 22 && minor >= 12) || major >= 24;
  if (!ok) fatal(`Node.js ${process.versions.node} is not supported.`, "Install Node.js 22.12+ (LTS) or 24+, then run `npm ci` and `npm run setup` again.");
  line("ok", `Node.js ${process.versions.node}`);
  const ignored = run("git", ["check-ignore", "-q", ".env"], { quiet: true });
  if (ignored.status === 1) fatal(".env is not git-ignored.", "Add `.env` to .gitignore before continuing — secrets must never be committed.");
  line(ignored.status === 0 ? "ok" : "skip", ".env is git-ignored", ignored.status === 0 ? undefined : "not a git checkout, skipped");
}

/** Docker is usable only if the CLI has Compose AND the daemon answers (an installed CLI alone isn't enough). */
function hasDocker() {
  if (args.has("--no-docker")) return false;
  return run("docker", ["compose", "version"], { quiet: true }).status === 0 && run("docker", ["info", "--format", "{{.ServerVersion}}"], { quiet: true }).status === 0;
}

/** Returns true when this run created .env (so it is safe to adjust defaults in it). */
function ensureEnvFile(): boolean {
  heading("2. Configuration");
  let created = false;
  if (!existsSync(ENV_FILE)) {
    if (!existsSync(EXAMPLE_FILE)) fatal(".env.example is missing.", "Restore it from git: git checkout -- .env.example");
    let text = readFileSync(EXAMPLE_FILE, "utf8");
    text = setKey(text, "APP_SECRET", randomBytes(32).toString("hex"));
    text = setKey(text, "ENCRYPTION_KEY", randomBytes(32).toString("hex"));
    writeFileSync(ENV_FILE, text, { mode: 0o600, flag: "wx" });
    line("ok", "Created .env with two fresh, independent secrets", "never printed, never committed");
    created = true;
  } else {
    let text = readFileSync(ENV_FILE, "utf8");
    const values = parseEnv(text);
    const missing = (["APP_SECRET", "ENCRYPTION_KEY"] as const).filter((k) => !values[k]);
    for (const k of missing) text = setKey(text, k, randomBytes(32).toString("hex"));
    if (missing.length) {
      writeFileSync(ENV_FILE, text, { mode: 0o600 });
      line("ok", `Filled in empty ${missing.join(" and ")}`);
    } else {
      line("ok", "Using your existing .env", "secrets left unchanged");
    }
    const filled = parseEnv(text);
    for (const k of ["APP_SECRET", "ENCRYPTION_KEY"] as const) {
      if (!HEX64.test(filled[k] ?? "")) fatal(`${k} in .env is not 64 hex characters.`, `Replace it with the output of: openssl rand -hex 32\n(Or delete .env and run npm run setup again.)`);
    }
    if (filled.APP_SECRET!.toLowerCase() === filled.ENCRYPTION_KEY!.toLowerCase()) fatal("APP_SECRET and ENCRYPTION_KEY must be different.", "Generate a new value for one of them with: openssl rand -hex 32");
  }
  if (process.platform !== "win32") {
    const mode = statSync(ENV_FILE).mode & 0o777;
    if (mode & 0o077) {
      chmodSync(ENV_FILE, 0o600);
      line("ok", "Restricted .env permissions to your user", `was ${mode.toString(8)}, now 600`);
    } else line("ok", ".env readable only by you", "mode 600");
  }
  process.loadEnvFile(ENV_FILE); // values already in the environment still win
  return created;
}

function startServices(docker: boolean, envCreated: boolean) {
  heading("3. Services");
  if (!docker) {
    line("info", args.has("--no-docker") ? "Docker skipped (--no-docker)" : "Docker not available", "using DATABASE_URL from .env; emails print in the dev server terminal");
    return;
  }
  const r = run("docker", ["compose", "up", "-d", "--wait"], { quiet: true });
  if (r.status !== 0) fatal("Docker Compose could not start the services.", `${(r.stderr || r.stdout || "").trim().split("\n").slice(-4).join("\n")}\nIs Docker running? Or use your own PostgreSQL: npm run setup -- --no-docker`);
  line("ok", "PostgreSQL and Mailpit are running", "docker compose");
  // Only now that Mailpit is confirmed running, route a freshly created .env's email to it.
  if (envCreated) {
    let text = readFileSync(ENV_FILE, "utf8");
    text = setKey(text, "EMAIL_TRANSPORT", "smtp");
    text = setKey(text, "SMTP_URL", "smtp://127.0.0.1:1025");
    writeFileSync(ENV_FILE, text, { mode: 0o600 });
    process.env.EMAIL_TRANSPORT = "smtp";
    process.env.SMTP_URL = "smtp://127.0.0.1:1025";
    line("ok", "Email goes to Mailpit", "http://localhost:8025");
  }
}

async function connect(url: string): Promise<pg.Client> {
  const deadline = Date.now() + 60_000;
  let last: unknown;
  while (Date.now() < deadline) {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      return client;
    } catch (err) {
      last = err;
      await client.end().catch(() => {});
      const code = (err as { code?: string }).code;
      if (code === "28P01" || code === "3D000" || code === "28000") break; // won't fix itself by waiting
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  const code = (last as { code?: string })?.code;
  const hint =
    code === "28P01" ? "The username or password in DATABASE_URL was rejected." : code === "3D000" ? "The database in DATABASE_URL does not exist. Create it, or start the bundled one with Docker." : "Is PostgreSQL running and reachable at DATABASE_URL? With Docker: docker compose up -d";
  fatal("Could not connect to the database.", hint);
}

/**
 * Existing data must be readable with the ENCRYPTION_KEY in .env. If the database was
 * seeded under a different key (e.g. before .env existed), 2FA sign-in would fail with a
 * server error — catch that here with a precise fix instead.
 */
async function assertKeyMatchesData(pool: pg.Pool) {
  const { rows } = await pool.query<{ id: string; enc: string }>("select id, totp_secret_enc as enc from users where totp_secret_enc is not null limit 1");
  if (!rows[0]) return;
  try {
    decryptField(rows[0].enc, `totp:${rows[0].id}`);
    line("ok", "Stored 2FA secrets readable with your ENCRYPTION_KEY");
  } catch {
    fatal(
      "This database was set up with a different ENCRYPTION_KEY.",
      "2FA sign-in would fail. Choose one:\n  • Local demo data:  npm run setup -- --reset   (wipes and recreates it)\n  • Real data:        put the original ENCRYPTION_KEY back in .env",
    );
  }
}

function isLocalDb(url: string) {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

async function prepareDatabase(): Promise<{ seeded: boolean; secrets?: { admin: string; mentor: string } }> {
  heading("4. Database");
  const url = process.env.DATABASE_URL ?? "postgres://shikor:shikor@localhost:5432/shikor";
  const client = await connect(url);
  const { rows } = await client.query<{ v: string }>("select current_setting('server_version') as v");
  const major = Number(rows[0]!.v.split(".")[0]);
  if (major < 16) fatal(`PostgreSQL ${rows[0]!.v} is too old.`, "Shikor needs PostgreSQL 16 or newer.");
  line("ok", `Connected to PostgreSQL ${rows[0]!.v}`, new URL(url).host);

  if (args.has("--reset")) {
    if (!isLocalDb(url)) fatal("Refusing to reset a database that isn't on this machine.", `DATABASE_URL points at ${new URL(url).hostname}. --reset only works for localhost.`);
    await client.query("drop schema if exists drizzle cascade; drop schema public cascade; create schema public;");
    line("ok", "Local database wiped", "--reset");
  }
  await client.end();

  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolve(ROOT, "drizzle") });
    const journal = JSON.parse(readFileSync(resolve(ROOT, "drizzle/meta/_journal.json"), "utf8")) as { entries: unknown[] };
    line("ok", "Schema up to date", `${journal.entries.length} migrations`);
    const { rows: users } = await pool.query<{ n: number }>("select count(*)::int as n from users");
    if (args.has("--no-seed")) {
      line("skip", "Demo data skipped", "--no-seed");
      return { seeded: false };
    }
    if (users[0]!.n > 0) {
      await assertKeyMatchesData(pool);
      line("skip", "Demo data already present", "run with --reset to start fresh");
      return { seeded: false };
    }
  } finally {
    await pool.end();
  }

  const secrets = { admin: generateTotpSecret(), mentor: generateTotpSecret() };
  const r = run(process.execPath, [resolve(ROOT, "node_modules/tsx/dist/cli.mjs"), "scripts/seed.ts"], {
    quiet: true,
    env: { ...process.env, SEED_ADMIN_TOTP: secrets.admin, SEED_MENTOR_TOTP: secrets.mentor },
  });
  if (r.status !== 0) fatal("Seeding demo data failed.", (r.stderr || r.stdout || "").trim().split("\n").slice(-6).join("\n"));
  line("ok", "Demo community created", "mentors, posts, opportunities, sessions, reports");
  return { seeded: true, secrets };
}

async function summary(docker: boolean, result: { seeded: boolean; secrets?: { admin: string; mentor: string } }) {
  console.log("");
  banner("Shikor is ready", "Start the app with:  npm run dev");
  heading("Open");
  table([
    ["What", "Where"],
    ["App", process.env.APP_URL ?? "http://localhost:3000"],
    ...(docker && process.env.EMAIL_TRANSPORT === "smtp" && /:1025\b/.test(process.env.SMTP_URL ?? "")
      ? [["Email inbox (Mailpit)", "http://localhost:8025"]]
      : [["Emails", process.env.EMAIL_TRANSPORT === "file" ? `written to ${process.env.EMAIL_FILE_DIR ?? ".mail-outbox"}/` : process.env.EMAIL_TRANSPORT === "smtp" ? "sent through SMTP_URL" : "printed in the `npm run dev` terminal"]]),
  ]);
  if (result.seeded || !args.has("--no-seed")) {
    heading("Demo accounts");
    table([
      ["Role", "Email", "2FA"],
      ["Student", "student@shikor.local", "—"],
      ["Mentor", "mentor@shikor.local", "required"],
      ["Moderator", "admin@shikor.local", "required"],
    ]);
    console.log(`    Password for every demo account: ${c.bold(DEMO_PASSWORD)}`);
  }
  if (result.secrets) {
    heading("Two-factor setup for the demo mentor and moderator");
    console.log(c.dim("    Scan the code, or type the key, into any authenticator app (Google Authenticator, Microsoft Authenticator, Aegis)."));
    for (const [label, account, secret] of [
      ["Mentor", "mentor@shikor.local", result.secrets.mentor],
      ["Moderator", "admin@shikor.local", result.secrets.admin],
    ] as const) {
      console.log(`\n    ${c.bold(label)} — ${account}`);
      // QR codes need an interactive colour terminal; logs and NO_COLOR get the key only.
      if (process.stdout.isTTY && !process.env.NO_COLOR) {
        const qr = await QRCode.toString(otpauthUri(secret, account, "Shikor (local)"), { type: "terminal", small: true });
        console.log(qr.replace(/^/gm, "    "));
      }
      console.log(`    Key: ${c.cyan(secret.match(/.{1,4}/g)!.join(" "))}`);
    }
  } else if (!args.has("--no-seed")) {
    console.log(c.dim("\n    2FA keys were shown when the demo data was first created. Run `npm run setup -- --reset` to make new ones."));
  }
  heading("Next");
  table([
    ["Command", "What it does"],
    ["npm run dev", "Start the app with hot reload"],
    ["npm run doctor", "Check configuration, database and security settings"],
    ["npm run check", "Lint, typecheck and unit tests"],
    ["npm run setup -- --reset", "Wipe the local database and start over"],
  ]);
  console.log("");
}

async function main() {
  console.log("");
  banner("Shikor setup", "Local development environment");
  checkPrerequisites();
  const docker = hasDocker();
  const envCreated = ensureEnvFile();
  startServices(docker, envCreated);
  const result = await prepareDatabase();
  await summary(docker, result);
}

main().catch((err) => fatal("Setup stopped unexpectedly.", err instanceof Error ? err.message : String(err)));
