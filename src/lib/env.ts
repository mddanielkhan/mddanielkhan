import { z } from "zod";

/**
 * Environment validation — fail fast, fail loudly.
 *
 * The app refuses to boot in production with missing, weak, reused or example
 * secrets. Shipping default secrets is one of the most common real-world
 * misconfigurations (OWASP A02:2025 Security Misconfiguration).
 */

const EXAMPLE_SECRETS = new Set([
  "0000000000000000000000000000000000000000000000000000000000000000",
  "change-me",
  "changeme",
  "replace-me-with-openssl-rand-hex-32",
]);

const hex32 = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, "must be 64 hex chars (generate with: openssl rand -hex 32)");

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1).default("postgres://shikor:shikor@localhost:5432/shikor"),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    APP_SECRET: hex32.default("1".repeat(64)),
    ENCRYPTION_KEY: hex32.default("2".repeat(64)),

    EMAIL_TRANSPORT: z.enum(["console", "smtp", "file"]).default("console"),
    EMAIL_FROM: z.string().default("Shikor <no-reply@localhost>"),
    SMTP_URL: z.string().optional(),
    EMAIL_FILE_DIR: z.string().default(".mail-outbox"),

    TRUSTED_IP_HEADER: z.enum(["none", "x-forwarded-for", "cf-connecting-ip", "x-real-ip"]).default("none"),
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(5).default(1),

    TURNSTILE_SITE_KEY: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    HIBP_CHECK: bool,

    JOBS_INLINE: bool,
    JITSI_BASE_URL: z.url().default("https://meet.jit.si"),

    GRIEVANCE_OFFICER_NAME: z.string().default("Grievance Officer (to be appointed)"),
    GRIEVANCE_OFFICER_EMAIL: z.string().default("grievance@example.invalid"),
    SUPPORT_EMAIL: z.string().default("support@example.invalid"),
    SECURITY_EMAIL: z.string().default("security@example.invalid"),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== "production") return;
    const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    // A production build served on localhost is a local smoke/E2E run, never a real deployment
    // (every email link would point at localhost). Real secrets are still required.
    const host = new URL(e.APP_URL).hostname;
    const localRun = host === "localhost" || host === "127.0.0.1";
    for (const key of ["APP_SECRET", "ENCRYPTION_KEY"] as const) {
      const v = e[key].toLowerCase();
      if (EXAMPLE_SECRETS.has(v) || /^(.)\1+$/.test(v)) fail(key, "is a placeholder; generate a real secret");
    }
    if (e.APP_SECRET.toLowerCase() === e.ENCRYPTION_KEY.toLowerCase()) {
      fail("ENCRYPTION_KEY", "must differ from APP_SECRET (independent rotation)");
    }
    if (e.EMAIL_TRANSPORT === "smtp" && !e.SMTP_URL) fail("SMTP_URL", "is required when EMAIL_TRANSPORT=smtp");
    if (localRun) return;
    if (!e.APP_URL.startsWith("https://")) fail("APP_URL", "must be https in production");
    if (e.EMAIL_TRANSPORT !== "smtp") fail("EMAIL_TRANSPORT", "must be smtp in production");
    if (e.JOBS_INLINE) fail("JOBS_INLINE", "must be false in production (run the worker)");
    if (e.GRIEVANCE_OFFICER_EMAIL.endsWith(".invalid")) fail("GRIEVANCE_OFFICER_EMAIL", "must be a real, monitored address");
    if (e.TRUSTED_IP_HEADER === "none") fail("TRUSTED_IP_HEADER", "must name the header your proxy sets (e.g. cf-connecting-ip), or IP rate limits cannot work");
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    // Never print values — only which keys are wrong.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  if (cached.NODE_ENV === "development" && (!process.env.APP_SECRET || !process.env.ENCRYPTION_KEY)) {
    // Development convenience only (production refuses to boot without real secrets). Say so loudly:
    // two processes on different fallbacks cannot read each other's encrypted data (e.g. 2FA secrets).
    console.warn("[shikor] APP_SECRET/ENCRYPTION_KEY are not set — using built-in development keys. Run `npm run setup` to create a .env with your own.");
  }
  return cached;
}

/** True when the built-in development keys are in use (never allowed in production). */
export function usingDevelopmentSecrets(): boolean {
  return !process.env.APP_SECRET || !process.env.ENCRYPTION_KEY;
}

/** For tests only: re-read process.env. */
export function resetEnvCache() {
  cached = undefined;
}

export function isProduction() {
  return env().NODE_ENV === "production";
}

/** Secure cookies are used for https origins and for localhost (browsers treat it as a secure context). */
export function secureCookiesEnabled(): boolean {
  const url = new URL(env().APP_URL);
  return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
}
