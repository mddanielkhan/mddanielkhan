import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { checkDatabase } from "@/lib/health";

/** Liveness/readiness for the load balancer and uptime monitor. Reveals nothing beyond up/down. */
export const GET = defineRoute({
  method: "GET",
  auth: { kind: "public" },
  schema: z.object({}).passthrough(),
  handler: async () => {
    const ok = await checkDatabase();
    return { json: { status: ok ? "ok" : "degraded" }, status: ok ? 200 : 503 };
  },
});
