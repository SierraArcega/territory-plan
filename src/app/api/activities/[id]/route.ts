import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import {
  getCategoryForType,
  ALL_ACTIVITY_TYPES,
  VALID_ACTIVITY_STATUSES,
  VALID_ACTIVITY_OUTCOMES,
  VALID_ACTIVITY_SENTIMENTS,
  VALID_DEAL_IMPACTS,
  type ActivityType,
} from "@/features/activities/types";
import { updateActivityOnCalendar, deleteActivityFromCalendar } from "@/features/calendar/lib/push";

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
          orderBy: { position: "asc" },
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
        opportunities: {
          include: {
            opportunity: {
              select: {
                id: true,
                name: true,
                stage: true,
                netBookingAmount: true,
                districtName: true,
                districtLeaId: true,
                closeDate: true,
              },
            },
          },
        },
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Allow viewing if user owns it, if it has no owner (backwards compatibility),
    // if the activity is linked to any plan (plan activities are visible to all),
    // or if the user is an admin
    if (activity.createdByUserId && activity.createdByUserId !== user.id) {
      const linkedToPlan = await prisma.activityPlan.findFirst({
        where: { activityId: id },
        select: { planId: true },
      });
      if (!linkedToPlan && !(await isAdmin(user.id))) {
        return NextResponse.json({ error: "Not authorized to view this activity" }, { status: 403 });
      }
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
        visitDate: d.visitDate?.toISOString() ?? null,
        visitEndDate: d.visitEndDate?.toISOString() ?? null,
        position: d.position,
        notes: d.notes,
      };
    });

    const needsPlanAssociation = activity.plans.length === 0;
    const hasUnlinkedDistricts = districtsWithPlanStatus.some(
      (d) => !d.isInPlan && !d.warningDismissed
    );

    const createdByUser = activity.createdByUserId
      ? await prisma.userProfile.findUnique({
          where: { id: activity.createdByUserId },
          select: { id: true, fullName: true, avatarUrl: true },
        })
      : null;

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
      googleEventId: activity.googleEventId,
      source: activity.source || "manual",
      outcome: activity.outcome,
      outcomeType: activity.outcomeType,
      sentiment: activity.sentiment,
      nextStep: activity.nextStep,
      followUpDate: activity.followUpDate?.toISOString() ?? null,
      dealImpact: activity.dealImpact,
      outcomeDisposition: activity.outcomeDisposition,
      rating: activity.rating,
      createdByUserId: activity.createdByUserId,
      createdByUser,
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
      expenses: activity.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        amountCents: Math.round(Number(e.amount) * 100),
        category: e.category,
        incurredOn: e.incurredOn.toISOString(),
        receiptStoragePath: e.receiptStoragePath,
        createdById: e.createdById,
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
          type: r.relatedActivity.type,
          startDate: r.relatedActivity.startDate?.toISOString() ?? null,
          status: r.relatedActivity.status,
          relationType: r.relationType,
        })),
        ...activity.relatedTo.map((r) => ({
          activityId: r.activity.id,
          title: r.activity.title,
          type: r.activity.type,
          startDate: r.activity.startDate?.toISOString() ?? null,
          status: r.activity.status,
          relationType: r.relationType,
        })),
      ],
      opportunities: activity.opportunities.map((ao) => ({
        id: ao.opportunity.id,
        name: ao.opportunity.name,
        stage: ao.opportunity.stage,
        netBookingAmount: ao.opportunity.netBookingAmount
          ? Number(ao.opportunity.netBookingAmount)
          : null,
        districtName: ao.opportunity.districtName,
        districtLeaId: ao.opportunity.districtLeaId,
        closeDate: ao.opportunity.closeDate?.toISOString() ?? null,
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

    // Allow editing if user owns it, if it has no owner (backwards compatibility), or if user is admin
    if (existing.createdByUserId && existing.createdByUserId !== user.id) {
      if (!(await isAdmin(user.id))) {
        return NextResponse.json({ error: "Not authorized to edit this activity" }, { status: 403 });
      }
    }

    const body = await request.json();
    const {
      type, title, notes, startDate, endDate, status, outcome, outcomeType,
      // Wave 1 redesigned outcome fields — see types.ts VALID_* constants
      sentiment, nextStep, followUpDate, dealImpact, outcomeDisposition,
      metadata, attendeeUserIds, contactIds, expenses, rating, opportunityIds,
      districts: districtUpdates, // [{leaid, visitDate?, visitEndDate?}]
    } = body;

    // Validate type if provided — allow keeping the existing type even if it's
    // a legacy value not in the current enum (e.g. customer_check_in)
    if (type && type !== existing.type && !ALL_ACTIVITY_TYPES.includes(type)) {
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

    // Validate rating if provided (1-5 integer)
    if (rating !== undefined && rating !== null) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "rating must be an integer between 1 and 5" },
          { status: 400 }
        );
      }
    }

    // Validate opportunityIds if provided
    if (opportunityIds !== undefined && !Array.isArray(opportunityIds)) {
      return NextResponse.json(
        { error: "opportunityIds must be an array of strings" },
        { status: 400 }
      );
    }

    // Validate redesigned outcome fields. Treating null/empty string as
    // "clear the value" so the auto-save model can revert a field cleanly.
    if (sentiment != null && sentiment !== "" &&
        !(VALID_ACTIVITY_SENTIMENTS as readonly string[]).includes(sentiment)) {
      return NextResponse.json(
        { error: `sentiment must be one of: ${VALID_ACTIVITY_SENTIMENTS.join(", ")}` },
        { status: 400 }
      );
    }
    if (dealImpact != null && dealImpact !== "" &&
        !(VALID_DEAL_IMPACTS as readonly string[]).includes(dealImpact)) {
      return NextResponse.json(
        { error: `dealImpact must be one of: ${VALID_DEAL_IMPACTS.join(", ")}` },
        { status: 400 }
      );
    }
    if (outcomeDisposition != null && outcomeDisposition !== "" &&
        !(VALID_ACTIVITY_OUTCOMES as readonly string[]).includes(outcomeDisposition)) {
      return NextResponse.json(
        { error: `outcomeDisposition must be one of: ${VALID_ACTIVITY_OUTCOMES.join(", ")}` },
        { status: 400 }
      );
    }
    if (followUpDate !== undefined && followUpDate !== null && followUpDate !== "") {
      const parsedFollowUp = new Date(followUpDate);
      if (isNaN(parsedFollowUp.getTime())) {
        return NextResponse.json(
          { error: "followUpDate must be a valid date" },
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
        ...(outcome !== undefined && { outcome: outcome?.trim() || null }),
        ...(outcomeType !== undefined && { outcomeType: outcomeType || null }),
        ...(sentiment !== undefined && { sentiment: sentiment || null }),
        ...(nextStep !== undefined && { nextStep: nextStep?.trim() || null }),
        ...(followUpDate !== undefined && {
          followUpDate: followUpDate ? new Date(followUpDate) : null,
        }),
        ...(dealImpact !== undefined && dealImpact !== null && dealImpact !== "" && {
          dealImpact,
        }),
        ...(outcomeDisposition !== undefined && {
          outcomeDisposition: outcomeDisposition || null,
        }),
        ...(metadata !== undefined && { metadata: metadata }),
        ...(rating !== undefined && { rating: rating }),
      },
    });

    // Update attendees if provided (replace all)
    if (attendeeUserIds !== undefined) {
      await prisma.activityAttendee.deleteMany({ where: { activityId: id } });
      if (attendeeUserIds.length > 0) {
        await prisma.activityAttendee.createMany({
          data: attendeeUserIds.map((userId: string) => ({ activityId: id, userId })),
        });
      }
    }

    // Update contacts if provided (replace all)
    if (contactIds !== undefined) {
      await prisma.activityContact.deleteMany({ where: { activityId: id } });
      if (Array.isArray(contactIds) && contactIds.length > 0) {
        await prisma.activityContact.createMany({
          data: (contactIds as number[]).map((contactId) => ({
            activityId: id,
            contactId,
          })),
        });
      }
    }

    // Update expenses if provided (replace all). Legacy callers send only
    // `{description, amount}`; the new schema requires `category` (defaults
    // to "other" via the column DEFAULT) and `incurredOn` (NOT NULL — fall
    // back to "now" for legacy payloads). Dedicated POST/DELETE expense
    // routes handle the redesigned UI's per-line edits.
    if (expenses !== undefined) {
      await prisma.activityExpense.deleteMany({ where: { activityId: id } });
      if (expenses.length > 0) {
        const incomingExpenses = expenses as Array<{
          description: string;
          amount: number;
          category?: string;
          incurredOn?: string;
          receiptStoragePath?: string | null;
        }>;
        await prisma.activityExpense.createMany({
          data: incomingExpenses.map((e) => ({
            activityId: id,
            description: e.description,
            amount: e.amount,
            category: e.category ?? "other",
            incurredOn: e.incurredOn ? new Date(e.incurredOn) : new Date(),
            receiptStoragePath: e.receiptStoragePath ?? null,
            createdById: user.id,
          })),
        });
      }
    }

    // Update districts if provided (replace all)
    if (districtUpdates !== undefined) {
      await prisma.activityDistrict.deleteMany({ where: { activityId: id } });
      const districts = districtUpdates as { leaid: string; position?: number; visitDate?: string | null; notes?: string | null }[];
      if (districts.length > 0) {
        await prisma.activityDistrict.createMany({
          data: districts.map((du, i) => ({
            activityId: id,
            districtLeaid: du.leaid,
            position: du.position ?? i,
            visitDate: du.visitDate ? new Date(du.visitDate) : null,
            notes: du.notes?.trim() || null,
            warningDismissed: false,
          })),
        });
      }
    }

    // Update opportunity links if provided (replace all)
    if (opportunityIds !== undefined) {
      await prisma.activityOpportunity.deleteMany({ where: { activityId: id } });
      if (Array.isArray(opportunityIds) && opportunityIds.length > 0) {
        await prisma.activityOpportunity.createMany({
          data: (opportunityIds as string[]).map((opportunityId) => ({
            activityId: id,
            opportunityId,
          })),
        });
      }
    }

    // Push changes to Google Calendar if the activity has a linked event
    // Best-effort — doesn't block the response
    updateActivityOnCalendar(user.id, activity.id);

    // Fetch opportunities for response if they were updated
    const opportunities = opportunityIds !== undefined
      ? await prisma.activityOpportunity.findMany({
          where: { activityId: id },
          include: {
            opportunity: {
              select: {
                id: true,
                name: true,
                stage: true,
                netBookingAmount: true,
                districtName: true,
              },
            },
          },
        })
      : undefined;

    return NextResponse.json({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      rating: activity.rating,
      updatedAt: activity.updatedAt.toISOString(),
      ...(opportunities !== undefined && {
        opportunities: opportunities.map((ao) => ({
          id: ao.opportunity.id,
          name: ao.opportunity.name,
          stage: ao.opportunity.stage,
          netBookingAmount: ao.opportunity.netBookingAmount
            ? Number(ao.opportunity.netBookingAmount)
            : null,
          districtName: ao.opportunity.districtName,
        })),
      }),
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

    // Allow deleting if user owns it, if it has no owner (backwards compatibility), or if user is admin
    if (activity.createdByUserId && activity.createdByUserId !== user.id) {
      if (!(await isAdmin(user.id))) {
        return NextResponse.json({ error: "Not authorized to delete this activity" }, { status: 403 });
      }
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
