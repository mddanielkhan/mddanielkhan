import { defineRoute } from "@/lib/http/route";
import { acceptAnswerSchema } from "@/lib/validation/schemas";
import { acceptAnswer } from "@/lib/content/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "answer.create" },
  schema: acceptAnswerSchema,
  handler: async ({ actor, input }) => {
    await acceptAnswer(actor!, input);
    return { redirect: `/posts/${input.postId}#answer-${input.answerId}`, notice: "answer_accepted" };
  },
});
