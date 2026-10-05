import { defineRoute } from "@/lib/http/route";
import { tokenSchema } from "@/lib/validation/schemas";
import { confirmInstitutionVerification } from "@/lib/account/account-service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "profile.update" },
  schema: tokenSchema,
  handler: async ({ actor, input }) => {
    await confirmInstitutionVerification(actor!, input.token);
    return { redirect: `/u/${actor!.user.username}`, notice: "institution_verified" };
  },
});
