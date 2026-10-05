import { defineRoute } from "@/lib/http/route";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { changePassword } from "@/lib/account/auth-service";
import { sessionCookie } from "@/lib/http/cookies";

export const POST = defineRoute({
  auth: { kind: "policy", action: "account.manage" },
  schema: changePasswordSchema,
  rate: ({ actor }) => [[POLICIES.reauth, actor?.user.id]],
  handler: async ({ actor, input, ipHash, userAgent }) => {
    const r = await changePassword(actor!, input.current, input.password, { ipHash, userAgent });
    return { redirect: "/settings/security", notice: "password_changed", cookies: [sessionCookie(r.token, r.maxAgeSec)] };
  },
});
