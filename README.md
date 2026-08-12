# Olo Growth Engine

Drives more digital revenue through the existing Olo online ordering channel via two initiatives:

1. **Abandoned cart recovery** — detects baskets that were started but never completed, and sends a discount-coded recovery message. Tracks conversion (did the customer come back and order?).
2. **Loyalty campaign optimization** — segments customers by recency/frequency/monetary (RFM) value from order + loyalty history, and lets you run A/B-tested reward campaigns targeted at a segment instead of blasting everyone the same offer.

## Why abandonment is inferred, not native

Olo's webhooks fire on order lifecycle events (placed, confirmed, completed), gift card activity, and loyalty accrual/redemption — there's no native "cart abandoned" event. This service tracks `basket.updated` events and periodically checks for OPEN baskets that have gone stale with no matching `order.placed` — that's the abandonment signal.

## Olo integration status

**No live Olo credentials are wired up yet.** All Olo access goes through the `OloClient` interface (`src/olo/client.ts`), currently backed by `MockOloClient` (`src/olo/mockClient.ts`), which returns fixture baskets/orders/loyalty events. To connect to the real Olo Ordering API / Olo Engage:

1. Implement `OloClient` with real HTTP calls (Ordering API for baskets/orders, Olo Engage for loyalty/segments).
2. Point `OLO_CLIENT_MODE=http` and set `OLO_API_BASE_URL` / `OLO_API_KEY` in `.env`.
3. Register Olo's real outbound webhooks to POST into `/webhooks/olo` (mapping their event shape to `OloWebhookEvent` in `src/olo/types.ts`).

Similarly, `MessageSender` (`src/messaging/messageSender.ts`) is stubbed (`StubMessageSender` just logs) — swap in SendGrid/Twilio-backed implementations when ready and set `MESSAGE_SENDER_MODE`.

## Stack

Node.js + TypeScript, Fastify, Prisma + Postgres, BullMQ + Redis (scheduled abandonment sweep), Vitest.

## Setup

```bash
npm install
npx prisma migrate deploy   # requires Postgres running, DATABASE_URL set (see .env.example)
npm run seed                # loads MockOloClient fixtures into the DB
npm run dev                 # starts the API on :3000 + the abandonment sweep worker (needs Redis)
```

Copy `.env.example` to `.env` and adjust `DATABASE_URL` / `REDIS_URL` for your local Postgres/Redis.

## API

- `POST /webhooks/olo` — receives `{ kind: "basket.updated" | "order.placed" | "loyalty.event", ... }` events
- `GET /cart-recovery/abandoned` — list of abandoned/recovered baskets with their recovery attempts
- `GET /cart-recovery/stats` — abandonment/recovery counts, recovery rate, revenue recovered
- `GET /loyalty/segments` — RFM segment for every customer
- `POST /loyalty/campaigns` — create a campaign `{ name, segment, variants: [{label, message}, ...], startsAt, endsAt? }`
- `POST /loyalty/campaigns/:id/send` — send the campaign to everyone currently in its target segment, split deterministically across variants
- `GET /loyalty/campaigns/:id/performance` — per-variant send/open/redeem counts and rates

## Tests

```bash
npm test
```

Runs against a real Postgres database (`DATABASE_URL` in `.env`) — `vitest.config.ts` disables file-level parallelism since tests share and reset that database between cases.
