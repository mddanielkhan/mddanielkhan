import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { env } from "@/lib/env";

/** RFC 9116 vulnerability disclosure contact. */
export const GET = defineRoute({
  method: "GET",
  auth: { kind: "public" },
  schema: z.object({}).passthrough(),
  handler: async () => {
    const expires = new Date(Date.now() + 180 * 86400_000).toISOString();
    const body = [
      `Contact: mailto:${env().SECURITY_EMAIL}`,
      `Expires: ${expires}`,
      `Policy: ${env().APP_URL}/security`,
      "Preferred-Languages: en, bn",
      `Canonical: ${env().APP_URL}/.well-known/security.txt`,
    ].join("\n");
    return { body: `${body}\n`, contentType: "text/plain; charset=utf-8" };
  },
});
