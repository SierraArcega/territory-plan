import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/sync — list DataRefreshLog entries
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") || "25", 10)));
    const source = searchParams.get("source");
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sort_by") || "completedAt";
    const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {};

    if (source) {
      where.dataSource = source;
    }

    if (status) {
      where.status = status;
    }

    const validSortColumns = new Set([
      "dataSource", "status", "recordsUpdated", "recordsFailed", "startedAt", "completedAt",
    ]);
    const orderByColumn = validSortColumns.has(sortBy) ? sortBy : "completedAt";

    const [items, total] = await Promise.all([
      prisma.dataRefreshLog.findMany({
        where,
        orderBy: { [orderByColumn]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dataRefreshLog.count({ where }),
    ]);

    // Get distinct data sources for filter dropdown
    const sources = await prisma.dataRefreshLog.findMany({
      distinct: ["dataSource"],
      select: { dataSource: true },
      orderBy: { dataSource: "asc" },
    });

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total },
      sources: sources.map((s) => s.dataSource),
    });
  } catch (error) {
    console.error("Error fetching sync logs:", error);
    return NextResponse.json({ error: "Failed to fetch sync logs" }, { status: 500 });
  }
}
