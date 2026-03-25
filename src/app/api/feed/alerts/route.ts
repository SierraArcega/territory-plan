import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/feed/alerts - Returns "Needs Attention" alerts for the Feed
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run both queries in parallel
    const [districtsWithoutContacts, stalePlans] = await Promise.all([
      getDistrictsWithoutContacts(user.id),
      getStalePlans(user.id, thirtyDaysAgo),
    ]);

    return NextResponse.json({ districtsWithoutContacts, stalePlans });
  } catch (error) {
    console.error("Error fetching feed alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed alerts" },
      { status: 500 }
    );
  }
}

/**
 * Find all districts in the user's territory plans that have zero contacts.
 */
async function getDistrictsWithoutContacts(userId: string) {
  const planDistricts = await prisma.territoryPlanDistrict.findMany({
    where: {
      plan: { userId },
    },
    select: {
      districtLeaid: true,
      plan: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      district: {
        select: {
          leaid: true,
          name: true,
          stateAbbrev: true,
          _count: {
            select: { contacts: true },
          },
        },
      },
    },
  });

  return planDistricts
    .filter((pd) => pd.district._count.contacts === 0)
    .map((pd) => ({
      leaid: pd.district.leaid,
      districtName: pd.district.name,
      stateAbbrev: pd.district.stateAbbrev ?? "",
      planId: pd.plan.id,
      planName: pd.plan.name,
      planColor: pd.plan.color,
    }));
}

/**
 * Find all user's territory plans with no activity or task activity in the last 30 days.
 */
async function getStalePlans(userId: string, since: Date) {
  const plans = await prisma.territoryPlan.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      color: true,
      districtCount: true,
      activityLinks: {
        select: {
          activity: {
            select: {
              createdAt: true,
              startDate: true,
            },
          },
        },
      },
      taskLinks: {
        select: {
          task: {
            select: {
              createdAt: true,
              dueDate: true,
            },
          },
        },
      },
    },
  });

  return plans
    .map((plan) => {
      // Collect all relevant dates from activities and tasks
      const dates: Date[] = [];

      for (const link of plan.activityLinks) {
        dates.push(link.activity.createdAt);
        if (link.activity.startDate) dates.push(link.activity.startDate);
      }

      for (const link of plan.taskLinks) {
        dates.push(link.task.createdAt);
        if (link.task.dueDate) dates.push(link.task.dueDate);
      }

      const lastActivityDate =
        dates.length > 0
          ? new Date(Math.max(...dates.map((d) => d.getTime())))
          : null;

      const hasRecentActivity =
        lastActivityDate !== null && lastActivityDate >= since;

      return {
        planId: plan.id,
        planName: plan.name,
        planColor: plan.color,
        districtCount: plan.districtCount,
        lastActivityDate: lastActivityDate?.toISOString() ?? null,
        _isStale: !hasRecentActivity,
      };
    })
    .filter((p) => p._isStale)
    .map(({ _isStale, ...rest }) => rest);
}
