import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { LOCALE_COOKIE, setUserLocale } from "@/lib/account/account-service";
import { safeBackPath } from "@/lib/http/urls";

export const POST = defineRoute({
  auth: { kind: "public" },
  schema: z.object({ locale: z.enum(["en", "bn"]) }),
  handler: async ({ actor, input, req }) => {
    if (actor) await setUserLocale(actor.user.id, input.locale);
    return {
      redirect: safeBackPath(req.headers.get("referer")),
      cookies: [{ name: LOCALE_COOKIE, value: input.locale, options: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 } }],
    };
  },
});
