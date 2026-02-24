import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fyParam = searchParams.get("fy") || "fy26";
    const validFys = ["fy24", "fy25", "fy26", "fy27"] as const;
    const fy = validFys.includes(fyParam as any) ? fyParam : "fy26";
    const fiscalYear = fy.toUpperCase(); // 'FY25' or 'FY26' for vendor_financials
    const states = searchParams.get("states");
    const owner = searchParams.get("owner");
    const planId = searchParams.get("planId");
    const accountTypes = searchParams.get("accountTypes");
    const vendors = searchParams.get("vendors");

    // Build base conditions (shared across combined + per-vendor queries)
    const baseConditions: string[] = [];
    const baseParams: (string | string[])[] = [];
    let paramIdx = 1;

    if (states) {
      const stateList = states.split(",").filter(Boolean);
      if (stateList.length > 0) {
        baseConditions.push(`dmf.state_abbrev = ANY($${paramIdx})`);
        baseParams.push(stateList);
        paramIdx++;
      }
    }

    if (owner) {
      baseConditions.push(`dmf.sales_executive = $${paramIdx}`);
      baseParams.push(owner);
      paramIdx++;
    }

    if (planId) {
      baseConditions.push(`dmf.plan_ids LIKE '%' || $${paramIdx} || '%'`);
      baseParams.push(planId);
      paramIdx++;
    }

    if (accountTypes) {
      const typeList = accountTypes.split(",").filter(Boolean);
      if (typeList.length > 0) {
        baseConditions.push(`dmf.account_type = ANY($${paramIdx})`);
        baseParams.push(typeList);
        paramIdx++;
      }
    }

    // Combined conditions add vendor OR for the main query
    const vendorList = vendors ? vendors.split(",").filter(Boolean) : [];
    const combinedConditions = [...baseConditions];
    if (vendorList.length > 0) {
      const vendorOrParts = vendorList.map((v) => `dmf.${fy}_${v}_category IS NOT NULL`);
      combinedConditions.push(`(${vendorOrParts.join(" OR ")})`);
    }

    const combinedWhere = combinedConditions.length > 0
      ? `WHERE ${combinedConditions.join(" AND ")}`
      : "";

    const fullmindCatCol = `${fy}_fullmind_category`;

    // Combined query: JOIN vendor_financials for all active vendors, group by fullmind category
    // We pass vendorList as an array param for the vf.vendor filter
    const vendorParamIdx = paramIdx;
    const fyParamIdx = paramIdx + 1;
    const combinedParams = [...baseParams, vendorList, fiscalYear];

    const combinedQuery = `
      WITH dist AS (
        SELECT DISTINCT leaid, enrollment FROM districts
      )
      SELECT
        dmf.${fullmindCatCol} AS category,
        COUNT(DISTINCT dmf.leaid)::int AS count,
        COALESCE(SUM(dist.enrollment), 0)::bigint AS total_enrollment,
        COALESCE(SUM(vf.open_pipeline), 0)::float AS open_pipeline,
        COALESCE(SUM(vf.closed_won_bookings), 0)::float AS closed_won_bookings,
        COALESCE(SUM(vf.invoicing), 0)::float AS invoicing,
        COALESCE(SUM(vf.scheduled_revenue), 0)::float AS scheduled_revenue,
        COALESCE(SUM(vf.delivered_revenue), 0)::float AS delivered_revenue,
        COALESCE(SUM(vf.deferred_revenue), 0)::float AS deferred_revenue,
        COALESCE(SUM(vf.total_revenue), 0)::float AS total_revenue,
        COALESCE(SUM(vf.delivered_take), 0)::float AS delivered_take,
        COALESCE(SUM(vf.scheduled_take), 0)::float AS scheduled_take,
        COALESCE(SUM(vf.all_take), 0)::float AS all_take
      FROM district_map_features dmf
      JOIN dist ON dmf.leaid = dist.leaid
      LEFT JOIN vendor_financials vf ON dmf.leaid = vf.leaid
        AND vf.vendor = ANY($${vendorParamIdx})
        AND vf.fiscal_year = $${fyParamIdx}
      ${combinedWhere}
      GROUP BY dmf.${fullmindCatCol}
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(combinedQuery, combinedParams);

      const emptyTotals = {
        count: 0, totalEnrollment: 0,
        openPipeline: 0, closedWonBookings: 0, invoicing: 0,
        scheduledRevenue: 0, deliveredRevenue: 0, deferredRevenue: 0, totalRevenue: 0,
        deliveredTake: 0, scheduledTake: 0, allTake: 0,
      };

      let combined = { ...emptyTotals };
      const byCategory: Record<string, typeof emptyTotals> = {};

      for (const row of result.rows) {
        const cat = row.category || "uncategorized";
        const entry = {
          count: row.count,
          totalEnrollment: Number(row.total_enrollment),
          openPipeline: row.open_pipeline,
          closedWonBookings: row.closed_won_bookings,
          invoicing: row.invoicing,
          scheduledRevenue: row.scheduled_revenue,
          deliveredRevenue: row.delivered_revenue,
          deferredRevenue: row.deferred_revenue,
          totalRevenue: row.total_revenue,
          deliveredTake: row.delivered_take,
          scheduledTake: row.scheduled_take,
          allTake: row.all_take,
        };
        byCategory[cat] = entry;
        combined.count += entry.count;
        combined.totalEnrollment += entry.totalEnrollment;
        combined.openPipeline += entry.openPipeline;
        combined.closedWonBookings += entry.closedWonBookings;
        combined.invoicing += entry.invoicing;
        combined.scheduledRevenue += entry.scheduledRevenue;
        combined.deliveredRevenue += entry.deliveredRevenue;
        combined.deferredRevenue += entry.deferredRevenue;
        combined.totalRevenue += entry.totalRevenue;
        combined.deliveredTake += entry.deliveredTake;
        combined.scheduledTake += entry.scheduledTake;
        combined.allTake += entry.allTake;
      }

      // Per-vendor breakdown (always when vendors are active, so each
      // vendor's byCategory is keyed by its own category column)
      let byVendor: Record<string, unknown> | undefined;
      if (vendorList.length >= 1) {
        const vendorQueries = vendorList.map((vendor) => {
          const catCol = `${fy}_${vendor}_category`;
          const vConditions = [...baseConditions, `dmf.${catCol} IS NOT NULL`];
          const vWhere = `WHERE ${vConditions.join(" AND ")}`;
          const vParams = [...baseParams, vendor, fiscalYear];

          const vQuery = `
            WITH dist AS (
              SELECT DISTINCT leaid, enrollment FROM districts
            )
            SELECT
              dmf.${catCol} AS category,
              COUNT(DISTINCT dmf.leaid)::int AS count,
              COALESCE(SUM(dist.enrollment), 0)::bigint AS total_enrollment,
              COALESCE(SUM(vf.open_pipeline), 0)::float AS open_pipeline,
              COALESCE(SUM(vf.closed_won_bookings), 0)::float AS closed_won_bookings,
              COALESCE(SUM(vf.invoicing), 0)::float AS invoicing,
              COALESCE(SUM(vf.scheduled_revenue), 0)::float AS scheduled_revenue,
              COALESCE(SUM(vf.delivered_revenue), 0)::float AS delivered_revenue,
              COALESCE(SUM(vf.deferred_revenue), 0)::float AS deferred_revenue,
              COALESCE(SUM(vf.total_revenue), 0)::float AS total_revenue,
              COALESCE(SUM(vf.delivered_take), 0)::float AS delivered_take,
              COALESCE(SUM(vf.scheduled_take), 0)::float AS scheduled_take,
              COALESCE(SUM(vf.all_take), 0)::float AS all_take
            FROM district_map_features dmf
            JOIN dist ON dmf.leaid = dist.leaid
            LEFT JOIN vendor_financials vf ON dmf.leaid = vf.leaid
              AND vf.vendor = $${paramIdx}
              AND vf.fiscal_year = $${paramIdx + 1}
            ${vWhere}
            GROUP BY dmf.${catCol}
          `;
          return client.query(vQuery, vParams).then((res) => ({ vendor, rows: res.rows }));
        });

        const vendorResults = await Promise.all(vendorQueries);
        byVendor = {};

        for (const { vendor, rows } of vendorResults) {
          let totals = { ...emptyTotals };
          const byCat: Record<string, typeof emptyTotals> = {};
          for (const row of rows) {
            const cat = row.category || "uncategorized";
            const entry = {
              count: row.count,
              totalEnrollment: Number(row.total_enrollment),
              openPipeline: row.open_pipeline,
              closedWonBookings: row.closed_won_bookings,
              invoicing: row.invoicing,
              scheduledRevenue: row.scheduled_revenue,
              deliveredRevenue: row.delivered_revenue,
              deferredRevenue: row.deferred_revenue,
              totalRevenue: row.total_revenue,
              deliveredTake: row.delivered_take,
              scheduledTake: row.scheduled_take,
              allTake: row.all_take,
            };
            byCat[cat] = entry;
            totals.count += entry.count;
            totals.totalEnrollment += entry.totalEnrollment;
            totals.openPipeline += entry.openPipeline;
            totals.closedWonBookings += entry.closedWonBookings;
            totals.invoicing += entry.invoicing;
            totals.scheduledRevenue += entry.scheduledRevenue;
            totals.deliveredRevenue += entry.deliveredRevenue;
            totals.deferredRevenue += entry.deferredRevenue;
            totals.totalRevenue += entry.totalRevenue;
            totals.deliveredTake += entry.deliveredTake;
            totals.scheduledTake += entry.scheduledTake;
            totals.allTake += entry.allTake;
          }
          byVendor[vendor] = { ...totals, byCategory: byCat };
        }
      }

      return NextResponse.json({
        ...combined,
        byCategory,
        ...(byVendor ? { byVendor } : {}),
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
