import { defineRoute } from "@/lib/http/route";
import { voteSchema, back } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { toggleVote } from "@/lib/content/service";
import { safeBackPath } from "@/lib/http/urls";

export const POST = defineRoute({
  auth: { kind: "policy", action: "vote.cast" },
  schema: voteSchema.extend({ _back: back }),
  rate: ({ actor }) => [[POLICIES.vote, actor?.user.id]],
  handler: async ({ actor, input }) => {
    const r = await toggleVote(actor!, input);
    return { redirect: safeBackPath(input._back, "/feed"), notice: r.voted ? "voted" : "unvoted" };
  },
});
