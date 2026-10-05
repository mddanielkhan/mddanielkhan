import { defineRoute } from "@/lib/http/route";
import { roleSchema } from "@/lib/validation/schemas";
import { setRole } from "@/lib/moderation/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.admin" },
  schema: roleSchema,
  handler: async ({ actor, input }) => {
    await setRole(actor!, input.userId, input.role);
    return { redirect: "/mod/users", notice: "mod_done" };
  },
});
