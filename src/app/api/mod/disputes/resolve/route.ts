import { defineRoute } from "@/lib/http/route";
import { disputeResolutionSchema } from "@/lib/validation/schemas";
import { resolveDispute } from "@/lib/booking/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.moderate" },
  schema: disputeResolutionSchema,
  handler: async ({ actor, input }) => {
    await resolveDispute(actor!, input);
    return { redirect: "/mod/disputes", notice: "mod_done" };
  },
});
