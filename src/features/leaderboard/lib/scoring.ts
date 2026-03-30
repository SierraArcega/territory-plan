// src/features/leaderboard/lib/scoring.ts
import prisma from "@/lib/prisma";
import type { TierName, TierRank } from "./types";

interface TierThreshold {
  tier: string;
  minPoints: number;
}

/**
 * Determine the tier for a given point total.
 * @param points - the rep's total points
 * @param thresholds - tier thresholds for the initiative
 */
export function calculateTier(
  points: number,
  thresholds: TierThreshold[],
): TierRank {
  const sorted = [...thresholds].sort((a, b) => b.minPoints - a.minPoints);
  const matched = sorted.find((t) => points >= t.minPoints);
  return (matched?.tier ?? "freshman") as TierRank;
}

interface CombinedScoreInput {
  initiativePoints: number;
  maxInitiativePoints: number;
  pipeline: number;
  maxPipeline: number;
  take: number;
  maxTake: number;
  revenue: number;
  maxRevenue: number;
  initiativeWeight: number;
  pipelineWeight: number;
  takeWeight: number;
  revenueWeight: number;
}

/**
 * Calculate the normalized combined score (0-100 scale).
 */
export function calculateCombinedScore(input: CombinedScoreInput): number {
  const normalize = (value: number, max: number) => (max > 0 ? (value / max) * 100 : 0);

  const initiativeNorm = normalize(input.initiativePoints, input.maxInitiativePoints);
  const pipelineNorm = normalize(input.pipeline, input.maxPipeline);
  const takeNorm = normalize(input.take, input.maxTake);
  const revenueNorm = normalize(input.revenue, input.maxRevenue);

  return (
    initiativeNorm * input.initiativeWeight +
    pipelineNorm * input.pipelineWeight +
    takeNorm * input.takeWeight +
    revenueNorm * input.revenueWeight
  );
}

/**
 * Calculate effective points for an action: pointValue × weight, rounded.
 */
export function calculateEffectivePoints(
  pointValue: number,
  weight: number | { toNumber?: () => number } | undefined | null,
): number {
  const w = weight ?? 1.0;
  return Math.round(pointValue * Number(w));
}

/**
 * Award points to a user for a tracked action.
 * Finds the active initiative, checks if the action is tracked, and increments the score.
 * Returns the points awarded (0 if no active initiative or action not tracked).
 */
export async function awardPoints(userId: string, action: string): Promise<number> {
  const initiative = await prisma.initiative.findFirst({
    where: { isActive: true },
    include: { metrics: true },
  });

  if (!initiative) return 0;

  const metric = initiative.metrics.find((m) => m.action === action);
  if (!metric) return 0;

  const points = calculateEffectivePoints(metric.pointValue, metric.weight);
  if (points <= 0) return 0;

  await prisma.initiativeScore.upsert({
    where: { initiativeId_userId: { initiativeId: initiative.id, userId } },
    create: {
      initiativeId: initiative.id,
      userId,
      totalPoints: points,
      tier: "freshman",
    },
    update: {
      totalPoints: { increment: points },
    },
  });

  return points;
}

/**
 * Award points for revenue targeted (dollar-based metric).
 * Converts dollar amount to points based on the metric's pointValue (pts per $10K).
 */
export async function awardRevenueTargetedPoints(
  userId: string,
  targetAmount: number
): Promise<number> {
  const initiative = await prisma.initiative.findFirst({
    where: { isActive: true },
    include: { metrics: true },
  });

  if (!initiative) return 0;

  const metric = initiative.metrics.find((m) => m.action === "revenue_targeted");
  if (!metric) return 0;

  const units = Math.floor(targetAmount / 10000);
  const effectivePointValue = calculateEffectivePoints(metric.pointValue, metric.weight);
  const points = units * effectivePointValue;
  if (points <= 0) return 0;

  await prisma.initiativeScore.upsert({
    where: { initiativeId_userId: { initiativeId: initiative.id, userId } },
    create: {
      initiativeId: initiative.id,
      userId,
      totalPoints: points,
      tier: "freshman",
    },
    update: {
      totalPoints: { increment: points },
    },
  });

  return points;
}
