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

// Calculate actual progress from user's territory plan districts for a specific fiscal year
async function calculateActualsForYear(userId: string, fiscalYear: number) {
  const userDistricts = await prisma.territoryPlanDistrict.findMany({
    where: {
      plan: { userId },
    },
    include: {
      district: true,
    },
  });

  // Calculate based on fiscal year
  if (fiscalYear === 2025) {
    return {
      revenueActual: userDistricts.reduce(
        (sum, d) => sum + toNumber(d.district.fy25NetInvoicing),
        0
      ),
      takeActual: userDistricts.reduce(
        (sum, d) => sum + toNumber(d.district.fy25SessionsTake),
        0
      ),
      pipelineActual: 0,
      newDistrictsActual: 0,
    };
  } else if (fiscalYear === 2026) {
    return {
      revenueActual: userDistricts.reduce(
        (sum, d) => sum + toNumber(d.district.fy26NetInvoicing),
        0
      ),
      takeActual: userDistricts.reduce(
        (sum, d) => sum + toNumber(d.district.fy26SessionsTake),
        0
      ),
      pipelineActual: userDistricts.reduce(
        (sum, d) => sum + toNumber(d.district.fy26OpenPipeline),
        0
      ),
      newDistrictsActual: userDistricts.filter((d) => !d.district.isCustomer).length,
    };
  } else if (fiscalYear === 2027) {
    return {
      revenueActual: 0,
      takeActual: 0,
      pipelineActual: userDistricts.reduce(
        (sum, d) => sum + toNumber(d.district.fy27OpenPipeline),
        0
      ),
      newDistrictsActual: 0,
    };
  }

  // Default for other years
  return {
    revenueActual: 0,
    takeActual: 0,
    pipelineActual: 0,
    newDistrictsActual: 0,
  };
}

// GET /api/profile/goals/[fiscalYear] - Get a specific fiscal year goal with progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fiscalYear: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { fiscalYear: fiscalYearParam } = await params;
    const fiscalYear = parseInt(fiscalYearParam, 10);

    if (isNaN(fiscalYear)) {
      return NextResponse.json(
        { error: "Invalid fiscal year" },
        { status: 400 }
      );
    }

    const goal = await prisma.userGoal.findUnique({
      where: {
        userId_fiscalYear: {
          userId: user.id,
          fiscalYear,
        },
      },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    // Calculate actuals for this fiscal year
    const actuals = await calculateActualsForYear(user.id, fiscalYear);

    return NextResponse.json({
      id: goal.id,
      fiscalYear: goal.fiscalYear,
      revenueTarget: toNumber(goal.revenueTarget),
      takeTarget: toNumber(goal.takeTarget),
      pipelineTarget: toNumber(goal.pipelineTarget),
      newDistrictsTarget: goal.newDistrictsTarget,
      drawDownTarget: toNumber(goal.drawDownTarget),
      quotaTarget: toNumber(goal.quotaTarget),
      ...actuals,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching goal:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

// PUT /api/profile/goals/[fiscalYear] - Update a specific fiscal year goal
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fiscalYear: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { fiscalYear: fiscalYearParam } = await params;
    const fiscalYear = parseInt(fiscalYearParam, 10);

    if (isNaN(fiscalYear)) {
      return NextResponse.json(
        { error: "Invalid fiscal year" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { revenueTarget, takeTarget, pipelineTarget, newDistrictsTarget, drawDownTarget, quotaTarget } = body;

    // Update the goal
    const goal = await prisma.userGoal.update({
      where: {
        userId_fiscalYear: {
          userId: user.id,
          fiscalYear,
        },
      },
      data: {
        revenueTarget: revenueTarget !== undefined ? revenueTarget : undefined,
        takeTarget: takeTarget !== undefined ? takeTarget : undefined,
        pipelineTarget: pipelineTarget !== undefined ? pipelineTarget : undefined,
        newDistrictsTarget: newDistrictsTarget !== undefined ? newDistrictsTarget : undefined,
        drawDownTarget: drawDownTarget !== undefined ? drawDownTarget : undefined,
        quotaTarget: quotaTarget !== undefined ? quotaTarget : undefined,
      },
    });

    // Calculate actuals for this fiscal year
    const actuals = await calculateActualsForYear(user.id, fiscalYear);

    return NextResponse.json({
      id: goal.id,
      fiscalYear: goal.fiscalYear,
      revenueTarget: toNumber(goal.revenueTarget),
      takeTarget: toNumber(goal.takeTarget),
      pipelineTarget: toNumber(goal.pipelineTarget),
      newDistrictsTarget: goal.newDistrictsTarget,
      drawDownTarget: toNumber(goal.drawDownTarget),
      quotaTarget: toNumber(goal.quotaTarget),
      ...actuals,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}

// DELETE /api/profile/goals/[fiscalYear] - Delete a specific fiscal year goal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fiscalYear: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { fiscalYear: fiscalYearParam } = await params;
    const fiscalYear = parseInt(fiscalYearParam, 10);

    if (isNaN(fiscalYear)) {
      return NextResponse.json(
        { error: "Invalid fiscal year" },
        { status: 400 }
      );
    }

    await prisma.userGoal.delete({
      where: {
        userId_fiscalYear: {
          userId: user.id,
          fiscalYear,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
