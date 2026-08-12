import type { OloBasket, OloOrder, OloLoyaltyEvent } from "./types.js";

/**
 * Abstraction over the Olo Ordering API + Olo Engage.
 * Swap MockOloClient for a real HTTP-backed implementation later
 * (same interface) once real credentials are available.
 */
export interface OloClient {
  listBaskets(): Promise<OloBasket[]>;
  listOrders(): Promise<OloOrder[]>;
  listLoyaltyEvents(): Promise<OloLoyaltyEvent[]>;
}
