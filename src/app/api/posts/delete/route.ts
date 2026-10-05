import { defineRoute } from "@/lib/http/route";
import { idSchema } from "@/lib/validation/schemas";
import { deleteOwnPost } from "@/lib/content/service";

export const POST = defineRoute({
  auth: { kind: "authenticated" },
  schema: idSchema,
  handler: async ({ actor, input }) => {
    await deleteOwnPost(actor!, input.id);
    return { redirect: "/feed", notice: "post_deleted" };
  },
});
