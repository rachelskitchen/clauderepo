import type { OloClient } from "./client.js";
import type { OloBasket, OloOrder, OloLoyaltyEvent } from "./types.js";

/**
 * Fixture-backed stand-in for the real Olo API, used for local dev,
 * seeding, and tests until real Olo sandbox credentials are wired up.
 */
export class MockOloClient implements OloClient {
  constructor(
    private readonly baskets: OloBasket[] = defaultBaskets(),
    private readonly orders: OloOrder[] = defaultOrders(),
    private readonly loyaltyEvents: OloLoyaltyEvent[] = defaultLoyaltyEvents(),
  ) {}

  async listBaskets(): Promise<OloBasket[]> {
    return this.baskets;
  }

  async listOrders(): Promise<OloOrder[]> {
    return this.orders;
  }

  async listLoyaltyEvents(): Promise<OloLoyaltyEvent[]> {
    return this.loyaltyEvents;
  }
}

function defaultBaskets(): OloBasket[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

  return [
    // Completed order — basket 1 has a matching order below.
    {
      oloBasketId: "basket-1",
      customer: { oloCustomerId: "cust-1", email: "alex@example.com", name: "Alex" },
      items: [{ name: "Burrito Bowl", quantity: 1, price: 11.5 }],
      subtotal: 11.5,
      updatedAt: hoursAgo(2),
    },
    // Abandoned — updated 2 hours ago, no order.
    {
      oloBasketId: "basket-2",
      customer: { oloCustomerId: "cust-2", email: "jordan@example.com", phone: "+15555550123", name: "Jordan" },
      items: [{ name: "Chicken Bowl", quantity: 2, price: 10.0 }],
      subtotal: 20.0,
      updatedAt: hoursAgo(2),
    },
    // Still fresh — updated 5 minutes ago, should not be flagged yet.
    {
      oloBasketId: "basket-3",
      customer: { oloCustomerId: "cust-3", phone: "+15555550456", name: "Sam" },
      items: [{ name: "Veggie Wrap", quantity: 1, price: 9.25 }],
      subtotal: 9.25,
      updatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    },
  ];
}

function defaultOrders(): OloOrder[] {
  return [
    {
      oloOrderId: "order-1",
      oloBasketId: "basket-1",
      total: 11.5,
      placedAt: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function defaultLoyaltyEvents(): OloLoyaltyEvent[] {
  return [
    {
      oloCustomerId: "cust-1",
      type: "ACCRUAL",
      points: 115,
      oloOrderId: "order-1",
      occurredAt: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
