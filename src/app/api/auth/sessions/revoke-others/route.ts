import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { revokeOtherSessions } from "@/lib/account/auth-service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "account.manage" },
  schema: z.object({}).passthrough(),
  handler: async ({ actor }) => {
    await revokeOtherSessions(actor!);
    return { redirect: "/settings/security", notice: "sessions_revoked" };
  },
});
