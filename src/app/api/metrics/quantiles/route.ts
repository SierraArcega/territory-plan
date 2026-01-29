import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Metric column mapping
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

    const metricColumn = METRIC_COLUMNS[metric]?.[year] || "fy26_net_invoicing";

    // Calculate quantile breaks using PostgreSQL's percentile_cont
    // We want 5 classes, so we need 4 break points (20%, 40%, 60%, 80%)
    const query = `
      WITH metric_values AS (
        SELECT ${metricColumn}::float AS value
        FROM fullmind_data
        WHERE ${metricColumn} > 0
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
      const result = await client.query(query);
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
