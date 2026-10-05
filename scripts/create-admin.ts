/**
 * Bootstrap the first admin (run once per environment):
 *   ADMIN_EMAIL=you@example.com ADMIN_USERNAME=founder npm run admin:create
 * Prints a one-time random password. Log in, change it, and enable 2FA —
 * staff powers stay locked until 2FA is verified in the session.
 */
import "@/lib/cli/load-env"; // must stay first: loads .env before any module reads config
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, closeDb } from "@/lib/db/client";
import { consentRecords, profiles, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/audit";
import { POLICY_VERSIONS } from "@/lib/config/brand";
import { email as emailSchema, username as usernameSchema } from "@/lib/validation/schemas";

async function main() {
  const email = emailSchema.parse(process.env.ADMIN_EMAIL ?? "");
  const username = usernameSchema.safeParse(process.env.ADMIN_USERNAME ?? "");
  const uname = username.success ? username.data : `founder_${randomBytes(2).toString("hex")}`;
  const password = randomBytes(18).toString("base64url");
  const [existing] = await db().select().from(users).where(eq(users.email, email));
  if (existing) {
    await db().update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
    await audit({ action: "admin.bootstrap_promoted", targetType: "user", targetId: existing.id });
    console.log(`Promoted existing account ${existing.username} to admin. Password unchanged.`);
    return;
  }
  const [u] = await db()
    .insert(users)
    .values({ email, username: uname, displayName: "Founder", passwordHash: await hashPassword(password), role: "admin", emailVerifiedAt: new Date(), adultAttestedAt: new Date(), trustLevel: 4 })
    .returning();
  await db().insert(profiles).values({ userId: u!.id });
  await db().insert(consentRecords).values(Object.entries(POLICY_VERSIONS).map(([document, version]) => ({ userId: u!.id, document, version })));
  await audit({ action: "admin.bootstrap_created", targetType: "user", targetId: u!.id });
  console.log(`Admin created.\n  email:    ${email}\n  username: ${uname}\n  password: ${password}\nLog in, change the password, then enable 2FA in Settings → Security.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
