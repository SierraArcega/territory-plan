// GET /api/activities/unlinked
// Returns activities that have source != "manual" AND have zero ActivityDistrict links.
// These are synced activities that couldn't be auto-matched to a district and need
// manual triage by the rep.

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activities = await prisma.activity.findMany({
      where: {
        createdByUserId: user.id,
        source: { notIn: ["manual", "system"] },
        districts: { none: {} }, // No ActivityDistrict links
      },
      orderBy: { startDate: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        source: true,
        startDate: true,
        integrationMeta: true,
      },
    });

    return NextResponse.json({ activities, count: activities.length });
  } catch (error) {
    console.error("Failed to fetch unlinked activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch unlinked activities" },
      { status: 500 }
    );
  }
}
