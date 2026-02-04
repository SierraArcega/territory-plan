import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/activities/[id]/districts/[leaid] - Unlink a district from an activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leaid: string }> }
) {
  try {
    const { id, leaid } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify activity ownership
    const activity = await prisma.activity.findUnique({
      where: { id, createdByUserId: user.id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Get the district link with its state
    const existingLink = await prisma.activityDistrict.findUnique({
      where: {
        activityId_districtLeaid: {
          activityId: id,
          districtLeaid: leaid,
        },
      },
      include: {
        district: { select: { stateFips: true } },
      },
    });

    if (!existingLink) {
      return NextResponse.json(
        { error: "District not linked to this activity" },
        { status: 404 }
      );
    }

    const removedStateFips = existingLink.district.stateFips;

    // Delete the district link
    await prisma.activityDistrict.delete({
      where: {
        activityId_districtLeaid: {
          activityId: id,
          districtLeaid: leaid,
        },
      },
    });

    // Check if we should cleanup the state
    // Only cleanup if: state is NOT explicit AND no other districts share it
    const stateLink = await prisma.activityState.findUnique({
      where: {
        activityId_stateFips: {
          activityId: id,
          stateFips: removedStateFips,
        },
      },
    });

    let stateRemoved = false;
    if (stateLink && !stateLink.isExplicit) {
      // Check if any other districts in this activity share this state
      const otherDistrictsInState = await prisma.activityDistrict.findFirst({
        where: {
          activityId: id,
          district: { stateFips: removedStateFips },
        },
      });

      if (!otherDistrictsInState) {
        // No other districts in this state, remove the state link
        await prisma.activityState.delete({
          where: {
            activityId_stateFips: {
              activityId: id,
              stateFips: removedStateFips,
            },
          },
        });
        stateRemoved = true;
      }
    }

    return NextResponse.json({
      success: true,
      stateRemoved,
      removedStateFips: stateRemoved ? removedStateFips : null,
    });
  } catch (error) {
    console.error("Error unlinking district from activity:", error);
    return NextResponse.json(
      { error: "Failed to unlink district from activity" },
      { status: 500 }
    );
  }
}
