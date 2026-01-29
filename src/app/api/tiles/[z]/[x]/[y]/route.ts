import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const { z, x, y } = await params;
    const zoom = parseInt(z);
    const tileX = parseInt(x);
    // Remove .mvt extension if present
    const tileY = parseInt(y.replace(".mvt", ""));

    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
      return NextResponse.json(
        { error: "Invalid tile coordinates" },
        { status: 400 }
      );
    }

    // Get optional state filter from query params
    const { searchParams } = new URL(request.url);
    const stateFilter = searchParams.get("state");

    // Build MVT query - filter by state if provided for better performance
    // Use a subquery to check for revenue instead of passing large arrays
    const query = `
      WITH tile_bounds AS (
        SELECT
          ST_TileEnvelope($1, $2, $3) AS envelope,
          ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS envelope_4326
      ),
      revenue_leaids AS (
        SELECT leaid FROM fullmind_data
        WHERE fy25_net_invoicing > 0 OR fy26_net_invoicing > 0
      ),
      tile_data AS (
        SELECT
          d.leaid,
          d.name,
          d.state_abbrev,
          EXISTS (SELECT 1 FROM revenue_leaids r WHERE r.leaid = d.leaid) AS has_revenue,
          ST_AsMVTGeom(
            ST_Transform(d.geometry, 3857),
            (SELECT envelope FROM tile_bounds),
            4096,
            64,
            true
          ) AS geom
        FROM districts d
        WHERE d.geometry IS NOT NULL
          AND d.geometry && (SELECT envelope_4326 FROM tile_bounds)
          ${stateFilter ? "AND d.state_abbrev = $4" : ""}
      )
      SELECT ST_AsMVT(tile_data, 'districts', 4096, 'geom') AS mvt
      FROM tile_data
      WHERE geom IS NOT NULL
    `;

    // Build query parameters
    const queryParams = stateFilter
      ? [zoom, tileX, tileY, stateFilter]
      : [zoom, tileX, tileY];

    const client = await pool.connect();
    try {
      const result = await client.query(query, queryParams);
      const mvt = result.rows[0]?.mvt;

      if (!mvt || mvt.length === 0) {
        // Return empty tile
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Content-Type": "application/vnd.mapbox-vector-tile",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      return new NextResponse(mvt, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Cache-Control": "public, max-age=3600",
          "Content-Length": mvt.length.toString(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error generating tile:", error);
    return NextResponse.json(
      { error: "Failed to generate tile" },
      { status: 500 }
    );
  }
}
