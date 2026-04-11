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

    // Vendor slug → display name mapping
    const VENDOR_DISPLAY_NAMES: Record<string, string> = {
      proximity: "Proximity Learning",
      elevate: "Elevate K12",
      tbt: "Tutored By Teachers",
      educere: "Educere",
    };

    // Fetch competitor financial data from district_financials (non-fullmind vendors)
    const competitorFinancials = await prisma.districtFinancials.findMany({
      where: {
        leaid,
        vendor: { not: "fullmind" },
      },
      select: {
        vendor: true,
        fiscalYear: true,
        totalRevenue: true,
        poCount: true,
      },
      orderBy: [
        { vendor: "asc" },
        { fiscalYear: "desc" },
      ],
    });

    // Transform to response format (keep same shape as before)
    const spendData = competitorFinancials.map((record) => ({
      competitor: VENDOR_DISPLAY_NAMES[record.vendor] || record.vendor,
      fiscalYear: record.fiscalYear.toLowerCase(), // e.g., "fy26"
      totalSpend: toNumber(record.totalRevenue),
      poCount: record.poCount,
      color: COMPETITOR_COLORS[VENDOR_DISPLAY_NAMES[record.vendor] || record.vendor] || "#6B7280",
    }));

    // Calculate total across all competitors
    const totalAllCompetitors = spendData.reduce(
      (sum, record) => sum + record.totalSpend,
      0
    );

    return NextResponse.json({
      competitors: spendData,
      totalAllCompetitors,
    });
  } catch (error) {
    console.error("Error fetching competitors:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitor data" },
      { status: 500 }
    );
  }
}
