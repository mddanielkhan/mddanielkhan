import { defineRoute } from "@/lib/http/route";
import { declineBookingSchema } from "@/lib/validation/schemas";
import { declineBooking } from "@/lib/booking/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "booking.participate" },
  schema: declineBookingSchema,
  handler: async ({ actor, input }) => {
    await declineBooking(actor!, input);
    return { redirect: `/bookings/${input.id}`, notice: "booking_declined" };
  },
});
