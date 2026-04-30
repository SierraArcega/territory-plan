import { prisma } from "@/lib/prisma";

const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000;

export async function sweepOrphanedNewsRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS);
  const result = await prisma.newsIngestRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: cutoff },
    },
    data: {
      status: "error",
      error: "orphaned (timeout — function killed before finishing)",
      finishedAt: new Date(),
    },
  });
  return result.count;
}
