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

    // Zoom-aware simplification (matches /api/tiles)
    const simplifyTolerance = zoom < 7 ? 0.01 : zoom < 11 ? 0.005 : 0.001;

    // Plan filter parsing — added in Task 4.
    const planFilters = "";
    const filterParams: (string | number)[] = [];

    const query = `
      WITH tile_bounds AS (
        SELECT
          ST_TileEnvelope($1, $2, $3) AS envelope,
          ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS envelope_4326
      ),
      tile_data AS (
        SELECT
          tp.id AS "planId",
          tp.name AS "planName",
          tp.color AS "planColor",
          tp.status AS "planStatus",
          d.name AS "districtName",
          d.leaid,
          tpd.renewal_target AS "renewalTarget",
          tpd.expansion_target AS "expansionTarget",
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
        FROM territory_plans tp
        INNER JOIN territory_plan_districts tpd ON tp.id = tpd.plan_id
        INNER JOIN district_map_features d ON tpd.district_leaid = d.leaid
        WHERE d.render_geometry IS NOT NULL
          AND d.render_geometry && (SELECT envelope_4326 FROM tile_bounds)
          ${planFilters}
      )
      SELECT ST_AsMVT(tile_data, 'plans', 4096, 'geom') AS mvt
      FROM tile_data
      WHERE geom IS NOT NULL
    `;

    const queryParams: (string | number)[] = [zoom, tileX, tileY, ...filterParams];

    const client = await pool.connect();
    try {
      const result = await client.query(query, queryParams);
      const mvt = result.rows[0]?.mvt;
      if (!mvt || mvt.length === 0) {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Content-Type": "application/vnd.mapbox-vector-tile",
            "Cache-Control": "public, max-age=300",
          },
        });
      }
      return new NextResponse(mvt, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Cache-Control": "public, max-age=300",
          "Content-Length": mvt.length.toString(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error generating plans tile:", error);
    return NextResponse.json(
      { error: "Failed to generate tile" },
      { status: 500 }
    );
  }
}
