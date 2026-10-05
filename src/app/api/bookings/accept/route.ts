import { defineRoute } from "@/lib/http/route";
import { acceptBookingSchema } from "@/lib/validation/schemas";
import { acceptBooking } from "@/lib/booking/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "booking.participate" },
  schema: acceptBookingSchema,
  handler: async ({ actor, input }) => {
    await acceptBooking(actor!, input);
    return { redirect: `/bookings/${input.id}`, notice: "booking_accepted" };
  },
});
