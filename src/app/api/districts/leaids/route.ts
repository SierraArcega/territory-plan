import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fyParam = searchParams.get("fy") || "fy26";
    const validFys = ["fy24", "fy25", "fy26", "fy27"] as const;
    const fy = validFys.includes(fyParam as any) ? fyParam : "fy26";
    const states = searchParams.get("states");
    const owner = searchParams.get("owner");
    const planId = searchParams.get("planId");
    const accountTypes = searchParams.get("accountTypes");
    const vendors = searchParams.get("vendors");

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

    const VALID_VENDORS = ["fullmind", "proximity", "elevate", "tbt", "educere"];
    const vendorList = vendors
      ? vendors.split(",").filter((v) => VALID_VENDORS.includes(v))
      : [];
    if (vendorList.length > 0) {
      const vendorOrParts = vendorList.map((v) => `dmf.${fy}_${v}_category IS NOT NULL`);
      conditions.push(`(${vendorOrParts.join(" OR ")})`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT DISTINCT dmf.leaid FROM district_map_features dmf ${whereClause} ORDER BY dmf.leaid`,
        params
      );
      return NextResponse.json({ leaids: result.rows.map((r: { leaid: string }) => r.leaid) });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching district leaids:", error);
    return NextResponse.json({ error: "Failed to fetch district leaids" }, { status: 500 });
  }
}
