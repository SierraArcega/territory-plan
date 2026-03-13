import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/unmatched-opportunities/facets — distinct values for filter dropdowns
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const [stages, reasons] = await Promise.all([
      prisma.unmatchedOpportunity.findMany({
        where: { stage: { not: null } },
        distinct: ["stage"],
        select: { stage: true },
        orderBy: { stage: "asc" },
      }),
      prisma.unmatchedOpportunity.findMany({
        where: { reason: { not: null } },
        distinct: ["reason"],
        select: { reason: true },
        orderBy: { reason: "asc" },
      }),
    ]);

    return NextResponse.json({
      stages: stages.map((s) => s.stage!).filter(Boolean),
      reasons: reasons.map((r) => r.reason!).filter(Boolean),
    });
  } catch (error) {
    console.error("Error fetching facets:", error);
    return NextResponse.json({ error: "Failed to fetch facets" }, { status: 500 });
  }
}
