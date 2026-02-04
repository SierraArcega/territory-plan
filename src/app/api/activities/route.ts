import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getCategoryForType, ACTIVITY_CATEGORIES, type ActivityCategory, type ActivityType } from "@/lib/activityTypes";

export const dynamic = "force-dynamic";

// GET /api/activities - List activities with filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as ActivityCategory | null;
    const planId = searchParams.get("planId");
    const stateAbbrev = searchParams.get("stateAbbrev");
    const needsPlanAssociation = searchParams.get("needsPlanAssociation") === "true";
    const hasUnlinkedDistricts = searchParams.get("hasUnlinkedDistricts") === "true";
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {
      createdByUserId: user.id,
    };

    // Filter by category (maps to types)
    if (category && ACTIVITY_CATEGORIES[category]) {
      where.type = { in: ACTIVITY_CATEGORIES[category] as unknown as string[] };
    }

    // Filter by plan
    if (planId) {
      where.plans = { some: { planId } };
    }

    // Filter by state
    if (stateAbbrev) {
      where.states = {
        some: {
          state: { abbrev: stateAbbrev },
        },
      };
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by date range
    if (startDate) {
      where.startDate = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.OR = [
        { endDate: { lte: new Date(endDate) } },
        { endDate: null, startDate: { lte: new Date(endDate) } },
      ];
    }

    // Fetch activities with relations
    const activities = await prisma.activity.findMany({
      where,
      include: {
        plans: {
          include: {
            plan: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        districts: {
          include: {
            district: {
              select: { leaid: true, name: true, stateAbbrev: true },
            },
          },
        },
        states: {
          include: {
            state: { select: { fips: true, abbrev: true, name: true } },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    // Get all plan districts for computing hasUnlinkedDistricts
    const planIds = [...new Set(activities.flatMap((a) => a.plans.map((p) => p.planId)))];
    const planDistricts = await prisma.territoryPlanDistrict.findMany({
      where: { planId: { in: planIds } },
      select: { planId: true, districtLeaid: true },
    });

    // Map plan -> set of district leaids
    const planDistrictMap = new Map<string, Set<string>>();
    for (const pd of planDistricts) {
      if (!planDistrictMap.has(pd.planId)) {
        planDistrictMap.set(pd.planId, new Set());
      }
      planDistrictMap.get(pd.planId)!.add(pd.districtLeaid);
    }

    // Transform and filter by computed flags
    const transformed = activities
      .map((activity) => {
        const activityPlanIds = activity.plans.map((p) => p.planId);
        const needsPlan = activity.plans.length === 0;

        // Check if any district is not in any of the activity's plans
        const hasUnlinked = activity.districts.some((ad) => {
          if (ad.warningDismissed) return false;
          return !activityPlanIds.some((planId) =>
            planDistrictMap.get(planId)?.has(ad.districtLeaid)
          );
        });

        return {
          id: activity.id,
          type: activity.type as ActivityType,
          category: getCategoryForType(activity.type as ActivityType),
          title: activity.title,
          startDate: activity.startDate.toISOString(),
          endDate: activity.endDate?.toISOString() ?? null,
          status: activity.status,
          needsPlanAssociation: needsPlan,
          hasUnlinkedDistricts: hasUnlinked,
          planCount: activity.plans.length,
          districtCount: activity.districts.length,
          stateAbbrevs: activity.states.map((s) => s.state.abbrev),
        };
      })
      .filter((a) => {
        if (needsPlanAssociation && !a.needsPlanAssociation) return false;
        if (hasUnlinkedDistricts && !a.hasUnlinkedDistricts) return false;
        return true;
      });

    return NextResponse.json({
      activities: transformed,
      total: transformed.length,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}
