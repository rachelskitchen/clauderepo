import type { PrismaClient } from "@prisma/client";

export type RfmSegment =
  | "champion" // recent, frequent, high spend
  | "loyal-low-spend" // frequent but low average spend
  | "lapsed-high-value" // used to spend well, hasn't ordered recently
  | "at-risk" // infrequent and not recent
  | "new";

export interface CustomerRfm {
  customerId: string;
  oloCustomerId: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  segment: RfmSegment;
}

const RECENT_DAYS_THRESHOLD = 14;
const LAPSED_DAYS_THRESHOLD = 45;
const FREQUENT_ORDER_THRESHOLD = 3;
const HIGH_SPEND_THRESHOLD = 75;

function classify(recencyDays: number, frequency: number, monetary: number): RfmSegment {
  if (frequency === 0) return "new";

  const isRecent = recencyDays <= RECENT_DAYS_THRESHOLD;
  const isLapsed = recencyDays > LAPSED_DAYS_THRESHOLD;
  const isFrequent = frequency >= FREQUENT_ORDER_THRESHOLD;
  const isHighSpend = monetary >= HIGH_SPEND_THRESHOLD;

  if (isRecent && isFrequent && isHighSpend) return "champion";
  if (isLapsed && isHighSpend) return "lapsed-high-value";
  if (isFrequent) return "loyal-low-spend";
  return "at-risk";
}

/**
 * Computes recency/frequency/monetary scores for every customer from
 * their order history, and buckets them into an actionable segment
 * that a campaign can target.
 */
export async function computeRfmSegments(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<CustomerRfm[]> {
  const customers = await prisma.customer.findMany({
    include: { baskets: { include: { order: true } } },
  });

  return customers.map((customer) => {
    const orders = customer.baskets
      .map((b) => b.order)
      .filter((o): o is NonNullable<typeof o> => o !== null);

    const frequency = orders.length;
    const monetary = orders.reduce((sum, o) => sum + o.total, 0);
    const lastOrderAt = orders.reduce<Date | null>((latest, o) => {
      return !latest || o.placedAt > latest ? o.placedAt : latest;
    }, null);
    const recencyDays = lastOrderAt
      ? Math.floor((now.getTime() - lastOrderAt.getTime()) / (1000 * 60 * 60 * 24))
      : Number.POSITIVE_INFINITY;

    return {
      customerId: customer.id,
      oloCustomerId: customer.oloCustomerId,
      recencyDays,
      frequency,
      monetary,
      segment: classify(recencyDays, frequency, monetary),
    };
  });
}
