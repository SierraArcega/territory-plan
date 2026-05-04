/**
 * One-time backfill: categorize historical VacancyScan failures into the
 * new failureReason column.
 *
 * Run:    npx tsx scripts/backfill-vacancy-failure-reasons.ts
 * Dry:    DRY_RUN=true npx tsx scripts/backfill-vacancy-failure-reasons.ts
 *
 * Idempotent — safe to re-run; the WHERE clause skips already-categorized rows.
 */
import prisma from "@/lib/prisma";
import { categorizeFailure } from "@/features/vacancies/lib/failure-reasons";
import type { VacancyFailureReason } from "@prisma/client";

const BATCH_SIZE = 500;
const DRY_RUN = process.env.DRY_RUN === "true";

async function main() {
  const counts: Record<string, number> = {};
  let totalProcessed = 0;
  let cursor: string | undefined = undefined;

  for (;;) {
    const batch = await prisma.vacancyScan.findMany({
      where: {
        status: { in: ["failed", "completed_partial"] },
        failureReason: null,
      },
      select: { id: true, errorMessage: true },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const updates: { id: string; reason: VacancyFailureReason }[] = batch.map((row) => {
      const reason = categorizeFailure({
        errorMessage: row.errorMessage ?? "",
        context: "thrown_error",
      });
      counts[reason] = (counts[reason] ?? 0) + 1;
      return { id: row.id, reason };
    });

    if (!DRY_RUN) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.vacancyScan.update({
            where: { id: u.id },
            data: { failureReason: u.reason },
          }),
        ),
      );
    }

    totalProcessed += batch.length;
    cursor = batch[batch.length - 1]!.id;
    console.log(
      `[backfill] processed ${totalProcessed} rows so far${DRY_RUN ? " (dry run)" : ""}`,
    );
  }

  console.log("\n=== Backfill summary ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Total rows processed: ${totalProcessed}`);
  console.log("Bucket counts:");
  for (const [reason, count] of Object.entries(counts).sort(
    ([, a], [, b]) => b - a,
  )) {
    console.log(`  ${reason.padEnd(28)} ${count}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] failed:", err);
    process.exit(1);
  });
