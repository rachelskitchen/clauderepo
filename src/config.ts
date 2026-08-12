import "./loadEnv.js";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  oloClientMode: process.env.OLO_CLIENT_MODE ?? "mock",
  messageSenderMode: process.env.MESSAGE_SENDER_MODE ?? "stub",
  cartAbandonmentThresholdMinutes: Number(
    process.env.CART_ABANDONMENT_THRESHOLD_MINUTES ?? 30,
  ),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
};
