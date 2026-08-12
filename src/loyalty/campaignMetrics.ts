import type { PrismaClient } from "@prisma/client";

export interface VariantPerformance {
  variant: string;
  sent: number;
  opened: number;
  redeemed: number;
  openRate: number;
  redemptionRate: number;
}

/**
 * Rolls up send/open/redeem counts per variant so under-performing
 * offers within a campaign can be identified and paused/reallocated.
 */
export async function getCampaignPerformance(
  prisma: PrismaClient,
  campaignId: string,
): Promise<VariantPerformance[]> {
  const sends = await prisma.campaignSend.findMany({ where: { campaignId } });

  const byVariant = new Map<string, { sent: number; opened: number; redeemed: number }>();
  for (const send of sends) {
    const bucket = byVariant.get(send.variant) ?? { sent: 0, opened: 0, redeemed: 0 };
    bucket.sent += 1;
    if (send.openedAt) bucket.opened += 1;
    if (send.redeemedAt) bucket.redeemed += 1;
    byVariant.set(send.variant, bucket);
  }

  return Array.from(byVariant.entries()).map(([variant, stats]) => ({
    variant,
    sent: stats.sent,
    opened: stats.opened,
    redeemed: stats.redeemed,
    openRate: stats.sent > 0 ? stats.opened / stats.sent : 0,
    redemptionRate: stats.sent > 0 ? stats.redeemed / stats.sent : 0,
  }));
}
