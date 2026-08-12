import type { PrismaClient } from "@prisma/client";
import type { MessageSender } from "../messaging/messageSender.js";
import { computeRfmSegments, type RfmSegment } from "./segmentation.js";

export interface CampaignVariant {
  label: string;
  message: string;
}

export interface CampaignDefinition {
  name: string;
  segment: RfmSegment;
  variants: CampaignVariant[];
  startsAt: Date;
  endsAt?: Date;
}

export async function createCampaign(prisma: PrismaClient, def: CampaignDefinition) {
  if (def.variants.length < 2) {
    throw new Error("A campaign needs at least 2 variants to A/B test");
  }

  return prisma.campaign.create({
    data: {
      name: def.name,
      segmentDefinition: { segment: def.segment },
      variants: def.variants as unknown as object,
      startsAt: def.startsAt,
      endsAt: def.endsAt,
    },
  });
}

/** Deterministic djb2 hash so a given customer always lands in the same variant for a campaign. */
function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(h);
}

export function assignVariantIndex(
  customerId: string,
  campaignId: string,
  variantCount: number,
): number {
  return hash(`${campaignId}:${customerId}`) % variantCount;
}

/**
 * Sends a campaign to every customer currently in its target segment,
 * splitting them deterministically across variants for later A/B
 * comparison via campaignMetrics.
 */
export async function sendCampaign(
  prisma: PrismaClient,
  sender: MessageSender,
  campaignId: string,
) {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const variants = campaign.variants as unknown as CampaignVariant[];
  const targetSegment = (campaign.segmentDefinition as { segment: RfmSegment }).segment;

  const rfm = await computeRfmSegments(prisma);
  const targetCustomers = rfm.filter((c) => c.segment === targetSegment);

  const customerRows = await prisma.customer.findMany({
    where: { id: { in: targetCustomers.map((c) => c.customerId) } },
  });
  const customerById = new Map(customerRows.map((c) => [c.id, c]));

  const sends = [];
  for (const target of targetCustomers) {
    const customer = customerById.get(target.customerId);
    const to = customer?.email ?? customer?.phone;
    if (!customer || !to) continue;

    const variantIndex = assignVariantIndex(customer.id, campaignId, variants.length);
    const variant = variants[variantIndex];

    await sender.send({
      channel: customer.email ? "EMAIL" : "SMS",
      to,
      subject: customer.email ? campaign.name : undefined,
      body: variant.message,
    });

    sends.push(
      await prisma.campaignSend.create({
        data: {
          campaignId,
          customerId: customer.id,
          variant: variant.label,
        },
      }),
    );
  }

  return sends;
}
