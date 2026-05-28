import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getStalePlans, getDistrictsWithoutContacts } from "@/features/plans/lib/plan-alerts";

export const dynamic = "force-dynamic";

// GET /api/feed/alerts — "Needs Attention" alerts for the Feed
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [districtsWithoutContacts, stalePlans] = await Promise.all([
      getDistrictsWithoutContacts(prisma, user.id),
      getStalePlans(prisma, user.id, thirtyDaysAgo),
    ]);
    return NextResponse.json({ districtsWithoutContacts, stalePlans });
  } catch (error) {
    console.error("Error fetching feed alerts:", error);
    return NextResponse.json({ error: "Failed to fetch feed alerts" }, { status: 500 });
  }
}
