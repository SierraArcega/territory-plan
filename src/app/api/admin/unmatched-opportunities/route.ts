import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { normalizeState } from "@/lib/states";

export const dynamic = "force-dynamic";

const SORTABLE_COLUMNS = new Set([
  "name", "accountName", "state", "schoolYr", "stage",
  "netBookingAmount", "reason", "resolved", "resolvedDistrictLeaid",
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
    const rawState = searchParams.get("state");
    const state = rawState ? normalizeState(rawState) : null;
    const stage = searchParams.get("stage");
    const reason = searchParams.get("reason");
    const hasDistrictId = searchParams.get("has_district_id");
    const stageGroup = searchParams.get("stage_group");
    const rep = searchParams.get("rep");
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

    if (stage) {
      where.stage = stage;
    }

    if (reason) {
      where.reason = reason;
    }

    if (hasDistrictId === "true") {
      where.accountLmsId = { not: null };
    } else if (hasDistrictId === "false") {
      where.accountLmsId = null;
    }

    if (stageGroup === "open") {
      where.NOT = { stage: { contains: "Closed", mode: "insensitive" } };
    } else if (stageGroup === "closed_won") {
      where.stage = { contains: "Closed Won", mode: "insensitive" };
    } else if (stageGroup === "closed_lost") {
      where.AND = [
        { stage: { contains: "Closed", mode: "insensitive" } },
        { NOT: { stage: { contains: "Closed Won", mode: "insensitive" } } },
      ];
    }

    if (search && search.length >= 2) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { accountName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (rep) {
      const profile = await prisma.userProfile.findUnique({
        where: { id: rep },
        select: { email: true },
      });
      if (!profile?.email) {
        return NextResponse.json({
          items: [],
          pagination: { page, pageSize, total: 0 },
        });
      }
      // Bounded by a single rep's lifetime opportunity count (~hundreds typical).
      // The 5000 cap is a tripwire: if a rep ever exceeds it, the chip will under-count
      // and we should add an index on opportunities.sales_rep_email + tighten this.
      const oppRows = await prisma.opportunity.findMany({
        where: { salesRepEmail: profile.email },
        select: { id: true },
        take: 5000,
      });
      where.id = { in: oppRows.map((o) => o.id) };
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
