import PQueue from "p-queue";
import prisma from "@/lib/prisma";

const scanQueue = new PQueue({ concurrency: 5 });

/**
 * Enqueue a vacancy scan job for processing.
 * The scan runner will be invoked asynchronously within the queue's concurrency limit.
 */
export async function enqueueScan(scanId: string): Promise<void> {
  scanQueue.add(async () => {
    const { runScan } = await import("./scan-runner");
    await runScan(scanId);
  });
}

/**
 * Stale scan recovery: on module load, find "running" scans older than 10 minutes
 * and mark them as failed. This handles scans that were interrupted by server restarts.
 */
async function recoverStaleScans(): Promise<void> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const staleCount = await prisma.vacancyScan.updateMany({
      where: {
        status: "running",
        startedAt: { lt: tenMinutesAgo },
      },
      data: {
        status: "failed",
        errorMessage: "Scan timed out (stale recovery)",
        completedAt: new Date(),
      },
    });

    if (staleCount.count > 0) {
      console.log(
        `[scan-queue] Recovered ${staleCount.count} stale scan(s) marked as failed`
      );
    }
  } catch (error) {
    console.error("[scan-queue] Error recovering stale scans:", error);
  }
}

// Run stale recovery on module load
recoverStaleScans();
