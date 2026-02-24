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
    const tileY = parseInt(y.replace(".mvt", ""));

    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
      return NextResponse.json(
        { error: "Invalid tile coordinates" },
        { status: 400 }
      );
    }

    // Get optional state filter
    const { searchParams } = new URL(request.url);
    const stateFilter = searchParams.get("state");
    const fyParam = searchParams.get("fy") || "fy26";
    const validFys = ["fy24", "fy25", "fy26", "fy27"] as const;
    const fy = validFys.includes(fyParam as any) ? fyParam : "fy26";

    // At low zoom (national view), only load districts with vendor data
    const isNationalView = zoom < 6 && !stateFilter;

    // Geometry simplification tolerance based on zoom level
    const simplifyTolerance = zoom < 5 ? 0.01 : zoom < 7 ? 0.005 : 0.001;

    const query = `
      WITH tile_bounds AS (
        SELECT
          ST_TileEnvelope($1, $2, $3) AS envelope,
          ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS envelope_4326
      ),
      tile_data AS (
        SELECT
          d.leaid,
          d.name,
          d.state_abbrev,
          d.sales_executive,
          d.plan_ids,
          d.${fy}_fullmind_category AS fullmind_category,
          d.${fy}_proximity_category AS proximity_category,
          d.${fy}_elevate_category AS elevate_category,
          d.${fy}_tbt_category AS tbt_category,
          d.enrollment_signal,
          d.ell_signal,
          d.swd_signal,
          d.locale_signal,
          d.expenditure_signal,
          d.account_type,
          ST_AsMVTGeom(
            ST_Transform(
              ST_Simplify(d.render_geometry, ${simplifyTolerance}),
              3857
            ),
            (SELECT envelope FROM tile_bounds),
            4096,
            64,
            true
          ) AS geom
        FROM district_map_features d
        WHERE d.render_geometry IS NOT NULL
          AND d.render_geometry && (SELECT envelope_4326 FROM tile_bounds)
          ${stateFilter ? "AND d.state_abbrev = $4" : ""}
          ${isNationalView ? `AND (
            d.${fy}_fullmind_category IS NOT NULL
            OR d.${fy}_proximity_category IS NOT NULL
            OR d.${fy}_elevate_category IS NOT NULL
            OR d.${fy}_tbt_category IS NOT NULL
          )` : ""}
      )
      SELECT ST_AsMVT(tile_data, 'districts', 4096, 'geom') AS mvt
      FROM tile_data
      WHERE geom IS NOT NULL
    `;

    const queryParams = stateFilter
      ? [zoom, tileX, tileY, stateFilter]
      : [zoom, tileX, tileY];

    const client = await pool.connect();
    try {
      const result = await client.query(query, queryParams);
      const mvt = result.rows[0]?.mvt;

      if (!mvt || mvt.length === 0) {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Content-Type": "application/vnd.mapbox-vector-tile",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      const cacheTime = isNationalView ? 86400 : 3600;

      return new NextResponse(mvt, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Cache-Control": `public, max-age=${cacheTime}`,
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
