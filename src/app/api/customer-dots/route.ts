import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Category colors and sizes for the legend
export const DOT_CATEGORIES = {
  multi_year: { color: "#403770", size: 10, label: "Multi-year customer" },
  new: { color: "#22C55E", size: 8, label: "New this year" },
  lapsed: { color: "#EF4444", size: 8, label: "Lapsed customer" },
  pipeline: { color: "#F59E0B", size: 7, label: "In pipeline" },
  target: { color: "#6EA3BE", size: 6, label: "Target" },
} as const;

export type DotCategory = keyof typeof DOT_CATEGORIES;

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Query districts calculating category based on revenue
      // - multi_year: has FY25 AND FY26 revenue
      // - new: has FY26 revenue only (no FY25)
      // - lapsed: has FY25 revenue but NO FY26 revenue
      // - pipeline: no revenue but has open pipeline
      // - target: in territory plan but no revenue or pipeline
      const result = await client.query(`
        WITH customer_districts AS (
          SELECT
            d.leaid,
            d.name,
            d.state_abbrev as "stateAbbrev",
            ST_X(ST_Centroid(d.geometry)) as lng,
            ST_Y(ST_Centroid(d.geometry)) as lat,
            CASE
              WHEN (d.fy25_net_invoicing > 0 OR d.fy25_sessions_revenue > 0)
                AND (d.fy26_net_invoicing > 0 OR d.fy26_sessions_revenue > 0)
              THEN 'multi_year'
              WHEN (d.fy26_net_invoicing > 0 OR d.fy26_sessions_revenue > 0)
                AND NOT (d.fy25_net_invoicing > 0 OR d.fy25_sessions_revenue > 0)
              THEN 'new'
              WHEN (d.fy25_net_invoicing > 0 OR d.fy25_sessions_revenue > 0)
                AND NOT (d.fy26_net_invoicing > 0 OR d.fy26_sessions_revenue > 0)
              THEN 'lapsed'
              WHEN d.has_open_pipeline = true
              THEN 'pipeline'
              ELSE NULL
            END as category
          FROM districts d
          WHERE d.geometry IS NOT NULL
            AND (d.is_customer = true OR d.has_open_pipeline = true)
        ),
        target_districts AS (
          SELECT DISTINCT
            d.leaid,
            d.name,
            d.state_abbrev as "stateAbbrev",
            ST_X(ST_Centroid(d.geometry)) as lng,
            ST_Y(ST_Centroid(d.geometry)) as lat,
            'target' as category
          FROM districts d
          INNER JOIN territory_plan_districts tpd ON d.leaid = tpd.district_leaid
          WHERE d.geometry IS NOT NULL
            AND d.is_customer IS NOT TRUE
            AND d.has_open_pipeline IS NOT TRUE
        )
        SELECT * FROM customer_districts WHERE category IS NOT NULL
        UNION ALL
        SELECT * FROM target_districts
        WHERE leaid NOT IN (SELECT leaid FROM customer_districts WHERE category IS NOT NULL)
      `);

      // Filter out nulls and build GeoJSON
      const features = result.rows
        .filter((row) => row.category !== null && row.lng !== null && row.lat !== null)
        .map((row) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [row.lng, row.lat],
          },
          properties: {
            leaid: row.leaid,
            name: row.name,
            stateAbbrev: row.stateAbbrev,
            category: row.category as DotCategory,
          },
        }));

      const geojson = {
        type: "FeatureCollection" as const,
        features,
      };

      return NextResponse.json(geojson, {
        headers: {
          "Cache-Control": "public, max-age=300", // 5 minute cache
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching customer dots:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer dots" },
      { status: 500 }
    );
  }
}
