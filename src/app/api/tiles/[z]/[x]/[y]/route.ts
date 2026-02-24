import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_FYS = ["fy24", "fy25", "fy26", "fy27"] as const;
const VENDOR_COLS = ["fullmind", "proximity", "elevate", "tbt"] as const;

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
    const fy = VALID_FYS.includes(fyParam as (typeof VALID_FYS)[number]) ? fyParam : "fy26";

    // Optional second FY for comparison mode
    const fy2Param = searchParams.get("fy2");
    const fy2 = fy2Param && VALID_FYS.includes(fy2Param as (typeof VALID_FYS)[number])
      ? fy2Param
      : null;

    // At low zoom (national view), only load districts with vendor data
    const isNationalView = zoom < 6 && !stateFilter;

    // Geometry simplification tolerance based on zoom level
    const simplifyTolerance = zoom < 5 ? 0.01 : zoom < 7 ? 0.005 : 0.001;

    // Build category column aliases based on whether fy2 is present
    let categoryColumns: string;
    if (fy2) {
      // Comparison mode: include both FYs with _a / _b suffixes
      const cols: string[] = [];
      for (const vendor of VENDOR_COLS) {
        cols.push(`d.${fy}_${vendor}_category AS ${vendor}_category_a`);
        cols.push(`d.${fy2}_${vendor}_category AS ${vendor}_category_b`);
      }
      categoryColumns = cols.join(",\n          ");
    } else {
      // Normal mode: single FY aliased to generic names
      categoryColumns = VENDOR_COLS.map(
        (vendor) => `d.${fy}_${vendor}_category AS ${vendor}_category`
      ).join(",\n          ");
    }

    // Build national view optimization filter
    let nationalFilter = "";
    if (isNationalView) {
      if (fy2) {
        // Include districts with data in EITHER year
        const fy1Parts = VENDOR_COLS.map((v) => `d.${fy}_${v}_category IS NOT NULL`);
        const fy2Parts = VENDOR_COLS.map((v) => `d.${fy2}_${v}_category IS NOT NULL`);
        nationalFilter = `AND (
            ${[...fy1Parts, ...fy2Parts].join("\n            OR ")}
          )`;
      } else {
        nationalFilter = `AND (
            ${VENDOR_COLS.map((v) => `d.${fy}_${v}_category IS NOT NULL`).join("\n            OR ")}
          )`;
      }
    }

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
          ${categoryColumns},
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
          ${nationalFilter}
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
