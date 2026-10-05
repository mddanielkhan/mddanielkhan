import { defineRoute } from "@/lib/http/route";
import { feedbackSchema } from "@/lib/validation/schemas";
import { leaveFeedback } from "@/lib/booking/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "booking.participate" },
  schema: feedbackSchema,
  handler: async ({ actor, input }) => {
    await leaveFeedback(actor!, input);
    return { redirect: `/bookings/${input.id}`, notice: "feedback_saved" };
  },
});
