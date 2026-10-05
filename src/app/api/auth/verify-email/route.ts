import { defineRoute } from "@/lib/http/route";
import { tokenSchema } from "@/lib/validation/schemas";
import { verifyEmail } from "@/lib/account/auth-service";
import { POLICIES } from "@/lib/security/rate-limit";

/** POST, not GET: email security scanners prefetch links and would otherwise burn the single-use token. */
export const POST = defineRoute({
  auth: { kind: "public" },
  schema: tokenSchema,
  rate: ({ ip }) => [[POLICIES.forgotIp, ip ?? "unknown"]],
  handler: async ({ input, actor }) => {
    await verifyEmail(input.token);
    return { redirect: actor ? "/feed" : "/login", notice: "email_verified" };
  },
});
