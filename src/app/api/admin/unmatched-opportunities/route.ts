import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/unmatched-opportunities — list with filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved");
    const schoolYr = searchParams.get("school_yr");
    const state = searchParams.get("state");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") || "50", 10)));

    const where: Record<string, unknown> = {};

    if (resolved === "true") {
      where.resolved = true;
    } else if (resolved === "false") {
      where.resolved = false;
    }

    if (schoolYr) {
      where.schoolYr = schoolYr;
    }

    if (state) {
      where.state = state;
    }

    const [items, total] = await Promise.all([
      prisma.unmatchedOpportunity.findMany({
        where,
        orderBy: { netBookingAmount: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.unmatchedOpportunity.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total },
    });
  } catch (error) {
    console.error("Error fetching unmatched opportunities:", error);
    return NextResponse.json({ error: "Failed to fetch unmatched opportunities" }, { status: 500 });
  }
}
