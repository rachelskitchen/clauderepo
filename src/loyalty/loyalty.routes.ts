import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prismaClient.js";
import { computeRfmSegments } from "./segmentation.js";
import { createCampaign, sendCampaign, type CampaignDefinition } from "./campaignService.js";
import { getCampaignPerformance } from "./campaignMetrics.js";
import { StubMessageSender } from "../messaging/stubSender.js";

const sender = new StubMessageSender();

export async function loyaltyRoutes(app: FastifyInstance) {
  app.get("/loyalty/segments", async () => {
    const segments = await computeRfmSegments(prisma);
    return { segments };
  });

  app.post<{ Body: Omit<CampaignDefinition, "startsAt" | "endsAt"> & { startsAt: string; endsAt?: string } }>(
    "/loyalty/campaigns",
    async (request, reply) => {
      const body = request.body;
      const campaign = await createCampaign(prisma, {
        ...body,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      });
      return reply.status(201).send({ campaign });
    },
  );

  app.post<{ Params: { id: string } }>("/loyalty/campaigns/:id/send", async (request) => {
    const sends = await sendCampaign(prisma, sender, request.params.id);
    return { sends };
  });

  app.get<{ Params: { id: string } }>("/loyalty/campaigns/:id/performance", async (request) => {
    const performance = await getCampaignPerformance(prisma, request.params.id);
    return { performance };
  });
}
