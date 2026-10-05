import { defineRoute } from "@/lib/http/route";
import { idSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { requestHumanReview } from "@/lib/content/service";

export const POST = defineRoute({
  auth: { kind: "authenticated" },
  schema: idSchema,
  rate: ({ actor }) => [[POLICIES.appeal, actor?.user.id]],
  handler: async ({ actor, input }) => {
    await requestHumanReview(actor!, input.id);
    return { redirect: `/posts/${input.id}`, notice: "review_requested" };
  },
});
