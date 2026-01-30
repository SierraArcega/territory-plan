import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/profile/goals/[fiscalYear]/dashboard - Get goal dashboard with targets vs actuals
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

    const { fiscalYear: fyParam } = await params;
    const fiscalYear = parseInt(fyParam, 10);

    if (isNaN(fiscalYear) || fiscalYear < 2024 || fiscalYear > 2030) {
      return NextResponse.json(
        { error: "Invalid fiscal year" },
        { status: 400 }
      );
    }

    // Get user goals for this fiscal year
    const userGoal = await prisma.userGoal.findUnique({
      where: {
        userId_fiscalYear: {
          userId: user.id,
          fiscalYear,
        },
      },
    });

    // Get all plans for this fiscal year with their district targets
    const plans = await prisma.territoryPlan.findMany({
      where: {
        userId: user.id,
        fiscalYear,
      },
      include: {
        districts: {
          select: {
            revenueTarget: true,
            pipelineTarget: true,
            districtLeaid: true,
            district: {
              select: {
                isCustomer: true,
                // Get FY-specific actuals based on fiscal year
                fy25SessionsRevenue: true,
                fy25SessionsTake: true,
                fy26SessionsRevenue: true,
                fy26SessionsTake: true,
                fy26OpenPipeline: true,
                fy27OpenPipeline: true,
              },
            },
          },
        },
      },
    });

    // Calculate plan totals (sum of district targets across all plans)
    let totalRevenueTarget = 0;
    let totalPipelineTarget = 0;
    let districtCount = 0;
    const uniqueDistricts = new Set<string>();

    // Calculate actuals from district data
    let revenueActual = 0;
    let takeActual = 0;
    let pipelineActual = 0;
    let newDistrictsActual = 0;
    const existingCustomers = new Set<string>();

    for (const plan of plans) {
      for (const pd of plan.districts) {
        uniqueDistricts.add(pd.districtLeaid);

        // Sum targets
        if (pd.revenueTarget) {
          totalRevenueTarget += Number(pd.revenueTarget);
        }
        if (pd.pipelineTarget) {
          totalPipelineTarget += Number(pd.pipelineTarget);
        }

        // Sum actuals based on fiscal year
        const district = pd.district;
        if (fiscalYear === 2025) {
          revenueActual += Number(district.fy25SessionsRevenue || 0);
          takeActual += Number(district.fy25SessionsTake || 0);
        } else if (fiscalYear === 2026) {
          revenueActual += Number(district.fy26SessionsRevenue || 0);
          takeActual += Number(district.fy26SessionsTake || 0);
          pipelineActual += Number(district.fy26OpenPipeline || 0);
        } else if (fiscalYear === 2027) {
          pipelineActual += Number(district.fy27OpenPipeline || 0);
        }

        // Track new vs existing customers
        if (district.isCustomer) {
          existingCustomers.add(pd.districtLeaid);
        }
      }
    }

    districtCount = uniqueDistricts.size;

    // New districts = districts in plan that aren't already customers
    // This is a simplified calculation - in practice you'd want to track
    // when a district became a customer vs when it was added to the plan
    newDistrictsActual = districtCount - existingCustomers.size;

    return NextResponse.json({
      fiscalYear,
      goals: userGoal
        ? {
            revenueTarget: userGoal.revenueTarget ? Number(userGoal.revenueTarget) : null,
            takeTarget: userGoal.takeTarget ? Number(userGoal.takeTarget) : null,
            pipelineTarget: userGoal.pipelineTarget ? Number(userGoal.pipelineTarget) : null,
            newDistrictsTarget: userGoal.newDistrictsTarget,
            drawDownTarget: userGoal.drawDownTarget ? Number(userGoal.drawDownTarget) : null,
            quotaTarget: userGoal.quotaTarget ? Number(userGoal.quotaTarget) : null,
          }
        : null,
      planTotals: {
        revenueTarget: totalRevenueTarget,
        pipelineTarget: totalPipelineTarget,
        districtCount,
        planCount: plans.length,
      },
      actuals: {
        revenue: revenueActual,
        take: takeActual,
        pipeline: pipelineActual,
        newDistricts: newDistrictsActual,
      },
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        color: plan.color,
        status: plan.status,
        districtCount: plan.districts.length,
        revenueTarget: plan.districts.reduce(
          (sum, pd) => sum + Number(pd.revenueTarget || 0),
          0
        ),
        pipelineTarget: plan.districts.reduce(
          (sum, pd) => sum + Number(pd.pipelineTarget || 0),
          0
        ),
      })),
    });
  } catch (error) {
    console.error("Error fetching goal dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal dashboard" },
      { status: 500 }
    );
  }
}
