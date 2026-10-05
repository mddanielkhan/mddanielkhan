import { defineRoute } from "@/lib/http/route";
import { idSchema } from "@/lib/validation/schemas";
import { deleteOwnAnswer } from "@/lib/content/service";

export const POST = defineRoute({
  auth: { kind: "authenticated" },
  schema: idSchema,
  handler: async ({ actor, input }) => {
    await deleteOwnAnswer(actor!, input.id);
    return { redirect: "/feed", notice: "answer_deleted" };
  },
});
