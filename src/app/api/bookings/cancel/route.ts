import { defineRoute } from "@/lib/http/route";
import { cancelBookingSchema } from "@/lib/validation/schemas";
import { cancelBooking } from "@/lib/booking/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "booking.participate" },
  schema: cancelBookingSchema,
  handler: async ({ actor, input }) => {
    await cancelBooking(actor!, input);
    return { redirect: `/bookings/${input.id}`, notice: "booking_cancelled" };
  },
});
