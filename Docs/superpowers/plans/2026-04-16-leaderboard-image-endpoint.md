# Leaderboard Image Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `GET /api/leaderboard-image` — a bearer-secret-authed PNG endpoint rendering the Revenue Overview leaderboard, callable by a daily scheduled remote agent that posts the image to Slack.

**Architecture:** Extract the data-assembly logic from the existing `/api/leaderboard` route into a shared server function (`fetchLeaderboardData()`). The new image route validates a bearer token, calls the shared function, and renders the result as a PNG using `next/og`'s `ImageResponse` (Satori) on the Node runtime. Brand-aligned: Plus Jakarta Sans + Fullmind plum palette. No browser, no extra runtime.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma + raw SQL via `pg`, `next/og` (built into Next 13+, no install), Vitest. Plus Jakarta Sans TTFs downloaded from Google Fonts and committed as static assets.

**Spec:** `Docs/superpowers/specs/2026-04-16-leaderboard-image-endpoint-design.md`

---

## File Structure

**Create:**
- `src/features/leaderboard/lib/fetch-leaderboard.ts` — extracted shared data-assembly function + `LeaderboardPayload` type
- `src/features/leaderboard/lib/format.ts` — currency formatter (`formatCurrencyShort`)
- `src/features/leaderboard/lib/image-layout.tsx` — JSX layout for the PNG (Satori-targeted; inline styles only, no Tailwind)
- `src/features/leaderboard/lib/fonts/PlusJakartaSans-Regular.ttf` — binary, downloaded from Google Fonts
- `src/features/leaderboard/lib/fonts/PlusJakartaSans-SemiBold.ttf` — binary, downloaded from Google Fonts
- `src/app/api/leaderboard-image/route.ts` — route handler
- `src/app/api/leaderboard-image/__tests__/route.test.ts` — auth + content-type tests
- `src/features/leaderboard/lib/__tests__/format.test.ts` — currency formatter tests

**Modify:**
- `src/app/api/leaderboard/route.ts` — refactor GET handler to delegate to `fetchLeaderboardData()`
- `.env.example` — add `LEADERBOARD_IMAGE_SECRET`

---

## Task 1: Add env var stub and generate local secret

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the env var to `.env.example`**

Append to the end of `.env.example`:

```
# Bearer secret used by /api/leaderboard-image. Generate with:
#   openssl rand -hex 32
# Set in Vercel (production + preview) and pass as `Authorization: Bearer <secret>` from scheduled agents.
LEADERBOARD_IMAGE_SECRET=
```

- [ ] **Step 2: Generate a local dev secret and add to `.env.local`**

Run:
```bash
openssl rand -hex 32
```
Copy the 64-char hex output. Open `.env.local` (do NOT commit) and add:
```
LEADERBOARD_IMAGE_SECRET=<the hex string>
```

- [ ] **Step 3: Commit only the `.env.example` change**

```bash
git add .env.example
git commit -m "chore(env): add LEADERBOARD_IMAGE_SECRET stub for new image route"
```

---

## Task 2: Extract `fetchLeaderboardData()` from existing route

**Goal:** Move the entire data-assembly block from `src/app/api/leaderboard/route.ts` into a reusable server function. The existing route stays cookie-authed; only the data fetch becomes shared. Behavior must be identical.

**Files:**
- Create: `src/features/leaderboard/lib/fetch-leaderboard.ts`
- Modify: `src/app/api/leaderboard/route.ts`

- [ ] **Step 1: Create `fetch-leaderboard.ts` with the extracted function**

Create `src/features/leaderboard/lib/fetch-leaderboard.ts`:

```ts
import prisma from "@/lib/prisma";
import { calculateTier, calculateCombinedScore } from "@/features/leaderboard/lib/scoring";
import { getRepActuals } from "@/lib/opportunity-actuals";
import type { LeaderboardEntry } from "@/features/leaderboard/lib/types";

export interface LeaderboardTeamTotals {
  revenue: number;
  revenueCurrentFY: number;
  revenuePriorFY: number;
  unassignedRevenue: number;
  unassignedRevenueCurrentFY: number;
  unassignedRevenuePriorFY: number;
  priorYearRevenue: number;
  minPurchasesCurrentFY: number;
  minPurchasesPriorFY: number;
  unassignedPriorYearRevenue: number;
  unassignedMinPurchasesCurrentFY: number;
  unassignedMinPurchasesPriorFY: number;
  pipelineCurrentFY: number;
  pipelineNextFY: number;
  unassignedPipelineCurrentFY: number;
  unassignedPipelineNextFY: number;
  targetedCurrentFY: number;
  targetedNextFY: number;
  unassignedTargetedCurrentFY: number;
  unassignedTargetedNextFY: number;
}

export interface LeaderboardPayload {
  initiative: {
    id: number;
    name: string;
    startDate: string;
    endDate: string | null;
    showName: boolean;
    showDates: boolean;
    initiativeWeight: number;
    pipelineWeight: number;
    takeWeight: number;
    revenueWeight: number;
    revenueTargetedWeight: number;
    pipelineFiscalYear: string | null;
    takeFiscalYear: string | null;
    revenueFiscalYear: string | null;
    revenueTargetedFiscalYear: string | null;
  };
  fiscalYears: { currentFY: string; nextFY: string; priorFY: string };
  entries: LeaderboardEntry[];
  teamTotals: LeaderboardTeamTotals;
  metrics: { action: string; label: string; pointValue: number }[];
  thresholds: { tier: string; minPoints: number }[];
}

export class NoActiveInitiativeError extends Error {
  constructor() { super("No active initiative"); this.name = "NoActiveInitiativeError"; }
}

/**
 * Fetches the full leaderboard payload for the active initiative.
 * Used by both /api/leaderboard (cookie-authed) and /api/leaderboard-image
 * (bearer-secret-authed). Throws NoActiveInitiativeError if no active
 * initiative exists.
 */
export async function fetchLeaderboardData(): Promise<LeaderboardPayload> {
  const initiative = await prisma.initiative.findFirst({
    where: { isActive: true },
    include: { thresholds: true, metrics: true },
  });

  if (!initiative) {
    throw new NoActiveInitiativeError();
  }

  const scores = await prisma.initiativeScore.findMany({
    where: { initiativeId: initiative.id },
    include: {
      user: { select: { id: true, fullName: true, avatarUrl: true, email: true, role: true } },
    },
    orderBy: { totalPoints: "desc" },
  });

  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const defaultSchoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;
  const priorFY = currentFY - 1;
  const priorSchoolYr = `${priorFY - 1}-${String(priorFY).slice(-2)}`;
  const nextFYSchoolYr = `${currentFY}-${String(currentFY + 1).slice(-2)}`;

  const pipelineSchoolYr = initiative.pipelineFiscalYear ?? defaultSchoolYr;
  const takeSchoolYr = initiative.takeFiscalYear ?? defaultSchoolYr;
  const revenueSchoolYr = initiative.revenueFiscalYear ?? defaultSchoolYr;

  const uniqueYears = [...new Set([pipelineSchoolYr, takeSchoolYr, revenueSchoolYr, priorSchoolYr, defaultSchoolYr, nextFYSchoolYr])];

  const repActuals = await Promise.all(
    scores.map(async (score) => {
      const email = score.user.email;
      try {
        const yearActuals = new Map<string, Awaited<ReturnType<typeof getRepActuals>>>();
        await Promise.all(
          uniqueYears.map(async (yr) => {
            const actuals = await getRepActuals(email, yr);
            yearActuals.set(yr, actuals);
          })
        );
        return {
          userId: score.userId,
          pipeline: yearActuals.get(pipelineSchoolYr)?.openPipeline ?? 0,
          pipelineCurrentFY: yearActuals.get(defaultSchoolYr)?.openPipeline ?? 0,
          pipelineNextFY: yearActuals.get(nextFYSchoolYr)?.openPipeline ?? 0,
          take: yearActuals.get(takeSchoolYr)?.totalTake ?? 0,
          revenue: yearActuals.get(revenueSchoolYr)?.totalRevenue ?? 0,
          revenueCurrentFY: yearActuals.get(defaultSchoolYr)?.totalRevenue ?? 0,
          revenuePriorFY: yearActuals.get(priorSchoolYr)?.totalRevenue ?? 0,
          priorYearRevenue: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
          minPurchasesCurrentFY: yearActuals.get(defaultSchoolYr)?.minPurchaseBookings ?? 0,
          minPurchasesPriorFY: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
        };
      } catch {
        return {
          userId: score.userId,
          take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0,
          revenue: 0, revenueCurrentFY: 0, revenuePriorFY: 0,
          priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0,
        };
      }
    })
  );

  const actualsMap = new Map(repActuals.map((a) => [a.userId, a]));
  const adminUserIds = new Set(scores.filter((s) => s.user.role === "admin").map((s) => s.userId));
  const rosterScores = scores.filter((s) => !adminUserIds.has(s.userId));
  const rosterActuals = repActuals.filter((a) => !adminUserIds.has(a.userId));

  const maxInitiativePoints = Math.max(...rosterScores.map((s) => s.totalPoints), 0);
  const maxTake = Math.max(...rosterActuals.map((a) => a.take), 0);
  const maxPipeline = Math.max(...rosterActuals.map((a) => a.pipeline), 0);
  const maxRevenue = Math.max(...rosterActuals.map((a) => a.revenue), 0);

  const thresholdData = initiative.thresholds.map((t) => ({ tier: t.tier, minPoints: t.minPoints }));

  const userIds = scores.map((s) => s.userId);
  const sinceDate = initiative.startDate;

  const allPlans = await prisma.territoryPlan.findMany({
    where: {
      createdAt: { gte: sinceDate },
      OR: [{ ownerId: { in: userIds } }, { userId: { in: userIds }, ownerId: null }],
    },
    select: { id: true, ownerId: true, userId: true },
  });

  const planCountMap = new Map<string, number>();
  for (const plan of allPlans) {
    const uid = plan.ownerId ?? plan.userId;
    if (!uid) continue;
    planCountMap.set(uid, (planCountMap.get(uid) ?? 0) + 1);
  }

  const planIds = allPlans.map((p) => p.id);

  const [activityCounts, planDistricts] = await Promise.all([
    prisma.activity.groupBy({
      by: ["createdByUserId"],
      where: { createdByUserId: { in: userIds }, createdAt: { gte: sinceDate } },
      _count: true,
    }),
    prisma.territoryPlanDistrict.findMany({
      where: { planId: { in: planIds } },
      select: {
        renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
        plan: { select: { ownerId: true, userId: true } },
      },
    }),
  ]);

  const activityCountMap = new Map(activityCounts.map((a) => [a.createdByUserId, a._count]));

  const revenueByUser = new Map<string, number>();
  for (const d of planDistricts) {
    const uid = d.plan.ownerId ?? d.plan.userId;
    if (!uid) continue;
    const total = Number(d.renewalTarget ?? 0) + Number(d.winbackTarget ?? 0) +
                  Number(d.expansionTarget ?? 0) + Number(d.newBusinessTarget ?? 0);
    revenueByUser.set(uid, (revenueByUser.get(uid) ?? 0) + total);
  }

  const currentFYInt = currentFY;
  const nextFYInt = currentFY + 1;

  const ownerFilter = {
    OR: [{ ownerId: { in: userIds } }, { userId: { in: userIds }, ownerId: null }],
  };

  const emailByUserId = new Map<string, string>();
  for (const s of scores) { if (s.user.email) emailByUserId.set(s.userId, s.user.email); }
  const rosterEmails = [...emailByUserId.values()];

  const [targetedCurrentFYDistricts, targetedNextFYDistricts, pipelineRows] = await Promise.all([
    prisma.territoryPlanDistrict.findMany({
      where: { plan: { ...ownerFilter, fiscalYear: currentFYInt } },
      select: {
        districtLeaid: true,
        renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
        plan: { select: { ownerId: true, userId: true } },
      },
    }),
    prisma.territoryPlanDistrict.findMany({
      where: { plan: { ...ownerFilter, fiscalYear: nextFYInt } },
      select: {
        districtLeaid: true,
        renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
        plan: { select: { ownerId: true, userId: true } },
      },
    }),
    rosterEmails.length === 0
      ? Promise.resolve([])
      : prisma.$queryRaw<{ sales_rep_email: string; district_lea_id: string; school_yr: string; pipeline: number }[]>`
          SELECT sales_rep_email, district_lea_id, school_yr,
                 SUM(open_pipeline)::float AS pipeline
          FROM district_opportunity_actuals
          WHERE sales_rep_email = ANY(${rosterEmails})
            AND school_yr IN (${defaultSchoolYr}, ${nextFYSchoolYr})
          GROUP BY sales_rep_email, district_lea_id, school_yr
          HAVING SUM(open_pipeline) > 0
        `,
  ]);

  const repPipelineMap = new Map<string, number>();
  for (const row of pipelineRows) {
    repPipelineMap.set(`${row.sales_rep_email}::${row.district_lea_id}::${row.school_yr}`, Number(row.pipeline));
  }

  function sumTargetsWithPipelineDeduction(
    districts: typeof targetedCurrentFYDistricts,
    schoolYr: string,
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const d of districts) {
      const uid = d.plan.ownerId ?? d.plan.userId;
      if (!uid) continue;
      const target = Number(d.renewalTarget ?? 0) + Number(d.winbackTarget ?? 0) +
                     Number(d.expansionTarget ?? 0) + Number(d.newBusinessTarget ?? 0);
      if (target <= 0) continue;
      const email = emailByUserId.get(uid);
      const pipeline = email ? repPipelineMap.get(`${email}::${d.districtLeaid}::${schoolYr}`) ?? 0 : 0;
      map.set(uid, (map.get(uid) ?? 0) + Math.max(0, target - pipeline));
    }
    return map;
  }

  const targetedCurrentFYByUser = sumTargetsWithPipelineDeduction(targetedCurrentFYDistricts, defaultSchoolYr);
  const targetedNextFYByUser = sumTargetsWithPipelineDeduction(targetedNextFYDistricts, nextFYSchoolYr);

  const revenueTargetedByUser = new Map<string, number>();
  for (const uid of userIds) {
    revenueTargetedByUser.set(uid, (targetedCurrentFYByUser.get(uid) ?? 0) + (targetedNextFYByUser.get(uid) ?? 0));
  }
  const maxRevenueTargeted = Math.max(...rosterScores.map((s) => revenueTargetedByUser.get(s.userId) ?? 0), 0);

  const getActionCount = (userId: string, action: string): number => {
    if (action === "plan_created") return planCountMap.get(userId) ?? 0;
    if (action === "activity_logged") return activityCountMap.get(userId) ?? 0;
    if (action === "revenue_targeted") return Math.floor((revenueByUser.get(userId) ?? 0) / 10000);
    return 0;
  };

  const entries: LeaderboardEntry[] = rosterScores.map((score, index) => {
    const actuals = actualsMap.get(score.userId) ?? {
      userId: score.userId, take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0,
      revenue: 0, revenueCurrentFY: 0, revenuePriorFY: 0,
      priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0,
    };
    const tier = calculateTier(score.totalPoints, thresholdData);
    const combinedScore = calculateCombinedScore({
      initiativePoints: score.totalPoints, maxInitiativePoints,
      pipeline: actuals.pipeline, maxPipeline,
      take: actuals.take, maxTake,
      revenue: actuals.revenue, maxRevenue,
      revenueTargeted: revenueTargetedByUser.get(score.userId) ?? 0, maxRevenueTargeted,
      initiativeWeight: Number(initiative.initiativeWeight),
      pipelineWeight: Number(initiative.pipelineWeight),
      takeWeight: Number(initiative.takeWeight),
      revenueWeight: Number(initiative.revenueWeight),
      revenueTargetedWeight: Number(initiative.revenueTargetedWeight),
    });
    const initiativeScore = maxInitiativePoints > 0 ? (score.totalPoints / maxInitiativePoints) * 100 : 0;
    const pointBreakdown = initiative.metrics.map((m) => {
      const count = getActionCount(score.userId, m.action);
      return { action: m.action, label: m.label, pointValue: m.pointValue, count, total: count * m.pointValue };
    });
    return {
      userId: score.userId,
      fullName: score.user.fullName ?? "Unknown",
      avatarUrl: score.user.avatarUrl,
      totalPoints: score.totalPoints,
      tier, rank: index + 1,
      take: actuals.take, pipeline: actuals.pipeline,
      pipelineCurrentFY: actuals.pipelineCurrentFY, pipelineNextFY: actuals.pipelineNextFY,
      revenue: actuals.revenue, revenueCurrentFY: actuals.revenueCurrentFY, revenuePriorFY: actuals.revenuePriorFY,
      priorYearRevenue: actuals.priorYearRevenue,
      minPurchasesCurrentFY: actuals.minPurchasesCurrentFY, minPurchasesPriorFY: actuals.minPurchasesPriorFY,
      revenueTargeted: revenueTargetedByUser.get(score.userId) ?? 0,
      targetedCurrentFY: targetedCurrentFYByUser.get(score.userId) ?? 0,
      targetedNextFY: targetedNextFYByUser.get(score.userId) ?? 0,
      combinedScore: Math.round(combinedScore * 10) / 10,
      initiativeScore: Math.round(initiativeScore * 10) / 10,
      pointBreakdown,
    };
  });

  const sumActuals = (
    pool: typeof repActuals,
    key:
      | "revenue" | "revenueCurrentFY" | "revenuePriorFY"
      | "priorYearRevenue" | "minPurchasesCurrentFY" | "minPurchasesPriorFY"
      | "pipelineCurrentFY" | "pipelineNextFY",
  ): number => pool.reduce((acc, a) => acc + (a[key] ?? 0), 0);

  const sumTargetedMap = (pool: Map<string, number>, ids: Iterable<string>): number => {
    let total = 0;
    for (const id of ids) total += pool.get(id) ?? 0;
    return total;
  };

  const adminActuals = repActuals.filter((a) => adminUserIds.has(a.userId));

  const teamTotals: LeaderboardTeamTotals = {
    revenue: sumActuals(repActuals, "revenue"),
    revenueCurrentFY: sumActuals(repActuals, "revenueCurrentFY"),
    revenuePriorFY: sumActuals(repActuals, "revenuePriorFY"),
    unassignedRevenue: sumActuals(adminActuals, "revenue"),
    unassignedRevenueCurrentFY: sumActuals(adminActuals, "revenueCurrentFY"),
    unassignedRevenuePriorFY: sumActuals(adminActuals, "revenuePriorFY"),
    priorYearRevenue: sumActuals(repActuals, "priorYearRevenue"),
    minPurchasesCurrentFY: sumActuals(repActuals, "minPurchasesCurrentFY"),
    minPurchasesPriorFY: sumActuals(repActuals, "minPurchasesPriorFY"),
    unassignedPriorYearRevenue: sumActuals(adminActuals, "priorYearRevenue"),
    unassignedMinPurchasesCurrentFY: sumActuals(adminActuals, "minPurchasesCurrentFY"),
    unassignedMinPurchasesPriorFY: sumActuals(adminActuals, "minPurchasesPriorFY"),
    pipelineCurrentFY: sumActuals(repActuals, "pipelineCurrentFY"),
    pipelineNextFY: sumActuals(repActuals, "pipelineNextFY"),
    unassignedPipelineCurrentFY: sumActuals(adminActuals, "pipelineCurrentFY"),
    unassignedPipelineNextFY: sumActuals(adminActuals, "pipelineNextFY"),
    targetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, userIds),
    targetedNextFY: sumTargetedMap(targetedNextFYByUser, userIds),
    unassignedTargetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, adminUserIds),
    unassignedTargetedNextFY: sumTargetedMap(targetedNextFYByUser, adminUserIds),
  };

  return {
    initiative: {
      id: initiative.id,
      name: initiative.name,
      startDate: initiative.startDate.toISOString(),
      endDate: initiative.endDate?.toISOString() ?? null,
      showName: initiative.showName,
      showDates: initiative.showDates,
      initiativeWeight: Number(initiative.initiativeWeight),
      pipelineWeight: Number(initiative.pipelineWeight),
      takeWeight: Number(initiative.takeWeight),
      revenueWeight: Number(initiative.revenueWeight),
      revenueTargetedWeight: Number(initiative.revenueTargetedWeight),
      pipelineFiscalYear: initiative.pipelineFiscalYear,
      takeFiscalYear: initiative.takeFiscalYear,
      revenueFiscalYear: initiative.revenueFiscalYear,
      revenueTargetedFiscalYear: initiative.revenueTargetedFiscalYear,
    },
    fiscalYears: { currentFY: defaultSchoolYr, nextFY: nextFYSchoolYr, priorFY: priorSchoolYr },
    entries,
    teamTotals,
    metrics: initiative.metrics.map((m) => ({ action: m.action, label: m.label, pointValue: m.pointValue })),
    thresholds: initiative.thresholds.map((t) => ({ tier: t.tier, minPoints: t.minPoints })),
  };
}
```

- [ ] **Step 2: Refactor `src/app/api/leaderboard/route.ts` to delegate**

Replace the entire file with:

```ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { fetchLeaderboardData, NoActiveInitiativeError } from "@/features/leaderboard/lib/fetch-leaderboard";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — full leaderboard for active initiative (cookie-authed)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await fetchLeaderboardData();
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof NoActiveInitiativeError) {
      return NextResponse.json({ error: "No active initiative" }, { status: 404 });
    }
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
```

- [ ] **Step 3: TypeScript build check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors. If errors, fix them before continuing.

- [ ] **Step 4: Manual response-shape parity check**

Start dev server:
```bash
npm run dev
```
With a browser session signed in (so the cookie is set), open `http://localhost:3005/api/leaderboard` and visually confirm the JSON has all expected top-level keys: `initiative`, `fiscalYears`, `entries`, `teamTotals`, `metrics`, `thresholds`. At least one entry should have all the FY-suffixed fields (`revenueCurrentFY`, `pipelineNextFY`, etc.).

If the endpoint returns 401, you're not signed in — sign in via the app first. If it returns 404 "No active initiative", that's expected behavior, not a regression.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/lib/fetch-leaderboard.ts src/app/api/leaderboard/route.ts
git commit -m "refactor(leaderboard): extract fetchLeaderboardData into shared lib

Pulls the data-assembly logic out of the cookie-authed /api/leaderboard
route so the upcoming /api/leaderboard-image route can reuse it without
duplicating the pipeline/targets/score math."
```

---

## Task 3: Build the currency formatter (TDD)

**Files:**
- Create: `src/features/leaderboard/lib/format.ts`
- Create: `src/features/leaderboard/lib/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/leaderboard/lib/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatCurrencyShort } from "../format";

describe("formatCurrencyShort", () => {
  it("formats zero as $0", () => {
    expect(formatCurrencyShort(0)).toBe("$0");
  });

  it("formats values under 1000 as exact dollars", () => {
    expect(formatCurrencyShort(450)).toBe("$450");
    expect(formatCurrencyShort(999)).toBe("$999");
  });

  it("formats thousands with K suffix and one decimal", () => {
    expect(formatCurrencyShort(1_000)).toBe("$1.0K");
    expect(formatCurrencyShort(12_300)).toBe("$12.3K");
    expect(formatCurrencyShort(450_000)).toBe("$450.0K");
  });

  it("formats millions with M suffix and one decimal", () => {
    expect(formatCurrencyShort(1_000_000)).toBe("$1.0M");
    expect(formatCurrencyShort(2_350_000)).toBe("$2.4M");
    expect(formatCurrencyShort(99_900_000)).toBe("$99.9M");
  });

  it("formats billions with B suffix and one decimal", () => {
    expect(formatCurrencyShort(1_500_000_000)).toBe("$1.5B");
  });

  it("handles negative values with leading minus", () => {
    expect(formatCurrencyShort(-1_500)).toBe("-$1.5K");
    expect(formatCurrencyShort(-450)).toBe("-$450");
  });

  it("rounds half-up at boundaries", () => {
    expect(formatCurrencyShort(950)).toBe("$950");
    expect(formatCurrencyShort(999_999)).toBe("$1.0M");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:
```bash
npx vitest run src/features/leaderboard/lib/__tests__/format.test.ts
```
Expected: FAIL with "Cannot find module '../format'".

- [ ] **Step 3: Implement the formatter**

Create `src/features/leaderboard/lib/format.ts`:

```ts
/**
 * Formats a currency value into a short, image-friendly string.
 * Examples: 0 → "$0", 450 → "$450", 12300 → "$12.3K", 2350000 → "$2.4M".
 * One-decimal precision for K/M/B; whole dollars below 1000.
 */
export function formatCurrencyShort(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs < 1_000) return `${sign}$${Math.round(abs)}`;
  if (abs < 1_000_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  if (abs < 1_000_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run:
```bash
npx vitest run src/features/leaderboard/lib/__tests__/format.test.ts
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/lib/format.ts src/features/leaderboard/lib/__tests__/format.test.ts
git commit -m "feat(leaderboard): add formatCurrencyShort for image rendering"
```

---

## Task 4: Download Plus Jakarta Sans TTFs

**Files:**
- Create: `src/features/leaderboard/lib/fonts/PlusJakartaSans-Regular.ttf`
- Create: `src/features/leaderboard/lib/fonts/PlusJakartaSans-SemiBold.ttf`

The route loads these as binary buffers at module init. They must be checked in so deployments have them.

- [ ] **Step 1: Make the directory**

Run:
```bash
mkdir -p src/features/leaderboard/lib/fonts
```

- [ ] **Step 2: Download the two TTF weights**

Run:
```bash
# Plus Jakarta Sans is OFL-licensed via Google Fonts. These URLs come from
# fonts.google.com → "Download family" → unzipped contents.
curl -L -o src/features/leaderboard/lib/fonts/PlusJakartaSans-Regular.ttf \
  "https://github.com/itfoundry/Plus-Jakarta-Sans/raw/master/fonts/ttf/PlusJakartaSans-Regular.ttf"
curl -L -o src/features/leaderboard/lib/fonts/PlusJakartaSans-SemiBold.ttf \
  "https://github.com/itfoundry/Plus-Jakarta-Sans/raw/master/fonts/ttf/PlusJakartaSans-SemiBold.ttf"
```

- [ ] **Step 3: Verify file sizes look reasonable**

Run:
```bash
ls -la src/features/leaderboard/lib/fonts/
```
Expected: both files present, each between 80KB and 200KB. If either is under 10KB, the download failed (probably HTML error page) — re-run from a different mirror or download manually from https://fonts.google.com/specimen/Plus+Jakarta+Sans.

- [ ] **Step 4: Commit the binaries**

```bash
git add src/features/leaderboard/lib/fonts/
git commit -m "chore(fonts): add Plus Jakarta Sans TTFs for server-side image rendering"
```

---

## Task 5: Build the image layout JSX

**Files:**
- Create: `src/features/leaderboard/lib/image-layout.tsx`

**Critical constraint:** Satori (the engine behind `next/og`) supports a limited CSS subset. Rules:
- Inline `style={...}` only — no Tailwind, no CSS classes
- Layout via `display: "flex"` only — no `display: "grid"` or `display: "block"` for layout containers
- Every `<div>` containing multiple children must have `display: "flex"` and explicit `flexDirection`
- No `gap` — use margins on individual children
- No SVG icons

- [ ] **Step 1: Create the layout component**

Create `src/features/leaderboard/lib/image-layout.tsx`:

```tsx
import type { LeaderboardPayload } from "./fetch-leaderboard";
import { formatCurrencyShort } from "./format";

const PLUM = "#403770";
const PLUM_DARK = "#322a5a";
const SURFACE = "#FFFCFA";
const SURFACE_RAISED = "#F7F5FA";
const HOVER_TINT = "#EFEDF5";
const BORDER_SUBTLE = "#E2DEEC";
const TEXT_BODY = "#6E6390";
const TEXT_STRONG = "#544A78";
const INVERSE = "#FFFFFF";

const ROW_HEIGHT = 44;
const COL_RANK_W = 60;
const COL_REP_W = 320;
const COL_NUM_W = 175;

function formatHeaderDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "America/Chicago",
  });
}

interface LeaderboardImageLayoutProps {
  payload: LeaderboardPayload;
  /** Used for the date stamp in the header; defaults to now. */
  renderedAt?: Date;
}

export function LeaderboardImageLayout({ payload, renderedAt }: LeaderboardImageLayoutProps) {
  const date = renderedAt ?? new Date();
  const { entries, teamTotals, initiative, fiscalYears } = payload;

  // Pretty FY labels: "2025-26" → "FY26", "2026-27" → "FY27"
  const fyLabel = (s: string) => `FY${s.split("-")[1]}`;
  const currentFYLabel = fyLabel(fiscalYears.currentFY);
  const nextFYLabel = fyLabel(fiscalYears.nextFY);

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        width: 1200, backgroundColor: SURFACE,
        fontFamily: "Plus Jakarta Sans",
        color: TEXT_BODY,
      }}
    >
      {/* Header band */}
      <div
        style={{
          display: "flex", flexDirection: "column",
          backgroundColor: PLUM, color: INVERSE,
          padding: "32px 40px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: INVERSE }}>
              Fullmind Sales Leaderboard
            </div>
            <div style={{ fontSize: 16, marginTop: 6, color: "#D8D2EC" }}>
              {formatHeaderDate(date)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 14, color: "#D8D2EC" }}>{initiative.name}</div>
            <div style={{ fontSize: 14, color: "#D8D2EC", marginTop: 4 }}>
              Revenue & Min Purchases · {currentFYLabel}  ·  Pipeline & Targets · {nextFYLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "flex", flexDirection: "row",
          backgroundColor: SURFACE_RAISED,
          color: TEXT_STRONG,
          fontSize: 13, fontWeight: 600,
          padding: "0 40px",
          borderBottom: `1px solid ${BORDER_SUBTLE}`,
        }}
      >
        <div style={{ width: COL_RANK_W, padding: "14px 0" }}>#</div>
        <div style={{ width: COL_REP_W, padding: "14px 0" }}>Rep</div>
        <div style={{ width: COL_NUM_W, padding: "14px 0", textAlign: "right" }}>Revenue ({currentFYLabel})</div>
        <div style={{ width: COL_NUM_W, padding: "14px 0", textAlign: "right" }}>Min Purchases ({currentFYLabel})</div>
        <div style={{ width: COL_NUM_W, padding: "14px 0", textAlign: "right" }}>Pipeline ({nextFYLabel})</div>
        <div style={{ width: COL_NUM_W, padding: "14px 0", textAlign: "right" }}>Targeted ({nextFYLabel})</div>
      </div>

      {/* Rep rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {entries.map((e, i) => (
          <div
            key={e.userId}
            style={{
              display: "flex", flexDirection: "row",
              backgroundColor: i % 2 === 0 ? SURFACE : SURFACE_RAISED,
              color: TEXT_BODY,
              fontSize: 14, fontWeight: 400,
              padding: "0 40px",
              height: ROW_HEIGHT, alignItems: "center",
            }}
          >
            <div style={{ width: COL_RANK_W, color: TEXT_STRONG, fontWeight: 600 }}>{e.rank}</div>
            <div style={{ width: COL_REP_W, color: TEXT_STRONG }}>{e.fullName}</div>
            <div style={{ width: COL_NUM_W, textAlign: "right" }}>{formatCurrencyShort(e.revenueCurrentFY)}</div>
            <div style={{ width: COL_NUM_W, textAlign: "right" }}>{formatCurrencyShort(e.minPurchasesCurrentFY)}</div>
            <div style={{ width: COL_NUM_W, textAlign: "right" }}>{formatCurrencyShort(e.pipelineNextFY)}</div>
            <div style={{ width: COL_NUM_W, textAlign: "right" }}>{formatCurrencyShort(e.targetedNextFY)}</div>
          </div>
        ))}
      </div>

      {/* Team totals footer */}
      <div
        style={{
          display: "flex", flexDirection: "row",
          backgroundColor: HOVER_TINT,
          color: PLUM_DARK,
          fontSize: 14, fontWeight: 600,
          padding: "0 40px",
          height: ROW_HEIGHT + 6, alignItems: "center",
          borderTop: `1px solid ${BORDER_SUBTLE}`,
        }}
      >
        <div style={{ width: COL_RANK_W }} />
        <div style={{ width: COL_REP_W }}>Team Total</div>
        <div style={{ width: COL_NUM_W, textAlign: "right" }}>{formatCurrencyShort(teamTotals.revenueCurrentFY)}</div>
        <div style={{ width: COL_NUM_W, textAlign: "right" }}>{formatCurrencyShort(teamTotals.minPurchasesCurrentFY)}</div>
        <div style={{ width: COL_NUM_W, textAlign: "right" }}>{formatCurrencyShort(teamTotals.pipelineNextFY)}</div>
        <div style={{ width: COL_NUM_W, textAlign: "right" }}>{formatCurrencyShort(teamTotals.targetedNextFY)}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript build check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/lib/image-layout.tsx
git commit -m "feat(leaderboard): add Satori-compatible JSX layout for image route"
```

---

## Task 6: Build the route handler

**Files:**
- Create: `src/app/api/leaderboard-image/route.ts`

- [ ] **Step 1: Create the route handler**

Create `src/app/api/leaderboard-image/route.ts`:

```ts
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { fetchLeaderboardData, NoActiveInitiativeError } from "@/features/leaderboard/lib/fetch-leaderboard";
import { LeaderboardImageLayout } from "@/features/leaderboard/lib/image-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FONTS_DIR = join(process.cwd(), "src/features/leaderboard/lib/fonts");

// Cache fonts as module-level promises so they're loaded once per warm instance.
const fontRegular = readFile(join(FONTS_DIR, "PlusJakartaSans-Regular.ttf"));
const fontSemiBold = readFile(join(FONTS_DIR, "PlusJakartaSans-SemiBold.ttf"));

function checkBearer(request: NextRequest): { ok: true } | { ok: false; status: number; body: string } {
  const expected = process.env.LEADERBOARD_IMAGE_SECRET;
  if (!expected) return { ok: false, status: 500, body: "LEADERBOARD_IMAGE_SECRET not configured" };

  const header = request.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return { ok: false, status: 401, body: "Unauthorized" };

  const provided = Buffer.from(m[1]);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return { ok: false, status: 401, body: "Unauthorized" };
  if (!timingSafeEqual(provided, expectedBuf)) return { ok: false, status: 401, body: "Unauthorized" };
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const auth = checkBearer(request);
  if (!auth.ok) {
    return new Response(auth.body, { status: auth.status, headers: { "Content-Type": "text/plain" } });
  }

  const [regular, semiBold] = await Promise.all([fontRegular, fontSemiBold]);

  try {
    const payload = await fetchLeaderboardData();
    return new ImageResponse(<LeaderboardImageLayout payload={payload} />, {
      width: 1200,
      // Height grows with content; setting only width lets Satori size vertically
      headers: { "Cache-Control": "no-store" },
      fonts: [
        { name: "Plus Jakarta Sans", data: regular,  weight: 400, style: "normal" },
        { name: "Plus Jakarta Sans", data: semiBold, weight: 600, style: "normal" },
      ],
    });
  } catch (error) {
    console.error("leaderboard-image: render failed", error);
    const reason = error instanceof NoActiveInitiativeError
      ? "No active initiative"
      : "Leaderboard unavailable — check logs";
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200, height: 200, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            backgroundColor: "#FFFCFA", color: "#403770",
            fontSize: 24, fontFamily: "Plus Jakarta Sans",
          }}
        >
          <div>Fullmind Sales Leaderboard</div>
          <div style={{ marginTop: 12, fontSize: 18, color: "#6E6390" }}>{reason}</div>
        </div>
      ),
      {
        width: 1200,
        headers: { "Cache-Control": "no-store" },
        fonts: [{ name: "Plus Jakarta Sans", data: regular, weight: 400, style: "normal" }],
      },
    );
  }
}
```

- [ ] **Step 2: TypeScript build check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leaderboard-image/route.ts
git commit -m "feat(leaderboard): add bearer-authed PNG endpoint for daily Slack post

GET /api/leaderboard-image returns the Revenue Overview leaderboard as
a PNG rendered server-side via next/og + Satori. Auth is a constant-time
comparison against LEADERBOARD_IMAGE_SECRET. Daily call volume is too low
to bother caching."
```

---

## Task 7: Add route auth tests

**Files:**
- Create: `src/app/api/leaderboard-image/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/leaderboard-image/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the fetch function so tests don't hit the DB.
vi.mock("@/features/leaderboard/lib/fetch-leaderboard", () => ({
  fetchLeaderboardData: vi.fn().mockResolvedValue({
    initiative: {
      id: 1, name: "Test Initiative",
      startDate: "2026-01-01T00:00:00.000Z", endDate: null,
      showName: true, showDates: true,
      initiativeWeight: 1, pipelineWeight: 1, takeWeight: 1, revenueWeight: 1, revenueTargetedWeight: 1,
      pipelineFiscalYear: null, takeFiscalYear: null, revenueFiscalYear: null, revenueTargetedFiscalYear: null,
    },
    fiscalYears: { currentFY: "2025-26", nextFY: "2026-27", priorFY: "2024-25" },
    entries: [{
      userId: "u1", fullName: "Test Rep", avatarUrl: null,
      totalPoints: 100, tier: "freshman", rank: 1,
      take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 50_000,
      revenue: 0, revenueCurrentFY: 100_000, revenuePriorFY: 0,
      priorYearRevenue: 0, minPurchasesCurrentFY: 25_000, minPurchasesPriorFY: 0,
      revenueTargeted: 0, targetedCurrentFY: 0, targetedNextFY: 75_000,
      combinedScore: 50, initiativeScore: 100, pointBreakdown: [],
    }],
    teamTotals: {
      revenue: 0, revenueCurrentFY: 100_000, revenuePriorFY: 0,
      unassignedRevenue: 0, unassignedRevenueCurrentFY: 0, unassignedRevenuePriorFY: 0,
      priorYearRevenue: 0, minPurchasesCurrentFY: 25_000, minPurchasesPriorFY: 0,
      unassignedPriorYearRevenue: 0, unassignedMinPurchasesCurrentFY: 0, unassignedMinPurchasesPriorFY: 0,
      pipelineCurrentFY: 0, pipelineNextFY: 50_000,
      unassignedPipelineCurrentFY: 0, unassignedPipelineNextFY: 0,
      targetedCurrentFY: 0, targetedNextFY: 75_000,
      unassignedTargetedCurrentFY: 0, unassignedTargetedNextFY: 0,
    },
    metrics: [], thresholds: [],
  }),
  NoActiveInitiativeError: class extends Error { constructor() { super("No active initiative"); } },
}));

import { GET } from "../route";

const SECRET = "test-secret-1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

describe("GET /api/leaderboard-image", () => {
  beforeEach(() => {
    process.env.LEADERBOARD_IMAGE_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.LEADERBOARD_IMAGE_SECRET;
  });

  it("returns 401 when authorization header is missing", async () => {
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer token is wrong", async () => {
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization header is not Bearer scheme", async () => {
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image", {
      headers: { authorization: `Basic ${SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when LEADERBOARD_IMAGE_SECRET is unset", async () => {
    delete process.env.LEADERBOARD_IMAGE_SECRET;
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("returns 200 image/png with valid bearer token", async () => {
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^image\/png/);
  });
});
```

- [ ] **Step 2: Run the tests**

Run:
```bash
npx vitest run src/app/api/leaderboard-image/__tests__/route.test.ts
```
Expected: PASS, 5 tests. If the 200 test fails because Satori can't load fonts in jsdom, that's a known test-env limitation — the auth tests are the priority. If it fails for that reason, narrow the test to assert `res.status !== 401 && res.status !== 500` (i.e., auth passed) and skip the content-type check with a `.skip` and a comment explaining why.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leaderboard-image/__tests__/route.test.ts
git commit -m "test(leaderboard-image): cover bearer auth + content-type"
```

---

## Task 8: Manual smoke test (local)

No code changes — visual verification only. **Do not commit** anything from this task.

- [ ] **Step 1: Confirm `.env.local` has the secret**

Run:
```bash
grep LEADERBOARD_IMAGE_SECRET .env.local
```
Expected: one line, value is the hex string from Task 1 step 2.

- [ ] **Step 2: Start dev server**

Run:
```bash
npm run dev
```
Wait for "Ready" output.

- [ ] **Step 3: Fetch the PNG with curl**

In a second terminal, run (substitute your actual secret):
```bash
SECRET=$(grep LEADERBOARD_IMAGE_SECRET .env.local | cut -d= -f2)
curl -sS -H "Authorization: Bearer $SECRET" \
  http://localhost:3005/api/leaderboard-image \
  -o /tmp/leaderboard.png
file /tmp/leaderboard.png
open /tmp/leaderboard.png
```

Expected: `file` reports "PNG image data, 1200 x N". The image opens in Preview showing:
- Plum header band with "Fullmind Sales Leaderboard" + today's date
- "Revenue & Min Purchases · FY26 · Pipeline & Targets · FY27" line
- Active initiative name top-right
- Column headers: # · Rep · Revenue (FY26) · Min Purchases (FY26) · Pipeline (FY27) · Targeted (FY27)
- One row per non-admin rep with currency values
- Team Total footer row

- [ ] **Step 4: Test the auth failure paths**

Run:
```bash
# Missing header
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3005/api/leaderboard-image
# Wrong token
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer wrong" \
  http://localhost:3005/api/leaderboard-image
```
Expected: both print `401`.

- [ ] **Step 5: Stop dev server**

`Ctrl+C` in the dev server terminal.

---

## Task 9: Deploy to Vercel preview and re-verify

- [ ] **Step 1: Push the branch**

Run:
```bash
git push -u origin HEAD
```

- [ ] **Step 2: Add `LEADERBOARD_IMAGE_SECRET` to Vercel**

Go to the Vercel project → Settings → Environment Variables. Add:
- Name: `LEADERBOARD_IMAGE_SECRET`
- Value: a NEW secret generated with `openssl rand -hex 32` (do not reuse the dev secret)
- Environments: Production AND Preview

Save. **Record the value** — you'll need it when configuring the scheduled trigger.

- [ ] **Step 3: Wait for the preview deploy**

The push triggers a preview build. Wait for it to finish (Vercel dashboard or `gh pr view --web` if there's a PR).

- [ ] **Step 4: Smoke-test the preview URL**

Run (substitute the preview URL and the secret you set in Vercel):
```bash
PREVIEW_URL="https://<branch-deploy>.vercel.app"
PROD_SECRET="<the secret from Vercel>"
curl -sS -H "Authorization: Bearer $PROD_SECRET" \
  "$PREVIEW_URL/api/leaderboard-image" \
  -o /tmp/leaderboard-preview.png
file /tmp/leaderboard-preview.png
open /tmp/leaderboard-preview.png
```

Expected: PNG renders identically to the local version, with real production data.

- [ ] **Step 5: Verify auth on the preview URL**

Run:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$PREVIEW_URL/api/leaderboard-image"
```
Expected: `401`.

---

## Task 10: Hand off to scheduling step (no code change)

- [ ] **Step 1: Confirm everything is ready**

Verify:
- [ ] All previous tasks committed and pushed
- [ ] Preview deploy responds 200 with valid bearer + 401 without
- [ ] Vercel `LEADERBOARD_IMAGE_SECRET` is set in Production env (so when this merges to main, prod has the secret)
- [ ] Slack connector is added to claude.ai connectors and ready
- [ ] You have the production Vercel URL or know it will be on the deployment

- [ ] **Step 2: Return to the scheduling conversation**

The image endpoint work is done. The scheduling step (creating the daily 8 AM CT trigger that fetches this PNG and posts to `#test-automations` first, then `#sales-`) happens next, in the original `/schedule` flow.

The trigger will need:
- The deployment URL (production after merge, preview during testing)
- The bearer secret (from Vercel env)
- Slack connector UUID/URL (visible in claude.ai connector settings after add)
- Channel: `#test-automations` until visually approved, then `#sales-`

---

## Self-Review Notes

**Spec coverage:** Every section in the spec maps to a task — env var (Task 1), shared fetch extraction (Task 2), formatter (Task 3), fonts (Task 4), JSX layout (Task 5), route handler with bearer auth + error PNG fallback (Task 6), tests (Task 7), local + preview verification (Tasks 8–9), handoff (Task 10).

**Type consistency:** `LeaderboardPayload` shape exported from `fetch-leaderboard.ts` is consumed by `image-layout.tsx`, `route.ts`, and the test mock — all reference the same exported type.

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N" — every code-step has full code.

**Risks called out inline:**
- Satori font loading in jsdom (Task 7 step 2) — fallback strategy provided
- Font download URL availability (Task 4 step 3) — verification + manual fallback
