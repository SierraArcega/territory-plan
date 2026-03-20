import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/map/plans
 *
 * Returns a GeoJSON FeatureCollection of district polygons belonging to
 * territory plans, with plan metadata attached to each feature.
 * No auth required (plans are team-shared).
 *
 * Query params:
 *   - status: filter by plan status (planning, working, stale, archived)
 *   - fiscalYear: filter by fiscal year (e.g., 2026)
 *   - planId: optional single-plan mode — return districts for one plan only
 *   - planIds: comma-separated list of plan IDs to include
 *   - ownerIds: comma-separated list of owner user IDs to filter by
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const fiscalYear = searchParams.get("fiscalYear");
    const planId = searchParams.get("planId");
    const planIds = searchParams.get("planIds");
    const ownerIds = searchParams.get("ownerIds");

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        params.push(statuses[0]);
        conditions.push(`tp.status = $${params.length}`);
      } else if (statuses.length > 1) {
        const placeholders = statuses.map((s) => {
          params.push(s);
          return `$${params.length}`;
        });
        conditions.push(`tp.status IN (${placeholders.join(",")})`);
      }
    }

    if (fiscalYear) {
      const fy = parseInt(fiscalYear, 10);
      if (isNaN(fy)) {
        return NextResponse.json(
          { error: "Invalid fiscalYear format" },
          { status: 400 }
        );
      }
      params.push(fy);
      conditions.push(`tp.fiscal_year = $${params.length}`);
    }

    if (planId) {
      params.push(planId);
      conditions.push(`tp.id = $${params.length}`);
    }

    if (planIds) {
      const ids = planIds.split(",").filter(Boolean);
      if (ids.length > 0) {
        const placeholders = ids.map((id, i) => {
          params.push(id);
          return `$${params.length}`;
        });
        conditions.push(`tp.id IN (${placeholders.join(",")})`);
      }
    }

    if (ownerIds) {
      const ids = ownerIds.split(",").filter(Boolean);
      if (ids.length > 0) {
        const placeholders = ids.map((id, i) => {
          params.push(id);
          return `$${params.length}`;
        });
        conditions.push(`tp.owner_id IN (${placeholders.join(",")})`);
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
          tpd.expansion_target AS "expansionTarget",
          ST_AsGeoJSON(COALESCE(d.geometry, d.point_location))::json AS geojson
        FROM territory_plans tp
        INNER JOIN territory_plan_districts tpd ON tp.id = tpd.plan_id
        INNER JOIN districts d ON tpd.district_leaid = d.leaid
        ${whereClause}
          ${whereClause ? "AND" : "WHERE"} COALESCE(d.geometry, d.point_location) IS NOT NULL
        `,
        params
      );

      const features = result.rows.map((row) => ({
        type: "Feature" as const,
        geometry: row.geojson,
        properties: {
          planId: row.planId,
          planName: row.planName,
          planColor: row.planColor,
          planStatus: row.planStatus,
          districtName: row.districtName,
          leaid: row.leaid,
          renewalTarget: row.renewalTarget
            ? parseFloat(row.renewalTarget)
            : null,
          expansionTarget: row.expansionTarget
            ? parseFloat(row.expansionTarget)
            : null,
        },
      }));

      return NextResponse.json(
        { type: "FeatureCollection", features },
        {
          headers: {
            "Cache-Control": "public, max-age=120",
          },
        }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching map plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch map plans" },
      { status: 500 }
    );
  }
}
