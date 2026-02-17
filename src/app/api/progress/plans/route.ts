// GET /api/progress/plans — Plan engagement metrics for the progress dashboard
// Returns per-plan stats: total districts, districts with activity, last activity date, count.
// Used by plan health indicators and the leading indicators panel.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all active plans with their districts and activity links
    // TerritoryPlan uses `userId` and `activityLinks` (ActivityPlan junction table)
    const plans = await prisma.territoryPlan.findMany({
      where: {
        userId: user.id,
        status: "working",
      },
      select: {
        id: true,
        name: true,
        color: true,
        districts: {
          select: { districtLeaid: true },
        },
        activityLinks: {
          select: {
            activity: {
              select: {
                id: true,
                status: true,
                startDate: true,
                districts: { select: { districtLeaid: true } },
              },
            },
          },
        },
      },
    });

    const result = plans.map((plan) => {
      const totalDistricts = plan.districts.length;
      const planDistrictIds = new Set(plan.districts.map((d: { districtLeaid: string }) => d.districtLeaid));

      // Find which plan districts have at least one activity touching them
      const districtsWithActivity = new Set<string>();
      let lastActivityDate: string | null = null;
      let activityCount = 0;

      for (const link of plan.activityLinks) {
        const activity = link.activity;
        activityCount++;

        // Track most recent activity date
        if (activity.startDate) {
          const dateStr = activity.startDate.toISOString();
          if (!lastActivityDate || dateStr > lastActivityDate) {
            lastActivityDate = dateStr;
          }
        }

        // Track which plan districts were touched by this activity
        for (const ad of activity.districts) {
          if (planDistrictIds.has(ad.districtLeaid)) {
            districtsWithActivity.add(ad.districtLeaid);
          }
        }
      }

      return {
        planId: plan.id,
        planName: plan.name,
        planColor: plan.color,
        totalDistricts,
        districtsWithActivity: districtsWithActivity.size,
        lastActivityDate,
        activityCount,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching plan engagement:", error);
    return NextResponse.json({ error: "Failed to fetch plan engagement" }, { status: 500 });
  }
}
