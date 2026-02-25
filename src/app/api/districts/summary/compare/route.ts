import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_FYS = ["fy24", "fy25", "fy26", "fy27"] as const;
const VALID_VENDORS = ["fullmind", "proximity", "elevate", "tbt", "educere"] as const;

// Category classification sets (mirrors client-side comparison.ts)
const CUSTOMER_CATS = new Set([
  "new",
  "multi_year_growing",
  "multi_year_flat",
  "multi_year_shrinking",
]);
const PIPELINE_CATS = new Set([
  "target",
  "new_business_pipeline",
  "winback_pipeline",
  "renewal_pipeline",
  "expansion_pipeline",
]);
const NO_DATA_CATS = new Set(["", "lapsed", "churned"]);

const CATEGORY_RANK: Record<string, number> = {
  "": 0,
  lapsed: 0,
  churned: 0,
  target: 1,
  new_business_pipeline: 2,
  winback_pipeline: 3,
  renewal_pipeline: 4,
  expansion_pipeline: 5,
  new: 6,
  multi_year_shrinking: 7,
  multi_year_flat: 8,
  multi_year_growing: 9,
};

type TransitionBucket =
  | "churned"
  | "new_customer"
  | "upgraded"
  | "downgraded"
  | "new_pipeline"
  | "unchanged";

function classifyTransition(catA: string, catB: string): TransitionBucket {
  const a = catA || "";
  const b = catB || "";

  if (a === b) return "unchanged";

  const rankA = CATEGORY_RANK[a] ?? 0;
  const rankB = CATEGORY_RANK[b] ?? 0;

  if (rankA >= 1 && NO_DATA_CATS.has(b)) return "churned";
  if ((NO_DATA_CATS.has(a) || PIPELINE_CATS.has(a)) && CUSTOMER_CATS.has(b)) return "new_customer";
  if (NO_DATA_CATS.has(a) && PIPELINE_CATS.has(b)) return "new_pipeline";
  if (rankA >= 1 && rankB >= 1 && rankB > rankA) return "upgraded";
  if (rankA >= 1 && rankB >= 1 && rankB < rankA && !NO_DATA_CATS.has(b)) return "downgraded";

  return "unchanged";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const fyAParam = searchParams.get("fyA") || "";
    const fyBParam = searchParams.get("fyB") || "";

    if (
      !VALID_FYS.includes(fyAParam as (typeof VALID_FYS)[number]) ||
      !VALID_FYS.includes(fyBParam as (typeof VALID_FYS)[number])
    ) {
      return NextResponse.json(
        { error: "Invalid fyA or fyB parameter. Must be fy24, fy25, fy26, or fy27." },
        { status: 400 }
      );
    }

    const fyA = fyAParam;
    const fyB = fyBParam;

    const vendorParam = searchParams.get("vendors") || "fullmind";
    const vendor = VALID_VENDORS.includes(vendorParam as (typeof VALID_VENDORS)[number])
      ? vendorParam
      : "fullmind";

    const states = searchParams.get("states");
    const owner = searchParams.get("owner");
    const planId = searchParams.get("planId");
    const accountTypes = searchParams.get("accountTypes");

    // Build filter conditions
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

    // Include districts that have data in either FY for this vendor
    const catColA = `${fyA}_${vendor}_category`;
    const catColB = `${fyB}_${vendor}_category`;
    conditions.push(`(dmf.${catColA} IS NOT NULL OR dmf.${catColB} IS NOT NULL)`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      WITH dist AS (
        SELECT DISTINCT leaid, enrollment FROM districts
      )
      SELECT
        COALESCE(dmf.${catColA}, '') AS cat_a,
        COALESCE(dmf.${catColB}, '') AS cat_b,
        COUNT(*)::int AS count,
        COALESCE(SUM(dist.enrollment), 0)::bigint AS total_enrollment
      FROM district_map_features dmf
      JOIN dist ON dmf.leaid = dist.leaid
      ${whereClause}
      GROUP BY dmf.${catColA}, dmf.${catColB}
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query, params);

      // Initialize bucket counters
      const buckets: Record<TransitionBucket, { count: number; totalEnrollment: number }> = {
        churned: { count: 0, totalEnrollment: 0 },
        new_customer: { count: 0, totalEnrollment: 0 },
        upgraded: { count: 0, totalEnrollment: 0 },
        downgraded: { count: 0, totalEnrollment: 0 },
        new_pipeline: { count: 0, totalEnrollment: 0 },
        unchanged: { count: 0, totalEnrollment: 0 },
      };

      let totalCount = 0;
      let totalEnrollment = 0;

      for (const row of result.rows) {
        const bucket = classifyTransition(row.cat_a, row.cat_b);
        const count = row.count;
        const enrollment = Number(row.total_enrollment);
        buckets[bucket].count += count;
        buckets[bucket].totalEnrollment += enrollment;
        totalCount += count;
        totalEnrollment += enrollment;
      }

      return NextResponse.json({
        fyA,
        fyB,
        vendor,
        buckets,
        total: { count: totalCount, totalEnrollment },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching comparison summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch comparison summary" },
      { status: 500 }
    );
  }
}
