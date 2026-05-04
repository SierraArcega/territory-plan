import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/map/plans/list
 *
 * Lightweight companion to /api/map/plans/[z]/[x]/[y].
 * Returns one row per (plan, district) pair with plan + target metadata,
 * **without** geometry. Used by:
 *   - `useCrossFilter` (extracts leaids to filter other overlays)
 *   - `<PlansTab>` (groups by planId for the sidebar list)
 *   - `SearchResults/index.tsx` tab counts
 *
 * Query params (mirror the legacy /api/map/plans endpoint):
 *   - status: comma-separated plan statuses
 *   - fiscalYear: integer FY
 *   - planId: single-plan mode
 *   - planIds: comma-separated plan UUIDs
 *   - ownerIds: comma-separated owner UUIDs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const fiscalYearRaw = searchParams.get("fiscalYear");
    const planId = searchParams.get("planId");
    const planIdsParam = searchParams.get("planIds");
    const ownerIdsParam = searchParams.get("ownerIds");

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    const placeholderFor = (val: string | number) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(`tp.status = ${placeholderFor(statuses[0])}`);
      } else if (statuses.length > 1) {
        const ph = statuses.map((s) => placeholderFor(s)).join(",");
        conditions.push(`tp.status IN (${ph})`);
      }
    }

    if (fiscalYearRaw) {
      const fy = parseInt(fiscalYearRaw, 10);
      if (isNaN(fy)) {
        return NextResponse.json(
          { error: "Invalid fiscalYear format" },
          { status: 400 }
        );
      }
      conditions.push(`tp.fiscal_year = ${placeholderFor(fy)}`);
    }

    if (planId) {
      conditions.push(`tp.id = ${placeholderFor(planId)}`);
    }

    if (planIdsParam) {
      const ids = planIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        const ph = ids.map((id) => placeholderFor(id)).join(",");
        conditions.push(`tp.id IN (${ph})`);
      }
    }

    if (ownerIdsParam) {
      const ids = ownerIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        const ph = ids.map((id) => placeholderFor(id)).join(",");
        conditions.push(`tp.owner_id IN (${ph})`);
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT
          tp.id AS "planId",
          tp.name AS "planName",
          tp.color AS "planColor",
          tp.status AS "planStatus",
          d.name AS "districtName",
          d.leaid,
          tpd.renewal_target AS "renewalTarget",
          tpd.expansion_target AS "expansionTarget"
        FROM territory_plans tp
        INNER JOIN territory_plan_districts tpd ON tp.id = tpd.plan_id
        INNER JOIN districts d ON tpd.district_leaid = d.leaid
        ${whereClause}
        `,
        params
      );

      const rows = result.rows.map((r) => ({
        planId: r.planId,
        planName: r.planName,
        planColor: r.planColor,
        planStatus: r.planStatus,
        districtName: r.districtName,
        leaid: r.leaid,
        renewalTarget: r.renewalTarget != null ? parseFloat(r.renewalTarget) : null,
        expansionTarget: r.expansionTarget != null ? parseFloat(r.expansionTarget) : null,
      }));

      return NextResponse.json(rows, {
        headers: { "Cache-Control": "public, max-age=120" },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching plan list:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan list" },
      { status: 500 }
    );
  }
}
