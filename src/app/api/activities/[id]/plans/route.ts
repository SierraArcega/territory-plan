import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/activities/[id]/plans - Link plans to an activity
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
    const { planIds } = body;

    if (!Array.isArray(planIds) || planIds.length === 0) {
      return NextResponse.json(
        { error: "planIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify plans belong to user
    const plans = await prisma.territoryPlan.findMany({
      where: { id: { in: planIds }, userId: user.id },
      select: { id: true },
    });

    if (plans.length !== planIds.length) {
      return NextResponse.json(
        { error: "One or more plans not found or not owned by user" },
        { status: 400 }
      );
    }

    // Create ActivityPlan records (skip duplicates)
    const result = await prisma.activityPlan.createMany({
      data: planIds.map((planId: string) => ({
        activityId: id,
        planId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      linked: result.count,
      activityId: id,
    });
  } catch (error) {
    console.error("Error linking plans to activity:", error);
    return NextResponse.json(
      { error: "Failed to link plans to activity" },
      { status: 500 }
    );
  }
}
