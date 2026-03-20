import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/vacancies/scan/[scanId]
 *
 * Poll the status of a single vacancy scan.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scanId } = await params;

    const scan = await prisma.vacancyScan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        status: true,
        platform: true,
        vacancyCount: true,
        fullmindRelevantCount: true,
        districtsMatched: true,
        completedAt: true,
        errorMessage: true,
      },
    });

    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      scanId: scan.id,
      status: scan.status,
      platform: scan.platform,
      vacancyCount: scan.vacancyCount,
      fullmindRelevantCount: scan.fullmindRelevantCount,
      districtsMatched: scan.districtsMatched,
      completedAt: scan.completedAt?.toISOString() ?? null,
      errorMessage: scan.errorMessage,
    });
  } catch (error) {
    console.error("Error fetching scan status:", error);
    return NextResponse.json(
      { error: "Failed to fetch scan status" },
      { status: 500 }
    );
  }
}
