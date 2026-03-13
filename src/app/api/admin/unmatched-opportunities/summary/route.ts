import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SummaryRow {
  total_count: bigint;
  with_district_id: bigint;
  closed_won_bookings: number | null;
  closed_lost_bookings: number | null;
  open_bookings: number | null;
}

// GET /api/admin/unmatched-opportunities/summary — aggregate stats for KPI cards
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rows = await prisma.$queryRaw<SummaryRow[]>`
      SELECT
        COUNT(*)::bigint AS total_count,
        COUNT(account_lms_id)::bigint AS with_district_id,
        COALESCE(SUM(CASE WHEN stage ILIKE '%closed won%' THEN net_booking_amount ELSE 0 END), 0)::float8 AS closed_won_bookings,
        COALESCE(SUM(CASE WHEN stage ILIKE '%closed%' AND stage NOT ILIKE '%closed won%' THEN net_booking_amount ELSE 0 END), 0)::float8 AS closed_lost_bookings,
        COALESCE(SUM(CASE WHEN stage NOT ILIKE '%closed%' OR stage IS NULL THEN net_booking_amount ELSE 0 END), 0)::float8 AS open_bookings
      FROM unmatched_opportunities
      WHERE resolved = false
    `;

    const row = rows[0];

    return NextResponse.json({
      totalCount: Number(row.total_count),
      withDistrictId: Number(row.with_district_id),
      withoutDistrictId: Number(row.total_count) - Number(row.with_district_id),
      openBookings: row.open_bookings ?? 0,
      closedWonBookings: row.closed_won_bookings ?? 0,
      closedLostBookings: row.closed_lost_bookings ?? 0,
    });
  } catch (error) {
    console.error("Error fetching unmatched opportunities summary:", error);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}
