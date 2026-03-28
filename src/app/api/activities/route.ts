import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getCategoryForType, ACTIVITY_CATEGORIES, ALL_ACTIVITY_TYPES, VALID_ACTIVITY_STATUSES, type ActivityCategory, type ActivityType } from "@/features/activities/types";
import { pushActivityToCalendar } from "@/features/calendar/lib/push";
import { awardPoints } from "@/features/leaderboard/lib/scoring";

export const dynamic = "force-dynamic";

// GET /api/activities - List activities with filtering
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as ActivityCategory | null;
    const planId = searchParams.get("planId");
    const districtLeaid = searchParams.get("districtLeaid");
    const stateAbbrev = searchParams.get("stateAbbrev");
    const needsPlanAssociation = searchParams.get("needsPlanAssociation") === "true";
    const hasUnlinkedDistricts = searchParams.get("hasUnlinkedDistricts") === "true";
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const unscheduled = searchParams.get("unscheduled") === "true";
    const search = searchParams.get("search");
    const source = searchParams.get("source");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Prisma.ActivityWhereInput = {
      createdByUserId: user.id,
      source: { not: "system" },
    };

    // Search by title
    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    // Filter by category (maps to types)
    if (category && ACTIVITY_CATEGORIES[category]) {
      where.type = { in: ACTIVITY_CATEGORIES[category] as unknown as string[] };
    }

    // Filter by plan
    if (planId) {
      where.plans = { some: { planId } };
    }

    // Filter by district
    if (districtLeaid) {
      where.districts = { some: { districtLeaid } };
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

    // Filter by source
    if (source) {
      where.source = source;
    }

    // Filter for unscheduled activities (no startDate)
    if (unscheduled) {
      where.startDate = null;
    } else if (startDate && endDate) {
      // Filter by date range
      // When both startDate and endDate are provided, find activities that overlap with the range
      where.AND = [
        { startDate: { not: null, gte: new Date(startDate) } },
        {
          OR: [
            { endDate: { lte: new Date(endDate) } },
            { endDate: null, startDate: { lte: new Date(endDate) } },
          ],
        },
      ];
    } else if (startDate) {
      where.startDate = { not: null, gte: new Date(startDate) };
    } else if (endDate) {
      where.OR = [
        { endDate: { lte: new Date(endDate) } },
        { endDate: null, startDate: { not: null, lte: new Date(endDate) } },
      ];
    }

    const queryStart = Date.now();

    // Run count and findMany in parallel for better performance
    // Using select instead of include to fetch only what's needed for the list view
    const [totalInDb, activities] = await Promise.all([
      // Query 1: Get total count for pagination (before computed filters)
      prisma.activity.count({ where }),

      // Query 2: Fetch activities with minimal data needed for list view
      prisma.activity.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          startDate: true,
          endDate: true,
          status: true,
          source: true,
          outcomeType: true,
          // Only fetch the IDs and flags we need for list view, not full related objects
          plans: {
            select: { planId: true },
          },
          districts: {
            select: {
              districtLeaid: true,
              warningDismissed: true,
            },
          },
          states: {
            select: {
              state: { select: { abbrev: true } },
            },
          },
        },
        orderBy: { startDate: { sort: "desc", nulls: "last" } },
        take: limit,
        skip: offset,
      }),
    ]);

    const mainQueryTime = Date.now() - queryStart;

    // Get all plan districts for computing hasUnlinkedDistricts
    // This query is fast since we're only fetching IDs
    const planDistrictsStart = Date.now();
    const planIds = [...new Set(activities.flatMap((a) => a.plans.map((p) => p.planId)))];

    // Only run this query if there are plans to check
    const planDistricts = planIds.length > 0
      ? await prisma.territoryPlanDistrict.findMany({
          where: { planId: { in: planIds } },
          select: { planId: true, districtLeaid: true },
        })
      : [];

    const planDistrictsTime = Date.now() - planDistrictsStart;

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
          startDate: activity.startDate?.toISOString() ?? null,
          endDate: activity.endDate?.toISOString() ?? null,
          status: activity.status,
          source: activity.source || "manual",
          outcomeType: activity.outcomeType,
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

    const totalTime = Date.now() - startTime;

    // Log timing in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.log(`[Activities API] Total: ${totalTime}ms | Main query: ${mainQueryTime}ms | Plan districts: ${planDistrictsTime}ms | Count: ${activities.length}`);
    }

    return NextResponse.json({
      activities: transformed,
      total: transformed.length,
      totalInDb, // total matching the base filters, before computed flag filtering
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    // Return more details in development
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: "Failed to fetch activities",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      },
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
      metadata = null,
      attendeeUserIds = [],
      expenses = [],
      districts: districtDetails = [],
      relatedActivityIds = [], // [{activityId, relationType}] // [{leaid, visitDate?, visitEndDate?}]
    } = body;

    // Validate required fields
    if (!type || !title) {
      return NextResponse.json(
        { error: "type and title are required" },
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

    // Validate status if provided
    if (status && !VALID_ACTIVITY_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_ACTIVITY_STATUSES.join(", ")}` },
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

    // Build district create entries — merge districtLeaids with districtDetails (which may have visit dates)
    const districtDetailsMap = new Map(
      districtDetails.map((d: { leaid: string; visitDate?: string; visitEndDate?: string; position?: number; notes?: string; name?: string }) => [d.leaid, d])
    );
    const allDistrictLeaids = [...new Set([...districtLeaids, ...districtDetails.map((d: { leaid: string }) => d.leaid)])];

    // Create activity with all relations
    const activity = await prisma.activity.create({
      data: {
        type,
        title: title.trim(),
        notes: notes?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status,
        metadata: metadata || undefined,
        createdByUserId: user.id,
        plans: {
          create: planIds.map((planId: string) => ({ planId })),
        },
        districts: {
          create: allDistrictLeaids.map((leaid: string) => {
            const detail = districtDetailsMap.get(leaid) as { visitDate?: string; visitEndDate?: string; position?: number; notes?: string } | undefined;
            return {
              districtLeaid: leaid,
              warningDismissed: false,
              visitDate: detail?.visitDate ? new Date(detail.visitDate) : null,
              visitEndDate: detail?.visitEndDate ? new Date(detail.visitEndDate) : null,
              position: detail?.position ?? 0,
              notes: detail?.notes?.trim() || null,
            };
          }),
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
        expenses: {
          create: expenses.map((e: { description: string; amount: number }) => ({
            description: e.description,
            amount: e.amount,
          })),
        },
        attendees: {
          create: attendeeUserIds.map((userId: string) => ({ userId })),
        },
        relations: {
          create: relatedActivityIds.map((r: { activityId: string; relationType?: string }) => ({
            relatedActivityId: r.activityId,
            relationType: r.relationType || "related",
          })),
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
        expenses: true,
        attendees: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
        relations: {
          include: { relatedActivity: { select: { id: true, title: true, type: true, startDate: true, status: true } } },
        },
        relatedTo: {
          include: { activity: { select: { id: true, title: true, type: true, startDate: true, status: true } } },
        },
      },
    });

    // Auto-create Visit activities for road trip stops that have visit dates
    if (type === "road_trip") {
      const districtsWithDates = districtDetails.filter(
        (d: { leaid: string; visitDate?: string; name?: string }) => d.visitDate
      );

      if (districtsWithDates.length > 0) {
        // Look up district details (name, state) for all stops that need visits
        const stopLeaids = districtsWithDates.map((d: { leaid: string }) => d.leaid);
        const stopDistricts = await prisma.district.findMany({
          where: { leaid: { in: stopLeaids } },
          select: { leaid: true, name: true, stateFips: true },
        });
        const stopDistrictMap = new Map(stopDistricts.map((d) => [d.leaid, d]));

        for (const stop of districtsWithDates as { leaid: string; visitDate: string; name?: string }[]) {
          const districtInfo = stopDistrictMap.get(stop.leaid);
          const districtName = stop.name || districtInfo?.name || stop.leaid;

          await prisma.activity.create({
            data: {
              type: "school_site_visit",
              title: `Visit: ${districtName}`,
              startDate: new Date(stop.visitDate),
              status: "planned",
              createdByUserId: user.id,
              plans: {
                create: planIds.map((planId: string) => ({ planId })),
              },
              districts: {
                create: [{ districtLeaid: stop.leaid }],
              },
              states: {
                create: districtInfo
                  ? [{ stateFips: districtInfo.stateFips, isExplicit: false }]
                  : [],
              },
              relatedTo: {
                create: [{
                  activityId: activity.id,
                  relationType: "part_of",
                }],
              },
            },
          });
        }
      }
    }

    // Push to Google Calendar if user has a connected calendar
    // This is best-effort — if it fails, the activity is still created
    pushActivityToCalendar(user.id, activity.id);

    // Award leaderboard points for activity logging (non-blocking)
    awardPoints(user.id, "activity_logged").catch((err) =>
      console.error("Failed to award activity_logged points:", err)
    );

    // Transform the activity response inline (type-safe via Prisma inference)
    return NextResponse.json({
      id: activity.id,
      type: activity.type,
      category: getCategoryForType(activity.type as ActivityType),
      title: activity.title,
      notes: activity.notes,
      startDate: activity.startDate?.toISOString() ?? null,
      endDate: activity.endDate?.toISOString() ?? null,
      status: activity.status,
      metadata: activity.metadata,
      createdByUserId: activity.createdByUserId,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      needsPlanAssociation: activity.plans.length === 0,
      hasUnlinkedDistricts: false, // Will be computed on fetch
      plans: activity.plans.map((p) => ({
        planId: p.plan.id,
        planName: p.plan.name,
        planColor: p.plan.color,
      })),
      districts: activity.districts.map((d) => ({
        leaid: d.district.leaid,
        name: d.district.name,
        stateAbbrev: d.district.stateAbbrev,
        warningDismissed: d.warningDismissed,
        isInPlan: false, // Will be computed on fetch
        visitDate: d.visitDate?.toISOString() ?? null,
        visitEndDate: d.visitEndDate?.toISOString() ?? null,
        position: d.position,
        notes: d.notes,
      })),
      contacts: activity.contacts.map((c) => ({
        id: c.contact.id,
        name: c.contact.name,
        title: c.contact.title,
      })),
      states: activity.states.map((s) => ({
        fips: s.state.fips,
        abbrev: s.state.abbrev,
        name: s.state.name,
        isExplicit: s.isExplicit,
      })),
      expenses: activity.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
      })),
      attendees: activity.attendees.map((a) => ({
        userId: a.user.id,
        fullName: a.user.fullName,
        avatarUrl: a.user.avatarUrl,
      })),
      relatedActivities: [
        ...activity.relations.map((r) => ({
          activityId: r.relatedActivity.id,
          title: r.relatedActivity.title,
          type: r.relatedActivity.type as ActivityType,
          startDate: r.relatedActivity.startDate?.toISOString() ?? null,
          status: r.relatedActivity.status,
          relationType: r.relationType,
        })),
        ...activity.relatedTo.map((r) => ({
          activityId: r.activity.id,
          title: r.activity.title,
          type: r.activity.type as ActivityType,
          startDate: r.activity.startDate?.toISOString() ?? null,
          status: r.activity.status,
          relationType: r.relationType,
        })),
      ],
    });
  } catch (error) {
    console.error("Error creating activity:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create activity: ${detail}` },
      { status: 500 }
    );
  }
}
