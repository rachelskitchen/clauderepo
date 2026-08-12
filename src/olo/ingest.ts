import type { PrismaClient } from "@prisma/client";
import type { OloBasket, OloOrder, OloLoyaltyEvent } from "./types.js";

async function upsertCustomer(prisma: PrismaClient, customer: OloBasket["customer"]) {
  return prisma.customer.upsert({
    where: { oloCustomerId: customer.oloCustomerId },
    create: {
      oloCustomerId: customer.oloCustomerId,
      email: customer.email,
      phone: customer.phone,
      name: customer.name,
    },
    update: {
      email: customer.email,
      phone: customer.phone,
      name: customer.name,
    },
  });
}

export async function ingestBasketUpdated(prisma: PrismaClient, basket: OloBasket) {
  const customer = await upsertCustomer(prisma, basket.customer);

  return prisma.basket.upsert({
    where: { oloBasketId: basket.oloBasketId },
    create: {
      oloBasketId: basket.oloBasketId,
      customerId: customer.id,
      items: basket.items as unknown as object,
      subtotal: basket.subtotal,
      updatedAt: new Date(basket.updatedAt),
    },
    update: {
      items: basket.items as unknown as object,
      subtotal: basket.subtotal,
      updatedAt: new Date(basket.updatedAt),
    },
  });
}

export async function ingestOrderPlaced(prisma: PrismaClient, order: OloOrder) {
  const basket = await prisma.basket.findUnique({
    where: { oloBasketId: order.oloBasketId },
  });
  if (!basket) {
    throw new Error(`Received order.placed for unknown basket ${order.oloBasketId}`);
  }

  const wasAbandonedOrRecoverable =
    basket.status === "ABANDONED" || basket.status === "RECOVERED";

  await prisma.order.upsert({
    where: { oloOrderId: order.oloOrderId },
    create: {
      oloOrderId: order.oloOrderId,
      basketId: basket.id,
      total: order.total,
      placedAt: new Date(order.placedAt),
    },
    update: {
      total: order.total,
      placedAt: new Date(order.placedAt),
    },
  });

  await prisma.basket.update({
    where: { id: basket.id },
    data: { status: wasAbandonedOrRecoverable ? "RECOVERED" : "ORDERED" },
  });

  if (wasAbandonedOrRecoverable) {
    await prisma.recoveryAttempt.updateMany({
      where: { basketId: basket.id, converted: false },
      data: { converted: true },
    });
  }
}

export async function ingestLoyaltyEvent(prisma: PrismaClient, event: OloLoyaltyEvent) {
  const customer = await prisma.customer.findUnique({
    where: { oloCustomerId: event.oloCustomerId },
  });
  if (!customer) {
    throw new Error(`Received loyalty.event for unknown customer ${event.oloCustomerId}`);
  }

  const order = event.oloOrderId
    ? await prisma.order.findUnique({ where: { oloOrderId: event.oloOrderId } })
    : null;

  await prisma.loyaltyEvent.create({
    data: {
      customerId: customer.id,
      type: event.type,
      points: event.points,
      orderId: order?.id,
      occurredAt: new Date(event.occurredAt),
    },
  });
}
