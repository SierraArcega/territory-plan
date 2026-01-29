import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Category colors and sizes for the legend
export const DOT_CATEGORIES = {
  multi_year: { color: "#403770", size: 8, label: "Multi-year customer" },
  new: { color: "#22C55E", size: 6, label: "New this year" },
  lapsed: { color: "#403770", opacity: 0.4, size: 6, label: "Lapsed customer" },
  prospect: { color: "#F59E0B", size: 5, label: "Prospect" },
} as const;

export type DotCategory = keyof typeof DOT_CATEGORIES;

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Query districts with Fullmind data, calculating category based on revenue
      // - multi_year: has FY25 AND FY26 revenue
      // - new: has FY26 revenue only (no FY25)
      // - lapsed: has FY25 revenue but NO FY26 revenue
      // - prospect: no revenue but has open pipeline
      const result = await client.query(`
        SELECT
          d.leaid,
          d.name,
          d.state_abbrev as "stateAbbrev",
          ST_X(ST_Centroid(d.geometry)) as lng,
          ST_Y(ST_Centroid(d.geometry)) as lat,
          CASE
            WHEN (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
              AND (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
            THEN 'multi_year'
            WHEN (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
              AND NOT (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
            THEN 'new'
            WHEN (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
              AND NOT (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
            THEN 'lapsed'
            WHEN f.has_open_pipeline = true
            THEN 'prospect'
            ELSE NULL
          END as category
        FROM districts d
        INNER JOIN fullmind_data f ON d.leaid = f.leaid
        WHERE d.geometry IS NOT NULL
          AND (f.is_customer = true OR f.has_open_pipeline = true)
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
