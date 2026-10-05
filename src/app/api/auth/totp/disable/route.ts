import { defineRoute } from "@/lib/http/route";
import { disableTotpSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { disableTotp } from "@/lib/account/auth-service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "account.manage" },
  schema: disableTotpSchema,
  rate: ({ actor }) => [[POLICIES.totpVerify, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await disableTotp(actor!, input.password, input.code);
    return { redirect: "/settings/security", notice: "totp_disabled" };
  },
});
