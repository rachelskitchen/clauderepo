import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db/prismaClient.js";
import { ingestBasketUpdated, ingestOrderPlaced } from "../src/olo/ingest.js";
import { computeRfmSegments } from "../src/loyalty/segmentation.js";
import { assignVariantIndex, createCampaign, sendCampaign } from "../src/loyalty/campaignService.js";
import { getCampaignPerformance } from "../src/loyalty/campaignMetrics.js";
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

async function seedOrder(customerId: string, basketId: string, orderId: string, daysAgo: number, total: number) {
  const placedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const basket: OloBasket = {
    oloBasketId: basketId,
    customer: { oloCustomerId: customerId, email: `${customerId}@example.com` },
    items: [{ name: "Bowl", quantity: 1, price: total }],
    subtotal: total,
    updatedAt: placedAt,
  };
  await ingestBasketUpdated(prisma, basket);
  const order: OloOrder = { oloOrderId: orderId, oloBasketId: basketId, total, placedAt };
  await ingestOrderPlaced(prisma, order);
}

describe("computeRfmSegments", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("classifies a recent, frequent, high-spend customer as a champion", async () => {
    for (let i = 0; i < 4; i++) {
      await seedOrder("champ", `champ-basket-${i}`, `champ-order-${i}`, i, 30);
    }

    const segments = await computeRfmSegments(prisma);
    const champ = segments.find((s) => s.oloCustomerId === "champ");
    expect(champ?.segment).toBe("champion");
  });

  it("classifies a customer with no orders as new", async () => {
    await ingestBasketUpdated(prisma, {
      oloBasketId: "newbie-basket",
      customer: { oloCustomerId: "newbie", email: "newbie@example.com" },
      items: [{ name: "Bowl", quantity: 1, price: 10 }],
      subtotal: 10,
      updatedAt: new Date().toISOString(),
    });

    const segments = await computeRfmSegments(prisma);
    const newbie = segments.find((s) => s.oloCustomerId === "newbie");
    expect(newbie?.segment).toBe("new");
  });

  it("classifies a high-spend customer who hasn't ordered recently as lapsed-high-value", async () => {
    await seedOrder("lapsed", "lapsed-basket-1", "lapsed-order-1", 90, 100);

    const segments = await computeRfmSegments(prisma);
    const lapsed = segments.find((s) => s.oloCustomerId === "lapsed");
    expect(lapsed?.segment).toBe("lapsed-high-value");
  });
});

describe("assignVariantIndex", () => {
  it("is deterministic for the same customer/campaign pair", () => {
    const a = assignVariantIndex("cust-1", "camp-1", 2);
    const b = assignVariantIndex("cust-1", "camp-1", 2);
    expect(a).toBe(b);
  });

  it("stays within bounds", () => {
    for (let i = 0; i < 20; i++) {
      const idx = assignVariantIndex(`cust-${i}`, "camp-1", 3);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    }
  });
});

describe("campaign send + performance rollup", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("sends to the targeted segment and rolls up per-variant performance", async () => {
    for (let i = 0; i < 4; i++) {
      await seedOrder("champ-a", `champ-a-basket-${i}`, `champ-a-order-${i}`, i, 30);
    }
    for (let i = 0; i < 4; i++) {
      await seedOrder("champ-b", `champ-b-basket-${i}`, `champ-b-order-${i}`, i, 30);
    }
    // A lapsed customer should NOT receive this "champion" campaign.
    await seedOrder("lapsed-c", "lapsed-c-basket", "lapsed-c-order", 90, 100);

    const campaign = await createCampaign(prisma, {
      name: "Champions Reward",
      segment: "champion",
      variants: [
        { label: "10-percent-off", message: "Enjoy 10% off your next order!" },
        { label: "free-drink", message: "Enjoy a free drink on your next order!" },
      ],
      startsAt: new Date(),
    });

    const sender = new StubMessageSender();
    const sends = await sendCampaign(prisma, sender, campaign.id);

    expect(sends).toHaveLength(2);
    expect(sender.sent).toHaveLength(2);

    const sentCustomerIds = new Set(
      (await prisma.campaignSend.findMany({ where: { campaignId: campaign.id } })).map(
        (s) => s.customerId,
      ),
    );
    const lapsedCustomer = await prisma.customer.findUnique({
      where: { oloCustomerId: "lapsed-c" },
    });
    expect(sentCustomerIds.has(lapsedCustomer!.id)).toBe(false);

    // Simulate one open + redeem to verify the metrics rollup.
    const firstSend = sends[0];
    await prisma.campaignSend.update({
      where: { id: firstSend.id },
      data: { openedAt: new Date(), redeemedAt: new Date() },
    });

    const performance = await getCampaignPerformance(prisma, campaign.id);
    const totalSent = performance.reduce((sum, p) => sum + p.sent, 0);
    const totalRedeemed = performance.reduce((sum, p) => sum + p.redeemed, 0);
    expect(totalSent).toBe(2);
    expect(totalRedeemed).toBe(1);
  });
});
