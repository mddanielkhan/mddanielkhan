import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { markAllRead } from "@/lib/notify/notifications";

export const POST = defineRoute({
  auth: { kind: "authenticated" },
  schema: z.object({}).passthrough(),
  handler: async ({ actor }) => {
    await markAllRead(actor!.user.id);
    return { redirect: "/notifications", notice: "read_all" };
  },
});
