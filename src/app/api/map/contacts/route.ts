import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/map/contacts
 *
 * Returns a GeoJSON FeatureCollection of contacts positioned at their
 * district's centroid. No auth required (contacts are team-shared).
 *
 * Query params:
 *   - bounds: "west,south,east,north" (required)
 *   - seniorityLevel: filter by seniority level
 *   - persona: filter by persona
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

    const seniorityLevel = searchParams.get("seniorityLevel");
    const persona = searchParams.get("persona");

    // Build parameterized query
    const conditions: string[] = [
      "d.centroid IS NOT NULL",
      "ST_X(d.centroid) >= $1",
      "ST_Y(d.centroid) >= $2",
      "ST_X(d.centroid) <= $3",
      "ST_Y(d.centroid) <= $4",
    ];
    const params: (string | number)[] = [west, south, east, north];

    if (seniorityLevel) {
      params.push(seniorityLevel);
      conditions.push(`c.seniority_level = $${params.length}`);
    }

    if (persona) {
      params.push(persona);
      conditions.push(`c.persona = $${params.length}`);
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT
          c.id,
          c.name,
          c.title,
          c.email,
          c.seniority_level AS "seniorityLevel",
          c.persona,
          d.name AS "districtName",
          d.leaid,
          ST_X(d.centroid) AS lng,
          ST_Y(d.centroid) AS lat
        FROM contacts c
        INNER JOIN districts d ON c.leaid = d.leaid
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
          name: row.name,
          title: row.title,
          email: row.email,
          seniorityLevel: row.seniorityLevel,
          persona: row.persona,
          districtName: row.districtName,
          leaid: row.leaid,
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
    console.error("Error fetching map contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch map contacts" },
      { status: 500 }
    );
  }
}
