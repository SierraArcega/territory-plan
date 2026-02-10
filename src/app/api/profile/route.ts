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

// Calculate actual progress from user's territory plan districts
// Aggregates revenue, take, pipeline, and new district counts by fiscal year
async function calculateActuals(userId: string) {
  // Get all districts in the user's territory plans
  const userDistricts = await prisma.territoryPlanDistrict.findMany({
    where: {
      plan: { userId },
    },
    include: {
      district: true,
    },
  });

  // Calculate FY26 actuals (current year)
  const fy26Revenue = userDistricts.reduce(
    (sum, d) => sum + toNumber(d.district.fy26NetInvoicing),
    0
  );
  const fy26Take = userDistricts.reduce(
    (sum, d) => sum + toNumber(d.district.fy26SessionsTake),
    0
  );
  const fy26Pipeline = userDistricts.reduce(
    (sum, d) => sum + toNumber(d.district.fy26OpenPipeline),
    0
  );
  // New districts = non-customers in plan (potential new business)
  const fy26NewDistricts = userDistricts.filter(
    (d) => !d.district.isCustomer
  ).length;

  // Calculate FY25 actuals (previous year for reference)
  const fy25Revenue = userDistricts.reduce(
    (sum, d) => sum + toNumber(d.district.fy25NetInvoicing),
    0
  );
  const fy25Take = userDistricts.reduce(
    (sum, d) => sum + toNumber(d.district.fy25SessionsTake),
    0
  );

  // Calculate FY27 pipeline (future year)
  const fy27Pipeline = userDistricts.reduce(
    (sum, d) => sum + toNumber(d.district.fy27OpenPipeline),
    0
  );

  return {
    2025: {
      revenueActual: fy25Revenue,
      takeActual: fy25Take,
      pipelineActual: 0, // No FY25 pipeline data
      newDistrictsActual: 0, // Historical, not tracked
    },
    2026: {
      revenueActual: fy26Revenue,
      takeActual: fy26Take,
      pipelineActual: fy26Pipeline,
      newDistrictsActual: fy26NewDistricts,
    },
    2027: {
      revenueActual: 0, // Future year
      takeActual: 0,
      pipelineActual: fy27Pipeline,
      newDistrictsActual: 0,
    },
  };
}

// GET /api/profile - Get or create user profile with goals and progress
export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Upsert the profile - create if doesn't exist, update lastLoginAt if it does
    const profile = await prisma.userProfile.upsert({
      where: { id: user.id },
      update: {
        // Update user info from Supabase on each login
        email: user.email!,
        fullName:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          null,
        avatarUrl:
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null,
        lastLoginAt: new Date(),
      },
      create: {
        id: user.id,
        email: user.email!,
        fullName:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          null,
        avatarUrl:
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null,
        hasCompletedSetup: false,
        lastLoginAt: new Date(),
      },
      include: {
        goals: {
          orderBy: { fiscalYear: "desc" },
        },
      },
    });

    // Calculate actuals from user's territory plans
    const actuals = await calculateActuals(user.id);

    // Format response with goals including calculated actuals
    const goalsWithActuals = profile.goals.map((goal) => {
      const yearActuals = actuals[goal.fiscalYear as keyof typeof actuals] || {
        revenueActual: 0,
        takeActual: 0,
        pipelineActual: 0,
        newDistrictsActual: 0,
      };

      return {
        id: goal.id,
        fiscalYear: goal.fiscalYear,
        earningsTarget: toNumber(goal.earningsTarget),
        takeRatePercent: toNumber(goal.takeRatePercent),
        revenueTarget: toNumber(goal.revenueTarget),
        takeTarget: toNumber(goal.takeTarget),
        pipelineTarget: toNumber(goal.pipelineTarget),
        newDistrictsTarget: goal.newDistrictsTarget,
        ...yearActuals,
      };
    });

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      hasCompletedSetup: profile.hasCompletedSetup,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
      goals: goalsWithActuals,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT /api/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fullName, hasCompletedSetup } = body;

    // Build update data - only include fields that were provided
    const updateData: {
      fullName?: string | null;
      hasCompletedSetup?: boolean;
    } = {};

    if (fullName !== undefined) {
      updateData.fullName = fullName?.trim() || null;
    }

    if (hasCompletedSetup !== undefined) {
      updateData.hasCompletedSetup = Boolean(hasCompletedSetup);
    }

    // Update the profile
    const profile = await prisma.userProfile.update({
      where: { id: user.id },
      data: updateData,
      include: {
        goals: {
          orderBy: { fiscalYear: "desc" },
        },
      },
    });

    // Calculate actuals from user's territory plans
    const actuals = await calculateActuals(user.id);

    // Format response
    const goalsWithActuals = profile.goals.map((goal) => {
      const yearActuals = actuals[goal.fiscalYear as keyof typeof actuals] || {
        revenueActual: 0,
        takeActual: 0,
        pipelineActual: 0,
        newDistrictsActual: 0,
      };

      return {
        id: goal.id,
        fiscalYear: goal.fiscalYear,
        earningsTarget: toNumber(goal.earningsTarget),
        takeRatePercent: toNumber(goal.takeRatePercent),
        revenueTarget: toNumber(goal.revenueTarget),
        takeTarget: toNumber(goal.takeTarget),
        pipelineTarget: toNumber(goal.pipelineTarget),
        newDistrictsTarget: goal.newDistrictsTarget,
        ...yearActuals,
      };
    });

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      hasCompletedSetup: profile.hasCompletedSetup,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
      goals: goalsWithActuals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating profile:", message, error);
    return NextResponse.json(
      { error: `Failed to update profile: ${message}` },
      { status: 500 }
    );
  }
}
