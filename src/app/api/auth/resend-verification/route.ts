import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { resendVerification } from "@/lib/account/auth-service";
import { POLICIES } from "@/lib/security/rate-limit";

export const POST = defineRoute({
  auth: { kind: "authenticated" },
  schema: z.object({}).passthrough(),
  rate: ({ actor }) => [[POLICIES.resendVerification, actor?.user.id]],
  handler: async ({ actor }) => {
    await resendVerification(actor!.user.id);
    return { redirect: "/verify-email", notice: "verification_sent" };
  },
});
