import type { PrismaClient } from "@prisma/client";
import type { MessageSender } from "../messaging/messageSender.js";
import { sendRecoveryMessage } from "./recoveryService.js";

/**
 * Finds OPEN baskets that haven't been updated within the abandonment
 * threshold, marks them ABANDONED, and triggers a recovery message for
 * each. Pure async function (no scheduling) so it's directly testable;
 * wired up on a BullMQ repeatable job in server.ts for production use.
 */
export async function runAbandonmentSweep(
  prisma: PrismaClient,
  sender: MessageSender,
  thresholdMinutes: number,
  now: Date = new Date(),
) {
  const cutoff = new Date(now.getTime() - thresholdMinutes * 60 * 1000);

  const staleBaskets = await prisma.basket.findMany({
    where: { status: "OPEN", updatedAt: { lt: cutoff } },
    include: { customer: true },
  });

  const results = [];
  for (const basket of staleBaskets) {
    await prisma.basket.update({
      where: { id: basket.id },
      data: { status: "ABANDONED" },
    });
    const attempt = await sendRecoveryMessage(prisma, sender, basket);
    results.push({ basket, attempt });
  }

  return results;
}
