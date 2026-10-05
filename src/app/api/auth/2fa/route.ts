import { defineRoute } from "@/lib/http/route";
import { totpSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { completeMfa } from "@/lib/account/auth-service";
import { resolveSession, sessionCookieName } from "@/lib/auth/session";
import { sessionCookie } from "@/lib/http/cookies";
import { safeBackPath } from "@/lib/http/urls";
import { AppError } from "@/lib/http/errors";

export const POST = defineRoute({
  auth: { kind: "public" }, // the pending-MFA session is checked explicitly below
  schema: totpSchema,
  rate: ({ ip }) => [[POLICIES.totpVerify, ip ?? "unknown"]],
  handler: async ({ req, input, ipHash, userAgent }) => {
    const pending = await resolveSession(req.cookies.get(sessionCookieName())?.value);
    if (!pending || pending.session.mfaState !== "pending") throw new AppError("login_required", 401);
    const result = await completeMfa(pending, input.code, { ipHash, userAgent });
    return { redirect: safeBackPath(input.next, "/feed"), cookies: [sessionCookie(result.token, result.maxAgeSec)] };
  },
});
