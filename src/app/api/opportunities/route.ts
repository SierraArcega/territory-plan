import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/opportunities?search={query}&limit={10}
// Search opportunities by ID or name
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "10", 10),
      50
    );

    if (!search || !search.trim()) {
      return NextResponse.json({ opportunities: [] });
    }

    const query = search.trim();

    const opportunities = await prisma.opportunity.findMany({
      where: {
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        stage: true,
        netBookingAmount: true,
        districtName: true,
        districtLeaId: true,
        closeDate: true,
      },
      take: limit,
      orderBy: [{ name: "asc" }],
    });

    const result = opportunities.map((opp) => ({
      id: opp.id,
      name: opp.name,
      stage: opp.stage,
      netBookingAmount: opp.netBookingAmount ? Number(opp.netBookingAmount) : null,
      districtName: opp.districtName,
      districtLeaId: opp.districtLeaId,
      closeDate: opp.closeDate?.toISOString() ?? null,
    }));

    return NextResponse.json({ opportunities: result });
  } catch (error) {
    console.error("Error searching opportunities:", error);
    return NextResponse.json(
      { error: "Failed to search opportunities" },
      { status: 500 }
    );
  }
}
