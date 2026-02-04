import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getCategoryForType, ACTIVITY_CATEGORIES, ALL_ACTIVITY_TYPES, type ActivityCategory, type ActivityType } from "@/lib/activityTypes";

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
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Prisma.ActivityWhereInput = {
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
    // When both startDate and endDate are provided, find activities that overlap with the range
    // - Activity starts on or after startDate
    // - Activity ends on or before endDate (or if no endDate, startDate is before the filter endDate)
    if (startDate && endDate) {
      where.AND = [
        { startDate: { gte: new Date(startDate) } },
        {
          OR: [
            { endDate: { lte: new Date(endDate) } },
            { endDate: null, startDate: { lte: new Date(endDate) } },
          ],
        },
      ];
    } else if (startDate) {
      where.startDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.OR = [
        { endDate: { lte: new Date(endDate) } },
        { endDate: null, startDate: { lte: new Date(endDate) } },
      ];
    }

    // Get total count for pagination (before computed filters)
    const totalInDb = await prisma.activity.count({ where });

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
      take: limit,
      skip: offset,
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
      totalInDb, // total matching the base filters, before computed flag filtering
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      title,
      notes,
      startDate,
      endDate,
      status = "planned",
      planIds = [],
      districtLeaids = [],
      contactIds = [],
      stateFips = [], // explicit states
    } = body;

    // Validate required fields
    if (!type || !title || !startDate) {
      return NextResponse.json(
        { error: "type, title, and startDate are required" },
        { status: 400 }
      );
    }

    // Validate type is valid
    if (!ALL_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid activity type: ${type}` },
        { status: 400 }
      );
    }

    // Get states derived from districts
    const derivedStates = new Set<string>();
    if (districtLeaids.length > 0) {
      const districts = await prisma.district.findMany({
        where: { leaid: { in: districtLeaids } },
        select: { stateFips: true },
      });
      districts.forEach((d) => derivedStates.add(d.stateFips));
    }

    // Create activity with all relations
    const activity = await prisma.activity.create({
      data: {
        type,
        title: title.trim(),
        notes: notes?.trim() || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status,
        createdByUserId: user.id,
        plans: {
          create: planIds.map((planId: string) => ({ planId })),
        },
        districts: {
          create: districtLeaids.map((leaid: string) => ({
            districtLeaid: leaid,
            warningDismissed: false,
          })),
        },
        contacts: {
          create: contactIds.map((contactId: number) => ({ contactId })),
        },
        states: {
          create: [
            // Derived states (from districts)
            ...[...derivedStates].map((fips) => ({
              stateFips: fips,
              isExplicit: false,
            })),
            // Explicit states (user-added)
            ...stateFips
              .filter((fips: string) => !derivedStates.has(fips))
              .map((fips: string) => ({
                stateFips: fips,
                isExplicit: true,
              })),
          ],
        },
      },
      include: {
        plans: {
          include: { plan: { select: { id: true, name: true, color: true } } },
        },
        districts: {
          include: {
            district: { select: { leaid: true, name: true, stateAbbrev: true } },
          },
        },
        contacts: {
          include: { contact: { select: { id: true, name: true, title: true } } },
        },
        states: {
          include: { state: { select: { fips: true, abbrev: true, name: true } } },
        },
      },
    });

    return NextResponse.json(transformActivity(activity));
  } catch (error) {
    console.error("Error creating activity:", error);
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}

// Helper to transform activity for response
function transformActivity(activity: any) {
  return {
    id: activity.id,
    type: activity.type,
    category: getCategoryForType(activity.type as ActivityType),
    title: activity.title,
    notes: activity.notes,
    startDate: activity.startDate.toISOString(),
    endDate: activity.endDate?.toISOString() ?? null,
    status: activity.status,
    createdByUserId: activity.createdByUserId,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
    needsPlanAssociation: activity.plans.length === 0,
    hasUnlinkedDistricts: false, // Will be computed on fetch
    plans: activity.plans.map((p: any) => ({
      planId: p.plan.id,
      planName: p.plan.name,
      planColor: p.plan.color,
    })),
    districts: activity.districts.map((d: any) => ({
      leaid: d.district.leaid,
      name: d.district.name,
      stateAbbrev: d.district.stateAbbrev,
      warningDismissed: d.warningDismissed,
      isInPlan: false, // Will be computed on fetch
    })),
    contacts: activity.contacts.map((c: any) => ({
      id: c.contact.id,
      name: c.contact.name,
      title: c.contact.title,
    })),
    states: activity.states.map((s: any) => ({
      fips: s.state.fips,
      abbrev: s.state.abbrev,
      name: s.state.name,
      isExplicit: s.isExplicit,
    })),
  };
}
