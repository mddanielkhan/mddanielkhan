import { defineRoute } from "@/lib/http/route";
import { modDecisionSchema, back } from "@/lib/validation/schemas";
import { decideContent } from "@/lib/moderation/service";
import { safeBackPath } from "@/lib/http/urls";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.moderate" },
  schema: modDecisionSchema.extend({ _back: back }),
  handler: async ({ actor, input }) => {
    await decideContent(actor!, input);
    return { redirect: safeBackPath(input._back, "/mod/queue"), notice: "mod_done" };
  },
});
