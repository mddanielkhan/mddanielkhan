import { defineRoute } from "@/lib/http/route";
import { killSwitchSchema } from "@/lib/validation/schemas";
import { setSwitch } from "@/lib/settings";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.admin" },
  schema: killSwitchSchema,
  handler: async ({ actor, input }) => {
    await setSwitch(input.key, input.value === "on", actor!.user.id);
    return { redirect: "/mod/settings", notice: "mod_done" };
  },
});
