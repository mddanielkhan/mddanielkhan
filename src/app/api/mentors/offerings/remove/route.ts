import { defineRoute } from "@/lib/http/route";
import { idSchema } from "@/lib/validation/schemas";
import { deactivateOffering } from "@/lib/mentors/service";

export const POST = defineRoute({
  auth: { kind: "authenticated" },
  schema: idSchema,
  handler: async ({ actor, input }) => {
    await deactivateOffering(actor!, input.id);
    return { redirect: "/mentor", notice: "offering_removed" };
  },
});
