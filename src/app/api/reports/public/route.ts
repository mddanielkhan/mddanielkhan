import { defineRoute } from "@/lib/http/route";
import { publicReportSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { createPublicReport } from "@/lib/reports/service";

/** Notice-and-action intake for anyone, including people without an account. */
export const POST = defineRoute({
  auth: { kind: "public" },
  schema: publicReportSchema,
  rate: ({ ip }) => [[POLICIES.publicReportIp, ip ?? "unknown"]],
  handler: async ({ input }) => {
    await createPublicReport(input);
    return { redirect: "/report-concern", notice: "public_report_received" };
  },
});
