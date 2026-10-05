import { defineRoute } from "@/lib/http/route";
import { mentorApplicationSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { applyAsMentor } from "@/lib/mentors/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "mentor.apply" },
  schema: mentorApplicationSchema,
  rate: ({ actor }) => [[POLICIES.mentorApply, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await applyAsMentor(actor!, input);
    return { redirect: "/mentor", notice: "mentor_applied" };
  },
});
