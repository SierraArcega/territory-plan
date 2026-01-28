import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// Use connection pool for tile requests
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const dynamic = "force-dynamic";

// Metric column mapping for choropleth
const METRIC_COLUMNS: Record<string, Record<string, string>> = {
  sessions_revenue: {
    fy25: "fy25_sessions_revenue",
    fy26: "fy26_sessions_revenue",
    fy27: "fy26_sessions_revenue",
  },
  sessions_take: {
    fy25: "fy25_sessions_take",
    fy26: "fy26_sessions_take",
    fy27: "fy26_sessions_take",
  },
  sessions_count: {
    fy25: "fy25_sessions_count",
    fy26: "fy26_sessions_count",
    fy27: "fy26_sessions_count",
  },
  closed_won_net_booking: {
    fy25: "fy25_closed_won_net_booking",
    fy26: "fy26_closed_won_net_booking",
    fy27: "fy26_closed_won_net_booking",
  },
  net_invoicing: {
    fy25: "fy25_net_invoicing",
    fy26: "fy26_net_invoicing",
    fy27: "fy26_net_invoicing",
  },
  open_pipeline: {
    fy25: "fy26_open_pipeline",
    fy26: "fy26_open_pipeline",
    fy27: "fy27_open_pipeline",
  },
  open_pipeline_weighted: {
    fy25: "fy26_open_pipeline_weighted",
    fy26: "fy26_open_pipeline_weighted",
    fy27: "fy27_open_pipeline_weighted",
  },
};

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

    // Get metric/year from query params
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric") || "net_invoicing";
    const year = searchParams.get("year") || "fy26";

    const metricColumn = METRIC_COLUMNS[metric]?.[year] || "fy26_net_invoicing";

    // Build MVT query using PostGIS
    // ST_TileEnvelope creates the bounding box for the tile
    // ST_AsMVTGeom clips and transforms geometry for MVT format
    // ST_AsMVT creates the actual MVT binary
    const query = `
      WITH tile_bounds AS (
        SELECT ST_TileEnvelope($1, $2, $3) AS envelope
      ),
      tile_data AS (
        SELECT
          d.leaid,
          d.name,
          d.state_abbrev,
          COALESCE(f.is_customer, false) AS is_customer,
          COALESCE(f.has_open_pipeline, false) AS has_open_pipeline,
          CASE
            WHEN f.is_customer AND f.has_open_pipeline THEN 'customer_pipeline'
            WHEN f.is_customer THEN 'customer'
            WHEN f.has_open_pipeline THEN 'pipeline'
            ELSE 'no_data'
          END AS status,
          COALESCE(f.${metricColumn}, 0)::float AS metric_value,
          ST_AsMVTGeom(
            d.geometry,
            (SELECT envelope FROM tile_bounds),
            4096,
            64,
            true
          ) AS geom
        FROM districts d
        LEFT JOIN fullmind_data f ON d.leaid = f.leaid
        WHERE d.geometry IS NOT NULL
          AND d.geometry && (SELECT envelope FROM tile_bounds)
      )
      SELECT ST_AsMVT(tile_data, 'districts', 4096, 'geom') AS mvt
      FROM tile_data
      WHERE geom IS NOT NULL
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query, [zoom, tileX, tileY]);
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
