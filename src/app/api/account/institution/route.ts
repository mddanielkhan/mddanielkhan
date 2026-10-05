import { defineRoute } from "@/lib/http/route";
import { institutionEmailSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { requestInstitutionVerification } from "@/lib/account/account-service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "profile.update" },
  schema: institutionEmailSchema,
  rate: ({ actor }) => [[POLICIES.institutionEmail, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await requestInstitutionVerification(actor!, input.email);
    return { redirect: "/settings/verify-institution", notice: "institution_sent" };
  },
});
