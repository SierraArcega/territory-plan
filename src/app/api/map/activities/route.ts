import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/map/activities
 *
 * Returns a GeoJSON FeatureCollection of activities positioned at linked
 * district centroids. Multi-district activities produce one feature per
 * district. Auth required — scoped to the current user's activities.
 *
 * Query params:
 *   - bounds: "west,south,east,north" (required)
 *   - type: filter by activity type (conference, road_trip, etc.)
 *   - status: filter by activity status (planned, completed, cancelled)
 *   - startDate: filter activities starting on or after this date (ISO string)
 *   - endDate: filter activities ending on or before this date (ISO string)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const conditions: string[] = [
      "d.centroid IS NOT NULL",
      "ST_X(d.centroid) >= $1",
      "ST_Y(d.centroid) >= $2",
      "ST_X(d.centroid) <= $3",
      "ST_Y(d.centroid) <= $4",
      "a.created_by_user_id = $5",
    ];
    const params: (string | number)[] = [west, south, east, north, user.id];

    if (type) {
      params.push(type);
      conditions.push(`a.type = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      conditions.push(`a.start_date >= $${params.length}::timestamp`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`a.end_date <= $${params.length}::timestamp`);
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT
          a.id,
          a.title,
          a.type,
          a.status,
          a.start_date AS "startDate",
          a.end_date AS "endDate",
          a.outcome,
          d.name AS "districtName",
          d.leaid,
          ST_X(d.centroid) AS lng,
          ST_Y(d.centroid) AS lat
        FROM activities a
        INNER JOIN activity_districts ad ON a.id = ad.activity_id
        INNER JOIN districts d ON ad.district_leaid = d.leaid
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
          type: row.type,
          status: row.status,
          startDate: row.startDate,
          endDate: row.endDate,
          outcome: row.outcome,
          districtName: row.districtName,
          leaid: row.leaid,
        },
      }));

      return NextResponse.json(
        { type: "FeatureCollection", features },
        {
          headers: {
            // No public cache — user-scoped data
            "Cache-Control": "private, max-age=60",
          },
        }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching map activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch map activities" },
      { status: 500 }
    );
  }
}
