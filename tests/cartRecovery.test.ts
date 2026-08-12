import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db/prismaClient.js";
import { ingestBasketUpdated, ingestOrderPlaced } from "../src/olo/ingest.js";
import { runAbandonmentSweep } from "../src/cartRecovery/abandonmentJob.js";
import { StubMessageSender } from "../src/messaging/stubSender.js";
import type { OloBasket, OloOrder } from "../src/olo/types.js";

async function resetDb() {
  await prisma.recoveryAttempt.deleteMany();
  await prisma.campaignSend.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.loyaltyEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.basket.deleteMany();
  await prisma.customer.deleteMany();
}

function basket(overrides: Partial<OloBasket> & { oloBasketId: string }): OloBasket {
  return {
    customer: { oloCustomerId: `cust-${overrides.oloBasketId}`, email: `${overrides.oloBasketId}@example.com` },
    items: [{ name: "Bowl", quantity: 1, price: 10 }],
    subtotal: 10,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("runAbandonmentSweep", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("flags OPEN baskets older than the threshold as ABANDONED and sends a recovery message", async () => {
    const now = new Date();
    const staleBasket = basket({
      oloBasketId: "stale-1",
      updatedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // 60 min ago
    });
    await ingestBasketUpdated(prisma, staleBasket);

    const sender = new StubMessageSender();
    const results = await runAbandonmentSweep(prisma, sender, 30, now);

    expect(results).toHaveLength(1);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].channel).toBe("EMAIL");

    const updated = await prisma.basket.findUnique({ where: { oloBasketId: "stale-1" } });
    expect(updated?.status).toBe("ABANDONED");

    const attempts = await prisma.recoveryAttempt.findMany();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].converted).toBe(false);
  });

  it("does not flag baskets updated within the threshold window", async () => {
    const now = new Date();
    const freshBasket = basket({
      oloBasketId: "fresh-1",
      updatedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 min ago
    });
    await ingestBasketUpdated(prisma, freshBasket);

    const sender = new StubMessageSender();
    const results = await runAbandonmentSweep(prisma, sender, 30, now);

    expect(results).toHaveLength(0);
    const stillOpen = await prisma.basket.findUnique({ where: { oloBasketId: "fresh-1" } });
    expect(stillOpen?.status).toBe("OPEN");
  });

  it("marks a basket RECOVERED and its attempt converted when an order arrives after abandonment", async () => {
    const now = new Date();
    const staleBasket = basket({
      oloBasketId: "stale-2",
      updatedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    });
    await ingestBasketUpdated(prisma, staleBasket);

    const sender = new StubMessageSender();
    await runAbandonmentSweep(prisma, sender, 30, now);

    const order: OloOrder = {
      oloOrderId: "order-stale-2",
      oloBasketId: "stale-2",
      total: 10,
      placedAt: new Date().toISOString(),
    };
    await ingestOrderPlaced(prisma, order);

    const recovered = await prisma.basket.findUnique({ where: { oloBasketId: "stale-2" } });
    expect(recovered?.status).toBe("RECOVERED");

    const attempts = await prisma.recoveryAttempt.findMany();
    expect(attempts[0].converted).toBe(true);
  });
});
