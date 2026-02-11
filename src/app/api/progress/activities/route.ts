// GET /api/progress/activities — Activity metrics for the progress dashboard
// Returns counts by category, source, status, plan, plus period-over-period trends.
// Accepts optional `period` param: "month" (default), "quarter", or "fiscal_year"

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { ACTIVITY_CATEGORIES, getCategoryForType, type ActivityType } from "@/lib/activityTypes";

export const dynamic = "force-dynamic";

type Period = "month" | "quarter" | "fiscal_year";

// Get the start/end dates for the current and previous period
function getPeriodDates(period: Period) {
  const now = new Date();
  let currentStart: Date;
  let previousStart: Date;
  let currentEnd: Date;

  if (period === "quarter") {
    const quarter = Math.floor(now.getMonth() / 3);
    currentStart = new Date(now.getFullYear(), quarter * 3, 1);
    currentEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
    previousStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
  } else if (period === "fiscal_year") {
    // Fiscal year runs Jul 1 – Jun 30
    const fyStart = now.getMonth() >= 6
      ? new Date(now.getFullYear(), 6, 1)
      : new Date(now.getFullYear() - 1, 6, 1);
    currentStart = fyStart;
    currentEnd = new Date(fyStart.getFullYear() + 1, 5, 30, 23, 59, 59);
    previousStart = new Date(fyStart.getFullYear() - 1, 6, 1);
  } else {
    // Default: month
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }

  return { currentStart, currentEnd, previousStart, previousEnd: new Date(currentStart.getTime() - 1) };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as Period;
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodDates(period);

    // Fetch current period activities and previous period count in parallel
    const [currentActivities, previousCount] = await Promise.all([
      prisma.activity.findMany({
        where: {
          createdByUserId: user.id,
          createdAt: { gte: currentStart, lte: currentEnd },
        },
        select: {
          type: true,
          status: true,
          source: true,
          plans: { select: { planId: true, plan: { select: { name: true, color: true } } } },
        },
      }),
      prisma.activity.count({
        where: {
          createdByUserId: user.id,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
      }),
    ]);

    // Count by category
    const byCategory = { events: 0, outreach: 0, meetings: 0 };
    for (const a of currentActivities) {
      const cat = getCategoryForType(a.type as ActivityType);
      byCategory[cat]++;
    }

    // Count by source
    const bySource = { manual: 0, calendar_sync: 0 };
    for (const a of currentActivities) {
      const src = (a.source || "manual") as "manual" | "calendar_sync";
      bySource[src]++;
    }

    // Count by status
    const byStatus = { planned: 0, completed: 0, cancelled: 0 };
    for (const a of currentActivities) {
      if (a.status in byStatus) {
        byStatus[a.status as keyof typeof byStatus]++;
      }
    }

    // Count by plan (aggregate across all activities' plan links)
    const planCounts = new Map<string, { planName: string; planColor: string; count: number }>();
    let linkedToAnyPlan = 0;
    for (const a of currentActivities) {
      if (a.plans.length > 0) linkedToAnyPlan++;
      for (const p of a.plans) {
        const existing = planCounts.get(p.planId);
        if (existing) {
          existing.count++;
        } else {
          planCounts.set(p.planId, {
            planName: p.plan.name,
            planColor: p.plan.color,
            count: 1,
          });
        }
      }
    }

    const total = currentActivities.length;

    // Trend: percent change vs previous period
    const changePercent = previousCount > 0
      ? Math.round(((total - previousCount) / previousCount) * 100)
      : total > 0 ? 100 : 0;

    return NextResponse.json({
      period: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
      totalActivities: total,
      byCategory,
      bySource,
      byStatus,
      byPlan: [...planCounts.entries()]
        .map(([planId, data]) => ({ planId, ...data }))
        .sort((a, b) => b.count - a.count),
      trend: { current: total, previous: previousCount, changePercent },
      planCoveragePercent: total > 0 ? Math.round((linkedToAnyPlan / total) * 100) : 0,
    });
  } catch (error) {
    console.error("Error fetching activity metrics:", error);
    return NextResponse.json({ error: "Failed to fetch activity metrics" }, { status: 500 });
  }
}
