import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { runScan } from "@/features/vacancies/lib/scan-runner";

export const dynamic = "force-dynamic";

// Allow up to 60s per individual scan
export const maxDuration = 60;

/**
 * POST /api/vacancies/scan-next
 *
 * Picks the next pending scan from a batch and runs it inline.
 * The client calls this repeatedly until no pending scans remain.
 *
 * Request body: { batchId: string }
 * Response: { done: boolean, scanId?: string, remaining: number }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { batchId } = body as { batchId?: string };

    if (!batchId || typeof batchId !== "string") {
      return NextResponse.json(
        { error: "batchId is required" },
        { status: 400 }
      );
    }

    // Find the next pending scan in this batch
    const nextScan = await prisma.vacancyScan.findFirst({
      where: { batchId, status: "pending" },
      orderBy: { startedAt: "asc" },
      select: { id: true },
    });

    if (!nextScan) {
      return NextResponse.json({ done: true, remaining: 0 });
    }

    // Run it
    await runScan(nextScan.id);

    // Count remaining
    const remaining = await prisma.vacancyScan.count({
      where: { batchId, status: "pending" },
    });

    return NextResponse.json({
      done: remaining === 0,
      scanId: nextScan.id,
      remaining,
    });
  } catch (error) {
    console.error("Error processing next scan:", error);
    return NextResponse.json(
      { error: "Failed to process scan" },
      { status: 500 }
    );
  }
}
