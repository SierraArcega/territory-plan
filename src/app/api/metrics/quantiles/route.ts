import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Map metric names to district_financials column names
const DF_COLUMN_MAP: Record<string, string> = {
  sessions_revenue: "total_revenue",
  sessions_take: "total_take",
  sessions_count: "session_count",
  closed_won_net_booking: "closed_won_bookings",
  net_invoicing: "invoicing",
  open_pipeline: "open_pipeline",
  open_pipeline_weighted: "weighted_pipeline",
};

// Map FY year param to district_financials fiscal_year value
// For metrics without specific FY data (e.g. FY27 sessions), fall back to FY26
function resolveFiscalYear(metric: string, year: string): string {
  const fy = year.toUpperCase(); // "fy26" → "FY26"
  // Pipeline metrics exist for FY27, other metrics don't
  if (fy === "FY27" && !metric.startsWith("open_pipeline")) return "FY26";
  if (fy === "FY25" && metric.startsWith("open_pipeline")) return "FY26";
  return fy;
}

// Choropleth color ramp (blue sequential)
const CHOROPLETH_COLORS = [
  "#f7fbff", // Lightest
  "#c6dbef",
  "#6baed6",
  "#2171b5",
  "#084594", // Darkest
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric") || "net_invoicing";
    const year = searchParams.get("year") || "fy26";

    const dfColumn = DF_COLUMN_MAP[metric] || "invoicing";
    const fiscalYear = resolveFiscalYear(metric, year);

    // Calculate quantile breaks using PostgreSQL's percentile_cont
    // We want 5 classes, so we need 4 break points (20%, 40%, 60%, 80%)
    const query = `
      WITH metric_values AS (
        SELECT COALESCE(df.${dfColumn}, 0)::float AS value
        FROM districts d
        LEFT JOIN district_financials df ON df.leaid = d.leaid
          AND df.vendor = 'fullmind' AND df.fiscal_year = $1
        WHERE COALESCE(df.${dfColumn}, 0) > 0
      )
      SELECT
        percentile_cont(0.2) WITHIN GROUP (ORDER BY value) AS p20,
        percentile_cont(0.4) WITHIN GROUP (ORDER BY value) AS p40,
        percentile_cont(0.6) WITHIN GROUP (ORDER BY value) AS p60,
        percentile_cont(0.8) WITHIN GROUP (ORDER BY value) AS p80,
        MAX(value) AS max_value,
        MIN(value) AS min_value,
        COUNT(*) AS count
      FROM metric_values
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query, [fiscalYear]);
      const row = result.rows[0];

      if (!row || row.count === 0) {
        // No data, return default breaks
        return NextResponse.json({
          breaks: [0, 1000, 10000, 50000, 100000],
          colors: CHOROPLETH_COLORS,
          min: 0,
          max: 0,
          count: 0,
        });
      }

      // Build breaks array: [0, p20, p40, p60, p80]
      // Values above p80 get the darkest color
      const breaks = [
        0,
        Math.round(parseFloat(row.p20) || 0),
        Math.round(parseFloat(row.p40) || 0),
        Math.round(parseFloat(row.p60) || 0),
        Math.round(parseFloat(row.p80) || 0),
      ];

      return NextResponse.json({
        breaks,
        colors: CHOROPLETH_COLORS,
        min: Math.round(parseFloat(row.min_value) || 0),
        max: Math.round(parseFloat(row.max_value) || 0),
        count: parseInt(row.count),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error calculating quantiles:", error);
    return NextResponse.json(
      { error: "Failed to calculate quantiles" },
      { status: 500 }
    );
  }
}
