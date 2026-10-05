import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { logout } from "@/lib/account/auth-service";
import { sessionCookieName } from "@/lib/auth/session";

export const POST = defineRoute({
  auth: { kind: "public" },
  schema: z.object({}).passthrough(),
  handler: async ({ actor }) => {
    if (actor) await logout(actor.session);
    return { redirect: "/", notice: "logged_out", clearCookies: [sessionCookieName()] };
  },
});
