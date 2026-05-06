/**
 * One-shot pipeline-signal refresh.
 *
 * Usage:
 *   npx tsx scripts/refresh-rfp-signals.ts
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { refreshRfpSignals } from "@/features/rfps/lib/refresh-signals";

async function main() {
  const startedAt = Date.now();
  const rowsUpdated = await refreshRfpSignals();
  const elapsedMs = Date.now() - startedAt;
  console.log(`Updated ${rowsUpdated} RFPs in ${elapsedMs}ms`);

  // Distribution snapshot — sanity check the result.
  const dist = await prisma.$queryRaw<{ state: string | null; n: bigint }[]>`
    SELECT district_pipeline_state AS state, COUNT(*)::bigint AS n
    FROM rfps
    GROUP BY 1
    ORDER BY 2 DESC
  `;
  console.log("\nSignal distribution:");
  for (const row of dist) {
    console.log(`  ${String(row.state ?? "NULL").padEnd(15)} ${row.n}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
