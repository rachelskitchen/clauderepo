import { prisma } from "../src/db/prismaClient.js";
import { MockOloClient } from "../src/olo/mockClient.js";
import { ingestBasketUpdated, ingestOrderPlaced, ingestLoyaltyEvent } from "../src/olo/ingest.js";

async function main() {
  const olo = new MockOloClient();

  for (const basket of await olo.listBaskets()) {
    await ingestBasketUpdated(prisma, basket);
  }
  for (const order of await olo.listOrders()) {
    await ingestOrderPlaced(prisma, order);
  }
  for (const event of await olo.listLoyaltyEvents()) {
    await ingestLoyaltyEvent(prisma, event);
  }

  console.log("Seeded database from MockOloClient fixtures.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
