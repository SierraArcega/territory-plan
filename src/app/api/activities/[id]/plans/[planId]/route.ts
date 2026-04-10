import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/activities/[id]/plans/[planId] - Unlink a plan from an activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  try {
    const { id, planId } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify activity exists and user can modify it
    const activity = await prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (activity.createdByUserId && activity.createdByUserId !== user.id) {
      if (!(await isAdmin(user.id))) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    }

    // Check if the link exists
    const existing = await prisma.activityPlan.findUnique({
      where: {
        activityId_planId: {
          activityId: id,
          planId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Plan not linked to this activity" },
        { status: 404 }
      );
    }

    // Delete the link
    await prisma.activityPlan.delete({
      where: {
        activityId_planId: {
          activityId: id,
          planId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking plan from activity:", error);
    return NextResponse.json(
      { error: "Failed to unlink plan from activity" },
      { status: 500 }
    );
  }
}
