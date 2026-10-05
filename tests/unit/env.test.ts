import { afterEach, describe, expect, it } from "vitest";
import { env, resetEnvCache } from "@/lib/env";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
});

function load(over: Record<string, string>) {
  process.env = { ...saved, ...over };
  resetEnvCache();
  return () => env();
}

const strong = { APP_SECRET: "a1".repeat(32), ENCRYPTION_KEY: "b2".repeat(32) };

describe("environment fail-fast", () => {
  it("refuses placeholder secrets in production", () => {
    expect(load({ NODE_ENV: "production", APP_URL: "https://shikor.example" })).toThrow(/APP_SECRET: is a placeholder/);
  });
  it("refuses reused secrets", () => {
    expect(load({ NODE_ENV: "production", APP_URL: "https://shikor.example", APP_SECRET: "c3".repeat(32), ENCRYPTION_KEY: "c3".repeat(32) })).toThrow(/must differ/);
  });
  it("requires https, smtp, a worker, a real grievance contact and a trusted IP header for real deployments", () => {
    const run = load({ NODE_ENV: "production", APP_URL: "http://shikor.example", ...strong, EMAIL_TRANSPORT: "console", JOBS_INLINE: "true" });
    expect(run).toThrow(/APP_URL: must be https/);
    expect(run).toThrow(/EMAIL_TRANSPORT: must be smtp/);
    expect(run).toThrow(/JOBS_INLINE/);
    expect(run).toThrow(/GRIEVANCE_OFFICER_EMAIL/);
    expect(run).toThrow(/TRUSTED_IP_HEADER/);
  });
  it("accepts a correct production configuration", () => {
    const run = load({
      NODE_ENV: "production",
      APP_URL: "https://shikor.example",
      ...strong,
      EMAIL_TRANSPORT: "smtp",
      SMTP_URL: "smtps://u:p@smtp.example:465",
      GRIEVANCE_OFFICER_EMAIL: "grievance@shikor.example",
      TRUSTED_IP_HEADER: "cf-connecting-ip",
    });
    expect(run().APP_URL).toBe("https://shikor.example");
  });
  it("allows a localhost production run (smoke/E2E) but still requires real secrets", () => {
    expect(load({ NODE_ENV: "production", APP_URL: "http://localhost:3000", ...strong })().EMAIL_TRANSPORT).toBe("console");
    expect(load({ NODE_ENV: "production", APP_URL: "http://localhost:3000" })).toThrow(/placeholder/);
  });
});
