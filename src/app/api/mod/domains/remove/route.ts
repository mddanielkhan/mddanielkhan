import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { removeBlockedDomain } from "@/lib/moderation/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.admin" },
  schema: z.object({ domain: z.string().trim().toLowerCase().max(253) }),
  handler: async ({ actor, input }) => {
    await removeBlockedDomain(actor!, input.domain);
    return { redirect: "/mod/settings", notice: "mod_done" };
  },
});
