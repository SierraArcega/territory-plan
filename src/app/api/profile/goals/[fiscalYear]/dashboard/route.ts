import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import {
  getRepActuals,
  getNewDistrictsCount,
  getPlanDistrictActuals,
  fiscalYearToSchoolYear,
} from "@/lib/opportunity-actuals";

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

    for (const plan of plans) {
      for (const pd of plan.districts) {
        uniqueDistricts.add(pd.districtLeaid);

        // Sum targets
        if (pd.renewalTarget) totalRenewalTarget += Number(pd.renewalTarget);
        if (pd.winbackTarget) totalWinbackTarget += Number(pd.winbackTarget);
        if (pd.expansionTarget) totalExpansionTarget += Number(pd.expansionTarget);
        if (pd.newBusinessTarget) totalNewBusinessTarget += Number(pd.newBusinessTarget);
      }
    }

    districtCount = uniqueDistricts.size;

    // Fetch actuals from the materialized view
    const schoolYr = fiscalYearToSchoolYear(fiscalYear);
    const priorSchoolYr = fiscalYearToSchoolYear(fiscalYear - 1);
    const email = user.email ?? "";

    const [repActuals, newDistrictsCount] = await Promise.all([
      getRepActuals(email, schoolYr),
      getNewDistrictsCount(email, schoolYr, priorSchoolYr),
    ]);

    // Build per-plan actuals
    const plansWithActuals = await Promise.all(
      plans.map(async (plan) => {
        const districtLeaIds = plan.districts.map((d) => d.districtLeaid);
        const planActuals = await getPlanDistrictActuals(districtLeaIds, schoolYr, email);

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
          revenueActual: planActuals.totalRevenue,
          takeActual: planActuals.totalTake,
          bookingsActual: planActuals.bookings,
        };
      })
    );

    return NextResponse.json({
      fiscalYear,
      goals: userGoal
        ? {
            earningsTarget: userGoal.earningsTarget ? Number(userGoal.earningsTarget) : null,
            takeRatePercent: userGoal.takeRatePercent ? Number(userGoal.takeRatePercent) : null,
            takeTarget: Number(userGoal.takeTarget) || null,
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
        earnings: BASE_SALARY + repActuals.totalTake * COMMISSION_RATE,
        revenue: repActuals.totalRevenue,
        take: repActuals.totalTake,
        completedTake: repActuals.completedTake,
        scheduledTake: repActuals.scheduledTake,
        pipeline: repActuals.weightedPipeline,
        bookings: repActuals.bookings,
        invoiced: repActuals.invoiced,
        newDistricts: newDistrictsCount,
      },
      plans: plansWithActuals,
    });
  } catch (error) {
    console.error("Error fetching goal dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal dashboard" },
      { status: 500 }
    );
  }
}
