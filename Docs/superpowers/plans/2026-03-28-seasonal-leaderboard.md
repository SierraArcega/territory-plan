# Seasonal Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a gamified leaderboard with tiered rankings, seasonal metric rotation, and a combined score blending platform engagement with sales performance.

**Architecture:** Four new Prisma models (Season, SeasonMetric, SeasonScore, SeasonTierThreshold) store season config and rep scores. A shared scoring utility handles point increments when reps perform tracked actions. The leaderboard is surfaced via three UI placements: a compact widget in the left nav (every page), a richer widget in the home sidebar, and a full leaderboard modal with Combined/Season Points/Take views.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma/PostgreSQL, TanStack Query, Zustand (modal state), Tailwind 4, Lucide icons, Vitest.

**Branch:** All work on `feat/seasonal-leaderboard` off main.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add Season, SeasonMetric, SeasonScore, SeasonTierThreshold models |
| `scripts/seed-season-0.ts` | Create | Seed Season 0 config + retroactive backfill |
| `src/features/leaderboard/lib/types.ts` | Create | TypeScript types for leaderboard data |
| `src/features/leaderboard/lib/scoring.ts` | Create | Point increment + tier calculation logic |
| `src/features/leaderboard/lib/queries.ts` | Create | TanStack Query hooks for leaderboard data |
| `src/app/api/leaderboard/route.ts` | Create | GET full leaderboard rankings |
| `src/app/api/leaderboard/me/route.ts` | Create | GET current user's rank + neighbors |
| `src/features/leaderboard/components/LeaderboardNavWidget.tsx` | Create | Compact widget for left nav sidebar |
| `src/features/leaderboard/components/LeaderboardHomeWidget.tsx` | Create | Richer widget for home sidebar |
| `src/features/leaderboard/components/LeaderboardModal.tsx` | Create | Full leaderboard modal |
| `src/features/leaderboard/components/TierBadge.tsx` | Create | Shared tier badge component (shield icon + color) |
| `src/features/leaderboard/components/RankTicker.tsx` | Create | Auto-rotating ticker showing neighbors |
| `src/features/shared/components/navigation/Sidebar.tsx` | Modify | Add LeaderboardNavWidget above Profile button |
| `src/features/home/components/ProfileSidebar.tsx` | Modify | Add LeaderboardHomeWidget above avatar |
| `src/app/api/territory-plans/route.ts` | Modify | Hook point scoring into plan creation |
| `src/app/api/activities/route.ts` | Modify | Hook point scoring into activity creation |

---

## Task 1: Create Feature Branch

**Files:** None (git only)

- [ ] **Step 1: Create and checkout feature branch**

```bash
git checkout -b feat/seasonal-leaderboard main
```

- [ ] **Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `feat/seasonal-leaderboard`

---

## Task 2: Add Prisma Models

**Files:**
- Modify: `prisma/schema.prisma` (append after the Session model, around line 1275)

- [ ] **Step 1: Add the four leaderboard models to the Prisma schema**

Append at the end of `prisma/schema.prisma` (before the closing of the file), after the last model:

```prisma
// ===== Seasonal Leaderboard =====
// Gamified point system with tiered rankings and seasonal rotation.

model Season {
  id             Int      @id @default(autoincrement())
  name           String   @db.VarChar(100)
  startDate      DateTime @map("start_date") @db.Timestamptz
  endDate        DateTime @map("end_date") @db.Timestamptz
  isActive       Boolean  @default(false) @map("is_active")
  softResetTiers Int      @default(1) @map("soft_reset_tiers")
  seasonWeight   Decimal  @default(0.6) @map("season_weight") @db.Decimal(3, 2)
  pipelineWeight Decimal  @default(0.2) @map("pipeline_weight") @db.Decimal(3, 2)
  takeWeight     Decimal  @default(0.2) @map("take_weight") @db.Decimal(3, 2)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  metrics    SeasonMetric[]
  scores     SeasonScore[]
  thresholds SeasonTierThreshold[]

  @@map("seasons")
}

model SeasonMetric {
  id         Int    @id @default(autoincrement())
  seasonId   Int    @map("season_id")
  action     String @db.VarChar(50)
  pointValue Int    @map("point_value")
  label      String @db.VarChar(100)

  season Season @relation(fields: [seasonId], references: [id], onDelete: Cascade)

  @@index([seasonId])
  @@map("season_metrics")
}

model SeasonScore {
  id          Int      @id @default(autoincrement())
  seasonId    Int      @map("season_id")
  userId      String   @map("user_id") @db.Uuid
  totalPoints Int      @default(0) @map("total_points")
  tier        String   @default("iron_3") @db.VarChar(20)
  rank        Int      @default(0)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  season Season      @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  user   UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([seasonId, userId])
  @@index([seasonId, totalPoints(sort: Desc)])
  @@map("season_scores")
}

model SeasonTierThreshold {
  id        Int    @id @default(autoincrement())
  seasonId  Int    @map("season_id")
  tier      String @db.VarChar(20)
  minPoints Int    @map("min_points")

  season Season @relation(fields: [seasonId], references: [id], onDelete: Cascade)

  @@unique([seasonId, tier])
  @@index([seasonId])
  @@map("season_tier_thresholds")
}
```

- [ ] **Step 2: Add the `seasonScores` relation to the UserProfile model**

Find the `UserProfile` model in the schema (around line 757) and add the relation field alongside the existing relations (near `goals`, `ownedPlans`, etc.):

```prisma
  seasonScores      SeasonScore[]
```

- [ ] **Step 3: Generate the migration**

```bash
npx prisma migrate dev --name add_seasonal_leaderboard
```

Expected: Migration created successfully, Prisma Client regenerated.

- [ ] **Step 4: Verify the generated client has the new models**

```bash
npx prisma validate
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(leaderboard): add Season, SeasonMetric, SeasonScore, SeasonTierThreshold models"
```

---

## Task 3: Create Leaderboard Types

**Files:**
- Create: `src/features/leaderboard/lib/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/features/leaderboard/lib/types.ts

export const TIERS = ["iron", "bronze", "silver", "gold"] as const;
export type TierName = (typeof TIERS)[number];

export const SUB_RANKS = [3, 2, 1] as const;
export type SubRank = (typeof SUB_RANKS)[number];

/** e.g. "iron_3", "gold_1" */
export type TierRank = `${TierName}_${SubRank}`;

export const TIER_COLORS: Record<TierName, { bg: string; text: string; glow: string }> = {
  iron:   { bg: "#F7F5FA", text: "#8A80A8", glow: "rgba(138,128,168,0.3)" },
  bronze: { bg: "#FEF2F1", text: "#F37167", glow: "rgba(243,113,103,0.3)" },
  silver: { bg: "#EEF4F9", text: "#5B8FAF", glow: "rgba(91,143,175,0.3)" },
  gold:   { bg: "#FFF8EE", text: "#D4A843", glow: "rgba(212,168,67,0.3)" },
};

export const TIER_LABELS: Record<TierName, string> = {
  iron: "Iron",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export function parseTierRank(tierRank: TierRank): { tier: TierName; subRank: SubRank } {
  const [tier, rank] = tierRank.split("_") as [TierName, string];
  return { tier, subRank: parseInt(rank, 10) as SubRank };
}

export function formatTierLabel(tierRank: TierRank): string {
  const { tier, subRank } = parseTierRank(tierRank);
  const romanMap: Record<SubRank, string> = { 3: "III", 2: "II", 1: "I" };
  return `${TIER_LABELS[tier]} ${romanMap[subRank]}`;
}

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalPoints: number;
  tier: TierRank;
  rank: number;
  take: number;
  pipeline: number;
  combinedScore: number;
  seasonScore: number;
}

export interface LeaderboardMyRank {
  entry: LeaderboardEntry;
  above: LeaderboardEntry | null;
  below: LeaderboardEntry | null;
  totalReps: number;
  pointBreakdown: { label: string; count: number; pointValue: number; total: number }[];
}

export interface SeasonInfo {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  seasonWeight: number;
  pipelineWeight: number;
  takeWeight: number;
}

export type LeaderboardView = "combined" | "season" | "take";
```

- [ ] **Step 2: Commit**

```bash
git add src/features/leaderboard/lib/types.ts
git commit -m "feat(leaderboard): add leaderboard TypeScript types"
```

---

## Task 4: Create Scoring Logic

**Files:**
- Create: `src/features/leaderboard/lib/scoring.ts`
- Test: `src/features/leaderboard/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write tests for tier calculation and point awarding**

```typescript
// src/features/leaderboard/lib/__tests__/scoring.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateTier, calculateCombinedScore } from "../scoring";

describe("calculateTier", () => {
  const thresholds = [
    { tier: "iron", minPoints: 0 },
    { tier: "bronze", minPoints: 100 },
    { tier: "silver", minPoints: 300 },
    { tier: "gold", minPoints: 600 },
  ];

  it("assigns iron for 0 points", () => {
    // With no other reps in the tier, defaults to sub-rank 3
    expect(calculateTier(0, thresholds, [])).toBe("iron_3");
  });

  it("assigns bronze for 150 points", () => {
    expect(calculateTier(150, thresholds, [])).toBe("bronze_3");
  });

  it("assigns gold for 700 points", () => {
    expect(calculateTier(700, thresholds, [])).toBe("gold_3");
  });

  it("calculates sub-rank based on percentile within tier", () => {
    // 3 reps in bronze: 100, 150, 200 — bottom third=III, middle=II, top=I
    const peersInTier = [100, 150, 200];
    expect(calculateTier(100, thresholds, peersInTier)).toBe("bronze_3");
    expect(calculateTier(150, thresholds, peersInTier)).toBe("bronze_2");
    expect(calculateTier(200, thresholds, peersInTier)).toBe("bronze_1");
  });

  it("handles single rep in tier as sub-rank 3", () => {
    expect(calculateTier(150, thresholds, [150])).toBe("bronze_3");
  });
});

describe("calculateCombinedScore", () => {
  it("calculates normalized combined score with 60/20/20 weights", () => {
    const score = calculateCombinedScore({
      seasonPoints: 50,
      maxSeasonPoints: 100,
      pipeline: 200000,
      maxPipeline: 400000,
      take: 100000,
      maxTake: 500000,
      seasonWeight: 0.6,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
    });
    // season: (50/100)*100 = 50, pipeline: (200k/400k)*100 = 50, take: (100k/500k)*100 = 20
    // combined: 50*0.6 + 50*0.2 + 20*0.2 = 30 + 10 + 4 = 44
    expect(score).toBeCloseTo(44);
  });

  it("handles zero max values gracefully", () => {
    const score = calculateCombinedScore({
      seasonPoints: 50,
      maxSeasonPoints: 100,
      pipeline: 0,
      maxPipeline: 0,
      take: 0,
      maxTake: 0,
      seasonWeight: 0.6,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
    });
    // Only season has data: (50/100)*100*0.6 = 30, others = 0
    expect(score).toBeCloseTo(30);
  });

  it("handles all zeros", () => {
    const score = calculateCombinedScore({
      seasonPoints: 0,
      maxSeasonPoints: 0,
      pipeline: 0,
      maxPipeline: 0,
      take: 0,
      maxTake: 0,
      seasonWeight: 0.6,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
    });
    expect(score).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/leaderboard/lib/__tests__/scoring.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement scoring logic**

```typescript
// src/features/leaderboard/lib/scoring.ts
import prisma from "@/lib/prisma";
import type { TierName, TierRank, SubRank } from "./types";
import { TIERS } from "./types";

interface TierThreshold {
  tier: string;
  minPoints: number;
}

/**
 * Determine the full tier rank (e.g. "bronze_2") for a given point total.
 * @param points - the rep's total points
 * @param thresholds - sorted tier thresholds for the season
 * @param peersInTier - all point totals of reps in the same tier (for sub-rank percentile)
 */
export function calculateTier(
  points: number,
  thresholds: TierThreshold[],
  peersInTier: number[]
): TierRank {
  // Find highest threshold the rep meets
  const sorted = [...thresholds].sort((a, b) => b.minPoints - a.minPoints);
  const matched = sorted.find((t) => points >= t.minPoints);
  const tierName = (matched?.tier ?? "iron") as TierName;

  // Sub-rank: percentile within tier
  let subRank: SubRank = 3;
  if (peersInTier.length >= 3) {
    const sortedPeers = [...peersInTier].sort((a, b) => a - b);
    const position = sortedPeers.indexOf(points);
    const percentile = position / (sortedPeers.length - 1);
    if (percentile >= 0.667) subRank = 1;
    else if (percentile >= 0.333) subRank = 2;
    else subRank = 3;
  }

  return `${tierName}_${subRank}` as TierRank;
}

interface CombinedScoreInput {
  seasonPoints: number;
  maxSeasonPoints: number;
  pipeline: number;
  maxPipeline: number;
  take: number;
  maxTake: number;
  seasonWeight: number;
  pipelineWeight: number;
  takeWeight: number;
}

/**
 * Calculate the normalized combined score (0-100 scale).
 */
export function calculateCombinedScore(input: CombinedScoreInput): number {
  const normalize = (value: number, max: number) => (max > 0 ? (value / max) * 100 : 0);

  const seasonNorm = normalize(input.seasonPoints, input.maxSeasonPoints);
  const pipelineNorm = normalize(input.pipeline, input.maxPipeline);
  const takeNorm = normalize(input.take, input.maxTake);

  return (
    seasonNorm * input.seasonWeight +
    pipelineNorm * input.pipelineWeight +
    takeNorm * input.takeWeight
  );
}

/**
 * Award points to a user for a tracked action.
 * Finds the active season, checks if the action is tracked, and increments the score.
 * Returns the points awarded (0 if no active season or action not tracked).
 */
export async function awardPoints(userId: string, action: string): Promise<number> {
  // Find active season and matching metric
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: { metrics: true },
  });

  if (!season) return 0;

  const metric = season.metrics.find((m) => m.action === action);
  if (!metric) return 0;

  // Upsert the score — create if first action, increment if exists
  await prisma.seasonScore.upsert({
    where: { seasonId_userId: { seasonId: season.id, userId } },
    create: {
      seasonId: season.id,
      userId,
      totalPoints: metric.pointValue,
      tier: "iron_3",
    },
    update: {
      totalPoints: { increment: metric.pointValue },
    },
  });

  return metric.pointValue;
}

/**
 * Award points for revenue targeted (dollar-based metric).
 * Converts dollar amount to points based on the metric's pointValue (pts per $10K).
 */
export async function awardRevenueTargetedPoints(
  userId: string,
  targetAmount: number
): Promise<number> {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: { metrics: true },
  });

  if (!season) return 0;

  const metric = season.metrics.find((m) => m.action === "revenue_targeted");
  if (!metric) return 0;

  // pointValue = pts per $10K, so $150K = 15 * pointValue
  const units = Math.floor(targetAmount / 10000);
  const points = units * metric.pointValue;
  if (points <= 0) return 0;

  await prisma.seasonScore.upsert({
    where: { seasonId_userId: { seasonId: season.id, userId } },
    create: {
      seasonId: season.id,
      userId,
      totalPoints: points,
      tier: "iron_3",
    },
    update: {
      totalPoints: { increment: points },
    },
  });

  return points;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/leaderboard/lib/__tests__/scoring.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/lib/scoring.ts src/features/leaderboard/lib/__tests__/scoring.test.ts
git commit -m "feat(leaderboard): add scoring logic with tier calculation and point awarding"
```

---

## Task 5: Create Leaderboard API Routes

**Files:**
- Create: `src/app/api/leaderboard/route.ts`
- Create: `src/app/api/leaderboard/me/route.ts`

- [ ] **Step 1: Create the full leaderboard GET endpoint**

```typescript
// src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { calculateTier, calculateCombinedScore } from "@/features/leaderboard/lib/scoring";
import { getRepActuals } from "@/lib/opportunity-actuals";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — full leaderboard for active season
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get active season with thresholds and metrics
    const season = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        thresholds: true,
        metrics: true,
      },
    });

    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    // Get all scores for this season with user profiles
    const scores = await prisma.seasonScore.findMany({
      where: { seasonId: season.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
      orderBy: { totalPoints: "desc" },
    });

    // Get take and pipeline data for all reps via the materialized view
    // Use current fiscal year — Season 0 is FY26
    const now = new Date();
    const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    const schoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;

    // Fetch actuals for all reps in parallel
    const repActuals = await Promise.all(
      scores.map(async (score) => {
        const email = score.user.email;
        try {
          const actuals = await getRepActuals(email, schoolYr);
          return {
            userId: score.userId,
            take: actuals.totalTake,
            pipeline: actuals.weightedPipeline,
          };
        } catch {
          return { userId: score.userId, take: 0, pipeline: 0 };
        }
      })
    );

    const actualsMap = new Map(repActuals.map((a) => [a.userId, a]));

    // Calculate max values for normalization
    const maxSeasonPoints = Math.max(...scores.map((s) => s.totalPoints), 0);
    const maxTake = Math.max(...repActuals.map((a) => a.take), 0);
    const maxPipeline = Math.max(...repActuals.map((a) => a.pipeline), 0);

    // Group scores by tier for sub-rank calculation
    const thresholdsSorted = [...season.thresholds].sort((a, b) => b.minPoints - a.minPoints);
    const tierGroups = new Map<string, number[]>();
    for (const score of scores) {
      const matched = thresholdsSorted.find((t) => score.totalPoints >= t.minPoints);
      const tierName = matched?.tier ?? "iron";
      if (!tierGroups.has(tierName)) tierGroups.set(tierName, []);
      tierGroups.get(tierName)!.push(score.totalPoints);
    }

    // Build leaderboard entries with combined scores
    const entries = scores.map((score, index) => {
      const actuals = actualsMap.get(score.userId) ?? { take: 0, pipeline: 0 };
      const matched = thresholdsSorted.find((t) => score.totalPoints >= t.minPoints);
      const tierName = matched?.tier ?? "iron";
      const peersInTier = tierGroups.get(tierName) ?? [];

      const tier = calculateTier(
        score.totalPoints,
        season.thresholds.map((t) => ({ tier: t.tier, minPoints: t.minPoints })),
        peersInTier
      );

      const combinedScore = calculateCombinedScore({
        seasonPoints: score.totalPoints,
        maxSeasonPoints,
        pipeline: actuals.pipeline,
        maxPipeline,
        take: actuals.take,
        maxTake,
        seasonWeight: Number(season.seasonWeight),
        pipelineWeight: Number(season.pipelineWeight),
        takeWeight: Number(season.takeWeight),
      });

      const seasonScore = maxSeasonPoints > 0
        ? (score.totalPoints / maxSeasonPoints) * 100
        : 0;

      return {
        userId: score.userId,
        fullName: score.user.fullName ?? "Unknown",
        avatarUrl: score.user.avatarUrl,
        totalPoints: score.totalPoints,
        tier,
        rank: index + 1,
        take: actuals.take,
        pipeline: actuals.pipeline,
        combinedScore: Math.round(combinedScore * 10) / 10,
        seasonScore: Math.round(seasonScore * 10) / 10,
      };
    });

    return NextResponse.json({
      season: {
        id: season.id,
        name: season.name,
        startDate: season.startDate.toISOString(),
        endDate: season.endDate.toISOString(),
        seasonWeight: Number(season.seasonWeight),
        pipelineWeight: Number(season.pipelineWeight),
        takeWeight: Number(season.takeWeight),
      },
      entries,
      metrics: season.metrics.map((m) => ({
        action: m.action,
        label: m.label,
        pointValue: m.pointValue,
      })),
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the "me" endpoint for current user's rank + neighbors**

```typescript
// src/app/api/leaderboard/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/leaderboard/me — current user's rank, neighbors, and point breakdown
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const season = await prisma.season.findFirst({
      where: { isActive: true },
      include: { metrics: true },
    });

    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    // Get all scores ranked by points
    const allScores = await prisma.seasonScore.findMany({
      where: { seasonId: season.id },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { totalPoints: "desc" },
    });

    const myIndex = allScores.findIndex((s) => s.userId === user.id);

    if (myIndex === -1) {
      // User has no score yet — return default iron_3 with no neighbors
      return NextResponse.json({
        seasonName: season.name,
        rank: allScores.length + 1,
        totalReps: allScores.length + 1,
        totalPoints: 0,
        tier: "iron_3",
        above: null,
        below: null,
        pointBreakdown: season.metrics.map((m) => ({
          label: m.label,
          action: m.action,
          pointValue: m.pointValue,
          count: 0,
          total: 0,
        })),
      });
    }

    const myScore = allScores[myIndex];
    const above = myIndex > 0 ? allScores[myIndex - 1] : null;
    const below = myIndex < allScores.length - 1 ? allScores[myIndex + 1] : null;

    // Calculate point breakdown per metric
    // Count actions from the source tables for accurate breakdown
    const [planCount, activityCount] = await Promise.all([
      prisma.territoryPlan.count({ where: { userId: user.id } }),
      prisma.activity.count({ where: { createdByUserId: user.id } }),
    ]);

    const actionCounts: Record<string, number> = {
      plan_created: planCount,
      activity_logged: activityCount,
    };

    const pointBreakdown = season.metrics.map((m) => {
      const count = actionCounts[m.action] ?? 0;
      return {
        label: m.label,
        action: m.action,
        pointValue: m.pointValue,
        count,
        total: count * m.pointValue,
      };
    });

    // For revenue_targeted, compute from plan district targets
    const revMetric = season.metrics.find((m) => m.action === "revenue_targeted");
    if (revMetric) {
      const plans = await prisma.territoryPlan.findMany({
        where: { userId: user.id },
        include: {
          districts: {
            select: {
              renewalTarget: true,
              winbackTarget: true,
              expansionTarget: true,
              newBusinessTarget: true,
            },
          },
        },
      });

      let totalTargeted = 0;
      for (const plan of plans) {
        for (const d of plan.districts) {
          totalTargeted +=
            Number(d.renewalTarget ?? 0) +
            Number(d.winbackTarget ?? 0) +
            Number(d.expansionTarget ?? 0) +
            Number(d.newBusinessTarget ?? 0);
        }
      }

      const units = Math.floor(totalTargeted / 10000);
      const existing = pointBreakdown.find((b) => b.action === "revenue_targeted");
      if (existing) {
        existing.count = units;
        existing.total = units * revMetric.pointValue;
      }
    }

    const formatNeighbor = (score: typeof myScore | null) =>
      score
        ? {
            userId: score.userId,
            fullName: score.user.fullName ?? "Unknown",
            avatarUrl: score.user.avatarUrl,
            totalPoints: score.totalPoints,
            rank: allScores.indexOf(score) + 1,
          }
        : null;

    return NextResponse.json({
      seasonName: season.name,
      rank: myIndex + 1,
      totalReps: allScores.length,
      totalPoints: myScore.totalPoints,
      tier: myScore.tier,
      above: formatNeighbor(above),
      below: formatNeighbor(below),
      pointBreakdown,
    });
  } catch (error) {
    console.error("Error fetching my leaderboard rank:", error);
    return NextResponse.json({ error: "Failed to fetch rank" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leaderboard/
git commit -m "feat(leaderboard): add leaderboard API routes (full rankings + my rank)"
```

---

## Task 6: Create TanStack Query Hooks

**Files:**
- Create: `src/features/leaderboard/lib/queries.ts`

- [ ] **Step 1: Create the query hooks**

```typescript
// src/features/leaderboard/lib/queries.ts
import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { LeaderboardEntry, SeasonInfo } from "./types";

interface LeaderboardResponse {
  season: SeasonInfo;
  entries: LeaderboardEntry[];
  metrics: { action: string; label: string; pointValue: number }[];
}

interface MyRankResponse {
  seasonName: string;
  rank: number;
  totalReps: number;
  totalPoints: number;
  tier: string;
  above: {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    totalPoints: number;
    rank: number;
  } | null;
  below: {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    totalPoints: number;
    rank: number;
  } | null;
  pointBreakdown: {
    label: string;
    action: string;
    pointValue: number;
    count: number;
    total: number;
  }[];
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchJson<LeaderboardResponse>(`${API_BASE}/leaderboard`),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useMyLeaderboardRank() {
  return useQuery({
    queryKey: ["leaderboard", "me"],
    queryFn: () => fetchJson<MyRankResponse>(`${API_BASE}/leaderboard/me`),
    staleTime: 2 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/leaderboard/lib/queries.ts
git commit -m "feat(leaderboard): add TanStack Query hooks for leaderboard data"
```

---

## Task 7: Create TierBadge Component

**Files:**
- Create: `src/features/leaderboard/components/TierBadge.tsx`

- [ ] **Step 1: Create the tier badge component**

```tsx
// src/features/leaderboard/components/TierBadge.tsx
"use client";

import { Shield } from "lucide-react";
import { parseTierRank, formatTierLabel, TIER_COLORS } from "../lib/types";
import type { TierRank } from "../lib/types";

interface TierBadgeProps {
  tierRank: TierRank;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_MAP = {
  sm: { icon: 14, text: "text-[10px]", gap: "gap-1", px: "px-1.5 py-0.5" },
  md: { icon: 16, text: "text-xs", gap: "gap-1.5", px: "px-2 py-1" },
  lg: { icon: 20, text: "text-sm", gap: "gap-2", px: "px-2.5 py-1.5" },
};

export default function TierBadge({ tierRank, size = "md", showLabel = true }: TierBadgeProps) {
  const { tier } = parseTierRank(tierRank);
  const colors = TIER_COLORS[tier];
  const s = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${s.px} rounded-lg font-semibold`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <Shield size={s.icon} fill="currentColor" strokeWidth={1.5} />
      {showLabel && <span className={s.text}>{formatTierLabel(tierRank)}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/leaderboard/components/TierBadge.tsx
git commit -m "feat(leaderboard): add TierBadge component with tier colors and shield icon"
```

---

## Task 8: Create RankTicker Component

**Files:**
- Create: `src/features/leaderboard/components/RankTicker.tsx`

- [ ] **Step 1: Create the auto-rotating ticker**

```tsx
// src/features/leaderboard/components/RankTicker.tsx
"use client";

import { useState, useEffect } from "react";

interface TickerLine {
  text: string;
  highlight?: boolean;
}

interface RankTickerProps {
  lines: TickerLine[];
  intervalMs?: number;
}

export default function RankTicker({ lines, intervalMs = 3500 }: RankTickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (lines.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % lines.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [lines.length, intervalMs]);

  if (lines.length === 0) return null;

  return (
    <div className="relative h-4 overflow-hidden">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`absolute inset-0 flex items-center transition-all duration-300 ${
            i === activeIndex
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2"
          }`}
        >
          <span
            className={`text-[10px] font-medium truncate ${
              line.highlight ? "text-plum font-semibold" : "text-[#8A80A8]"
            }`}
          >
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/leaderboard/components/RankTicker.tsx
git commit -m "feat(leaderboard): add RankTicker auto-rotating component"
```

---

## Task 9: Create LeaderboardNavWidget

**Files:**
- Create: `src/features/leaderboard/components/LeaderboardNavWidget.tsx`
- Modify: `src/features/shared/components/navigation/Sidebar.tsx`

- [ ] **Step 1: Create the nav widget component**

```tsx
// src/features/leaderboard/components/LeaderboardNavWidget.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useMyLeaderboardRank } from "../lib/queries";
import TierBadge from "./TierBadge";
import RankTicker from "./RankTicker";
import { parseTierRank, TIER_COLORS } from "../lib/types";
import type { TierRank, TickerLine } from "../lib/types";

interface LeaderboardNavWidgetProps {
  collapsed: boolean;
  onOpenModal: () => void;
}

const SHIMMER_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function LeaderboardNavWidget({
  collapsed,
  onOpenModal,
}: LeaderboardNavWidgetProps) {
  const { data, isLoading } = useMyLeaderboardRank();
  const [minimized, setMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("leaderboard-minimized") === "true";
  });
  const [shimmer, setShimmer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prevRankRef = useRef<number | null>(null);
  const [rankChanged, setRankChanged] = useState(false);

  // Periodic shimmer every 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1000);
    }, SHIMMER_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Detect rank changes
  useEffect(() => {
    if (data && prevRankRef.current !== null && prevRankRef.current !== data.rank) {
      setRankChanged(true);
      setTimeout(() => setRankChanged(false), 1500);
    }
    if (data) prevRankRef.current = data.rank;
  }, [data?.rank]);

  // Persist minimized state
  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMinimized(true);
    sessionStorage.setItem("leaderboard-minimized", "true");
  };

  if (isLoading || !data) return null;

  const tierRank = (data.tier ?? "iron_3") as TierRank;
  const { tier } = parseTierRank(tierRank);
  const colors = TIER_COLORS[tier];

  // Build ticker lines
  const tickerLines: { text: string; highlight?: boolean }[] = [];
  if (data.above) {
    const diff = data.above.totalPoints - data.totalPoints;
    tickerLines.push({
      text: `#${data.above.rank} ${data.above.fullName} — +${diff} pts ahead`,
    });
  }
  tickerLines.push({
    text: `You: #${data.rank} — ${data.totalPoints} pts`,
    highlight: true,
  });
  if (data.below) {
    const diff = data.totalPoints - data.below.totalPoints;
    tickerLines.push({
      text: `#${data.below.rank} ${data.below.fullName} — ${diff} pts behind`,
    });
  }

  // Minimized state: just badge + rank
  if (minimized || collapsed) {
    return (
      <button
        onClick={onOpenModal}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative flex items-center justify-center gap-1.5 px-2 py-2 mx-1 mb-1 rounded-lg cursor-pointer transition-all duration-100"
        style={{
          boxShadow: isHovered ? `0 0 12px ${colors.glow}` : "none",
        }}
        title="Open Leaderboard"
      >
        <TierBadge tierRank={tierRank} size="sm" showLabel={false} />
        {!collapsed && (
          <span className="text-xs font-bold text-plum">#{data.rank}</span>
        )}
      </button>
    );
  }

  // Expanded state
  return (
    <div
      onClick={onOpenModal}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative mx-2 mb-1 px-3 py-2.5 rounded-xl cursor-pointer
        transition-all duration-100 overflow-hidden
        ${rankChanged ? "animate-pulse" : ""}
      `}
      style={{
        backgroundColor: colors.bg,
        boxShadow: isHovered ? `0 0 16px ${colors.glow}` : "none",
        transform: rankChanged ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.glow}, transparent)`,
            animation: "shimmer-sweep 1s ease-in-out",
          }}
        />
      )}

      {/* Dismiss button */}
      <button
        onClick={handleMinimize}
        className={`absolute top-1 right-1 p-0.5 rounded text-[#8A80A8] hover:text-plum transition-opacity duration-100 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <X size={12} />
      </button>

      {/* Tier badge + rank */}
      <div className="flex items-center gap-2 mb-1">
        <TierBadge tierRank={tierRank} size="sm" />
        <span className="text-sm font-bold text-plum">#{data.rank}</span>
      </div>

      {/* Ticker */}
      <RankTicker lines={tickerLines} />
    </div>
  );
}
```

- [ ] **Step 2: Add shimmer keyframe CSS**

Add to `src/app/globals.css` (or the project's global stylesheet):

```css
@keyframes shimmer-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

- [ ] **Step 3: Integrate into the Sidebar component**

In `src/features/shared/components/navigation/Sidebar.tsx`, add the widget above the Profile button section.

Add import at top of file:

```typescript
import LeaderboardNavWidget from "@/features/leaderboard/components/LeaderboardNavWidget";
```

Add state for the modal:

```typescript
const [showLeaderboard, setShowLeaderboard] = useState(false);
```

Insert the widget between the divider and the bottom tabs (around line 319-324), replacing:

```tsx
      {/* Divider between main/admin tabs and bottom section */}
      <div className="mx-3 border-t border-[#E2DEEC]" />

      {/* Bottom tabs (Profile) */}
      <nav className="py-2">
        {BOTTOM_TABS.map(renderTab)}
      </nav>
```

with:

```tsx
      {/* Divider between main/admin tabs and bottom section */}
      <div className="mx-3 border-t border-[#E2DEEC]" />

      {/* Leaderboard widget — above Profile */}
      <div className="py-1">
        <LeaderboardNavWidget
          collapsed={collapsed}
          onOpenModal={() => setShowLeaderboard(true)}
        />
      </div>

      {/* Bottom tabs (Profile) */}
      <nav className="py-2">
        {BOTTOM_TABS.map(renderTab)}
      </nav>
```

The `showLeaderboard` state will be consumed by the LeaderboardModal (added in Task 11). For now, wire the state — the modal component will be added later.

Also add after the closing `</aside>` tag, before the function's closing:

```tsx
      {showLeaderboard && (
        <LeaderboardModal
          isOpen={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
```

And add the import (this will reference a component created in Task 11 — it will cause a temporary build error that resolves after Task 11):

```typescript
import LeaderboardModal from "@/features/leaderboard/components/LeaderboardModal";
```

**Note:** If you prefer to avoid the temporary build error, you can skip the modal rendering here and add it in Task 11 instead. Just keep the `showLeaderboard` state and `setShowLeaderboard` setter ready.

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardNavWidget.tsx src/features/shared/components/navigation/Sidebar.tsx src/app/globals.css
git commit -m "feat(leaderboard): add nav widget with shimmer, ticker, and sidebar integration"
```

---

## Task 10: Create LeaderboardHomeWidget

**Files:**
- Create: `src/features/leaderboard/components/LeaderboardHomeWidget.tsx`
- Modify: `src/features/home/components/ProfileSidebar.tsx`

- [ ] **Step 1: Create the home sidebar widget**

```tsx
// src/features/leaderboard/components/LeaderboardHomeWidget.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useMyLeaderboardRank } from "../lib/queries";
import TierBadge from "./TierBadge";
import RankTicker from "./RankTicker";
import { parseTierRank, TIER_COLORS } from "../lib/types";
import type { TierRank } from "../lib/types";

interface LeaderboardHomeWidgetProps {
  onOpenModal: () => void;
}

const SHIMMER_INTERVAL = 5 * 60 * 1000;

export default function LeaderboardHomeWidget({ onOpenModal }: LeaderboardHomeWidgetProps) {
  const { data, isLoading } = useMyLeaderboardRank();
  const [shimmer, setShimmer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prevRankRef = useRef<number | null>(null);
  const [rankChanged, setRankChanged] = useState(false);

  // Periodic shimmer
  useEffect(() => {
    const timer = setInterval(() => {
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1000);
    }, SHIMMER_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Detect rank changes
  useEffect(() => {
    if (data && prevRankRef.current !== null && prevRankRef.current !== data.rank) {
      setRankChanged(true);
      setTimeout(() => setRankChanged(false), 1500);
    }
    if (data) prevRankRef.current = data.rank;
  }, [data?.rank]);

  if (isLoading || !data) return null;

  const tierRank = (data.tier ?? "iron_3") as TierRank;
  const { tier } = parseTierRank(tierRank);
  const colors = TIER_COLORS[tier];

  // Build ticker lines
  const tickerLines: { text: string; highlight?: boolean }[] = [];
  if (data.above) {
    const diff = data.above.totalPoints - data.totalPoints;
    tickerLines.push({
      text: `#${data.above.rank} ${data.above.fullName} — +${diff} pts ahead`,
    });
  }
  tickerLines.push({
    text: `You: #${data.rank} of ${data.totalReps} — ${data.totalPoints} pts`,
    highlight: true,
  });
  if (data.below) {
    const diff = data.totalPoints - data.below.totalPoints;
    tickerLines.push({
      text: `#${data.below.rank} ${data.below.fullName} — ${diff} pts behind`,
    });
  }

  return (
    <div
      onClick={onOpenModal}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative mb-6 px-4 py-3.5 rounded-xl cursor-pointer
        transition-all duration-100 overflow-hidden
      `}
      style={{
        backgroundColor: colors.bg,
        boxShadow: isHovered ? `0 0 20px ${colors.glow}` : `0 0 0 transparent`,
        transform: rankChanged ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.glow}, transparent)`,
            animation: "shimmer-sweep 1s ease-in-out",
          }}
        />
      )}

      {/* Top row: tier badge + rank */}
      <div className="flex items-center justify-between mb-2">
        <TierBadge tierRank={tierRank} size="md" />
        <span className="text-lg font-bold text-plum">#{data.rank}</span>
      </div>

      {/* Season name */}
      <p className="text-[10px] font-medium text-[#8A80A8] mb-1.5">
        {data.seasonName}
      </p>

      {/* Ticker */}
      <RankTicker lines={tickerLines} />
    </div>
  );
}
```

- [ ] **Step 2: Integrate into ProfileSidebar**

In `src/features/home/components/ProfileSidebar.tsx`, add the widget above the avatar section.

Add imports at top:

```typescript
import LeaderboardHomeWidget from "@/features/leaderboard/components/LeaderboardHomeWidget";
import LeaderboardModal from "@/features/leaderboard/components/LeaderboardModal";
```

Add state inside the `ProfileSidebar` component (around line 66-69, after existing state):

```typescript
const [showLeaderboard, setShowLeaderboard] = useState(false);
```

Insert the widget inside the `<div className="px-6 pt-8">` container, before the avatar section (after line 85 `<div className="px-6 pt-8">`):

```tsx
        {/* Leaderboard widget — above avatar */}
        <LeaderboardHomeWidget onOpenModal={() => setShowLeaderboard(true)} />
```

Add the modal at the end of the component's return, before the closing `</aside>`:

```tsx
      {/* Leaderboard modal */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />
```

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardHomeWidget.tsx src/features/home/components/ProfileSidebar.tsx
git commit -m "feat(leaderboard): add home sidebar widget with shimmer and ticker"
```

---

## Task 11: Create LeaderboardModal

**Files:**
- Create: `src/features/leaderboard/components/LeaderboardModal.tsx`

- [ ] **Step 1: Create the leaderboard modal**

```tsx
// src/features/leaderboard/components/LeaderboardModal.tsx
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useLeaderboard, useMyLeaderboardRank } from "../lib/queries";
import TierBadge from "./TierBadge";
import { TIER_COLORS, parseTierRank, TIERS } from "../lib/types";
import type { LeaderboardView, TierRank, LeaderboardEntry } from "../lib/types";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const [view, setView] = useState<LeaderboardView>("combined");
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard();
  const { data: myRank } = useMyLeaderboardRank();

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Sort entries by the active view
  const sortedEntries = [...(leaderboard?.entries ?? [])].sort((a, b) => {
    if (view === "combined") return b.combinedScore - a.combinedScore;
    if (view === "season") return b.totalPoints - a.totalPoints;
    return b.take - a.take;
  });

  // Re-rank after sorting
  const rankedEntries = sortedEntries.map((entry, i) => ({
    ...entry,
    displayRank: i + 1,
  }));

  // Determine score display per view
  const getScore = (entry: LeaderboardEntry): string => {
    if (view === "combined") return `${entry.combinedScore.toFixed(1)}`;
    if (view === "season") return `${entry.totalPoints} pts`;
    return formatCurrency(entry.take);
  };

  // Find tier boundaries for dividers
  const getTierForEntry = (entry: LeaderboardEntry): string => {
    return parseTierRank(entry.tier as TierRank).tier;
  };

  const VIEW_OPTIONS: { value: LeaderboardView; label: string }[] = [
    { value: "combined", label: "Combined" },
    { value: "season", label: "Season Points" },
    { value: "take", label: "Take" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#403770]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#E2DEEC]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-plum">
              {leaderboard?.season.name ?? "Leaderboard"}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8A80A8] hover:text-plum hover:bg-[#F7F5FA] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {leaderboard?.season && (
            <p className="text-xs text-[#8A80A8]">
              {formatDate(leaderboard.season.startDate)} — {formatDate(leaderboard.season.endDate)}
            </p>
          )}

          {/* View toggle pills */}
          <div className="flex gap-1.5 mt-4">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  view === opt.value
                    ? "bg-plum text-white"
                    : "bg-[#F7F5FA] text-[#8A80A8] hover:text-plum"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* My rank card (pinned) */}
        {myRank && (
          <div className="px-6 py-4 bg-[#F7F5FA] border-b border-[#E2DEEC]">
            <div className="flex items-center gap-3">
              <TierBadge tierRank={(myRank.tier ?? "iron_3") as TierRank} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-plum">
                    #{myRank.rank}
                  </span>
                  <span className="text-xs text-[#8A80A8]">
                    of {myRank.totalReps} reps
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {myRank.pointBreakdown.map((b) => (
                    <span key={b.action} className="text-[10px] text-[#8A80A8]">
                      {b.count} {b.label.toLowerCase()} × {b.pointValue}pts = {b.total}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-lg font-bold text-plum">
                {myRank.totalPoints} pts
              </span>
            </div>
          </div>
        )}

        {/* Rankings table */}
        <div className="flex-1 overflow-y-auto">
          {lbLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-[#E2DEEC]">
              {rankedEntries.map((entry, i) => {
                const isMe = entry.userId === myRank?.rank ? false : entry.rank === myRank?.rank;
                const currentTier = getTierForEntry(entry);
                const prevTier = i > 0 ? getTierForEntry(rankedEntries[i - 1]) : null;
                const showDivider = prevTier !== null && prevTier !== currentTier;

                return (
                  <div key={entry.userId}>
                    {/* Tier boundary divider */}
                    {showDivider && (
                      <div className="flex items-center gap-2 px-6 py-1.5 bg-[#F7F5FA]">
                        <div className="h-px flex-1 bg-[#E2DEEC]" />
                        <span className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                          {currentTier}
                        </span>
                        <div className="h-px flex-1 bg-[#E2DEEC]" />
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-3 px-6 py-3 ${
                        entry.userId === myRank?.rank?.toString()
                          ? ""
                          : isMe
                            ? "bg-[#F7F5FA]"
                            : "hover:bg-[#FAFAFA]"
                      }`}
                    >
                      {/* Rank */}
                      <span className="w-8 text-sm font-bold text-plum text-right">
                        #{entry.displayRank}
                      </span>

                      {/* Avatar */}
                      {entry.avatarUrl ? (
                        <img
                          src={entry.avatarUrl}
                          alt={entry.fullName}
                          className="w-8 h-8 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-coral flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {entry.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                        </div>
                      )}

                      {/* Name */}
                      <span className="flex-1 text-sm font-medium text-plum truncate">
                        {entry.fullName}
                      </span>

                      {/* Tier badge */}
                      <TierBadge
                        tierRank={entry.tier as TierRank}
                        size="sm"
                      />

                      {/* Score */}
                      <span className="w-20 text-right text-sm font-semibold text-plum">
                        {getScore(entry)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the Sidebar import from Task 9 now resolves**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to LeaderboardModal import.

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardModal.tsx
git commit -m "feat(leaderboard): add full leaderboard modal with view toggle and tier boundaries"
```

---

## Task 12: Hook Point Scoring into Plan Creation

**Files:**
- Modify: `src/app/api/territory-plans/route.ts`

- [ ] **Step 1: Add scoring hook to the POST handler**

In `src/app/api/territory-plans/route.ts`, add import at top:

```typescript
import { awardPoints } from "@/features/leaderboard/lib/scoring";
```

After the `prisma.territoryPlan.create()` call succeeds and before the `return NextResponse.json(result, { status: 201 })`, add:

```typescript
    // Award leaderboard points for plan creation
    await awardPoints(user.id, "plan_created").catch((err) =>
      console.error("Failed to award plan_created points:", err)
    );
```

The `.catch()` ensures scoring failures don't break plan creation.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/territory-plans/route.ts
git commit -m "feat(leaderboard): hook point scoring into plan creation"
```

---

## Task 13: Hook Point Scoring into Activity Creation

**Files:**
- Modify: `src/app/api/activities/route.ts`

- [ ] **Step 1: Add scoring hook to the POST handler**

In `src/app/api/activities/route.ts`, add import at top:

```typescript
import { awardPoints } from "@/features/leaderboard/lib/scoring";
```

After the `prisma.activity.create()` call succeeds and before the response is returned, add:

```typescript
    // Award leaderboard points for activity logging
    await awardPoints(user.id, "activity_logged").catch((err) =>
      console.error("Failed to award activity_logged points:", err)
    );
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/activities/route.ts
git commit -m "feat(leaderboard): hook point scoring into activity creation"
```

---

## Task 14: Create Season 0 Seed Script

**Files:**
- Create: `scripts/seed-season-0.ts`

- [ ] **Step 1: Create the seed script**

```typescript
// scripts/seed-season-0.ts
// Seeds Season 0 with retroactive backfill for existing plans, activities, and revenue targets.
// Run with: npx tsx scripts/seed-season-0.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Season 0...");

  // 1. Create Season 0
  const season = await prisma.season.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      name: "Season 0",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-06-30T23:59:59Z"),
      isActive: true,
      softResetTiers: 1,
      seasonWeight: 0.6,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
    },
    update: {
      name: "Season 0",
      isActive: true,
    },
  });
  console.log(`  Season created: ${season.name} (id=${season.id})`);

  // 2. Create metrics
  const metrics = [
    { action: "plan_created", pointValue: 10, label: "Create a Plan" },
    { action: "activity_logged", pointValue: 5, label: "Log an Activity" },
    { action: "revenue_targeted", pointValue: 1, label: "Revenue Targeted ($10K)" },
  ];

  for (const m of metrics) {
    await prisma.seasonMetric.upsert({
      where: {
        id: undefined as unknown as number, // Force create if not exists
      },
      create: {
        seasonId: season.id,
        action: m.action,
        pointValue: m.pointValue,
        label: m.label,
      },
      update: {},
    });
  }
  // Use createMany with skipDuplicates instead
  await prisma.seasonMetric.deleteMany({ where: { seasonId: season.id } });
  await prisma.seasonMetric.createMany({
    data: metrics.map((m) => ({
      seasonId: season.id,
      action: m.action,
      pointValue: m.pointValue,
      label: m.label,
    })),
  });
  console.log(`  Metrics created: ${metrics.map((m) => m.action).join(", ")}`);

  // 3. Create tier thresholds
  const thresholds = [
    { tier: "iron", minPoints: 0 },
    { tier: "bronze", minPoints: 100 },
    { tier: "silver", minPoints: 300 },
    { tier: "gold", minPoints: 600 },
  ];

  await prisma.seasonTierThreshold.deleteMany({ where: { seasonId: season.id } });
  await prisma.seasonTierThreshold.createMany({
    data: thresholds.map((t) => ({
      seasonId: season.id,
      tier: t.tier,
      minPoints: t.minPoints,
    })),
  });
  console.log(`  Tier thresholds set: ${thresholds.map((t) => `${t.tier}=${t.minPoints}`).join(", ")}`);

  // 4. Retroactive backfill — count existing plans and activities per user
  const users = await prisma.userProfile.findMany({
    select: {
      id: true,
      fullName: true,
    },
  });

  console.log(`  Backfilling ${users.length} users...`);

  const planMetric = metrics.find((m) => m.action === "plan_created")!;
  const activityMetric = metrics.find((m) => m.action === "activity_logged")!;
  const revenueMetric = metrics.find((m) => m.action === "revenue_targeted")!;

  for (const user of users) {
    // Count plans
    const planCount = await prisma.territoryPlan.count({
      where: { userId: user.id },
    });

    // Count activities
    const activityCount = await prisma.activity.count({
      where: { createdByUserId: user.id },
    });

    // Sum revenue targets
    const plans = await prisma.territoryPlan.findMany({
      where: { userId: user.id },
      include: {
        districts: {
          select: {
            renewalTarget: true,
            winbackTarget: true,
            expansionTarget: true,
            newBusinessTarget: true,
          },
        },
      },
    });

    let totalTargeted = 0;
    for (const plan of plans) {
      for (const d of plan.districts) {
        totalTargeted +=
          Number(d.renewalTarget ?? 0) +
          Number(d.winbackTarget ?? 0) +
          Number(d.expansionTarget ?? 0) +
          Number(d.newBusinessTarget ?? 0);
      }
    }
    const revenueUnits = Math.floor(totalTargeted / 10000);

    const totalPoints =
      planCount * planMetric.pointValue +
      activityCount * activityMetric.pointValue +
      revenueUnits * revenueMetric.pointValue;

    if (totalPoints > 0 || true) {
      // Create score for every user so they appear on the leaderboard
      await prisma.seasonScore.upsert({
        where: {
          seasonId_userId: { seasonId: season.id, userId: user.id },
        },
        create: {
          seasonId: season.id,
          userId: user.id,
          totalPoints,
          tier: "iron_3", // Will be recalculated on read
        },
        update: {
          totalPoints,
        },
      });
    }

    console.log(
      `    ${user.fullName ?? user.id}: ${planCount} plans (${planCount * planMetric.pointValue}pts) + ` +
        `${activityCount} activities (${activityCount * activityMetric.pointValue}pts) + ` +
        `$${(revenueUnits * 10000).toLocaleString()} targeted (${revenueUnits * revenueMetric.pointValue}pts) = ${totalPoints} total`
    );
  }

  console.log("Season 0 seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Verify the script runs**

```bash
npx tsx scripts/seed-season-0.ts
```

Expected: Output showing season creation, metrics, thresholds, and per-user backfill with point totals.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-season-0.ts
git commit -m "feat(leaderboard): add Season 0 seed script with retroactive backfill"
```

---

## Task 15: Invalidate Leaderboard Cache on Mutations

**Files:**
- Modify: `src/features/plans/lib/queries.ts`
- Modify: `src/features/activities/lib/queries.ts` (or wherever the activity mutation hook lives)

- [ ] **Step 1: Add leaderboard cache invalidation to plan creation mutation**

In the `useCreateTerritoryPlan` mutation's `onSuccess` callback, add:

```typescript
queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
```

- [ ] **Step 2: Add leaderboard cache invalidation to activity creation mutation**

Find the activity creation mutation hook and add the same invalidation in its `onSuccess`:

```typescript
queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
```

- [ ] **Step 3: Commit**

```bash
git add src/features/plans/lib/queries.ts src/features/activities/lib/queries.ts
git commit -m "feat(leaderboard): invalidate leaderboard cache on plan and activity creation"
```

---

## Task 16: Verify End-to-End Flow

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Run the seed script against dev database**

```bash
npx tsx scripts/seed-season-0.ts
```

- [ ] **Step 3: Verify the leaderboard widget appears in the left nav and home sidebar**

Open `http://localhost:3005` — you should see:
- A leaderboard card above the Profile button in the left nav
- A larger leaderboard card above the avatar in the home sidebar
- Both showing your tier (Iron III initially), rank, and ticker

- [ ] **Step 4: Click the widget to verify the modal opens**

The modal should show:
- "Season 0 Leaderboard" header with date range
- Combined/Season Points/Take toggle pills
- Your rank card pinned at top with point breakdown
- Full rankings table with tier badges and tier boundary dividers

- [ ] **Step 5: Create a plan to verify point scoring**

Click "Create Plan", create a test plan. After creation:
- Your points should increase by 10
- Leaderboard data should refresh (cache invalidated)

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass, including the new scoring tests.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(leaderboard): verify end-to-end flow and fix any issues"
```

---

Plan complete and saved to `Docs/superpowers/plans/2026-03-28-seasonal-leaderboard.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
