import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prismaClient.js";

export async function cartRecoveryRoutes(app: FastifyInstance) {
  app.get("/cart-recovery/abandoned", async () => {
    const baskets = await prisma.basket.findMany({
      where: { status: { in: ["ABANDONED", "RECOVERED"] } },
      include: { customer: true, recoveryAttempts: true },
      orderBy: { updatedAt: "desc" },
    });
    return { baskets };
  });

  app.get("/cart-recovery/stats", async () => {
    const [abandoned, recovered, ordered, open] = await Promise.all([
      prisma.basket.count({ where: { status: "ABANDONED" } }),
      prisma.basket.count({ where: { status: "RECOVERED" } }),
      prisma.basket.count({ where: { status: "ORDERED" } }),
      prisma.basket.count({ where: { status: "OPEN" } }),
    ]);

    const recoveredBaskets = await prisma.basket.findMany({
      where: { status: "RECOVERED" },
      include: { order: true },
    });
    const revenueRecovered = recoveredBaskets.reduce(
      (sum, b) => sum + (b.order?.total ?? 0),
      0,
    );

    const totalAbandonedEver = abandoned + recovered;
    const recoveryRate = totalAbandonedEver > 0 ? recovered / totalAbandonedEver : 0;

    return {
      open,
      ordered,
      abandoned,
      recovered,
      recoveryRate,
      revenueRecovered,
    };
  });
}
