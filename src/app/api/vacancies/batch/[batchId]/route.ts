import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/vacancies/batch/[batchId]
 *
 * Poll the progress of a bulk vacancy scan batch.
 *
 * Response: {
 *   batchId: string,
 *   total: number,
 *   completed: number,
 *   failed: number,
 *   pending: number,
 *   vacanciesFound: number,
 *   fullmindRelevant: number
 * }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    // Query all scans with this batchId
    const scans = await prisma.vacancyScan.findMany({
      where: { batchId },
      select: {
        status: true,
        vacancyCount: true,
        fullmindRelevantCount: true,
      },
    });

    if (scans.length === 0) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Aggregate by status
    let completed = 0;
    let failed = 0;
    let pending = 0;
    let vacanciesFound = 0;
    let fullmindRelevant = 0;

    for (const scan of scans) {
      switch (scan.status) {
        case "completed":
        case "completed_partial":
          completed++;
          vacanciesFound += scan.vacancyCount ?? 0;
          fullmindRelevant += scan.fullmindRelevantCount ?? 0;
          break;
        case "failed":
          failed++;
          break;
        case "pending":
        case "running":
          pending++;
          break;
      }
    }

    return NextResponse.json({
      batchId,
      total: scans.length,
      completed,
      failed,
      pending,
      vacanciesFound,
      fullmindRelevant,
    });
  } catch (error) {
    console.error("Error fetching batch status:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch status" },
      { status: 500 }
    );
  }
}
