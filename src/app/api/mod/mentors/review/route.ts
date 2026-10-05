import { defineRoute } from "@/lib/http/route";
import { mentorReviewSchema } from "@/lib/validation/schemas";
import { reviewMentor } from "@/lib/mentors/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "staff.moderate" },
  schema: mentorReviewSchema,
  handler: async ({ actor, input }) => {
    await reviewMentor(actor!, input);
    return { redirect: "/mod/mentors", notice: "mod_done" };
  },
});
