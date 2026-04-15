import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const initiative = await prisma.initiative.findFirst({
      where: { isActive: true },
      include: {
        metrics: true,
        scores: {
          orderBy: { totalPoints: "desc" },
          include: { user: { select: { id: true, fullName: true, avatarUrl: true, role: true } } },
        },
      },
    });

    if (!initiative) {
      return NextResponse.json({ entries: [], metrics: [] });
    }

    // Admins are excluded from the Initiative tab roster.
    const rosterScores = initiative.scores.filter((s) => s.user.role !== "admin");
    const userIds = rosterScores.map((s) => s.userId);
    const sinceDate = initiative.startDate;

    // Fetch actual plan and activity records for all users (only since initiative start)
    // Attribute plans to their owner, falling back to creator when no owner is set
    const [plans, activities] = await Promise.all([
      prisma.territoryPlan.findMany({
        where: {
          createdAt: { gte: sinceDate },
          OR: [
            { ownerId: { in: userIds } },
            { userId: { in: userIds }, ownerId: null },
          ],
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
          userId: true,
          createdAt: true,
          districts: {
            select: {
              renewalTarget: true,
              winbackTarget: true,
              expansionTarget: true,
              newBusinessTarget: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activity.findMany({
        where: { createdByUserId: { in: userIds }, createdAt: { gte: sinceDate } },
        select: {
          id: true,
          title: true,
          type: true,
          createdByUserId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Group plans by effective owner (ownerId, falling back to userId)
    const plansByUser = new Map<string, typeof plans>();
    for (const plan of plans) {
      const uid = plan.ownerId ?? plan.userId;
      if (!uid) continue;
      const list = plansByUser.get(uid) ?? [];
      list.push(plan);
      plansByUser.set(uid, list);
    }

    const activitiesByUser = new Map<string, typeof activities>();
    for (const activity of activities) {
      if (!activity.createdByUserId) continue;
      const list = activitiesByUser.get(activity.createdByUserId) ?? [];
      list.push(activity);
      activitiesByUser.set(activity.createdByUserId, list);
    }

    // Build entries with breakdowns and individual items
    const entries = rosterScores.map((score, index) => {
      const userId = score.userId;
      const userPlans = plansByUser.get(userId) ?? [];
      const userActivities = activitiesByUser.get(userId) ?? [];

      // Calculate revenue units from plan districts
      let totalRevenue = 0;
      for (const plan of userPlans) {
        for (const d of plan.districts) {
          totalRevenue +=
            Number(d.renewalTarget ?? 0) +
            Number(d.winbackTarget ?? 0) +
            Number(d.expansionTarget ?? 0) +
            Number(d.newBusinessTarget ?? 0);
        }
      }
      const revenueUnits = Math.floor(totalRevenue / 10000);

      const actionCounts: Record<string, number> = {
        plan_created: userPlans.length,
        activity_logged: userActivities.length,
        revenue_targeted: revenueUnits,
      };

      const breakdown = initiative.metrics.map((m) => {
        const count = actionCounts[m.action] ?? 0;
        return {
          action: m.action,
          label: m.label,
          pointValue: m.pointValue,
          count,
          total: count * m.pointValue,
        };
      });

      // Individual items for each tracked action
      const items: {
        action: string;
        id: string;
        title: string;
        date: string;
        type?: string;
      }[] = [];

      for (const plan of userPlans) {
        items.push({
          action: "plan_created",
          id: String(plan.id),
          title: plan.name ?? `Plan #${plan.id}`,
          date: plan.createdAt.toISOString(),
        });
      }

      for (const activity of userActivities) {
        items.push({
          action: "activity_logged",
          id: activity.id,
          title: activity.title ?? "Untitled Activity",
          date: activity.createdAt.toISOString(),
          type: activity.type ?? undefined,
        });
      }

      return {
        rank: index + 1,
        userId,
        fullName: score.user.fullName ?? "Unknown",
        avatarUrl: score.user.avatarUrl,
        totalPoints: score.totalPoints,
        tier: score.tier,
        breakdown,
        items,
      };
    });

    return NextResponse.json({
      entries,
      metrics: initiative.metrics.map((m) => ({
        action: m.action,
        label: m.label,
        pointValue: m.pointValue,
      })),
    });
  } catch (error) {
    console.error("Error fetching leaderboard details:", error);
    return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
  }
}
