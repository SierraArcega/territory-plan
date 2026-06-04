import type { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "territoryPlan" | "territoryPlanDistrict">;

/** A plan is stale when its most recent activity/task date is before `since`. */
export function isPlanStale(dates: Date[], since: Date): boolean {
  if (dates.length === 0) return true;
  const last = Math.max(...dates.map((d) => d.getTime()));
  return last < since.getTime();
}

export interface StalePlan {
  planId: string;
  planName: string;
  planColor: string | null;
  districtCount: number;
  lastActivityDate: string | null;
}

export async function getStalePlans(db: Db, userId: string, since: Date): Promise<StalePlan[]> {
  const plans = await db.territoryPlan.findMany({
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
      const dates: Date[] = [];
      for (const link of plan.activityLinks) {
        dates.push(link.activity.createdAt);
        if (link.activity.startDate) dates.push(link.activity.startDate);
      }
      for (const link of plan.taskLinks) {
        dates.push(link.task.createdAt);
        if (link.task.dueDate) dates.push(link.task.dueDate);
      }
      const last =
        dates.length > 0
          ? new Date(Math.max(...dates.map((d) => d.getTime())))
          : null;
      return {
        dates,
        summary: {
          planId: plan.id,
          planName: plan.name,
          planColor: plan.color,
          districtCount: plan.districtCount,
          lastActivityDate: last?.toISOString() ?? null,
        },
      };
    })
    .filter((p) => isPlanStale(p.dates, since))
    .map((p) => p.summary);
}

export interface DistrictWithoutContacts {
  leaid: string;
  districtName: string;
  stateAbbrev: string;
  planId: string;
  planName: string;
  planColor: string | null;
}

export async function getDistrictsWithoutContacts(
  db: Db,
  userId: string,
): Promise<DistrictWithoutContacts[]> {
  const planDistricts = await db.territoryPlanDistrict.findMany({
    where: { plan: { userId } },
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
