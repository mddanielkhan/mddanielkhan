import { defineRoute } from "@/lib/http/route";
import { bookingMessageSchema } from "@/lib/validation/schemas";
import { POLICIES } from "@/lib/security/rate-limit";
import { sendBookingMessage } from "@/lib/booking/service";

export const POST = defineRoute({
  auth: { kind: "policy", action: "booking.participate" },
  schema: bookingMessageSchema,
  rate: ({ actor }) => [[POLICIES.bookingMessage, actor?.user.id]],
  handler: async ({ actor, input }) => {
    const r = await sendBookingMessage(actor!, input);
    return { redirect: `/bookings/${input.id}#messages`, notice: r.status === "held" ? "message_held" : "message_sent" };
  },
});
