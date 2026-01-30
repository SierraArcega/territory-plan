import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

// Helper to convert Decimal to number
function toNumber(val: Decimal | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return val.toNumber();
}

// GET /api/profile/goals - List all user goals
export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const goals = await prisma.userGoal.findMany({
      where: { userId: user.id },
      orderBy: { fiscalYear: "desc" },
    });

    const result = goals.map((goal) => ({
      id: goal.id,
      fiscalYear: goal.fiscalYear,
      earningsTarget: toNumber(goal.earningsTarget),
      takeRatePercent: toNumber(goal.takeRatePercent),
      revenueTarget: toNumber(goal.revenueTarget),
      takeTarget: toNumber(goal.takeTarget),
      pipelineTarget: toNumber(goal.pipelineTarget),
      newDistrictsTarget: goal.newDistrictsTarget,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

// POST /api/profile/goals - Create or update a goal (upsert by fiscalYear)
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fiscalYear, earningsTarget, takeRatePercent, revenueTarget, takeTarget, pipelineTarget, newDistrictsTarget } = body;

    // Validate fiscalYear
    if (!fiscalYear || typeof fiscalYear !== "number" || fiscalYear < 2020 || fiscalYear > 2050) {
      return NextResponse.json(
        { error: "fiscalYear is required and must be a valid year (2020-2050)" },
        { status: 400 }
      );
    }

    // Ensure user profile exists first
    await prisma.userProfile.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email!,
        fullName: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        hasCompletedSetup: false,
      },
    });

    // Upsert the goal - creates if doesn't exist for this year, updates if it does
    const goal = await prisma.userGoal.upsert({
      where: {
        userId_fiscalYear: {
          userId: user.id,
          fiscalYear,
        },
      },
      update: {
        earningsTarget: earningsTarget ?? null,
        takeRatePercent: takeRatePercent ?? null,
        revenueTarget: revenueTarget ?? null,
        takeTarget: takeTarget ?? null,
        pipelineTarget: pipelineTarget ?? null,
        newDistrictsTarget: newDistrictsTarget ?? null,
      },
      create: {
        userId: user.id,
        fiscalYear,
        earningsTarget: earningsTarget ?? null,
        takeRatePercent: takeRatePercent ?? null,
        revenueTarget: revenueTarget ?? null,
        takeTarget: takeTarget ?? null,
        pipelineTarget: pipelineTarget ?? null,
        newDistrictsTarget: newDistrictsTarget ?? null,
      },
    });

    return NextResponse.json(
      {
        id: goal.id,
        fiscalYear: goal.fiscalYear,
        earningsTarget: toNumber(goal.earningsTarget),
        takeRatePercent: toNumber(goal.takeRatePercent),
        revenueTarget: toNumber(goal.revenueTarget),
        takeTarget: toNumber(goal.takeTarget),
        pipelineTarget: toNumber(goal.pipelineTarget),
        newDistrictsTarget: goal.newDistrictsTarget,
        createdAt: goal.createdAt.toISOString(),
        updatedAt: goal.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating/updating goal:", error);
    return NextResponse.json(
      { error: "Failed to save goal" },
      { status: 500 }
    );
  }
}
