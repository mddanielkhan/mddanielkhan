import { defineRoute } from "@/lib/http/route";
import { revokeSessionSchema } from "@/lib/validation/schemas";
import { revokeOwnSession } from "@/lib/account/auth-service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "account.manage" },
  schema: revokeSessionSchema,
  handler: async ({ actor, input }) => {
    await revokeOwnSession(actor!.user.id, input.sessionId);
    return { redirect: "/settings/security", notice: "session_revoked" };
  },
});
