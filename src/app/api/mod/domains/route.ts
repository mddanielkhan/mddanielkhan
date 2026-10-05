import { defineRoute } from "@/lib/http/route";
import { blockedDomainSchema } from "@/lib/validation/schemas";
import { addBlockedDomain } from "@/lib/moderation/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.moderate" },
  schema: blockedDomainSchema,
  handler: async ({ actor, input }) => {
    await addBlockedDomain(actor!, input.domain, input.reason);
    return { redirect: "/mod/settings", notice: "mod_done" };
  },
});
