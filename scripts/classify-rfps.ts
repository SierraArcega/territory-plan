/**
 * One-shot RFP classification backfill.
 *
 * Usage:
 *   npx tsx scripts/classify-rfps.ts             # classify all WHERE classified_at IS NULL
 *   npx tsx scripts/classify-rfps.ts --force     # re-classify everything (clears classified_at first)
 *   npx tsx scripts/classify-rfps.ts --batch=50  # cap per loop (default 100)
 */
import { config } from "dotenv";
config();

import { prisma } from "@/lib/prisma";
import { classifyUnclassified } from "@/features/rfps/lib/classifier";

const args = process.argv.slice(2);
const force = args.includes("--force");
const batchArg = args.find((a) => a.startsWith("--batch="));
const batchSize = batchArg ? parseInt(batchArg.split("=")[1], 10) : 100;

async function main() {
  if (force) {
    const cleared = await prisma.rfp.updateMany({
      data: { classifiedAt: null },
    });
    console.log(`[force] cleared classified_at on ${cleared.count} rows`);
  }

  let totalClassified = 0;
  let totalErrors = 0;
  let loops = 0;

  while (true) {
    const queueRemaining = await prisma.rfp.count({
      where: { classifiedAt: null },
    });
    if (queueRemaining === 0) break;

    loops++;
    console.log(`[loop ${loops}] queue: ${queueRemaining} remaining`);

    const stats = await classifyUnclassified(batchSize, 4, 60_000);
    totalClassified += stats.classified;
    totalErrors += stats.errors;

    console.log(`[loop ${loops}] classified=${stats.classified} errors=${stats.errors}`);

    if (stats.processed === 0) {
      console.warn("[loop] processed 0 — something is wrong, bailing");
      break;
    }
  }

  console.log(`\nDone. classified=${totalClassified} errors=${totalErrors} loops=${loops}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
