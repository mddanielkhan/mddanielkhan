import { defineRoute } from "@/lib/http/route";
import { reportSchema, back } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { createReport } from "@/lib/reports/service";
import { safeBackPath } from "@/lib/http/urls";

export const POST = defineRoute({
  auth: { kind: "policy", action: "report.create" },
  schema: reportSchema.extend({ _back: back }),
  rate: ({ actor }) => [[POLICIES.report, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await createReport(actor!, input);
    return { redirect: safeBackPath(input._back, "/feed"), notice: "reported" };
  },
});
