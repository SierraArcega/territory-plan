import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fyParam = searchParams.get("fy") || "fy26";
    const fy = fyParam === "fy25" ? "fy25" : "fy26";
    const states = searchParams.get("states");
    const owner = searchParams.get("owner");
    const planId = searchParams.get("planId");
    const accountTypes = searchParams.get("accountTypes");
    const vendors = searchParams.get("vendors");

    // Build dynamic WHERE clauses
    const conditions: string[] = [];
    const params: (string | string[])[] = [];
    let paramIdx = 1;

    if (states) {
      const stateList = states.split(",").filter(Boolean);
      if (stateList.length > 0) {
        conditions.push(`dmf.state_abbrev = ANY($${paramIdx})`);
        params.push(stateList);
        paramIdx++;
      }
    }

    if (owner) {
      conditions.push(`dmf.sales_executive = $${paramIdx}`);
      params.push(owner);
      paramIdx++;
    }

    if (planId) {
      conditions.push(`dmf.plan_ids LIKE '%' || $${paramIdx} || '%'`);
      params.push(planId);
      paramIdx++;
    }

    if (accountTypes) {
      const typeList = accountTypes.split(",").filter(Boolean);
      if (typeList.length > 0) {
        conditions.push(`dmf.account_type = ANY($${paramIdx})`);
        params.push(typeList);
        paramIdx++;
      }
    }

    const vendorList = vendors ? vendors.split(",").filter(Boolean) : [];
    if (vendorList.length > 0) {
      const vendorConditions = vendorList.map((v) => {
        const col = `${fy}_${v}_category`;
        return `dmf.${col} IS NOT NULL`;
      });
      conditions.push(`(${vendorConditions.join(" OR ")})`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const revenueCol = `${fy}_sessions_revenue`;
    const invoicingCol = `${fy}_net_invoicing`;
    const bookingsCol = `${fy}_closed_won_net_booking`;
    const hasPipeline = fy === "fy26";
    const pipelineCol = hasPipeline ? "fy26_open_pipeline" : null;
    const weightedPipelineCol = hasPipeline ? "fy26_open_pipeline_weighted" : null;

    const fullmindCatCol = `${fy}_fullmind_category`;

    const query = `
      SELECT
        dmf.${fullmindCatCol} AS category,
        COUNT(*)::int AS count,
        COALESCE(SUM(d.enrollment), 0)::bigint AS total_enrollment,
        COALESCE(SUM(d.${revenueCol}), 0)::float AS sessions_revenue,
        COALESCE(SUM(d.${invoicingCol}), 0)::float AS net_invoicing,
        COALESCE(SUM(d.${bookingsCol}), 0)::float AS closed_won_bookings
        ${hasPipeline ? `,
        COALESCE(SUM(d.${pipelineCol}), 0)::float AS open_pipeline,
        COALESCE(SUM(d.${weightedPipelineCol}), 0)::float AS weighted_pipeline
        ` : ""}
      FROM district_map_features dmf
      JOIN districts d ON dmf.leaid = d.leaid
      ${whereClause}
      GROUP BY dmf.${fullmindCatCol}
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query, params);

      let count = 0;
      let totalEnrollment = 0;
      let sessionsRevenue = 0;
      let netInvoicing = 0;
      let closedWonBookings = 0;
      let openPipeline = 0;
      let weightedPipeline = 0;
      const byCategory: Record<string, {
        count: number;
        totalEnrollment: number;
        sessionsRevenue: number;
        netInvoicing: number;
        closedWonBookings: number;
        openPipeline: number;
        weightedPipeline: number;
      }> = {};

      for (const row of result.rows) {
        const cat = row.category || "uncategorized";
        const entry = {
          count: row.count,
          totalEnrollment: Number(row.total_enrollment),
          sessionsRevenue: row.sessions_revenue,
          netInvoicing: row.net_invoicing,
          closedWonBookings: row.closed_won_bookings,
          openPipeline: hasPipeline ? row.open_pipeline : 0,
          weightedPipeline: hasPipeline ? row.weighted_pipeline : 0,
        };
        byCategory[cat] = entry;
        count += entry.count;
        totalEnrollment += entry.totalEnrollment;
        sessionsRevenue += entry.sessionsRevenue;
        netInvoicing += entry.netInvoicing;
        closedWonBookings += entry.closedWonBookings;
        openPipeline += entry.openPipeline;
        weightedPipeline += entry.weightedPipeline;
      }

      return NextResponse.json({
        count,
        totalEnrollment,
        sessionsRevenue,
        netInvoicing,
        closedWonBookings,
        openPipeline,
        weightedPipeline,
        byCategory,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching district summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch district summary" },
      { status: 500 }
    );
  }
}
