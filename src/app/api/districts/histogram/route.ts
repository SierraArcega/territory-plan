// GET /api/districts/histogram?column=enrollment&bins=30
// Returns histogram bucket counts for a given numeric column.

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Allowed columns (Prisma field → DB column)
const ALLOWED_COLUMNS: Record<string, string> = {
  enrollment: "enrollment",
  ell_percent: "ell_pct",
  sped_percent: "swd_pct",
  free_lunch_percent: "children_poverty_percent",
  medianHouseholdIncome: "median_household_income",
  expenditurePerPupil: "expenditure_per_pupil",
};

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const column = req.nextUrl.searchParams.get("column") || "enrollment";
  const bins = Math.min(50, Math.max(10, parseInt(req.nextUrl.searchParams.get("bins") || "30", 10)));

  const dbColumn = ALLOWED_COLUMNS[column];
  if (!dbColumn) {
    return NextResponse.json({ error: "Invalid column" }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    try {
      // Get min, max, and histogram in one query
      const result = await client.query(`
        WITH stats AS (
          SELECT
            MIN(${dbColumn}::float) AS min_val,
            MAX(${dbColumn}::float) AS max_val,
            COUNT(*) FILTER (WHERE ${dbColumn} IS NOT NULL) AS total
          FROM districts
          WHERE ${dbColumn} IS NOT NULL
        ),
        buckets AS (
          SELECT
            width_bucket(
              ${dbColumn}::float,
              (SELECT min_val FROM stats),
              (SELECT max_val FROM stats) + 0.001,
              ${bins}
            ) AS bucket,
            COUNT(*) AS count
          FROM districts
          WHERE ${dbColumn} IS NOT NULL
          GROUP BY bucket
          ORDER BY bucket
        )
        SELECT
          s.min_val,
          s.max_val,
          s.total,
          COALESCE(json_agg(json_build_object('bucket', b.bucket, 'count', b.count) ORDER BY b.bucket), '[]'::json) AS buckets
        FROM stats s
        LEFT JOIN buckets b ON true
        GROUP BY s.min_val, s.max_val, s.total
      `);

      const row = result.rows[0];
      if (!row || !row.total) {
        return NextResponse.json({ min: 0, max: 0, total: 0, buckets: [] });
      }

      const min = parseFloat(row.min_val);
      const max = parseFloat(row.max_val);
      const bucketWidth = (max - min) / bins;

      // Convert to simple array of counts, filling empty buckets with 0
      const counts: number[] = new Array(bins).fill(0);
      for (const b of row.buckets) {
        const idx = b.bucket - 1; // width_bucket is 1-indexed
        if (idx >= 0 && idx < bins) {
          counts[idx] = parseInt(b.count);
        }
      }

      return NextResponse.json({
        min: Math.floor(min),
        max: Math.ceil(max),
        total: parseInt(row.total),
        bucketWidth,
        counts,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Histogram error:", error);
    return NextResponse.json({ error: "Failed to compute histogram" }, { status: 500 });
  }
}
