import { defineRoute } from "@/lib/http/route";
import { appealSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { createAppeal } from "@/lib/moderation/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "appeal.create" },
  schema: appealSchema,
  rate: ({ actor }) => [[POLICIES.appeal, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await createAppeal(actor!, input);
    return { redirect: "/notifications", notice: "appeal_submitted" };
  },
});
