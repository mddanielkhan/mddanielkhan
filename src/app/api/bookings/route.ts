import { defineRoute } from "@/lib/http/route";
import { bookingRequestSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { requestBooking } from "@/lib/booking/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "booking.request" },
  schema: bookingRequestSchema,
  rate: ({ actor }) => [[POLICIES.bookingRequest, actor?.user.id]],
  handler: async ({ actor, input }) => {
    const id = await requestBooking(actor!, input);
    return { redirect: `/bookings/${id}`, notice: "booking_requested" };
  },
});
