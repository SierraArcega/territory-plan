import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

// Competitor colors for UI display
const COMPETITOR_COLORS: Record<string, string> = {
  "Proximity Learning": "#6EA3BE",
  "Elevate K12": "#E07A5F",
  "Tutored By Teachers": "#7C3AED",
  "Educere": "#403770",
};

// Helper to convert Decimal to number
function toNumber(val: Decimal | null | undefined): number {
  return val != null ? Number(val) : 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;

    // Fetch all competitor spend records for this district
    const competitorSpend = await prisma.competitorSpend.findMany({
      where: { leaid },
      orderBy: [
        { competitor: "asc" },
        { fiscalYear: "desc" },
      ],
    });

    // Transform to response format
    const spendData = competitorSpend.map((record) => ({
      competitor: record.competitor,
      fiscalYear: record.fiscalYear.toLowerCase(), // e.g., "fy26"
      totalSpend: toNumber(record.totalSpend),
      poCount: record.poCount,
      color: COMPETITOR_COLORS[record.competitor] || "#6B7280",
    }));

    // Calculate total across all competitors
    const totalAllCompetitors = spendData.reduce(
      (sum, record) => sum + record.totalSpend,
      0
    );

    return NextResponse.json({
      competitorSpend: spendData,
      totalAllCompetitors,
    });
  } catch (error) {
    console.error("Error fetching competitor spend:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitor spend data" },
      { status: 500 }
    );
  }
}
