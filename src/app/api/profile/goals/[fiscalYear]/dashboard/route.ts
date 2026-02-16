import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Constants for earnings calculation
const BASE_SALARY = 130000;
const COMMISSION_RATE = 0.10; // 10% of take

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
            renewalTarget: true,
            winbackTarget: true,
            expansionTarget: true,
            newBusinessTarget: true,
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
    let totalRenewalTarget = 0;
    let totalWinbackTarget = 0;
    let totalExpansionTarget = 0;
    let totalNewBusinessTarget = 0;
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
        if (pd.renewalTarget) totalRenewalTarget += Number(pd.renewalTarget);
        if (pd.winbackTarget) totalWinbackTarget += Number(pd.winbackTarget);
        if (pd.expansionTarget) totalExpansionTarget += Number(pd.expansionTarget);
        if (pd.newBusinessTarget) totalNewBusinessTarget += Number(pd.newBusinessTarget);

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

    // Calculate projected earnings based on actual take
    const earningsActual = BASE_SALARY + (takeActual * COMMISSION_RATE);

    return NextResponse.json({
      fiscalYear,
      goals: userGoal
        ? {
            earningsTarget: userGoal.earningsTarget ? Number(userGoal.earningsTarget) : null,
            takeRatePercent: userGoal.takeRatePercent ? Number(userGoal.takeRatePercent) : null,
            renewalTarget: userGoal.renewalTarget ? Number(userGoal.renewalTarget) : null,
            winbackTarget: userGoal.winbackTarget ? Number(userGoal.winbackTarget) : null,
            expansionTarget: userGoal.expansionTarget ? Number(userGoal.expansionTarget) : null,
            newBusinessTarget: userGoal.newBusinessTarget ? Number(userGoal.newBusinessTarget) : null,
            newDistrictsTarget: userGoal.newDistrictsTarget,
          }
        : null,
      planTotals: {
        renewalTarget: totalRenewalTarget,
        winbackTarget: totalWinbackTarget,
        expansionTarget: totalExpansionTarget,
        newBusinessTarget: totalNewBusinessTarget,
        totalTarget: totalRenewalTarget + totalWinbackTarget + totalExpansionTarget + totalNewBusinessTarget,
        districtCount,
        planCount: plans.length,
      },
      actuals: {
        earnings: earningsActual,
        revenue: revenueActual,
        take: takeActual,
        pipeline: pipelineActual,
        newDistricts: newDistrictsActual,
      },
      plans: plans.map((plan) => {
        const renewal = plan.districts.reduce((sum, pd) => sum + Number(pd.renewalTarget || 0), 0);
        const winback = plan.districts.reduce((sum, pd) => sum + Number(pd.winbackTarget || 0), 0);
        const expansion = plan.districts.reduce((sum, pd) => sum + Number(pd.expansionTarget || 0), 0);
        const newBiz = plan.districts.reduce((sum, pd) => sum + Number(pd.newBusinessTarget || 0), 0);
        return {
          id: plan.id,
          name: plan.name,
          color: plan.color,
          status: plan.status,
          districtCount: plan.districts.length,
          renewalTarget: renewal,
          winbackTarget: winback,
          expansionTarget: expansion,
          newBusinessTarget: newBiz,
          totalTarget: renewal + winback + expansion + newBiz,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching goal dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal dashboard" },
      { status: 500 }
    );
  }
}
