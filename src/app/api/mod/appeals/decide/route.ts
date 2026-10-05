import { defineRoute } from "@/lib/http/route";
import { appealDecisionSchema } from "@/lib/validation/schemas";
import { decideAppeal } from "@/lib/moderation/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.moderate" },
  schema: appealDecisionSchema,
  handler: async ({ actor, input }) => {
    await decideAppeal(actor!, input);
    return { redirect: "/mod/appeals", notice: "mod_done" };
  },
});
