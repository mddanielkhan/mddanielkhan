import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real production build (standalone server) and a
 * real PostgreSQL database (DATABASE_URL_E2E, default peerlink_e2e). The global
 * setup resets the database, migrates and seeds deterministic fixtures.
 */
const PORT = 3100;
export const E2E_DB = process.env.DATABASE_URL_E2E ?? "postgres://peerlink:peerlink@localhost:5432/peerlink_e2e";
export const MAIL_DIR = "test-results/mail-e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke\.spec\.ts/ },
  ],
  webServer: {
    // Reset + migrate + seed the E2E database, then start the production server.
    command: "npx tsx tests/e2e/prepare-db.ts && node .next/standalone/server.js",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      APP_URL: `http://localhost:${PORT}`,
      DATABASE_URL: E2E_DB,
      APP_SECRET: "e2e0".repeat(16).replace(/[^0-9a-f]/g, "a"),
      ENCRYPTION_KEY: "e2e1".repeat(16).replace(/[^0-9a-f]/g, "b"),
      EMAIL_TRANSPORT: "file",
      EMAIL_FILE_DIR: `${process.cwd()}/${MAIL_DIR}`,
      JOBS_INLINE: "true",
    },
  },
});
