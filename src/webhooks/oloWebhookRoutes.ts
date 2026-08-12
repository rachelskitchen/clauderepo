import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prismaClient.js";
import { ingestBasketUpdated, ingestOrderPlaced, ingestLoyaltyEvent } from "../olo/ingest.js";
import type { OloWebhookEvent } from "../olo/types.js";

export async function oloWebhookRoutes(app: FastifyInstance) {
  app.post<{ Body: OloWebhookEvent }>("/webhooks/olo", async (request, reply) => {
    const event = request.body;

    switch (event.kind) {
      case "basket.updated":
        await ingestBasketUpdated(prisma, event.basket);
        break;
      case "order.placed":
        await ingestOrderPlaced(prisma, event.order);
        break;
      case "loyalty.event":
        await ingestLoyaltyEvent(prisma, event.event);
        break;
      default:
        return reply.status(400).send({ error: "Unknown event kind" });
    }

    return reply.status(202).send({ ok: true });
  });
}
