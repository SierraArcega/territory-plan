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

// PUT /api/territory-plans/[id]/activities/[activityId] - Update an activity
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id: planId, activityId } = await params;
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

    // Verify activity exists and belongs to this plan
    const existingActivity = await prisma.planActivity.findUnique({
      where: { id: activityId, planId },
    });

    if (!existingActivity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Validate activity type if provided
    if (type !== undefined && !VALID_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_ACTIVITY_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // If district specified, verify it exists and is in the plan
    if (districtLeaid !== undefined && districtLeaid !== null) {
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

    // Build update data - only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title.trim();
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (activityDate !== undefined) updateData.activityDate = new Date(activityDate);
    if (status !== undefined) updateData.status = status;
    if (districtLeaid !== undefined) updateData.districtLeaid = districtLeaid || null;

    // Handle contacts update if provided
    if (contactIds !== undefined) {
      // Validate contacts if district is specified
      const targetDistrict = districtLeaid ?? existingActivity.districtLeaid;
      if (contactIds.length > 0 && targetDistrict) {
        const validContacts = await prisma.contact.findMany({
          where: {
            id: { in: contactIds },
            leaid: targetDistrict,
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

      // Delete existing contacts and add new ones
      await prisma.planActivityContact.deleteMany({
        where: { activityId },
      });

      if (contactIds.length > 0) {
        await prisma.planActivityContact.createMany({
          data: contactIds.map((contactId: number) => ({
            activityId,
            contactId,
          })),
        });
      }
    }

    // Update the activity
    const activity = await prisma.planActivity.update({
      where: { id: activityId },
      data: updateData,
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
    console.error("Error updating plan activity:", error);
    return NextResponse.json(
      { error: "Failed to update plan activity" },
      { status: 500 }
    );
  }
}

// DELETE /api/territory-plans/[id]/activities/[activityId] - Delete an activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id: planId, activityId } = await params;
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

    // Verify activity exists and belongs to this plan
    const existingActivity = await prisma.planActivity.findUnique({
      where: { id: activityId, planId },
    });

    if (!existingActivity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Delete will cascade to PlanActivityContact due to onDelete: Cascade
    await prisma.planActivity.delete({
      where: { id: activityId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting plan activity:", error);
    return NextResponse.json(
      { error: "Failed to delete plan activity" },
      { status: 500 }
    );
  }
}
