import { defineRoute } from "@/lib/http/route";
import { registerSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { register, verifyTurnstile } from "@/lib/account/auth-service";
import { AppError } from "@/lib/http/errors";

export const POST = defineRoute({
  auth: { kind: "public" },
  schema: registerSchema,
  rate: ({ ip }) => [[POLICIES.registerIp, ip ?? "unknown"]],
  handler: async ({ input, ip, ipHash }) => {
    if (!(await verifyTurnstile(input["cf-turnstile-response"], ip))) throw new AppError("bot_check_failed", 400);
    await register(input, { ipHash });
    // Identical outcome whether or not the email was already registered (anti-enumeration).
    return { redirect: "/login", notice: "registered" };
  },
});
