import Fastify from "fastify";
import { Queue, Worker } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { config } from "./config.js";
import { prisma } from "./db/prismaClient.js";
import { oloWebhookRoutes } from "./webhooks/oloWebhookRoutes.js";
import { cartRecoveryRoutes } from "./cartRecovery/cartRecovery.routes.js";
import { loyaltyRoutes } from "./loyalty/loyalty.routes.js";
import { runAbandonmentSweep } from "./cartRecovery/abandonmentJob.js";
import { StubMessageSender } from "./messaging/stubSender.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

await app.register(oloWebhookRoutes);
await app.register(cartRecoveryRoutes);
await app.register(loyaltyRoutes);

const ABANDONMENT_QUEUE_NAME = "cart-abandonment-sweep";

function startAbandonmentScheduler() {
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(ABANDONMENT_QUEUE_NAME, { connection });
  const sender = new StubMessageSender();

  const worker = new Worker(
    ABANDONMENT_QUEUE_NAME,
    async () => {
      const results = await runAbandonmentSweep(
        prisma,
        sender,
        config.cartAbandonmentThresholdMinutes,
      );
      app.log.info(`Abandonment sweep flagged ${results.length} basket(s)`);
      return results.length;
    },
    { connection },
  );

  queue.add(
    "sweep",
    {},
    { repeat: { every: 5 * 60 * 1000 }, removeOnComplete: true, removeOnFail: true },
  );

  return { queue, worker };
}

const port = config.port;
app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});

if (process.env.NODE_ENV !== "test") {
  startAbandonmentScheduler();
}
