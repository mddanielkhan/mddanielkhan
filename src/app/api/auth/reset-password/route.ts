import { defineRoute } from "@/lib/http/route";
import { resetPasswordSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { resetPassword } from "@/lib/account/auth-service";
import { sessionCookieName } from "@/lib/auth/session";

export const POST = defineRoute({
  auth: { kind: "public" },
  schema: resetPasswordSchema,
  rate: ({ ip }) => [[POLICIES.forgotIp, ip ?? "unknown"]],
  handler: async ({ input, ipHash }) => {
    await resetPassword(input.token, input.password, { ipHash });
    return { redirect: "/login", notice: "password_reset", clearCookies: [sessionCookieName()] };
  },
});
