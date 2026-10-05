import { defineRoute } from "@/lib/http/route";
import { resolveReportSchema } from "@/lib/validation/schemas";
import { resolveReport } from "@/lib/moderation/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.moderate" },
  schema: resolveReportSchema,
  handler: async ({ actor, input }) => {
    await resolveReport(actor!, input);
    return { redirect: "/mod/reports", notice: "mod_done" };
  },
});
