// scripts/seed-auto-tags.ts
import prisma from "../src/lib/prisma";
import {
  ensureAutoTagsExist,
  syncAutoTagsForDistrict,
  syncLocaleTagForDistrict,
} from "../src/lib/autoTags";

async function main() {
  console.log("Seeding auto-tags...");

  // Step 1: Ensure all auto-tags exist in the Tag table
  await ensureAutoTagsExist();
  console.log("Auto-tags created/verified in database.");

  // Step 2: Get all districts
  const districts = await prisma.district.findMany({
    select: { leaid: true },
  });
  console.log(`Found ${districts.length} districts to process.`);

  // Step 3: Sync locale tags for all districts (one-time)
  console.log("Syncing locale tags...");
  let localeCount = 0;
  for (const { leaid } of districts) {
    await syncLocaleTagForDistrict(leaid);
    localeCount++;
    if (localeCount % 1000 === 0) {
      console.log(`  Processed ${localeCount}/${districts.length} locale tags...`);
    }
  }
  console.log(`Locale tags synced for ${localeCount} districts.`);

  // Step 4: Sync auto-tags (Customer, Pipeline, VIP, Win Back, Prospect)
  console.log("Syncing auto-tags...");
  let autoCount = 0;
  for (const { leaid } of districts) {
    await syncAutoTagsForDistrict(leaid);
    autoCount++;
    if (autoCount % 1000 === 0) {
      console.log(`  Processed ${autoCount}/${districts.length} auto-tags...`);
    }
  }
  console.log(`Auto-tags synced for ${autoCount} districts.`);

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error("Error seeding auto-tags:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
