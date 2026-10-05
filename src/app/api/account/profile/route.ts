import { defineRoute } from "@/lib/http/route";
import { profileSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { updateProfile } from "@/lib/account/account-service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "profile.update" },
  schema: profileSchema,
  rate: ({ actor }) => [[POLICIES.profileUpdate, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await updateProfile(actor!, { ...input, headline: input.headline, gender: input.gender || undefined });
    return { redirect: "/settings", notice: "profile_saved" };
  },
});
