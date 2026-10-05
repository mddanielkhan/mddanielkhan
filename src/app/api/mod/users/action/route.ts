import { defineRoute } from "@/lib/http/route";
import { modUserActionSchema, back } from "@/lib/validation/schemas";
import { actOnUser } from "@/lib/moderation/service";
import { safeBackPath } from "@/lib/http/urls";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.moderate" },
  schema: modUserActionSchema.extend({ _back: back }),
  handler: async ({ actor, input }) => {
    await actOnUser(actor!, { ...input, internalNote: input.internalNote ?? "" });
    return { redirect: safeBackPath(input._back, "/mod/users"), notice: "mod_done" };
  },
});
