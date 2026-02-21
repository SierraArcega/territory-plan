// scripts/seed-auto-tags.ts
import prisma from "../src/lib/prisma";
import {
  ensureAutoTagsExist,
  syncLocaleTagForDistrict,
} from "../src/features/shared/lib/auto-tags";

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

  // Step 4: Classification tags (Churn Risk, Key Account, EK12/Fullmind tags)
  // are manually applied — no auto-sync needed.
  console.log("Classification tags are manually applied — skipping auto-sync.");

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
