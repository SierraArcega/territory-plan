import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SORTABLE_COLUMNS = new Set([
  "name", "accountName", "state", "schoolYr", "stage",
  "netBookingAmount", "reason", "resolved",
]);

// GET /api/admin/unmatched-opportunities — list with filtering, sorting, and search
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
    const sortBy = searchParams.get("sort_by") || "netBookingAmount";
    const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";
    const search = searchParams.get("search") || "";
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

    if (search && search.length >= 2) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { accountName: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderByColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "netBookingAmount";

    const [items, total] = await Promise.all([
      prisma.unmatchedOpportunity.findMany({
        where,
        orderBy: { [orderByColumn]: sortDir },
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
