import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getCategoryForType, ALL_ACTIVITY_TYPES, VALID_ACTIVITY_STATUSES, type ActivityType } from "@/lib/activityTypes";
import { updateActivityOnCalendar, deleteActivityFromCalendar } from "@/lib/calendar-push";

export const dynamic = "force-dynamic";

// GET /api/activities/[id] - Get activity detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activity = await prisma.activity.findUnique({
      where: { id },
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

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Allow viewing if user owns it OR if it has no owner (backwards compatibility)
    if (activity.createdByUserId && activity.createdByUserId !== user.id) {
      return NextResponse.json({ error: "Not authorized to view this activity" }, { status: 403 });
    }

    // Get plan districts for computing isInPlan
    const planIds = activity.plans.map((p) => p.planId);
    const planDistricts = await prisma.territoryPlanDistrict.findMany({
      where: { planId: { in: planIds } },
      select: { planId: true, districtLeaid: true },
    });

    const planDistrictMap = new Map<string, Set<string>>();
    for (const pd of planDistricts) {
      if (!planDistrictMap.has(pd.planId)) {
        planDistrictMap.set(pd.planId, new Set());
      }
      planDistrictMap.get(pd.planId)!.add(pd.districtLeaid);
    }

    // Check which districts are in plans
    const districtsWithPlanStatus = activity.districts.map((d) => {
      const isInPlan = planIds.some((planId) =>
        planDistrictMap.get(planId)?.has(d.districtLeaid)
      );
      return {
        leaid: d.district.leaid,
        name: d.district.name,
        stateAbbrev: d.district.stateAbbrev,
        warningDismissed: d.warningDismissed,
        isInPlan,
      };
    });

    const needsPlanAssociation = activity.plans.length === 0;
    const hasUnlinkedDistricts = districtsWithPlanStatus.some(
      (d) => !d.isInPlan && !d.warningDismissed
    );

    return NextResponse.json({
      id: activity.id,
      type: activity.type,
      category: getCategoryForType(activity.type as ActivityType),
      title: activity.title,
      notes: activity.notes,
      startDate: activity.startDate?.toISOString() ?? null,
      endDate: activity.endDate?.toISOString() ?? null,
      status: activity.status,
      createdByUserId: activity.createdByUserId,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      needsPlanAssociation,
      hasUnlinkedDistricts,
      plans: activity.plans.map((p) => ({
        planId: p.plan.id,
        planName: p.plan.name,
        planColor: p.plan.color,
      })),
      districts: districtsWithPlanStatus,
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
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

// PATCH /api/activities/[id] - Update activity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify activity exists and user can edit it
    const existing = await prisma.activity.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Allow editing if user owns it OR if it has no owner (backwards compatibility)
    if (existing.createdByUserId && existing.createdByUserId !== user.id) {
      return NextResponse.json({ error: "Not authorized to edit this activity" }, { status: 403 });
    }

    const body = await request.json();
    const { type, title, notes, startDate, endDate, status } = body;

    // Validate type if provided
    if (type && !ALL_ACTIVITY_TYPES.includes(type)) {
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

    // Validate dates if provided
    if (startDate !== undefined && startDate !== null) {
      const parsedStart = new Date(startDate);
      if (isNaN(parsedStart.getTime())) {
        return NextResponse.json(
          { error: "startDate must be a valid date" },
          { status: 400 }
        );
      }
    }

    if (endDate !== undefined && endDate !== null) {
      const parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime())) {
        return NextResponse.json(
          { error: "endDate must be a valid date" },
          { status: 400 }
        );
      }
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(title && { title: title.trim() }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
        ...(endDate !== undefined && {
          endDate: endDate ? new Date(endDate) : null,
        }),
        ...(status && { status }),
      },
    });

    // Push changes to Google Calendar if the activity has a linked event
    // Best-effort — doesn't block the response
    updateActivityOnCalendar(user.id, activity.id);

    return NextResponse.json({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      updatedAt: activity.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating activity:", error);
    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: 500 }
    );
  }
}

// DELETE /api/activities/[id] - Delete activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify activity exists
    const activity = await prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Allow deleting if user owns it OR if it has no owner (backwards compatibility)
    if (activity.createdByUserId && activity.createdByUserId !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this activity" }, { status: 403 });
    }

    await prisma.activity.delete({ where: { id } });

    // Remove the corresponding Google Calendar event if one exists
    if (activity.googleEventId) {
      deleteActivityFromCalendar(user.id, id, activity.googleEventId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return NextResponse.json(
      { error: "Failed to delete activity" },
      { status: 500 }
    );
  }
}
