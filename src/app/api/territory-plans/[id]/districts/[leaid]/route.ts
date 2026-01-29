import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE /api/territory-plans/[id]/districts/[leaid] - Remove a district from a plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leaid: string }> }
) {
  try {
    const { id: planId, leaid } = await params;

    // Check if the relationship exists
    const existing = await prisma.territoryPlanDistrict.findUnique({
      where: {
        planId_districtLeaid: {
          planId,
          districtLeaid: leaid,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "District not found in this plan" },
        { status: 404 }
      );
    }

    await prisma.territoryPlanDistrict.delete({
      where: {
        planId_districtLeaid: {
          planId,
          districtLeaid: leaid,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing district from plan:", error);
    return NextResponse.json(
      { error: "Failed to remove district from plan" },
      { status: 500 }
    );
  }
}
