import { defineRoute } from "@/lib/http/route";
import { postSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { createPost } from "@/lib/content/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "post.create" },
  schema: postSchema,
  rate: ({ actor }) => [[POLICIES.postBurst, actor?.user.id]],
  handler: async ({ actor, input }) => {
    const r = await createPost(actor!, input);
    const notice = { published: "post_published", flagged: "post_flagged", held: "post_held", rejected: "post_rejected" }[r.status as "published"] ?? "post_published";
    return { redirect: `/posts/${r.id}`, notice };
  },
});
