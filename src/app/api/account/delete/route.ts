import { defineRoute } from "@/lib/http/route";
import { deleteAccountSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { deleteAccount } from "@/lib/account/account-service";
import { sessionCookieName } from "@/lib/auth/session";

export const POST = defineRoute({
  auth: { kind: "policy", action: "account.manage" },
  schema: deleteAccountSchema,
  rate: ({ actor }) => [[POLICIES.reauth, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await deleteAccount(actor!, input.password, input.deleteContent);
    return { redirect: "/", notice: "account_deleted", clearCookies: [sessionCookieName()] };
  },
});
