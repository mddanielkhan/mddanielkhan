import { defineRoute } from "@/lib/http/route";
import { confirmTotpSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { confirmTotpEnrollment } from "@/lib/account/auth-service";
import { encryptField } from "@/lib/security/crypto";
import { secureCookiesEnabled } from "@/lib/env";
import { RECOVERY_CODES_COOKIE } from "@/lib/http/cookies";

export const POST = defineRoute({
  auth: { kind: "policy", action: "account.manage" },
  schema: confirmTotpSchema,
  rate: ({ actor }) => [[POLICIES.totpVerify, actor?.user.id]],
  handler: async ({ actor, input }) => {
    const codes = await confirmTotpEnrollment(actor!, input.code);
    // Shown exactly once: an encrypted, HttpOnly, 5-minute cookie bound to this user.
    const value = encryptField(JSON.stringify(codes), `rc:${actor!.user.id}`);
    return {
      redirect: "/settings/security/recovery-codes",
      notice: "totp_enabled",
      cookies: [{ name: RECOVERY_CODES_COOKIE, value, options: { httpOnly: true, secure: secureCookiesEnabled(), sameSite: "strict", path: "/settings/security", maxAge: 300 } }],
    };
  },
});
