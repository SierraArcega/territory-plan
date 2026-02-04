import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/activities/[id]/districts - Link districts to an activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json();
    const { leaids } = body;

    if (!Array.isArray(leaids) || leaids.length === 0) {
      return NextResponse.json(
        { error: "leaids must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify districts exist
    const districts = await prisma.district.findMany({
      where: { leaid: { in: leaids } },
      select: { leaid: true, stateFips: true },
    });

    if (districts.length !== leaids.length) {
      const foundLeaids = new Set(districts.map((d) => d.leaid));
      const missing = leaids.filter((l: string) => !foundLeaids.has(l));
      return NextResponse.json(
        { error: `Districts not found: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Create ActivityDistrict records (skip duplicates)
    const result = await prisma.activityDistrict.createMany({
      data: leaids.map((leaid: string) => ({
        activityId: id,
        districtLeaid: leaid,
        warningDismissed: false,
      })),
      skipDuplicates: true,
    });

    // Auto-derive states from districts
    // Get current activity states
    const currentStates = await prisma.activityState.findMany({
      where: { activityId: id },
      select: { stateFips: true, isExplicit: true },
    });
    const currentStateMap = new Map(
      currentStates.map((s) => [s.stateFips, s.isExplicit])
    );

    // Get states from districts
    const derivedStates = new Set(districts.map((d) => d.stateFips));

    // Create ActivityState records for new states (non-explicit)
    const newStates = [...derivedStates].filter(
      (fips) => !currentStateMap.has(fips)
    );

    if (newStates.length > 0) {
      await prisma.activityState.createMany({
        data: newStates.map((stateFips) => ({
          activityId: id,
          stateFips,
          isExplicit: false,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      linked: result.count,
      activityId: id,
      statesAdded: newStates.length,
    });
  } catch (error) {
    console.error("Error linking districts to activity:", error);
    return NextResponse.json(
      { error: "Failed to link districts to activity" },
      { status: 500 }
    );
  }
}
