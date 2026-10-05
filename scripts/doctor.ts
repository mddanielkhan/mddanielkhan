/**
 * Health and security check for any environment:  npm run doctor
 * (production image: node dist/doctor.mjs)
 *
 * Read-only. Never prints secret values — only whether they are acceptable.
 * Exit code 0 when everything passes (warnings allowed), 1 on any failure,
 * so it can gate a deploy or run in monitoring.
 */
import "@/lib/cli/load-env"; // must stay first: loads .env before any module reads config
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { sql } from "drizzle-orm";
import { createTransport } from "nodemailer";
import { banner, c, heading, line, type Status } from "@/lib/cli/terminal";

const results: Status[] = [];
const report = (status: Status, label: string, detail?: string) => {
  results.push(status);
  line(status, label, detail);
};

async function main() {
  console.log("");
  banner("PeerLink doctor", "Configuration, database and security checks");

  heading("Runtime");
  const [major, minor] = process.versions.node.split(".").map(Number) as [number, number];
  const nodeOk = (major === 22 && minor >= 12) || major >= 24;
  report(nodeOk ? "ok" : "fail", `Node.js ${process.versions.node}`, nodeOk ? undefined : "needs 22.12+ or 24+");

  const envFile = resolve(process.cwd(), ".env");
  if (existsSync(envFile)) {
    report("ok", ".env found");
    if (process.platform !== "win32") {
      const mode = statSync(envFile).mode & 0o777;
      report(mode & 0o077 ? "warn" : "ok", `.env permissions ${mode.toString(8)}`, mode & 0o077 ? "readable by other users — run: chmod 600 .env" : "only you can read it");
    }
    const ignored = spawnSync("git", ["check-ignore", "-q", ".env"], { stdio: "ignore", shell: process.platform === "win32" });
    if (ignored.status === 1) report("fail", ".env is NOT git-ignored", "secrets could be committed — add .env to .gitignore");
    else if (ignored.status === 0) report("ok", ".env is git-ignored");
  } else {
    report("info", "No .env file", "using the process environment (normal in production)");
  }

  heading("Configuration");
  const { env, usingDevelopmentSecrets } = await import("@/lib/env");
  let e: ReturnType<typeof env>;
  try {
    e = env();
  } catch (err) {
    report("fail", "Configuration is invalid");
    console.log(c.red(String(err instanceof Error ? err.message : err).replace(/^/gm, "      ")));
    return;
  }
  const prod = e.NODE_ENV === "production";
  report("ok", `Configuration valid`, `NODE_ENV=${e.NODE_ENV}`);
  if (usingDevelopmentSecrets()) report(prod ? "fail" : "warn", "Built-in development secrets in use", "run `npm run setup` (local) or set APP_SECRET and ENCRYPTION_KEY");
  else report("ok", "APP_SECRET and ENCRYPTION_KEY set", "values not shown");
  report(e.APP_URL.startsWith("https://") ? "ok" : prod ? "fail" : "info", `APP_URL ${e.APP_URL}`, e.APP_URL.startsWith("https://") ? undefined : "plain http is fine locally only");
  report(e.JOBS_INLINE && prod ? "fail" : "ok", `Background jobs: ${e.JOBS_INLINE ? "inline" : "worker process"}`, e.JOBS_INLINE ? "development mode" : "run `npm run worker` alongside the app");
  report(e.TRUSTED_IP_HEADER === "none" && prod ? "fail" : e.TRUSTED_IP_HEADER === "none" ? "info" : "ok", `Client IP header: ${e.TRUSTED_IP_HEADER}`, e.TRUSTED_IP_HEADER === "none" ? "set it to your proxy's header in production" : undefined);
  report(e.HIBP_CHECK ? "ok" : "warn", `Breached-password screening ${e.HIBP_CHECK ? "on" : "off"}`);

  heading("Database");
  const { db, closeDb } = await import("@/lib/db/client");
  try {
    const version = await db().execute<{ server_version: string }>(sql`show server_version`);
    const v = version.rows[0]!.server_version;
    report(Number(v.split(".")[0]) >= 16 ? "ok" : "fail", `PostgreSQL ${v}`, Number(v.split(".")[0]) >= 16 ? undefined : "needs 16+");

    const journal = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: unknown[] };
    const applied = await db()
      .execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)
      .then((r) => r.rows[0]!.n)
      .catch(() => 0);
    const pending = journal.entries.length - applied;
    report(pending === 0 ? "ok" : "fail", pending === 0 ? `Schema up to date (${applied} migrations)` : `${pending} migration(s) not applied`, pending === 0 ? undefined : "run `npm run db:migrate`");
    if (pending > 0) return;

    const topics = await db().execute<{ n: number }>(sql`select count(*)::int as n from topics`);
    report(topics.rows[0]!.n > 0 ? "ok" : "warn", `${topics.rows[0]!.n} topics`, topics.rows[0]!.n > 0 ? undefined : "run `npm run db:seed -- --topics-only`");

    const priv = await db().execute<{ can_update: boolean; is_owner: boolean }>(
      sql`select has_table_privilege(current_user, 'audit_log', 'UPDATE') as can_update,
                 (select tableowner = current_user from pg_tables where tablename = 'audit_log') as is_owner`,
    );
    const p = priv.rows[0]!;
    const leastPrivilege = !p.can_update && !p.is_owner;
    report(leastPrivilege ? "ok" : prod ? "fail" : "info", leastPrivilege ? "Least-privilege database role" : "App connects as a privileged role", leastPrivilege ? "cannot rewrite the audit log" : "fine locally; production must use peerlink_app (deploy/postgres/grants.sql)");

    const enc = await db().execute<{ id: string; enc: string }>(sql`select id, totp_secret_enc as enc from users where totp_secret_enc is not null limit 1`);
    if (enc.rows[0]) {
      const { decryptField } = await import("@/lib/security/crypto");
      let readable = true;
      try {
        decryptField(enc.rows[0].enc, `totp:${enc.rows[0].id}`);
      } catch {
        readable = false;
      }
      report(readable ? "ok" : "fail", readable ? "Encrypted 2FA secrets readable" : "Encrypted 2FA secrets NOT readable with ENCRYPTION_KEY", readable ? undefined : "the key changed — restore the original key (locally: npm run setup -- --reset)");
    }

    const { verifyAuditChain } = await import("@/lib/audit/audit");
    const chain = await verifyAuditChain();
    report(chain.ok ? "ok" : "fail", chain.ok ? `Audit chain intact (${chain.checked} entries)` : `Audit chain BROKEN at #${chain.brokenAtId}`, chain.ok ? undefined : "start the incident runbook in docs/OPERATIONS.md");

    const { failedJobCount } = await import("@/lib/jobs/queue");
    const failed = await failedJobCount();
    report(failed ? "warn" : "ok", failed ? `${failed} background job(s) failed permanently` : "No failed background jobs", failed ? "check the worker logs" : undefined);
  } catch (err) {
    report("fail", "Could not reach the database", err instanceof Error ? err.message : String(err));
  } finally {
    await closeDb();
  }

  heading("Email");
  if (e.EMAIL_TRANSPORT === "smtp" && e.SMTP_URL) {
    const transport = createTransport(e.SMTP_URL);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out after 10 s")), 10_000).unref());
    await Promise.race([transport.verify(), timeout])
      .then(() => report("ok", "SMTP server accepted the connection", new URL(e.SMTP_URL!).host))
      .catch((err: Error) => report("fail", "SMTP connection failed", err.message));
    transport.close();
  } else {
    report(prod ? "fail" : "info", `Email transport: ${e.EMAIL_TRANSPORT}`, prod ? "production needs smtp" : e.EMAIL_TRANSPORT === "console" ? "emails print in the dev server terminal" : `files in ${e.EMAIL_FILE_DIR}/`);
  }
}

main()
  .catch((err) => report("fail", "Doctor stopped unexpectedly", err instanceof Error ? err.message : String(err)))
  .finally(() => {
    const fails = results.filter((r) => r === "fail").length;
    const warns = results.filter((r) => r === "warn").length;
    console.log("");
    if (fails) console.log(`  ${c.red(c.bold(`${fails} problem${fails === 1 ? "" : "s"} to fix`))}${warns ? c.dim(` · ${warns} warning${warns === 1 ? "" : "s"}`) : ""}\n`);
    else console.log(`  ${c.green(c.bold("All checks passed"))}${warns ? c.dim(` · ${warns} warning${warns === 1 ? "" : "s"}`) : ""}\n`);
    process.exitCode = fails ? 1 : 0;
  });
