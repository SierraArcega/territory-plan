// GET /api/progress/outcomes — Outcome metrics for the progress dashboard
// Returns outcome distribution, sales funnel counts, district engagement, and tagging rate.
// Accepts optional `period` param: "month" (default), "quarter", or "fiscal_year"

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Period = "month" | "quarter" | "fiscal_year";

function getPeriodDates(period: Period) {
  const now = new Date();
  let currentStart: Date;
  let currentEnd: Date;

  if (period === "quarter") {
    const quarter = Math.floor(now.getMonth() / 3);
    currentStart = new Date(now.getFullYear(), quarter * 3, 1);
    currentEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
  } else if (period === "fiscal_year") {
    const fyStart = now.getMonth() >= 6
      ? new Date(now.getFullYear(), 6, 1)
      : new Date(now.getFullYear() - 1, 6, 1);
    currentStart = fyStart;
    currentEnd = new Date(fyStart.getFullYear() + 1, 5, 30, 23, 59, 59);
  } else {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  return { currentStart, currentEnd };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as Period;
    const { currentStart, currentEnd } = getPeriodDates(period);

    // Fetch completed activities with outcomes and district links
    const activities = await prisma.activity.findMany({
      where: {
        createdByUserId: user.id,
        createdAt: { gte: currentStart, lte: currentEnd },
        status: "completed",
      },
      select: {
        type: true,
        outcomeType: true,
        districts: { select: { districtLeaid: true } },
      },
    });

    // Get total districts across all user's active plans (for engagement ratio)
    const totalDistrictsInPlans = await prisma.territoryPlanDistrict.count({
      where: {
        plan: {
          userId: user.id,
          status: "active",
        },
      },
    });

    const totalCompleted = activities.length;
    const withOutcome = activities.filter((a) => a.outcomeType).length;

    // Count by outcome type
    const byOutcomeType: Record<string, number> = {};
    for (const a of activities) {
      if (a.outcomeType) {
        byOutcomeType[a.outcomeType] = (byOutcomeType[a.outcomeType] || 0) + 1;
      }
    }

    // Build sales funnel from activity types
    const funnel = {
      discoveryCallsCompleted: 0,
      demosCompleted: 0,
      proposalsReviewed: 0,
      positiveOutcomes: 0,
    };
    for (const a of activities) {
      if (a.type === "discovery_call") funnel.discoveryCallsCompleted++;
      if (a.type === "demo") funnel.demosCompleted++;
      if (a.type === "proposal_review") funnel.proposalsReviewed++;
      if (a.outcomeType === "positive_progress") funnel.positiveOutcomes++;
    }

    // Count unique engaged districts
    const engagedDistricts = new Set<string>();
    for (const a of activities) {
      for (const d of a.districts) {
        engagedDistricts.add(d.districtLeaid);
      }
    }

    return NextResponse.json({
      totalWithOutcome: withOutcome,
      totalCompleted,
      outcomeRate: totalCompleted > 0 ? Math.round((withOutcome / totalCompleted) * 100) : 0,
      byOutcomeType,
      funnel,
      districtsEngaged: engagedDistricts.size,
      totalDistrictsInPlans,
    });
  } catch (error) {
    console.error("Error fetching outcome metrics:", error);
    return NextResponse.json({ error: "Failed to fetch outcome metrics" }, { status: 500 });
  }
}
