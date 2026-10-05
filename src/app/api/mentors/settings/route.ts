import { defineRoute } from "@/lib/http/route";
import { mentorSettingsSchema } from "@/lib/validation/schemas";
import { updateMentorSettings, getMentorProfile } from "@/lib/mentors/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "mentor.manage", context: async (a) => ({ mentorStatus: (await getMentorProfile(a.user.id))?.status ?? null }) },
  schema: mentorSettingsSchema,
  handler: async ({ actor, input }) => {
    await updateMentorSettings(actor!, input);
    return { redirect: "/mentor", notice: "mentor_settings_saved" };
  },
});
