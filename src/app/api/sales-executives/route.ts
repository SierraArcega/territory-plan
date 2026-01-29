import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const query = `
      SELECT DISTINCT sales_executive
      FROM fullmind_data
      WHERE sales_executive IS NOT NULL AND sales_executive != ''
      ORDER BY sales_executive
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query);
      const executives = result.rows.map((row) => row.sales_executive);
      return NextResponse.json(executives);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching sales executives:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales executives" },
      { status: 500 }
    );
  }
}
