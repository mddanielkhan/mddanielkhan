import { defineRoute } from "@/lib/http/route";
import { emailOnlySchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { forgotPassword } from "@/lib/account/auth-service";
import { hmacHex } from "@/lib/security/crypto";

export const POST = defineRoute({
  auth: { kind: "public" },
  schema: emailOnlySchema,
  rate: ({ ip, input }) => [
    [POLICIES.forgotIp, ip ?? "unknown"],
    [POLICIES.forgotEmail, hmacHex("identifier-hash", (input as { email: string }).email)],
  ],
  handler: async ({ input, ipHash }) => {
    await forgotPassword(input.email, { ipHash });
    return { redirect: "/login", notice: "reset_sent" };
  },
});
