export interface OloCustomer {
  oloCustomerId: string;
  email?: string;
  phone?: string;
  name?: string;
}

export interface OloBasketItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OloBasket {
  oloBasketId: string;
  customer: OloCustomer;
  items: OloBasketItem[];
  subtotal: number;
  updatedAt: string;
}

export interface OloOrder {
  oloOrderId: string;
  oloBasketId: string;
  total: number;
  placedAt: string;
}

export type OloLoyaltyEventType = "ACCRUAL" | "REDEMPTION";

export interface OloLoyaltyEvent {
  oloCustomerId: string;
  type: OloLoyaltyEventType;
  points: number;
  oloOrderId?: string;
  occurredAt: string;
}

export type OloWebhookEvent =
  | { kind: "basket.updated"; basket: OloBasket }
  | { kind: "order.placed"; order: OloOrder }
  | { kind: "loyalty.event"; event: OloLoyaltyEvent };
