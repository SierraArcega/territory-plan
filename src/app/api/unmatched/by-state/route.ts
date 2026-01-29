import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    // Aggregate unmatched accounts by state
    const query = `
      SELECT
        state_abbrev,
        COUNT(*) AS unmatched_count,
        SUM(fy26_open_pipeline + fy27_open_pipeline)::float AS total_pipeline,
        SUM(fy25_net_invoicing + fy26_net_invoicing)::float AS total_invoicing,
        SUM(CASE WHEN is_customer THEN 1 ELSE 0 END) AS customer_count,
        SUM(CASE WHEN has_open_pipeline THEN 1 ELSE 0 END) AS pipeline_count
      FROM unmatched_accounts
      GROUP BY state_abbrev
      ORDER BY unmatched_count DESC
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query);

      const summaries = result.rows.map((row) => ({
        stateAbbrev: row.state_abbrev,
        unmatchedCount: parseInt(row.unmatched_count),
        totalPipeline: parseFloat(row.total_pipeline) || 0,
        totalInvoicing: parseFloat(row.total_invoicing) || 0,
        customerCount: parseInt(row.customer_count),
        pipelineCount: parseInt(row.pipeline_count),
      }));

      return NextResponse.json(summaries);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching state summaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch state summaries" },
      { status: 500 }
    );
  }
}
