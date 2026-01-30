import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Valid activity types and statuses
const VALID_ACTIVITY_TYPES = [
  "email_campaign",
  "in_person_visit",
  "sales_meeting",
  "conference",
  "phone_call",
] as const;

const VALID_STATUSES = ["planned", "completed", "cancelled"] as const;

// GET /api/territory-plans/[id]/activities - List all activities for a plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const user = await getUser();

    // Verify plan exists and belongs to user
    const plan = await prisma.territoryPlan.findUnique({
      where: { id: planId, userId: user?.id },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Fetch activities with related data
    const activities = await prisma.planActivity.findMany({
      where: { planId },
      include: {
        district: {
          select: {
            name: true,
            stateAbbrev: true,
          },
        },
        contacts: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { activityDate: "desc" },
    });

    return NextResponse.json(
      activities.map((activity) => ({
        id: activity.id,
        planId: activity.planId,
        districtLeaid: activity.districtLeaid,
        districtName: activity.district?.name ?? null,
        districtState: activity.district?.stateAbbrev ?? null,
        type: activity.type,
        title: activity.title,
        notes: activity.notes,
        activityDate: activity.activityDate.toISOString(),
        status: activity.status,
        contacts: activity.contacts.map((c) => ({
          id: c.contact.id,
          name: c.contact.name,
          title: c.contact.title,
        })),
        createdAt: activity.createdAt.toISOString(),
        updatedAt: activity.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Error fetching plan activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan activities" },
      { status: 500 }
    );
  }
}

// POST /api/territory-plans/[id]/activities - Create a new activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const user = await getUser();
    const body = await request.json();

    const { type, title, notes, activityDate, status, districtLeaid, contactIds } = body;

    // Verify plan exists and belongs to user
    const plan = await prisma.territoryPlan.findUnique({
      where: { id: planId, userId: user?.id },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!type || !title || !activityDate) {
      return NextResponse.json(
        { error: "type, title, and activityDate are required" },
        { status: 400 }
      );
    }

    // Validate activity type
    if (!VALID_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_ACTIVITY_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate status if provided
    const activityStatus = status || "planned";
    if (!VALID_STATUSES.includes(activityStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // If district specified, verify it exists and is in the plan
    if (districtLeaid) {
      const planDistrict = await prisma.territoryPlanDistrict.findUnique({
        where: {
          planId_districtLeaid: { planId, districtLeaid },
        },
      });

      if (!planDistrict) {
        return NextResponse.json(
          { error: "District not found in this plan" },
          { status: 400 }
        );
      }
    }

    // Validate contacts if provided (must belong to the specified district)
    if (contactIds && contactIds.length > 0 && districtLeaid) {
      const validContacts = await prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          leaid: districtLeaid,
        },
        select: { id: true },
      });

      if (validContacts.length !== contactIds.length) {
        return NextResponse.json(
          { error: "One or more contacts not found or not associated with the specified district" },
          { status: 400 }
        );
      }
    }

    // Create the activity
    const activity = await prisma.planActivity.create({
      data: {
        planId,
        districtLeaid: districtLeaid || null,
        type,
        title: title.trim(),
        notes: notes?.trim() || null,
        activityDate: new Date(activityDate),
        status: activityStatus,
        // Connect contacts if provided
        contacts: contactIds?.length > 0
          ? {
              create: contactIds.map((contactId: number) => ({
                contactId,
              })),
            }
          : undefined,
      },
      include: {
        district: {
          select: {
            name: true,
            stateAbbrev: true,
          },
        },
        contacts: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      id: activity.id,
      planId: activity.planId,
      districtLeaid: activity.districtLeaid,
      districtName: activity.district?.name ?? null,
      districtState: activity.district?.stateAbbrev ?? null,
      type: activity.type,
      title: activity.title,
      notes: activity.notes,
      activityDate: activity.activityDate.toISOString(),
      status: activity.status,
      contacts: activity.contacts.map((c) => ({
        id: c.contact.id,
        name: c.contact.name,
        title: c.contact.title,
      })),
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating plan activity:", error);
    return NextResponse.json(
      { error: "Failed to create plan activity" },
      { status: 500 }
    );
  }
}
