import { defineRoute } from "@/lib/http/route";
import { offeringSchema } from "@/lib/validation/schemas";
import { createOffering, getMentorProfile } from "@/lib/mentors/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "mentor.manage", context: async (a) => ({ mentorStatus: (await getMentorProfile(a.user.id))?.status ?? null }) },
  schema: offeringSchema,
  handler: async ({ actor, input }) => {
    await createOffering(actor!, input);
    return { redirect: "/mentor", notice: "offering_created" };
  },
});
