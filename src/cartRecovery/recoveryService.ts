import type { PrismaClient, Basket } from "@prisma/client";
import type { MessageSender } from "../messaging/messageSender.js";

function generateDiscountCode(basketId: string): string {
  return `COMEBACK-${basketId.slice(-6).toUpperCase()}`;
}

/**
 * Sends a recovery message for a single abandoned basket and records
 * the attempt. Prefers email, falls back to SMS, skips silently if
 * neither contact channel is on file.
 */
export async function sendRecoveryMessage(
  prisma: PrismaClient,
  sender: MessageSender,
  basket: Basket & { customer: { email: string | null; phone: string | null; name: string | null } },
) {
  const discountCode = generateDiscountCode(basket.id);
  const channel = basket.customer.email ? "EMAIL" : basket.customer.phone ? "SMS" : null;

  if (!channel) {
    return null;
  }

  const to = channel === "EMAIL" ? basket.customer.email! : basket.customer.phone!;
  const greeting = basket.customer.name ? `Hi ${basket.customer.name},` : "Hi there,";

  await sender.send({
    channel,
    to,
    subject: channel === "EMAIL" ? "You left something behind!" : undefined,
    body: `${greeting} you left items in your cart. Use code ${discountCode} for 10% off if you finish your order in the next hour.`,
  });

  return prisma.recoveryAttempt.create({
    data: {
      basketId: basket.id,
      channel,
      discountCode,
    },
  });
}
