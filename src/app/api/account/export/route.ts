import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { POLICIES } from "@/lib/security/rate-limit";
import { exportUserData } from "@/lib/account/account-service";

/** Right of access & portability (PDPA 2026). POST so it is CSRF-protected and never prefetched. */
export const POST = defineRoute({
  auth: { kind: "policy", action: "account.manage" },
  schema: z.object({}).passthrough(),
  rate: ({ actor }) => [[POLICIES.export, actor?.user.id]],
  handler: async ({ actor }) => {
    const data = await exportUserData(actor!.user.id);
    return {
      body: JSON.stringify(data, null, 2),
      contentType: "application/json; charset=utf-8",
      headers: { "content-disposition": `attachment; filename="shikor-data-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "no-store" },
    };
  },
});
