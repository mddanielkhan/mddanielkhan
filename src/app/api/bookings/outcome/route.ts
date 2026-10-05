import { defineRoute } from "@/lib/http/route";
import { outcomeSchema } from "@/lib/validation/schemas";
import { reportOutcome } from "@/lib/booking/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "booking.participate" },
  schema: outcomeSchema,
  handler: async ({ actor, input }) => {
    await reportOutcome(actor!, input);
    return { redirect: `/bookings/${input.id}`, notice: "outcome_recorded" };
  },
});
