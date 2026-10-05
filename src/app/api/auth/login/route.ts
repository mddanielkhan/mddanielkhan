import { defineRoute } from "@/lib/http/route";
import { loginSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { login } from "@/lib/account/auth-service";
import { sessionCookie } from "@/lib/http/cookies";
import { safeBackPath, withParam } from "@/lib/http/urls";
import { hmacHex } from "@/lib/security/crypto";

export const POST = defineRoute({
  auth: { kind: "public" },
  schema: loginSchema,
  // Dual-keyed: per IP (generous — campus NAT) and per account (strict — credential stuffing).
  rate: ({ ip, input }) => [
    [POLICIES.loginIp, ip ?? "unknown"],
    [POLICIES.loginAccount, hmacHex("identifier-hash", (input as { email: string }).email)],
  ],
  handler: async ({ input, ipHash, userAgent }) => {
    const next = safeBackPath(input.next, "/feed");
    const result = await login(input, { ipHash, userAgent });
    const cookies = [sessionCookie(result.token, result.maxAgeSec)];
    if (result.kind === "mfa") return { redirect: withParam("/login/2fa", "next", next), cookies };
    return { redirect: next, cookies };
  },
});
