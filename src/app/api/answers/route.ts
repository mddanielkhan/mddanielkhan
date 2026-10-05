import { defineRoute } from "@/lib/http/route";
import { answerSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { createAnswer } from "@/lib/content/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "answer.create" },
  schema: answerSchema,
  rate: ({ actor }) => [[POLICIES.answerBurst, actor?.user.id]],
  handler: async ({ actor, input }) => {
    const r = await createAnswer(actor!, input);
    const visible = r.status === "published" || r.status === "flagged";
    return { redirect: `/posts/${input.postId}#answer-${r.id}`, notice: visible ? "answer_published" : "answer_held" };
  },
});
