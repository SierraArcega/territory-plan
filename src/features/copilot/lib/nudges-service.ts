import type { PrismaClient } from "@prisma/client";
import { isOpenDeal, isOverdue } from "@/features/deals/lib/open-deals";
import { getStalePlans } from "@/features/plans/lib/plan-alerts";
import { computeStaleInStageCount, type StageOpp } from "./stale-in-stage";
import type { CopilotNudge } from "./nudge-types";

type Db = Pick<PrismaClient, "opportunity" | "activity" | "task" | "territoryPlan" | "territoryPlanDistrict">;

function endOfWeek(now: Date): Date {
  const d = new Date(now);
  const daysUntilSunday = 7 - d.getDay();
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Build the ranked, non-zero nudge list for a rep. Read-only. */
export async function buildCopilotNudges(
  userId: string,
  db: Db,
  now: Date,
): Promise<CopilotNudge[]> {
  const weekEnd = endOfWeek(now);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Load the rep's open opps once (reused by slipping + stale-in-stage).
  const opps = await db.opportunity.findMany({
    where: { salesRepId: userId, stage: { not: null } },
    select: { id: true, stage: true, closeDate: true, stageHistory: true, createdAt: true },
  });
  const openOpps = opps.filter((o) => isOpenDeal(o.stage));

  const slippingCount = openOpps.filter((o) => isOverdue(o.closeDate ?? null, now)).length;

  const stageOpps: StageOpp[] = openOpps.map((o) => ({
    stage: o.stage,
    stageHistory: Array.isArray(o.stageHistory) ? (o.stageHistory as unknown as StageOpp["stageHistory"]) : [],
    createdAt: o.createdAt ? o.createdAt.toISOString() : null,
  }));
  const staleInStageCount = computeStaleInStageCount(stageOpps, now);

  const [activityFollowUps, taskDue, stalePlans] = await Promise.all([
    db.activity.count({ where: { createdByUserId: userId, followUpDate: { gte: now, lte: weekEnd } } }),
    db.task.count({ where: { createdByUserId: userId, dueDate: { gte: now, lte: weekEnd } } }),
    getStalePlans(db, userId, thirtyDaysAgo),
  ]);
  const followUpsCount = activityFollowUps + taskDue;
  const stalePlansCount = stalePlans.length;

  const candidates: CopilotNudge[] = [
    {
      id: "deals_slipping", kind: "deals_slipping", severity: "risk",
      headline: `${slippingCount} ${slippingCount === 1 ? "deal is" : "deals are"} slipping`,
      reason: "Open with a close date in the past",
      count: slippingCount,
      seedPrompt: "Show me my open deals whose close date has already passed.",
    },
    {
      id: "follow_ups_due", kind: "follow_ups_due", severity: "risk",
      headline: `${followUpsCount} follow-up${followUpsCount === 1 ? "" : "s"} due this week`,
      reason: "From your activities and tasks",
      count: followUpsCount,
      seedPrompt: "What follow-ups and tasks do I have due this week?",
    },
    {
      id: "stale_in_stage", kind: "stale_in_stage", severity: "risk",
      headline: `${staleInStageCount} ${staleInStageCount === 1 ? "deal has" : "deals have"} stalled in stage`,
      reason: "In their stage longer than your average",
      count: staleInStageCount,
      seedPrompt: "Which of my open deals have been stuck in their current stage the longest?",
    },
    {
      id: "stale_plans", kind: "stale_plans", severity: "risk",
      headline: `${stalePlansCount} plan${stalePlansCount === 1 ? "" : "s"} ${stalePlansCount === 1 ? "has" : "have"} gone quiet`,
      reason: "No activity in 30 days",
      count: stalePlansCount,
      seedPrompt: "Which of my territory plans have had no activity in the last 30 days?",
    },
  ];

  // Omit zero-count; rank risk before opportunity, then by count desc.
  return candidates
    .filter((n) => n.count > 0)
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "risk" ? -1 : 1;
      return b.count - a.count;
    });
}
