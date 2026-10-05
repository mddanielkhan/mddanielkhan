import { defineRoute } from "@/lib/http/route";
import { reauthSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { reauthenticate } from "@/lib/account/auth-service";
import { safeBackPath } from "@/lib/http/urls";

export const POST = defineRoute({
  auth: { kind: "policy", action: "account.manage" },
  schema: reauthSchema,
  rate: ({ actor }) => [[POLICIES.reauth, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await reauthenticate(actor!, input.password, input.code);
    return { redirect: safeBackPath(input.next, "/settings"), notice: "reauthenticated" };
  },
});
