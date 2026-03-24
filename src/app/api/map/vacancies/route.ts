import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/map/vacancies
 *
 * Returns a GeoJSON FeatureCollection of vacancies positioned at the
 * linked school's lat/lng when available, falling back to the district
 * centroid. No auth required.
 *
 * Query params:
 *   - bounds: "west,south,east,north" (required)
 *   - category: filter by vacancy category (SPED, ELL, etc.)
 *   - status: filter by vacancy status (open, closed, expired)
 *   - dateStart: filter vacancies posted on or after this date (ISO string)
 *   - dateEnd: filter vacancies posted on or before this date (ISO string)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bounds = searchParams.get("bounds");

    if (!bounds) {
      return NextResponse.json(
        { error: "bounds parameter required (west,south,east,north)" },
        { status: 400 }
      );
    }

    const [west, south, east, north] = bounds.split(",").map(Number);
    if ([west, south, east, north].some(isNaN)) {
      return NextResponse.json(
        { error: "Invalid bounds format" },
        { status: 400 }
      );
    }

    const category = searchParams.get("category");
    const status = searchParams.get("status") ?? "open"; // default to open vacancies only
    const dateStart = searchParams.get("dateStart");
    const dateEnd = searchParams.get("dateEnd");
    const states = searchParams.get("states"); // comma-separated state abbreviations

    // Use COALESCE to prefer school lat/lng, fall back to district centroid
    const conditions: string[] = [
      `COALESCE(s.longitude::double precision, ST_X(d.centroid)) IS NOT NULL`,
      `COALESCE(s.latitude::double precision, ST_Y(d.centroid)) IS NOT NULL`,
      `COALESCE(s.longitude::double precision, ST_X(d.centroid)) >= $1`,
      `COALESCE(s.latitude::double precision, ST_Y(d.centroid)) >= $2`,
      `COALESCE(s.longitude::double precision, ST_X(d.centroid)) <= $3`,
      `COALESCE(s.latitude::double precision, ST_Y(d.centroid)) <= $4`,
    ];
    const params: (string | number)[] = [west, south, east, north];

    if (category) {
      params.push(category);
      conditions.push(`v.category = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`v.status = $${params.length}`);
    }

    if (dateStart) {
      params.push(dateStart);
      conditions.push(`v.date_posted >= $${params.length}::timestamp`);
    }

    if (dateEnd) {
      params.push(dateEnd);
      conditions.push(`v.date_posted <= $${params.length}::timestamp`);
    }

    if (states) {
      const stateList = states.split(",").map((s) => s.trim()).filter(Boolean);
      if (stateList.length > 0) {
        params.push(stateList.join(","));
        conditions.push(`d.state_abbrev = ANY(string_to_array($${params.length}, ','))`);
      }
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT
          v.id,
          v.title,
          v.category,
          v.status,
          v.school_name AS "schoolName",
          v.date_posted AS "datePosted",
          CASE
            WHEN v.date_posted IS NOT NULL
            THEN EXTRACT(DAY FROM NOW() - v.date_posted)::int
            ELSE NULL
          END AS "daysOpen",
          v.fullmind_relevant AS "fullmindRelevant",
          d.name AS "districtName",
          d.leaid,
          v.source_url AS "sourceUrl",
          d.job_board_url AS "jobBoardUrl",
          tp_agg.plans AS "plans",
          COALESCE(s.longitude::double precision, ST_X(d.centroid)) AS lng,
          COALESCE(s.latitude::double precision, ST_Y(d.centroid)) AS lat
        FROM vacancies v
        INNER JOIN districts d ON v.leaid = d.leaid
        LEFT JOIN schools s ON v.school_ncessch = s.ncessch
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(jsonb_build_object(
            'id', tp.id,
            'name', tp.name,
            'fiscalYear', tp.fiscal_year,
            'color', tp.color
          )) AS plans
          FROM territory_plan_districts tpd
          INNER JOIN territory_plans tp ON tpd.plan_id = tp.id
          WHERE tpd.district_leaid = v.leaid
        ) tp_agg ON true
        WHERE ${conditions.join(" AND ")}
        `,
        params
      );

      const features = result.rows.map((row) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [row.lng, row.lat],
        },
        properties: {
          id: row.id,
          title: row.title,
          category: row.category,
          status: row.status,
          schoolName: row.schoolName,
          datePosted: row.datePosted,
          daysOpen: row.daysOpen,
          fullmindRelevant: row.fullmindRelevant,
          districtName: row.districtName,
          leaid: row.leaid,
          sourceUrl: row.sourceUrl,
          jobBoardUrl: row.jobBoardUrl,
          plans: row.plans ?? null,
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
    console.error("Error fetching map vacancies:", error);
    return NextResponse.json(
      { error: "Failed to fetch map vacancies" },
      { status: 500 }
    );
  }
}
