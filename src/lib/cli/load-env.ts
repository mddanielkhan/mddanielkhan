/**
 * Load ./.env for command-line scripts, exactly like Next.js does for the app.
 *
 * Import this FIRST in every script entry point. Without it, scripts run via
 * `tsx` silently fall back to built-in development secrets while `next dev`
 * uses the keys in .env — so data encrypted by one (e.g. seeded 2FA secrets)
 * cannot be decrypted by the other.
 *
 * Variables already present in the environment always win, so values injected
 * by a deployment or a test harness are never overridden by a stray file.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), ".env");
if (existsSync(file)) process.loadEnvFile(file);
