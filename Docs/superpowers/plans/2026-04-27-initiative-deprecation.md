# Initiative Deprecation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Initiative concept from the territory-plan app — Initiative tab, admin Leaderboard tab, scoring logic, Slack cron, DB tables — while preserving the Revenue Overview leaderboard and replacing the floating tier widget with a Revenue Rank widget.

**Architecture:** Single feature branch `feat/initiative-deprecation`, merged in two PRs. PR 1 (code-only) decouples Revenue Overview from Initiative, builds the new Revenue Rank widget, removes all Initiative UI/cron/scoring code; tables stay in DB orphaned-but-harmless. PR 2 (schema-only, ~2 weeks later) drops the Initiative tables.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, TanStack Query, Vitest, Tailwind 4

**Spec:** `Docs/superpowers/specs/2026-04-27-initiative-deprecation-design.md`

---

## File Structure

### PR 1 — Modified

- `src/features/leaderboard/lib/fetch-leaderboard.ts` — roster from `UserProfile`, drop `since: initiative.startDate`, strip Initiative-only fields
- `src/features/leaderboard/lib/types.ts` — slim `LeaderboardEntry`, `LeaderboardPayload`; drop `InitiativeInfo`
- `src/features/leaderboard/lib/queries.ts` — drop `useMyLeaderboardRank`; add `useRevenueRank({ fy })`
- `src/features/leaderboard/components/LeaderboardModal.tsx` — drop Initiative tab + sub-view selector; modal opens to Revenue Overview
- `src/features/leaderboard/components/LeaderboardDetailView.tsx` — drop tab bar, render `RevenueOverviewTab` only
- `src/features/leaderboard/components/LeaderboardNavWidget.tsx` — rewrite as Revenue Rank widget
- `src/features/leaderboard/components/LeaderboardHomeWidget.tsx` — same rewrite
- `src/features/admin/components/AdminDashboard.tsx` — remove leaderboard tab + lazy import
- `src/app/api/territory-plans/route.ts` — delete `awardPoints("plan_created")` call
- `src/app/api/territory-plans/[id]/districts/route.ts` — delete `awardPoints("district_added")` call
- `src/app/api/activities/route.ts` — delete `awardPoints("activity_logged")` call
- `src/app/api/leaderboard/route.ts` — drop `NoActiveInitiativeError` handling
- `src/app/api/leaderboard/details/route.ts` — drop initiative-roster filter, use UserProfile-based roster
- `vercel.json` — remove `leaderboard-slack-post` cron entry

### PR 1 — Added

- `src/app/api/leaderboard/revenue-rank/route.ts`
- `src/app/api/leaderboard/revenue-rank/__tests__/route.test.ts`

### PR 1 — Deleted

- `src/app/api/leaderboard/me/route.ts`
- `src/features/admin/components/LeaderboardTab.tsx`
- `src/features/admin/components/leaderboard/` (entire folder)
- `src/features/admin/hooks/useAdminLeaderboard.ts`
- `src/features/admin/lib/leaderboard-types.ts`
- `src/app/api/admin/leaderboard/` (entire folder)
- `src/app/api/cron/leaderboard-slack-post/route.tsx`
- `src/app/api/leaderboard-image/route.tsx` + `__tests__/`
- `src/features/leaderboard/lib/image-layout.tsx`
- `src/features/leaderboard/lib/fonts/`
- `src/features/leaderboard/lib/scoring.ts`
- `src/features/leaderboard/lib/__tests__/scoring.test.ts`
- `Docs/superpowers/plans/2026-03-28-leaderboard-admin.md`
- `Docs/superpowers/specs/2026-03-28-leaderboard-admin-spec.md`
- `Docs/leaderboard-admin-handoff.md`

### PR 2 — Modified

- `prisma/schema.prisma` — remove `Initiative*` and `MetricRegistry` models, remove `initiativeScores` back-relation on `UserProfile`

### PR 2 — Added

- `prisma/migrations/<timestamp>_drop_initiative_tables/migration.sql` (auto-generated)

---

## Task 1: Capture pre-change baseline of Revenue Overview

**Why:** Before any code changes, capture exact numbers shown by Revenue Overview today so we can verify zero behavioral drift after the decoupling.

**Files:**
- Create (temporary, not committed): local `/tmp/revenue-baseline.json`

- [ ] **Step 1: Run dev server**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan"
npm run dev
```

Wait for `▲ Next.js ready on http://localhost:3005`.

- [ ] **Step 2: Hit the leaderboard endpoint with cookie auth**

In a separate terminal, log in to the dev app in browser, then capture the cookie:

```bash
# Open Chrome DevTools → Application → Cookies → http://localhost:3005
# Copy the value of the `sb-*-auth-token` cookie
# Replace COOKIE_VALUE below

curl -s "http://localhost:3005/api/leaderboard" \
  -H "Cookie: sb-localhost-auth-token=COOKIE_VALUE" \
  | jq '.entries | map({userId, fullName, rank, revenueCurrentFY, revenuePriorFY, pipelineCurrentFY, pipelineNextFY, targetedCurrentFY, targetedNextFY, minPurchasesCurrentFY, minPurchasesPriorFY})' \
  > /tmp/revenue-baseline.json
```

- [ ] **Step 3: Verify baseline is non-empty**

```bash
jq 'length' /tmp/revenue-baseline.json
```

Expected: a number > 0 (the rep count). If the response is `{"error": "No active initiative"}`, the baseline can't be captured this way — log it and move on; we'll do post-change verification by comparing against a sandbox snapshot.

- [ ] **Step 4: Capture team totals separately**

```bash
curl -s "http://localhost:3005/api/leaderboard" \
  -H "Cookie: sb-localhost-auth-token=COOKIE_VALUE" \
  | jq '.teamTotals' \
  > /tmp/team-totals-baseline.json
```

- [ ] **Step 5: Note baseline location**

The two files at `/tmp/revenue-baseline.json` and `/tmp/team-totals-baseline.json` are the source of truth for the parity check in Task 6. They are NOT committed.

---

## Task 2: Slim `LeaderboardEntry` and `LeaderboardPayload` types

**Files:**
- Modify: `src/features/leaderboard/lib/types.ts`

- [ ] **Step 1: Read current types**

```bash
cat src/features/leaderboard/lib/types.ts
```

- [ ] **Step 2: Find consumers of fields being removed**

```bash
grep -rn "totalPoints\|combinedScore\|initiativeScore\|pointBreakdown\|\\.tier\b\|InitiativeInfo" \
  src/features/leaderboard/ src/features/admin/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v __tests__
```

Expected hits: `LeaderboardModal.tsx` (Initiative tab), `LeaderboardDetailView.tsx` (Initiative tab), scoring imports. All these consumers are being deleted or refactored in later tasks. The only kept consumer is `RevenuePodium.tsx` / `RevenueTable.tsx` which use only revenue/pipeline/targeted/min-purchases fields — verify by reading them next.

- [ ] **Step 3: Verify Revenue Overview only uses kept fields**

```bash
grep -n "entry\." src/features/leaderboard/components/RevenuePodium.tsx src/features/leaderboard/components/RevenueTable.tsx src/features/leaderboard/components/RevenueOverviewTab.tsx
```

Expected: only references to `userId, fullName, avatarUrl, rank, revenue*, pipeline*, targeted*, minPurchases*, priorYearRevenue, take, revenueTargeted`. No `tier`, `totalPoints`, `combinedScore`, `pointBreakdown`. If anything else appears, flag and adjust the slim — do NOT delete a field that's still used.

- [ ] **Step 4: Edit `types.ts` — remove Initiative-only fields**

Remove from `LeaderboardEntry`: `tier`, `totalPoints`, `combinedScore`, `initiativeScore`, `pointBreakdown`.

Remove the `InitiativeInfo` type entirely (and its export).

Remove `parseTierRank`, `TIER_COLORS`, `TIER_LABELS`, `TierName` — these are tier-display helpers used only by the floating widget (which we're rewriting) and the dropped Initiative tab. Re-grep to confirm no other consumers:

```bash
grep -rn "parseTierRank\|TIER_COLORS\|TIER_LABELS\|TierName" \
  src/ --include="*.ts" --include="*.tsx" \
  | grep -v __tests__
```

If any consumer outside `LeaderboardNavWidget.tsx`, `LeaderboardHomeWidget.tsx`, `LeaderboardModal.tsx`, `LeaderboardDetailView.tsx`, or `TierBadge.tsx` shows up, leave the helper in place and revisit in Task 11.

Remove `LeaderboardPayload` fields: `initiative`, `metrics`, `thresholds`. Keep: `entries`, `fiscalYears`, `teamTotals`.

Remove `LeaderboardMyRank` type (consumed only by deleted `useMyLeaderboardRank`).

- [ ] **Step 5: Add new type for Revenue Rank widget response**

In `types.ts`, add:

```typescript
export interface RevenueRankResponse {
  fy: "current" | "next";
  schoolYear: string;
  rank: number;
  totalReps: number;
  revenue: number;
  inRoster: boolean;
}
```

- [ ] **Step 6: Run typecheck**

```bash
npm run build 2>&1 | head -100
```

Expected: many compile errors in files we're about to modify (`LeaderboardModal.tsx`, `LeaderboardNavWidget.tsx`, `LeaderboardDetailView.tsx`, `fetch-leaderboard.ts`, `leaderboard/me/route.ts`, scoring imports). This is expected — those are the files we'll fix in subsequent tasks.

- [ ] **Step 7: Commit**

```bash
git add src/features/leaderboard/lib/types.ts
git commit -m "refactor(leaderboard): slim LeaderboardEntry and payload to Revenue Overview fields"
```

---

## Task 3: Decouple `fetch-leaderboard.ts` from Initiative — write failing test

**Files:**
- Create: `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`

- [ ] **Step 1: Read current `fetch-leaderboard.ts` to understand inputs/outputs**

```bash
cat src/features/leaderboard/lib/fetch-leaderboard.ts
```

- [ ] **Step 2: Write failing test for new behavior**

Create `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: { findMany: vi.fn() },
    territoryPlanDistrict: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/opportunity-actuals", () => ({
  getRepActuals: vi.fn(),
}));

import { fetchLeaderboardData } from "../fetch-leaderboard";
import prisma from "@/lib/prisma";
import { getRepActuals } from "@/lib/opportunity-actuals";

const mockUserProfile = vi.mocked(prisma.userProfile.findMany);
const mockTerritoryPlanDistrict = vi.mocked(prisma.territoryPlanDistrict.findMany);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockGetRepActuals = vi.mocked(getRepActuals);

describe("fetchLeaderboardData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTerritoryPlanDistrict.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([]);
  });

  it("sources roster from UserProfile (rep + manager), excludes admin", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "u1", fullName: "Alice Rep", avatarUrl: null, email: "alice@x.com", role: "rep" },
      { id: "u2", fullName: "Bob Manager", avatarUrl: null, email: "bob@x.com", role: "manager" },
      { id: "u3", fullName: "Carol Admin", avatarUrl: null, email: "carol@x.com", role: "admin" },
    ] as never);
    mockGetRepActuals.mockResolvedValue({
      openPipeline: 0, totalTake: 0, totalRevenue: 0, minPurchaseBookings: 0,
    } as never);

    const payload = await fetchLeaderboardData();

    expect(mockUserProfile).toHaveBeenCalledWith({
      where: { role: { in: ["rep", "manager", "admin"] } },
      select: { id: true, fullName: true, avatarUrl: true, email: true, role: true },
    });
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries.map((e) => e.userId).sort()).toEqual(["u1", "u2"]);
  });

  it("returns entries without tier/totalPoints/combinedScore/pointBreakdown", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
    ] as never);
    mockGetRepActuals.mockResolvedValue({
      openPipeline: 100, totalTake: 200, totalRevenue: 300, minPurchaseBookings: 50,
    } as never);

    const payload = await fetchLeaderboardData();
    const entry = payload.entries[0];

    expect(entry).not.toHaveProperty("tier");
    expect(entry).not.toHaveProperty("totalPoints");
    expect(entry).not.toHaveProperty("combinedScore");
    expect(entry).not.toHaveProperty("pointBreakdown");
    expect(entry).not.toHaveProperty("initiativeScore");
  });

  it("sorts entries by revenueCurrentFY desc by default", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "low", fullName: "Low", avatarUrl: null, email: "l@x.com", role: "rep" },
      { id: "high", fullName: "High", avatarUrl: null, email: "h@x.com", role: "rep" },
    ] as never);
    mockGetRepActuals.mockImplementation(async (email: string) => {
      const rev = email === "h@x.com" ? 5000 : 1000;
      return { openPipeline: 0, totalTake: 0, totalRevenue: rev, minPurchaseBookings: 0 } as never;
    });

    const payload = await fetchLeaderboardData();

    expect(payload.entries[0].userId).toBe("high");
    expect(payload.entries[1].userId).toBe("low");
    expect(payload.entries[0].rank).toBe(1);
    expect(payload.entries[1].rank).toBe(2);
  });

  it("returns payload without initiative/metrics/thresholds fields", async () => {
    mockUserProfile.mockResolvedValue([] as never);

    const payload = await fetchLeaderboardData();

    expect(payload).not.toHaveProperty("initiative");
    expect(payload).not.toHaveProperty("metrics");
    expect(payload).not.toHaveProperty("thresholds");
    expect(payload).toHaveProperty("entries");
    expect(payload).toHaveProperty("teamTotals");
    expect(payload).toHaveProperty("fiscalYears");
  });

  it("includes admin actuals in teamTotals.unassigned* but excludes from entries", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "rep1", fullName: "Rep", avatarUrl: null, email: "r@x.com", role: "rep" },
      { id: "admin1", fullName: "Admin", avatarUrl: null, email: "a@x.com", role: "admin" },
    ] as never);
    mockGetRepActuals.mockImplementation(async (email: string) => {
      if (email === "a@x.com") {
        return { openPipeline: 0, totalTake: 0, totalRevenue: 999, minPurchaseBookings: 0 } as never;
      }
      return { openPipeline: 0, totalTake: 0, totalRevenue: 100, minPurchaseBookings: 0 } as never;
    });

    const payload = await fetchLeaderboardData();

    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0].userId).toBe("rep1");
    expect(payload.teamTotals.revenueCurrentFY).toBe(1099);
    expect(payload.teamTotals.unassignedRevenueCurrentFY).toBe(999);
  });
});
```

- [ ] **Step 3: Run test, expect FAIL**

```bash
npx vitest run src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts
```

Expected: tests fail (current code reads from `prisma.initiative`, not `prisma.userProfile`; current entries have `tier`/`totalPoints`).

- [ ] **Step 4: Commit failing test**

```bash
git add src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts
git commit -m "test(leaderboard): add failing tests for decoupled fetchLeaderboardData"
```

---

## Task 4: Decouple `fetch-leaderboard.ts` — implement and pass

**Files:**
- Modify: `src/features/leaderboard/lib/fetch-leaderboard.ts`

- [ ] **Step 1: Rewrite `fetch-leaderboard.ts`**

Replace the entire contents with:

```typescript
import prisma from "@/lib/prisma";
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
  fiscalYears: { currentFY: string; nextFY: string; priorFY: string };
  entries: LeaderboardEntry[];
  teamTotals: LeaderboardTeamTotals;
}

/**
 * Fetches the Revenue Overview payload. Roster comes from UserProfile
 * (rep + manager visible; admin contributes only to teamTotals.unassigned*).
 */
export async function fetchLeaderboardData(): Promise<LeaderboardPayload> {
  const profiles = await prisma.userProfile.findMany({
    where: { role: { in: ["rep", "manager", "admin"] } },
    select: { id: true, fullName: true, avatarUrl: true, email: true, role: true },
  });

  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const defaultSchoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;
  const priorFY = currentFY - 1;
  const priorSchoolYr = `${priorFY - 1}-${String(priorFY).slice(-2)}`;
  const nextFYSchoolYr = `${currentFY}-${String(currentFY + 1).slice(-2)}`;

  const uniqueYears = [...new Set([priorSchoolYr, defaultSchoolYr, nextFYSchoolYr])];

  const repActuals = await Promise.all(
    profiles.map(async (profile) => {
      const email = profile.email;
      try {
        const yearActuals = new Map<string, Awaited<ReturnType<typeof getRepActuals>>>();
        await Promise.all(
          uniqueYears.map(async (yr) => {
            const actuals = await getRepActuals(email, yr);
            yearActuals.set(yr, actuals);
          }),
        );
        return {
          userId: profile.id,
          pipeline: yearActuals.get(defaultSchoolYr)?.openPipeline ?? 0,
          pipelineCurrentFY: yearActuals.get(defaultSchoolYr)?.openPipeline ?? 0,
          pipelineNextFY: yearActuals.get(nextFYSchoolYr)?.openPipeline ?? 0,
          take: yearActuals.get(defaultSchoolYr)?.totalTake ?? 0,
          revenue: yearActuals.get(defaultSchoolYr)?.totalRevenue ?? 0,
          revenueCurrentFY: yearActuals.get(defaultSchoolYr)?.totalRevenue ?? 0,
          revenuePriorFY: yearActuals.get(priorSchoolYr)?.totalRevenue ?? 0,
          priorYearRevenue: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
          minPurchasesCurrentFY: yearActuals.get(defaultSchoolYr)?.minPurchaseBookings ?? 0,
          minPurchasesPriorFY: yearActuals.get(priorSchoolYr)?.minPurchaseBookings ?? 0,
        };
      } catch {
        return {
          userId: profile.id,
          take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0,
          revenue: 0, revenueCurrentFY: 0, revenuePriorFY: 0,
          priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0,
        };
      }
    }),
  );

  const adminUserIds = new Set(profiles.filter((p) => p.role === "admin").map((p) => p.id));
  const rosterProfiles = profiles.filter((p) => !adminUserIds.has(p.id));
  const userIds = profiles.map((p) => p.id);
  const actualsMap = new Map(repActuals.map((a) => [a.userId, a]));

  // Targeted revenue queries (current FY + next FY) — independent of any initiative date scope
  const currentFYInt = currentFY;
  const nextFYInt = currentFY + 1;
  const ownerFilter = {
    OR: [{ ownerId: { in: userIds } }, { userId: { in: userIds }, ownerId: null }],
  };

  const emailByUserId = new Map<string, string>();
  for (const p of profiles) emailByUserId.set(p.id, p.email);
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

  // Build entries (roster only — no admins)
  const entries: LeaderboardEntry[] = rosterProfiles.map((profile) => {
    const a = actualsMap.get(profile.id) ?? {
      userId: profile.id, take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0,
      revenue: 0, revenueCurrentFY: 0, revenuePriorFY: 0,
      priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0,
    };
    const targetedCurrentFY = targetedCurrentFYByUser.get(profile.id) ?? 0;
    const targetedNextFY = targetedNextFYByUser.get(profile.id) ?? 0;
    return {
      userId: profile.id,
      fullName: profile.fullName ?? "Unknown",
      avatarUrl: profile.avatarUrl,
      rank: 0, // assigned after sort
      take: a.take,
      pipeline: a.pipeline,
      pipelineCurrentFY: a.pipelineCurrentFY,
      pipelineNextFY: a.pipelineNextFY,
      revenue: a.revenue,
      revenueCurrentFY: a.revenueCurrentFY,
      revenuePriorFY: a.revenuePriorFY,
      priorYearRevenue: a.priorYearRevenue,
      minPurchasesCurrentFY: a.minPurchasesCurrentFY,
      minPurchasesPriorFY: a.minPurchasesPriorFY,
      revenueTargeted: targetedCurrentFY + targetedNextFY,
      targetedCurrentFY,
      targetedNextFY,
    };
  });

  entries.sort((a, b) => b.revenueCurrentFY - a.revenueCurrentFY);
  entries.forEach((e, i) => { e.rank = i + 1; });

  // Team totals — full pool (rep + manager + admin) sums; admin-only feeds unassigned*.
  const sumActuals = (
    pool: typeof repActuals,
    key:
      | "revenue" | "revenueCurrentFY" | "revenuePriorFY"
      | "priorYearRevenue" | "minPurchasesCurrentFY" | "minPurchasesPriorFY"
      | "pipelineCurrentFY" | "pipelineNextFY",
  ): number => pool.reduce((acc, x) => acc + (x[key] ?? 0), 0);

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
    fiscalYears: { currentFY: defaultSchoolYr, nextFY: nextFYSchoolYr, priorFY: priorSchoolYr },
    entries,
    teamTotals,
  };
}
```

Note: `NoActiveInitiativeError` class is removed. Consumers that catch it must be updated (Task 5 + Task 9).

- [ ] **Step 2: Run failing tests**

```bash
npx vitest run src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/lib/fetch-leaderboard.ts
git commit -m "refactor(leaderboard): decouple fetchLeaderboardData from Initiative"
```

---

## Task 5: Update `/api/leaderboard` route to drop NoActiveInitiativeError handling

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`

- [ ] **Step 1: Read current**

```bash
cat src/app/api/leaderboard/route.ts
```

- [ ] **Step 2: Rewrite**

```typescript
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { fetchLeaderboardData } from "@/features/leaderboard/lib/fetch-leaderboard";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — Revenue Overview payload (cookie-authed)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await fetchLeaderboardData();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck this file**

```bash
npx tsc --noEmit src/app/api/leaderboard/route.ts 2>&1 | head -20
```

Expected: clean (or generic project-wide errors unrelated to this file).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leaderboard/route.ts
git commit -m "refactor(leaderboard): drop NoActiveInitiativeError handling from /api/leaderboard"
```

---

## Task 6: Number-parity check against baseline

**Why:** Verify the rewritten data path produces identical numbers to what was captured in Task 1.

- [ ] **Step 1: Restart dev server**

```bash
# Stop existing dev server (Ctrl+C), then:
npm run dev
```

- [ ] **Step 2: Capture new payload**

```bash
curl -s "http://localhost:3005/api/leaderboard" \
  -H "Cookie: sb-localhost-auth-token=COOKIE_VALUE" \
  | jq '.entries | map({userId, fullName, rank, revenueCurrentFY, revenuePriorFY, pipelineCurrentFY, pipelineNextFY, targetedCurrentFY, targetedNextFY, minPurchasesCurrentFY, minPurchasesPriorFY})' \
  > /tmp/revenue-after.json

curl -s "http://localhost:3005/api/leaderboard" \
  -H "Cookie: sb-localhost-auth-token=COOKIE_VALUE" \
  | jq '.teamTotals' \
  > /tmp/team-totals-after.json
```

- [ ] **Step 3: Diff entries**

```bash
diff <(jq 'sort_by(.userId)' /tmp/revenue-baseline.json) \
     <(jq 'sort_by(.userId)' /tmp/revenue-after.json)
```

Expected diffs:
- `rank` may differ for some entries (now sorted by `revenueCurrentFY` desc; previously by `totalPoints` desc). This is expected.
- New entries may appear: reps with no `InitiativeScore` row but who *do* have `UserProfile` rows. These will show `$0` revenue. Documented behavior change.
- Numeric fields (revenue, pipeline, targeted, min-purchases) for the SAME userId must match exactly.

If any numeric field differs for an existing rep — STOP. Investigate before proceeding.

- [ ] **Step 4: Diff team totals**

```bash
diff /tmp/team-totals-baseline.json /tmp/team-totals-after.json
```

Expected: identical (or differing only because new $0 reps now contribute zero — i.e., still identical).

- [ ] **Step 5: Open Revenue Overview in browser**

Open `http://localhost:3005`, click the floating widget (still old-style for now) → modal opens → confirm Revenue Overview tab renders the podium and table.

- [ ] **Step 6: No commit needed; this is a verification gate**

Proceed to Task 7 only if Step 3 and Step 4 are clean.

---

## Task 7: Decouple `/api/leaderboard/details` route

**Files:**
- Modify: `src/app/api/leaderboard/details/route.ts`

- [ ] **Step 1: Read current**

```bash
cat src/app/api/leaderboard/details/route.ts
```

- [ ] **Step 2: Identify what fields the consumer (`LeaderboardDetailView` revenue half) actually uses**

```bash
grep -n "useLeaderboardDetails\|details\." src/features/leaderboard/components/LeaderboardDetailView.tsx
```

The full-page view's Revenue half uses `<RevenueOverviewTab>` which internally calls `useLeaderboard()`, NOT `useLeaderboardDetails()`. The Initiative half (which we're dropping) was the only consumer of `details`. **`useLeaderboardDetails` and `/api/leaderboard/details` can be deleted entirely.** Verify by re-grep:

```bash
grep -rn "useLeaderboardDetails\|/leaderboard/details" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

Expected: only `LeaderboardDetailView.tsx` (Initiative half — dropped in Task 14) and `queries.ts` (the hook def, dropped in Task 9). Confirm no other consumer.

- [ ] **Step 3: Delete the route file**

```bash
rm src/app/api/leaderboard/details/route.ts
rmdir src/app/api/leaderboard/details
```

- [ ] **Step 4: Typecheck**

```bash
npm run build 2>&1 | grep -i "details" | head
```

Expected: errors in `queries.ts` (the hook still references the route) and `LeaderboardDetailView.tsx`. Both are fixed in Task 9 and Task 14 respectively. Continue.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/api/leaderboard/details
git commit -m "feat(leaderboard): delete /api/leaderboard/details (Initiative-only consumer)"
```

---

## Task 8: Build `/api/leaderboard/revenue-rank` route — failing tests

**Files:**
- Create: `src/app/api/leaderboard/revenue-rank/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/opportunity-actuals", () => ({
  getRepActuals: vi.fn(),
}));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getRepActuals } from "@/lib/opportunity-actuals";

const mockGetUser = vi.mocked(getUser);
const mockUserProfile = vi.mocked(prisma.userProfile.findMany);
const mockGetRepActuals = vi.mocked(getRepActuals);

function makeRequest(fy: string): Request {
  return new Request(`http://localhost/api/leaderboard/revenue-rank?fy=${fy}`);
}

describe("GET /api/leaderboard/revenue-rank", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("current"));
    expect(res.status).toBe(401);
  });

  it("returns rank+revenue for known rep with fy=current", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockUserProfile.mockResolvedValue([
      { id: "u1", email: "u1@x.com", role: "rep" },
      { id: "u2", email: "u2@x.com", role: "rep" },
    ] as never);
    mockGetRepActuals.mockImplementation(async (email: string) => {
      const rev = email === "u1@x.com" ? 100 : 500;
      return { totalRevenue: rev } as never;
    });

    const res = await GET(makeRequest("current"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe("current");
    expect(body.rank).toBe(2); // u2 has 500, u1 has 100 → u1 is rank 2
    expect(body.totalReps).toBe(2);
    expect(body.revenue).toBe(100);
    expect(body.inRoster).toBe(true);
  });

  it("returns rank+revenue for known rep with fy=next", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockUserProfile.mockResolvedValue([
      { id: "u1", email: "u1@x.com", role: "rep" },
    ] as never);
    mockGetRepActuals.mockResolvedValue({ totalRevenue: 250 } as never);

    const res = await GET(makeRequest("next"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe("next");
    expect(body.rank).toBe(1);
    expect(body.revenue).toBe(250);
  });

  it("returns inRoster: false for an admin caller", async () => {
    mockGetUser.mockResolvedValue({ id: "admin1" } as never);
    mockUserProfile.mockResolvedValue([
      { id: "u1", email: "u1@x.com", role: "rep" },
      { id: "admin1", email: "a@x.com", role: "admin" },
    ] as never);
    mockGetRepActuals.mockResolvedValue({ totalRevenue: 0 } as never);

    const res = await GET(makeRequest("current"));
    const body = await res.json();

    expect(body.inRoster).toBe(false);
    expect(body.rank).toBe(2); // admin reported as last+1
    expect(body.totalReps).toBe(1);
  });

  it("returns rank: N+1 with revenue: 0 for caller not in profile list", async () => {
    mockGetUser.mockResolvedValue({ id: "ghost" } as never);
    mockUserProfile.mockResolvedValue([
      { id: "u1", email: "u1@x.com", role: "rep" },
    ] as never);
    mockGetRepActuals.mockResolvedValue({ totalRevenue: 100 } as never);

    const res = await GET(makeRequest("current"));
    const body = await res.json();

    expect(body.inRoster).toBe(false);
    expect(body.revenue).toBe(0);
    expect(body.rank).toBe(2);
  });

  it("rejects invalid fy param", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    const res = await GET(makeRequest("invalid"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, expect FAIL with "module not found"**

```bash
npx vitest run src/app/api/leaderboard/revenue-rank/__tests__/route.test.ts
```

Expected: failures because `../route` doesn't exist yet.

- [ ] **Step 3: Commit failing test**

```bash
git add src/app/api/leaderboard/revenue-rank/__tests__/route.test.ts
git commit -m "test(leaderboard): failing tests for /api/leaderboard/revenue-rank"
```

---

## Task 9: Implement `/api/leaderboard/revenue-rank`

**Files:**
- Create: `src/app/api/leaderboard/revenue-rank/route.ts`

- [ ] **Step 1: Implement route**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getRepActuals } from "@/lib/opportunity-actuals";

export const dynamic = "force-dynamic";

// GET /api/leaderboard/revenue-rank?fy=current|next
// Returns the calling user's revenue rank for the requested fiscal year.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fyParam = url.searchParams.get("fy");
  if (fyParam !== "current" && fyParam !== "next") {
    return NextResponse.json({ error: "fy must be 'current' or 'next'" }, { status: 400 });
  }

  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const currentSchoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;
  const nextSchoolYr = `${currentFY}-${String(currentFY + 1).slice(-2)}`;
  const schoolYear = fyParam === "current" ? currentSchoolYr : nextSchoolYr;

  const profiles = await prisma.userProfile.findMany({
    where: { role: { in: ["rep", "manager"] } },
    select: { id: true, email: true },
  });

  const withRevenue = await Promise.all(
    profiles.map(async (p) => {
      try {
        const actuals = await getRepActuals(p.email, schoolYear);
        return { id: p.id, revenue: actuals?.totalRevenue ?? 0 };
      } catch {
        return { id: p.id, revenue: 0 };
      }
    }),
  );

  withRevenue.sort((a, b) => b.revenue - a.revenue);

  const totalReps = withRevenue.length;
  const callerIndex = withRevenue.findIndex((r) => r.id === user.id);
  const inRoster = callerIndex !== -1;

  const rank = inRoster ? callerIndex + 1 : totalReps + 1;
  const revenue = inRoster ? withRevenue[callerIndex].revenue : 0;

  return NextResponse.json({
    fy: fyParam,
    schoolYear,
    rank,
    totalReps,
    revenue,
    inRoster,
  });
}
```

- [ ] **Step 2: Run tests, expect all PASS**

```bash
npx vitest run src/app/api/leaderboard/revenue-rank/__tests__/route.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leaderboard/revenue-rank/route.ts
git commit -m "feat(leaderboard): add /api/leaderboard/revenue-rank endpoint"
```

---

## Task 10: Update `queries.ts` — drop `useMyLeaderboardRank`, add `useRevenueRank`

**Files:**
- Modify: `src/features/leaderboard/lib/queries.ts`

- [ ] **Step 1: Read current**

```bash
cat src/features/leaderboard/lib/queries.ts
```

- [ ] **Step 2: Remove `useMyLeaderboardRank` and `useLeaderboardDetails` hooks**

Find and delete:
- The `useMyLeaderboardRank` export (whole function + its `queryKey` const)
- The `useLeaderboardDetails` export (whole function + its `queryKey` const)
- Any imports for `LeaderboardMyRank` or `LeaderboardDetailsResponse` types

- [ ] **Step 3: Add `useRevenueRank` hook**

Add at the bottom of `queries.ts`:

```typescript
import type { RevenueRankResponse } from "./types";

export function useRevenueRank(fy: "current" | "next") {
  return useQuery({
    queryKey: ["revenue-rank", fy],
    queryFn: () => fetchJson<RevenueRankResponse>(`${API_BASE}/leaderboard/revenue-rank?fy=${fy}`),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
```

(If `useQuery` and `fetchJson` and `API_BASE` are already imported at the top, do NOT re-import — just add the function.)

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -i "queries\.ts\|useMyLeaderboardRank\|useLeaderboardDetails" | head
```

Expected hits: only consumers of the removed hooks (`LeaderboardNavWidget.tsx`, `LeaderboardHomeWidget.tsx`, `LeaderboardModal.tsx`, `LeaderboardDetailView.tsx`). All are rewritten in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/lib/queries.ts
git commit -m "refactor(leaderboard): drop useMyLeaderboardRank/useLeaderboardDetails, add useRevenueRank"
```

---

## Task 11: Rewrite `LeaderboardNavWidget` as Revenue Rank widget

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardNavWidget.tsx`

- [ ] **Step 1: Replace contents**

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useRevenueRank } from "../lib/queries";

interface LeaderboardNavWidgetProps {
  collapsed: boolean;
  onOpenModal: () => void;
}

const SHIMMER_INTERVAL = 5 * 60 * 1000;
const FY_TOGGLE_KEY = "revenue-rank-fy";

function formatCompactCurrency(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function fyLabels(): { current: string; next: string } {
  const now = new Date();
  const fy = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return {
    current: `FY${String(fy).slice(-2)}`,
    next: `FY${String(fy + 1).slice(-2)}`,
  };
}

export default function LeaderboardNavWidget({
  collapsed,
  onOpenModal,
}: LeaderboardNavWidgetProps) {
  const labels = fyLabels();
  const [fy, setFy] = useState<"current" | "next">(() => {
    if (typeof window === "undefined") return "current";
    return (sessionStorage.getItem(FY_TOGGLE_KEY) as "current" | "next") ?? "current";
  });
  const { data, isLoading } = useRevenueRank(fy);
  const [minimized, setMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("leaderboard-minimized") === "true";
  });
  const [shimmer, setShimmer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prevRankRef = useRef<number | null>(null);
  const [rankChanged, setRankChanged] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1000);
    }, SHIMMER_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data && prevRankRef.current !== null && prevRankRef.current !== data.rank) {
      setRankChanged(true);
      setTimeout(() => setRankChanged(false), 1500);
    }
    if (data) prevRankRef.current = data.rank;
  }, [data?.rank]);

  const handleToggle = (next: "current" | "next") => {
    setFy(next);
    sessionStorage.setItem(FY_TOGGLE_KEY, next);
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMinimized(true);
    sessionStorage.setItem("leaderboard-minimized", "true");
  };

  if (collapsed || minimized) return null;
  if (isLoading || !data) return null;

  const inRoster = data.inRoster;
  const rankLabel = inRoster ? `#${data.rank} of ${data.totalReps}` : "—";
  const fyCurrent = fy === "current";

  return (
    <div
      onClick={onOpenModal}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative mb-6 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-100 overflow-hidden bg-[#F7F5FA]"
      style={{
        boxShadow: isHovered ? "0 0 20px rgba(64, 55, 112, 0.15)" : "0 0 0 transparent",
        transform: rankChanged ? "scale(1.02)" : "scale(1)",
      }}
    >
      {shimmer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(64, 55, 112, 0.15), transparent)",
            animation: "shimmer-sweep 1s ease-in-out",
          }}
        />
      )}

      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-[11px] font-semibold text-[#403770]">Revenue Rank</p>
          <p className="text-xs text-[#8A80A8]">{rankLabel}</p>
        </div>
        <button
          onClick={handleMinimize}
          className="text-[#8A80A8] hover:text-[#403770]"
          aria-label="Minimize"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-1 my-1.5" role="tablist">
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle("current"); }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            fyCurrent ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#8A80A8]"
          }`}
          role="tab"
          aria-selected={fyCurrent}
        >
          {labels.current}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle("next"); }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            !fyCurrent ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#8A80A8]"
          }`}
          role="tab"
          aria-selected={!fyCurrent}
        >
          {labels.next}
        </button>
      </div>

      <p className="text-base font-bold text-[#403770]">
        {inRoster ? formatCompactCurrency(data.revenue) : ""}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Visual smoke test in browser**

```bash
npm run dev
```

Open `http://localhost:3005`, look at sidebar above Profile. Expected:
- Pill labeled "Revenue Rank"
- Rank like `#3 of 22` (or `—` if you're an admin)
- Two FY toggles, current FY highlighted by default
- Compact currency below
- Click toggles → switches data
- Click pill → modal opens

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardNavWidget.tsx
git commit -m "feat(leaderboard): rewrite LeaderboardNavWidget as Revenue Rank widget"
```

---

## Task 12: Rewrite `LeaderboardHomeWidget` as Revenue Rank widget

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardHomeWidget.tsx`

- [ ] **Step 1: Read its current usage**

```bash
grep -n "LeaderboardHomeWidget" src/features/home/components/ProfileSidebar.tsx
```

It mounts at line ~93 with prop `onOpenModal`. We keep that prop interface.

- [ ] **Step 2: Replace contents**

Use the same widget logic as `LeaderboardNavWidget` but without the `collapsed` prop and without the minimize button (the home widget is on a content page, not the always-visible sidebar):

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useRevenueRank } from "../lib/queries";

interface LeaderboardHomeWidgetProps {
  onOpenModal: () => void;
}

const SHIMMER_INTERVAL = 5 * 60 * 1000;
const FY_TOGGLE_KEY = "revenue-rank-fy";

function formatCompactCurrency(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function fyLabels(): { current: string; next: string } {
  const now = new Date();
  const fy = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return {
    current: `FY${String(fy).slice(-2)}`,
    next: `FY${String(fy + 1).slice(-2)}`,
  };
}

export default function LeaderboardHomeWidget({ onOpenModal }: LeaderboardHomeWidgetProps) {
  const labels = fyLabels();
  const [fy, setFy] = useState<"current" | "next">(() => {
    if (typeof window === "undefined") return "current";
    return (sessionStorage.getItem(FY_TOGGLE_KEY) as "current" | "next") ?? "current";
  });
  const { data, isLoading } = useRevenueRank(fy);
  const [shimmer, setShimmer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prevRankRef = useRef<number | null>(null);
  const [rankChanged, setRankChanged] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1000);
    }, SHIMMER_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data && prevRankRef.current !== null && prevRankRef.current !== data.rank) {
      setRankChanged(true);
      setTimeout(() => setRankChanged(false), 1500);
    }
    if (data) prevRankRef.current = data.rank;
  }, [data?.rank]);

  const handleToggle = (next: "current" | "next") => {
    setFy(next);
    sessionStorage.setItem(FY_TOGGLE_KEY, next);
  };

  if (isLoading || !data) return null;

  const inRoster = data.inRoster;
  const rankLabel = inRoster ? `#${data.rank} of ${data.totalReps}` : "—";
  const fyCurrent = fy === "current";

  return (
    <div
      onClick={onOpenModal}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative mb-6 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-100 overflow-hidden bg-[#F7F5FA]"
      style={{
        boxShadow: isHovered ? "0 0 20px rgba(64, 55, 112, 0.15)" : "0 0 0 transparent",
        transform: rankChanged ? "scale(1.02)" : "scale(1)",
      }}
    >
      {shimmer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(64, 55, 112, 0.15), transparent)",
            animation: "shimmer-sweep 1s ease-in-out",
          }}
        />
      )}

      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-[#403770]">Revenue Rank</p>
        <span className="text-base font-bold text-plum">{rankLabel}</span>
      </div>

      <div className="flex gap-1 my-1.5" role="tablist">
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle("current"); }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            fyCurrent ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#8A80A8]"
          }`}
          role="tab"
          aria-selected={fyCurrent}
        >
          {labels.current}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle("next"); }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            !fyCurrent ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#8A80A8]"
          }`}
          role="tab"
          aria-selected={!fyCurrent}
        >
          {labels.next}
        </button>
      </div>

      <p className="text-base font-bold text-[#403770]">
        {inRoster ? formatCompactCurrency(data.revenue) : ""}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Visit `http://localhost:3005/?tab=home` (or wherever the ProfileSidebar appears). Verify the home widget renders with the same affordances as the nav widget.

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardHomeWidget.tsx
git commit -m "feat(leaderboard): rewrite LeaderboardHomeWidget as Revenue Rank widget"
```

---

## Task 13: Drop Initiative tab from `LeaderboardModal`

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardModal.tsx`

- [ ] **Step 1: Read current**

```bash
cat src/features/leaderboard/components/LeaderboardModal.tsx
```

- [ ] **Step 2: Find the Initiative-related blocks**

```bash
grep -n "initiative\|Initiative\|view\|VIEW_CONFIG" src/features/leaderboard/components/LeaderboardModal.tsx
```

- [ ] **Step 3: Rewrite to render only Revenue Overview**

Edit so the modal:
- Has no `activeTab` state (only Revenue Overview exists)
- Has no `view` state (no sub-views)
- Has no `VIEW_CONFIG`, no `useLeaderboard()` call (the Revenue tab itself calls `useLeaderboard`), no `initiative`/`weights`/`fyLabels` derivation
- Renders only `<RevenueOverviewTab />` inside the modal body
- Header: title `"Leaderboard"` (no initiative name); no date subtitle; show-me-details button kept

Concretely, the modal becomes much simpler:

```typescript
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import RevenueOverviewTab from "./RevenueOverviewTab";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDetails: () => void;
  setActiveTab: (tab: string) => void;
}

export default function LeaderboardModal({
  isOpen,
  onClose,
  onNavigateToDetails,
}: Omit<LeaderboardModalProps, "setActiveTab">) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFEDF5]">
          <h2 className="text-lg font-bold text-[#403770]">Leaderboard</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToDetails}
              className="text-xs font-semibold text-[#403770] hover:underline"
            >
              Show me details
            </button>
            <button
              onClick={onClose}
              className="text-[#8A80A8] hover:text-[#403770]"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <RevenueOverviewTab />
        </div>
      </div>
    </div>
  );
}
```

Note: the `setActiveTab` prop in the original is removed because it was only used by the Initiative-tab "open in details" link.

- [ ] **Step 4: Update `Sidebar.tsx` if it passes `setActiveTab`**

```bash
grep -n "LeaderboardModal" src/features/shared/components/navigation/Sidebar.tsx
```

If `setActiveTab={...}` is passed, remove that prop. Other props (`isOpen`, `onClose`, `onNavigateToDetails`) stay.

- [ ] **Step 5: Smoke test**

```bash
npm run dev
```

Click the Revenue Rank widget → modal opens. Expected:
- Title "Leaderboard" (no initiative name, no date)
- Only Revenue Overview content (podium + filters + table)
- No tab bar with "Revenue Overview / Initiative"
- Click "Show me details" → navigates to full-page leaderboard
- Esc closes

- [ ] **Step 6: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardModal.tsx src/features/shared/components/navigation/Sidebar.tsx
git commit -m "feat(leaderboard): drop Initiative tab from LeaderboardModal"
```

---

## Task 14: Drop Initiative tab from `LeaderboardDetailView`

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardDetailView.tsx`

- [ ] **Step 1: Replace contents**

```typescript
"use client";

import RevenueOverviewTab from "./RevenueOverviewTab";

export default function LeaderboardDetailView() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#403770] mb-1">Leaderboard</h2>
          <p className="text-sm text-[#8A80A8]">
            Revenue Overview — ranked by current year revenue
          </p>
        </div>

        <RevenueOverviewTab />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Click sidebar "Leaderboard" entry → full-page view loads. Expected:
- Title "Leaderboard"
- Subtitle "Revenue Overview — ranked by current year revenue"
- No tab bar
- Renders Revenue Overview content
- No console errors

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardDetailView.tsx
git commit -m "feat(leaderboard): drop Initiative tab from LeaderboardDetailView"
```

---

## Task 15: Drop admin Leaderboard tab from `AdminDashboard`

**Files:**
- Modify: `src/features/admin/components/AdminDashboard.tsx`

- [ ] **Step 1: Read current**

```bash
grep -n "LeaderboardTab\|leaderboard" src/features/admin/components/AdminDashboard.tsx
```

- [ ] **Step 2: Edit**

Remove from `AdminDashboard.tsx`:
- Line `const LeaderboardTab = lazy(() => import("./LeaderboardTab"));`
- Any tab definition object referring to `id: "leaderboard"` in the tabs list
- Line `{activeTab === "leaderboard" && <LeaderboardTab />}` (or `<Suspense>` wrapper around it)

If the file has a default `activeTab` value of `"leaderboard"`, change to whatever the original first tab was (e.g., `"users"` or `"stats"`).

- [ ] **Step 3: Smoke test**

Open admin dashboard. Expected: no Leaderboard tab in nav. Other admin tabs work.

- [ ] **Step 4: Commit**

```bash
git add src/features/admin/components/AdminDashboard.tsx
git commit -m "feat(admin): remove Leaderboard tab from AdminDashboard"
```

---

## Task 16: Remove `awardPoints()` call sites

**Files:**
- Modify: `src/app/api/territory-plans/route.ts`
- Modify: `src/app/api/territory-plans/[id]/districts/route.ts`
- Modify: `src/app/api/activities/route.ts`

- [ ] **Step 1: Find each call site**

```bash
grep -n "awardPoints\|awardRevenueTargetedPoints" src/app/api/territory-plans/route.ts src/app/api/territory-plans/\[id\]/districts/route.ts src/app/api/activities/route.ts
```

- [ ] **Step 2: Remove from `territory-plans/route.ts`**

Find the block (around line 222):

```typescript
    awardPoints(user.id, "plan_created").catch((err) =>
      console.error("Failed to award plan_created points:", err),
    );
```

Delete those lines. Also remove the `awardPoints` import at the top of the file if it's there.

- [ ] **Step 3: Remove from `territory-plans/[id]/districts/route.ts`**

Find (around line 188):

```typescript
      awardPoints(user.id, "district_added").catch((err) =>
        console.error("Failed to award district_added points:", err),
      );
```

Delete. Remove import.

- [ ] **Step 4: Remove from `activities/route.ts`**

Find (around line 466):

```typescript
    awardPoints(user.id, "activity_logged").catch((err) =>
      console.error("Failed to award activity_logged points:", err),
    );
```

Delete. Remove import.

- [ ] **Step 5: Search for other consumers**

```bash
grep -rn "awardPoints\|awardRevenueTargetedPoints\|from.*scoring" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v scoring.ts
```

Expected: zero hits. If anything appears outside `scoring.ts` itself, remove that import too.

- [ ] **Step 6: Smoke test — create a plan and an activity**

```bash
npm run dev
```

In the app:
- Create a new plan → confirm no console error
- Add a district → confirm no console error
- Log an activity → confirm no console error

- [ ] **Step 7: Commit**

```bash
git add src/app/api/territory-plans/route.ts src/app/api/territory-plans/\[id\]/districts/route.ts src/app/api/activities/route.ts
git commit -m "refactor(api): remove awardPoints calls from plan/district/activity creation"
```

---

## Task 17: Delete `/api/leaderboard/me`

**Files:**
- Delete: `src/app/api/leaderboard/me/route.ts`

- [ ] **Step 1: Verify no remaining consumer**

```bash
grep -rn "/leaderboard/me\|leaderboard-me" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

Expected: zero hits (the only consumer was `useMyLeaderboardRank`, deleted in Task 10).

- [ ] **Step 2: Delete**

```bash
rm src/app/api/leaderboard/me/route.ts
rmdir src/app/api/leaderboard/me
```

- [ ] **Step 3: Commit**

```bash
git add -A src/app/api/leaderboard/me
git commit -m "feat(api): delete /api/leaderboard/me (replaced by /revenue-rank)"
```

---

## Task 18: Delete admin Leaderboard files

**Files:**
- Delete: `src/features/admin/components/LeaderboardTab.tsx`
- Delete: `src/features/admin/components/leaderboard/` (entire directory)
- Delete: `src/features/admin/hooks/useAdminLeaderboard.ts`
- Delete: `src/features/admin/lib/leaderboard-types.ts`
- Delete: `src/app/api/admin/leaderboard/` (entire directory)

- [ ] **Step 1: Verify nothing references these**

```bash
grep -rn "LeaderboardTab\|useAdminLeaderboard\|admin/leaderboard\|admin/lib/leaderboard-types" \
  src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

Expected: zero hits (Task 15 removed the only consumer).

- [ ] **Step 2: Delete component files**

```bash
rm src/features/admin/components/LeaderboardTab.tsx
rm -r src/features/admin/components/leaderboard/
rm src/features/admin/hooks/useAdminLeaderboard.ts
rm src/features/admin/lib/leaderboard-types.ts
```

- [ ] **Step 3: Delete admin API routes**

```bash
rm -r src/app/api/admin/leaderboard/
```

- [ ] **Step 4: Typecheck**

```bash
npm run build 2>&1 | grep -i "error" | head -20
```

Expected: no new errors from these deletions.

- [ ] **Step 5: Commit**

```bash
git add -A src/features/admin src/app/api/admin/leaderboard
git commit -m "feat(admin): delete admin leaderboard components, hooks, types, and API routes"
```

---

## Task 19: Delete cron, image route, image-layout, fonts, scoring

**Files:**
- Delete: `src/app/api/cron/leaderboard-slack-post/route.tsx`
- Delete: `src/app/api/leaderboard-image/route.tsx` + `__tests__/`
- Delete: `src/features/leaderboard/lib/image-layout.tsx`
- Delete: `src/features/leaderboard/lib/fonts/`
- Delete: `src/features/leaderboard/lib/scoring.ts`
- Delete: `src/features/leaderboard/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Verify no remaining consumer**

```bash
grep -rn "leaderboard-slack-post\|leaderboard-image\|image-layout\|leaderboard.*scoring\|from.*leaderboard/lib/scoring" \
  src/ vercel.json --include="*.ts" --include="*.tsx" --include="*.json" \
  | grep -v __tests__ | grep -v "scoring\.ts:"
```

Expected hits: only `vercel.json` (cron entry — handled in Task 20). If anything else appears, do not proceed.

- [ ] **Step 2: Delete files**

```bash
rm src/app/api/cron/leaderboard-slack-post/route.tsx
rmdir src/app/api/cron/leaderboard-slack-post

rm -r src/app/api/leaderboard-image

rm src/features/leaderboard/lib/image-layout.tsx
rm -r src/features/leaderboard/lib/fonts

rm src/features/leaderboard/lib/scoring.ts
rm src/features/leaderboard/lib/__tests__/scoring.test.ts
```

- [ ] **Step 3: Typecheck + run all tests**

```bash
npm run build 2>&1 | tail -30
npx vitest run 2>&1 | tail -30
```

Expected: build passes, all remaining tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/api/cron/leaderboard-slack-post src/app/api/leaderboard-image src/features/leaderboard/lib
git commit -m "feat(leaderboard): delete Slack cron, image route, image-layout, scoring, fonts"
```

---

## Task 20: Remove cron from `vercel.json` and delete stale docs

**Files:**
- Modify: `vercel.json`
- Delete: `Docs/superpowers/plans/2026-03-28-leaderboard-admin.md`
- Delete: `Docs/superpowers/specs/2026-03-28-leaderboard-admin-spec.md`
- Delete: `Docs/leaderboard-admin-handoff.md`

- [ ] **Step 1: Edit `vercel.json`**

Remove the entire object:

```json
    {
      "path": "/api/cron/leaderboard-slack-post?secret=${CRON_SECRET}",
      "schedule": "0 13 * * 1-5"
    },
```

Verify the `crons` array still has valid JSON (no trailing comma issues).

- [ ] **Step 2: Verify `vercel.json` is valid JSON**

```bash
jq . vercel.json > /dev/null && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Delete stale docs**

```bash
rm Docs/superpowers/plans/2026-03-28-leaderboard-admin.md
rm Docs/superpowers/specs/2026-03-28-leaderboard-admin-spec.md
rm Docs/leaderboard-admin-handoff.md
```

- [ ] **Step 4: Commit**

```bash
git add vercel.json Docs/superpowers/plans/2026-03-28-leaderboard-admin.md Docs/superpowers/specs/2026-03-28-leaderboard-admin-spec.md Docs/leaderboard-admin-handoff.md
git commit -m "chore: remove leaderboard-slack-post cron and stale Initiative docs"
```

---

## Task 21: Final verification — build, tests, manual

- [ ] **Step 1: Full build**

```bash
npm run build 2>&1 | tail -50
```

Expected: build completes without errors.

- [ ] **Step 2: Full test suite**

```bash
npx vitest run 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 3: Final greps for orphan references**

```bash
echo "=== Initiative consumer scan ==="
grep -rn "Initiative\|initiative\|MetricRegistry" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v "//\|/\*"
echo
echo "=== awardPoints scan ==="
grep -rn "awardPoints\|awardRevenueTargetedPoints" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
echo
echo "=== leaderboard-image scan ==="
grep -rn "leaderboard-image\|fetchLeaderboardData.*Initiative" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

Expected: only `prisma/schema.prisma` references to `Initiative*` / `MetricRegistry` (kept until PR 2). `awardPoints` and `leaderboard-image` should be empty.

- [ ] **Step 4: Manual smoke test against dev**

```bash
npm run dev
```

Walk through:
1. Sidebar — Revenue Rank widget shows, FY toggle flips
2. Click widget → modal opens to "Leaderboard" header, Revenue Overview content only
3. Click "Show me details" → full-page Leaderboard view, Revenue Overview only
4. Sidebar "Leaderboard" entry → same full-page view
5. Admin dashboard → no Leaderboard tab
6. Create a plan → no errors
7. Add a district → no errors
8. Log an activity → no errors
9. Home page (ProfileSidebar) → home widget shows Revenue Rank with toggle

- [ ] **Step 5: Confirm Prisma still generates**

```bash
npx prisma generate 2>&1 | tail
```

Expected: success. Initiative models are still in `schema.prisma` and Prisma generates types for them — that's fine; no code uses them.

- [ ] **Step 6: Commit any verification fixes**

If Step 1-4 surface any issues, fix them on the branch and commit. Otherwise nothing to do.

---

## Task 22: Open PR 1 (code-only)

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/initiative-deprecation
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(leaderboard): deprecate Initiative — code-only PR 1 of 2" --body "$(cat <<'EOF'
## Summary

- Removes Initiative tab, admin Leaderboard tab, scoring logic, and `leaderboard-slack-post` Slack cron
- Replaces floating tier widget with Revenue Rank widget (FY toggle)
- Decouples Revenue Overview from Initiative — roster now sourced from `UserProfile`
- Tables remain in DB (orphaned-but-harmless); PR 2 (~2 weeks later) drops them

Spec: `Docs/superpowers/specs/2026-04-27-initiative-deprecation-design.md`
Plan: `Docs/superpowers/plans/2026-04-27-initiative-deprecation.md`

## Test plan

- [ ] Verify Revenue Overview renders identically pre/post merge against production data
- [ ] Verify Revenue Rank widget renders, FY toggle works, click opens modal
- [ ] Verify modal opens to Revenue Overview only (no Initiative tab)
- [ ] Verify full-page Leaderboard view shows Revenue Overview only
- [ ] Verify admin dashboard has no Leaderboard tab
- [ ] Create plan / add district / log activity — confirm no errors
- [ ] Confirm `vercel logs --follow` shows no `leaderboard-slack-post` invocations

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Note PR URL for review**

Capture the URL printed by `gh pr create`. After merge and ~2 weeks of soak, proceed to Task 23.

---

## Task 23: (Soak period — 2 weeks after PR 1 merges)

Wait. During the soak period:

- Monitor production for any errors related to leaderboard/revenue endpoints
- Confirm no users report missing data or broken flows
- Confirm Vercel cron list no longer shows `leaderboard-slack-post`
- Confirm DB query volume on the now-orphaned `initiative*` tables is zero (via DB metrics if available)

If any issue surfaces, `git revert <pr1-merge-commit>` is a clean rollback (tables and data still intact).

---

## Task 24: Drop Initiative models from `schema.prisma` (PR 2)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Pull latest main and create PR 2 from same branch**

```bash
git checkout main
git pull
git checkout feat/initiative-deprecation
git merge main
```

- [ ] **Step 2: Remove `initiativeScores` back-relation from `UserProfile`**

Open `prisma/schema.prisma`, find `model UserProfile` (around line 752). Delete:

```prisma
  // Initiative leaderboard scores
  initiativeScores       InitiativeScore[]
```

- [ ] **Step 3: Remove the five Initiative models**

Delete these blocks entirely from `schema.prisma`:
- `model Initiative` (around lines 1442-1469)
- `model InitiativeMetric` (around lines 1471-1483)
- `model InitiativeScore` (around lines 1485-1500)
- `model InitiativeTierThreshold` (around lines 1502-1513)
- `model MetricRegistry` (around lines 1515-1523)

Also remove any standalone comment headers (`// ===== Initiative ... =====`) above the deleted models.

- [ ] **Step 4: Verify schema is valid**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`.

If errors: most likely a back-relation we missed. Re-grep:

```bash
grep -n "Initiative\|MetricRegistry" prisma/schema.prisma
```

Should be empty. If any hit, delete that line/block and re-run `prisma validate`.

- [ ] **Step 5: Commit schema deletion**

```bash
git add prisma/schema.prisma
git commit -m "chore(db): remove Initiative and MetricRegistry models from schema"
```

---

## Task 25: Generate drop migration (PR 2)

**Files:**
- Create: `prisma/migrations/<timestamp>_drop_initiative_tables/migration.sql`

- [ ] **Step 1: Generate migration**

```bash
npx prisma migrate dev --name drop_initiative_tables
```

This creates a new migration with the auto-generated SQL.

- [ ] **Step 2: Inspect the generated SQL**

```bash
ls -lt prisma/migrations | head
cat prisma/migrations/$(ls -t prisma/migrations | head -1)/migration.sql
```

Expected SQL (Prisma generates DROP TABLE statements in dependency order):

```sql
-- DropForeignKey
ALTER TABLE "initiative_metrics" DROP CONSTRAINT IF EXISTS "initiative_metrics_initiative_id_fkey";
ALTER TABLE "initiative_scores" DROP CONSTRAINT IF EXISTS "initiative_scores_initiative_id_fkey";
ALTER TABLE "initiative_scores" DROP CONSTRAINT IF EXISTS "initiative_scores_user_id_fkey";
ALTER TABLE "initiative_tier_thresholds" DROP CONSTRAINT IF EXISTS "initiative_tier_thresholds_initiative_id_fkey";

-- DropTable
DROP TABLE "initiative_metrics";
DROP TABLE "initiative_scores";
DROP TABLE "initiative_tier_thresholds";
DROP TABLE "initiatives";
DROP TABLE "metric_registry";
```

If the generated SQL doesn't match (e.g., missing tables, missing constraints), edit the file directly to ensure all five tables and their FKs are dropped.

- [ ] **Step 3: Re-generate Prisma client**

```bash
npx prisma generate
```

Expected: clean output. Per `project_local_dev_broken.md`, this step is needed after schema changes.

- [ ] **Step 4: Run tests**

```bash
npx vitest run 2>&1 | tail
```

Expected: all tests pass.

- [ ] **Step 5: Final orphan-reference check**

```bash
grep -rn "initiative\|Initiative\|MetricRegistry" src/ prisma/ \
  --include="*.ts" --include="*.tsx" --include="*.prisma" \
  | grep -v "node_modules\|migrations" \
  | grep -v -i "//.*initiative\|/\*.*initiative"
```

Expected: zero hits (we've removed everything from `prisma/schema.prisma` and all source files).

- [ ] **Step 6: Commit migration**

```bash
git add prisma/migrations
git commit -m "chore(db): drop initiative_* and metric_registry tables"
```

---

## Task 26: Open PR 2 (schema-only)

- [ ] **Step 1: Push**

```bash
git push origin feat/initiative-deprecation
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "chore(db): drop Initiative tables — schema PR 2 of 2" --body "$(cat <<'EOF'
## Summary

- Removes Initiative*/MetricRegistry models from Prisma schema
- Adds drop migration for `initiatives`, `initiative_metrics`, `initiative_scores`, `initiative_tier_thresholds`, `metric_registry`
- Follow-up to PR #<PR1_NUMBER> (code-only deprecation)

Spec: `Docs/superpowers/specs/2026-04-27-initiative-deprecation-design.md`
Plan: `Docs/superpowers/plans/2026-04-27-initiative-deprecation.md`

## Test plan

- [ ] Verify migration runs cleanly in staging
- [ ] Verify `npx prisma generate` succeeds
- [ ] Verify Revenue Overview, Revenue Rank widget, and full-page leaderboard still render after migration
- [ ] Verify all other app flows are unaffected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After PR 2 merges, the deprecation is complete.
