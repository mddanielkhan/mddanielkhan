import { defineRoute } from "@/lib/http/route";
import { editPostSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { editPost } from "@/lib/content/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "post.create" },
  schema: editPostSchema,
  rate: ({ actor }) => [[POLICIES.postBurst, actor?.user.id]],
  handler: async ({ actor, input }) => {
    const r = await editPost(actor!, input);
    return { redirect: `/posts/${input.id}`, notice: r.status === "held" ? "post_held" : r.status === "rejected" ? "post_rejected" : "post_updated" };
  },
});
