import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { readonlyPool } from "@/lib/db-readonly";
import { compileFilterTree } from "@/lib/saved-views/sql-compiler";
import { filterNodeSchema } from "@/lib/saved-views/schema";
import { emptyAndTree } from "@/lib/saved-views/filter-tree";
import type { FilterNode } from "@/lib/saved-views/filter-tree";

export const dynamic = "force-dynamic";

// GET /api/territory-plans/[id]/districts/export
// Returns all matching district rows for a plan without pagination.
// Accepts optional ?filters=<JSON> query param validated by filterNodeSchema.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: planId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse and validate optional filters query param.
    let requestFilter: FilterNode = emptyAndTree();
    const filtersParam = searchParams.get("filters");
    if (filtersParam) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(filtersParam);
      } catch {
        return NextResponse.json(
          { error: "Invalid filters JSON" },
          { status: 400 },
        );
      }
      const result = filterNodeSchema.safeParse(parsed);
      if (!result.success) {
        return NextResponse.json(
          { error: `Invalid filter shape: ${result.error.message}` },
          { status: 400 },
        );
      }
      requestFilter = result.data;
    }

    // Fetch the plan with its districts.
    const plan = await prisma.territoryPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        districts: {
          select: { districtLeaid: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.districts.length === 0) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    const planLeaids = plan.districts.map((d) => d.districtLeaid);

    // Compile the filter tree into a parameterized WHERE fragment.
    const compileResult = compileFilterTree(
      "districts",
      requestFilter,
      "t",
      0,
      { planId },
    );
    if (!compileResult.ok) {
      return NextResponse.json(
        { error: `Filter compile error: ${compileResult.error}` },
        { status: 400 },
      );
    }

    // Build params: compiled filter params first, then leaids array, then planId.
    const queryParams: unknown[] = [...compileResult.params];

    queryParams.push(planLeaids);
    const leaidsParamIdx = queryParams.length;

    queryParams.push(planId);
    const planParamIdx = queryParams.length;

    // Build WHERE clause. If compileFilterTree returned a non-empty whereSql
    // (and not just "TRUE"), combine it with the leaids scope. Otherwise use
    // just the leaids scope.
    const compiledWhere = compileResult.whereSql;
    const leaidsClause = `t.leaid = ANY($${leaidsParamIdx})`;

    let whereClause: string;
    if (compiledWhere && compiledWhere !== "TRUE") {
      whereClause = `${compiledWhere} AND ${leaidsClause}`;
    } else {
      whereClause = leaidsClause;
    }

    // Build and execute the query — NO LIMIT/OFFSET.
    const sql = `
      SELECT
        t.leaid,
        t.name,
        t.state_abbrev,
        t.enrollment,
        tpd.renewal_target::float     AS renewal_target,
        tpd.winback_target::float     AS winback_target,
        tpd.expansion_target::float   AS expansion_target,
        tpd.new_business_target::float AS new_business_target
      FROM districts t
      LEFT JOIN territory_plan_districts tpd
        ON tpd.district_leaid = t.leaid AND tpd.plan_id = $${planParamIdx}
      WHERE ${whereClause}
      ORDER BY t.name ASC
    `.trim();

    const result = await readonlyPool.query(sql, queryParams);

    return NextResponse.json({
      rows: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    console.error("[district-export] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
