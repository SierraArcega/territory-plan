import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/opportunities?search={query}&limit={10}
//   - With `search`: search by id/name (legacy behavior).
//   - With `leaids=a,b,c`: list opportunities in the given district set
//     (used by Saved Views' Opps view).
//   - With neither: returns an empty list.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const leaidsArg = searchParams.get("leaids");
    const leaids = leaidsArg
      ? leaidsArg.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "10", 10),
      50
    );

    // Build the where clause based on the call shape. Search and leaids are
    // both honored — combining them narrows by both, which is the natural
    // expectation for any future "search within this plan" UX.
    const where: Record<string, unknown> = {};
    if (search && search.trim()) {
      where.OR = [
        { id: { contains: search.trim(), mode: "insensitive" } },
        { name: { contains: search.trim(), mode: "insensitive" } },
      ];
    }
    if (leaids && leaids.length > 0) {
      where.districtLeaId = { in: leaids };
    }

    // If neither search nor leaids supplied, fall back to legacy empty
    // response (the original handler treated this as "no query → no rows").
    if (!search?.trim() && (!leaids || leaids.length === 0)) {
      return NextResponse.json({ opportunities: [] });
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
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
      orderBy: [{ closeDate: "desc" }, { name: "asc" }],
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
