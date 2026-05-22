# Leaderboard — Unified FY Period Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Leaderboard's four independent FY dropdowns with a single "Prior Year / Current Year / Next Year" pill selector, backed by four new backend fields that expose previously-fetched-but-dropped data.

**Architecture:** Types first → backend wiring (additive only, no query changes to the batch fetch) → new prior-FY targeted DB query → team totals → frontend pill group replacing all FY state. Every task is independently committable and leaves TypeScript compiling.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, Vitest + Testing Library, Tailwind 4, TanStack Query, Zustand.

---

## File Map

| File | What changes |
|---|---|
| `src/features/leaderboard/lib/types.ts` | Add 4 fields to `LeaderboardEntry` |
| `src/features/leaderboard/lib/fetch-leaderboard.ts` | Wire 3 mapped actuals fields; add prior-FY targeted query; update `LeaderboardTeamTotals` + `teamTotals` object |
| `src/features/leaderboard/lib/queries.ts` | Add 8 new fields to `teamTotals` type in `LeaderboardResponse` |
| `src/features/leaderboard/components/RevenueOverviewTab.tsx` | Replace 4 FY state vars + helpers with `period` + `getColumnValues`; swap `FYSelect` row for pill group |
| `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts` | Add tests for new entry fields and team totals |

---

## Task 1: Extend LeaderboardEntry with four new fields

**Files:**
- Modify: `src/features/leaderboard/lib/types.ts`

These fields expose year-specific data that the backend already fetches but currently drops. TypeScript will immediately surface any downstream consumers that need updating — let the compiler guide you.

- [ ] **Step 1: Add four fields to `LeaderboardEntry`**

Open `src/features/leaderboard/lib/types.ts` and add four fields after `targetedNextFY` (line 26):

```ts
export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  rank: number;
  take: number;
  pipeline: number;
  pipelineCurrentFY: number;
  pipelineNextFY: number;
  pipelinePriorFY: number;       // ← NEW: prior year open pipeline
  revenue: number;
  revenueCurrentFY: number;
  revenuePriorFY: number;
  revenueNextFY: number;         // ← NEW: next year revenue (accumulates as FY27 deals close)
  priorYearRevenue: number;
  minPurchasesCurrentFY: number;
  minPurchasesPriorFY: number;
  minPurchasesNextFY: number;    // ← NEW: next year contracted minimums
  revenueTargeted: number;
  targetedCurrentFY: number;
  targetedNextFY: number;
  targetedPriorFY: number;       // ← NEW: prior year untapped targets
  unmatchedOppCount: number;
  unmatchedRevenue: number;
}
```

- [ ] **Step 2: Verify TypeScript finds the gaps**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx tsc --noEmit 2>&1 | grep -E "leaderboard|fetch-leader|RevenueOver" | head -20
```

Expected: errors in `fetch-leaderboard.ts` and `RevenueOverviewTab.tsx` about missing fields — that's correct. These are the files we'll fix in Tasks 2–5.

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/lib/types.ts
git commit -m "feat(leaderboard): add revenueNextFY, minPurchasesNextFY, pipelinePriorFY, targetedPriorFY to LeaderboardEntry"
```

---

## Task 2: Wire three repActuals fields in fetch-leaderboard

**Files:**
- Modify: `src/features/leaderboard/lib/fetch-leaderboard.ts`
- Modify: `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`

`getRepActualsBatch` already fetches all three years. The `next` year's `totalRevenue` and `minPurchaseBookings`, and the `prior` year's `openPipeline`, are available in memory but never mapped into the returned object. This task maps them.

- [ ] **Step 1: Write failing tests**

Add to `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts` inside the existing `describe("fetchLeaderboardData", ...)` block:

```ts
it("populates revenueNextFY from next school year actuals", async () => {
  mockUserProfile.mockResolvedValue([
    { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
  ] as never);
  mockGetRepActualsBatch.mockResolvedValue(batchOf({
    "alice@x.com": {
      "2025-26": { totalRevenue: 100 },
      "2026-27": { totalRevenue: 42 },
    },
  }));

  const payload = await fetchLeaderboardData();
  expect(payload.entries[0].revenueNextFY).toBe(42);
});

it("populates minPurchasesNextFY from next school year actuals", async () => {
  mockUserProfile.mockResolvedValue([
    { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
  ] as never);
  mockGetRepActualsBatch.mockResolvedValue(batchOf({
    "alice@x.com": {
      "2025-26": { minPurchaseBookings: 50 },
      "2026-27": { minPurchaseBookings: 99 },
    },
  }));

  const payload = await fetchLeaderboardData();
  expect(payload.entries[0].minPurchasesNextFY).toBe(99);
});

it("populates pipelinePriorFY from prior school year actuals", async () => {
  mockUserProfile.mockResolvedValue([
    { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
  ] as never);
  mockGetRepActualsBatch.mockResolvedValue(batchOf({
    "alice@x.com": {
      "2024-25": { openPipeline: 77 },
      "2025-26": { openPipeline: 200 },
    },
  }));

  const payload = await fetchLeaderboardData();
  expect(payload.entries[0].pipelinePriorFY).toBe(77);
});

it("defaults new per-FY fields to 0 when school year data is absent", async () => {
  mockUserProfile.mockResolvedValue([
    { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
  ] as never);
  mockGetRepActualsBatch.mockResolvedValue(batchOf({
    "alice@x.com": { "2025-26": { totalRevenue: 10 } },
    // No 2026-27 or 2024-25 entries
  }));

  const payload = await fetchLeaderboardData();
  expect(payload.entries[0].revenueNextFY).toBe(0);
  expect(payload.entries[0].minPurchasesNextFY).toBe(0);
  expect(payload.entries[0].pipelinePriorFY).toBe(0);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx vitest run src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts 2>&1 | tail -20
```

Expected: 4 new tests fail with "received undefined" or TypeScript compile errors about missing fields.

- [ ] **Step 3: Wire three new fields in repActuals mapping**

In `src/features/leaderboard/lib/fetch-leaderboard.ts`, replace the `repActuals` map (lines 56–74) with:

```ts
const repActuals = profiles.map((profile) => {
  const yearActuals = yearActualsByEmail.get(profile.email);
  const cur = yearActuals?.get(defaultSchoolYr);
  const prior = yearActuals?.get(priorSchoolYr);
  const next = yearActuals?.get(nextFYSchoolYr);
  return {
    userId: profile.id,
    pipeline: cur?.openPipeline ?? 0,
    pipelineCurrentFY: cur?.openPipeline ?? 0,
    pipelineNextFY: next?.openPipeline ?? 0,
    pipelinePriorFY: prior?.openPipeline ?? 0,
    take: cur?.totalTake ?? 0,
    revenue: cur?.totalRevenue ?? 0,
    revenueCurrentFY: cur?.totalRevenue ?? 0,
    revenuePriorFY: prior?.totalRevenue ?? 0,
    revenueNextFY: next?.totalRevenue ?? 0,
    priorYearRevenue: prior?.minPurchaseBookings ?? 0,
    minPurchasesCurrentFY: cur?.minPurchaseBookings ?? 0,
    minPurchasesPriorFY: prior?.minPurchaseBookings ?? 0,
    minPurchasesNextFY: next?.minPurchaseBookings ?? 0,
  };
});
```

- [ ] **Step 4: Update the fallback object (used when a rep has no actuals)**

Find the fallback at line ~151 (inside the `entries` map, `actualsMap.get(profile.id) ?? { ... }`). Replace it with:

```ts
const a = actualsMap.get(profile.id) ?? {
  userId: profile.id, take: 0,
  pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 0, pipelinePriorFY: 0,
  revenue: 0, revenueCurrentFY: 0, revenuePriorFY: 0, revenueNextFY: 0,
  priorYearRevenue: 0, minPurchasesCurrentFY: 0, minPurchasesPriorFY: 0, minPurchasesNextFY: 0,
};
```

- [ ] **Step 5: Wire new fields into each LeaderboardEntry**

In the `entries` map return object (around line 159), add three new fields after `minPurchasesPriorFY`:

```ts
pipelinePriorFY: a.pipelinePriorFY,
revenueNextFY: a.revenueNextFY,
minPurchasesNextFY: a.minPurchasesNextFY,
// targetedPriorFY comes in Task 3
targetedPriorFY: 0,  // placeholder until Task 3
```

- [ ] **Step 6: Extend sumActuals key union**

Find `const sumActuals` (around line 185). Extend the key union to include the three new actuals keys:

```ts
const sumActuals = (
  pool: typeof repActuals,
  key:
    | "revenue" | "revenueCurrentFY" | "revenuePriorFY" | "revenueNextFY"
    | "priorYearRevenue" | "minPurchasesCurrentFY" | "minPurchasesPriorFY" | "minPurchasesNextFY"
    | "pipelineCurrentFY" | "pipelineNextFY" | "pipelinePriorFY",
): number => pool.reduce((acc, x) => acc + (x[key] ?? 0), 0);
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx vitest run src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts 2>&1 | tail -20
```

Expected: All tests pass (including the 4 new ones).

- [ ] **Step 8: Commit**

```bash
git add src/features/leaderboard/lib/fetch-leaderboard.ts src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts
git commit -m "feat(leaderboard): wire revenueNextFY, minPurchasesNextFY, pipelinePriorFY from existing batch fetch"
```

---

## Task 3: Add prior-FY targeted query and wire targetedPriorFY

**Files:**
- Modify: `src/features/leaderboard/lib/fetch-leaderboard.ts`
- Modify: `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`

`targetedPriorFY` is the only field that needs a new DB query — a third `territoryPlanDistrict.findMany` for `fiscalYear: currentFY - 1`, matching the pattern of the existing current/next queries.

- [ ] **Step 1: Write failing test**

Add to `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`:

```ts
it("populates targetedPriorFY from prior-year territory plan districts", async () => {
  mockUserProfile.mockResolvedValue([
    { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
  ] as never);
  // The mock returns once per call to findMany. With three calls (current, next, prior),
  // we use mockResolvedValueOnce for each in call order.
  mockTerritoryPlanDistrict
    .mockResolvedValueOnce([]) // currentFY districts
    .mockResolvedValueOnce([]) // nextFY districts
    .mockResolvedValueOnce([  // priorFY districts ← NEW third call
      {
        districtLeaid: "D1",
        renewalTarget: 500,
        winbackTarget: 0,
        expansionTarget: 0,
        newBusinessTarget: 0,
        plan: { ownerId: "u1", userId: null },
      },
    ] as never);

  const payload = await fetchLeaderboardData();
  expect(payload.entries[0].targetedPriorFY).toBe(500);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx vitest run src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts 2>&1 | tail -20
```

Expected: new test fails (targetedPriorFY is 0, not 500).

- [ ] **Step 3: Add prior-FY targeted query to Promise.all**

In `fetch-leaderboard.ts`, find the `Promise.all` at line ~92. Add a third `territoryPlanDistrict.findMany` for the prior FY and destructure it:

```ts
const [
  targetedCurrentFYDistricts,
  targetedNextFYDistricts,
  targetedPriorFYDistricts,
  pipelineRows,
  unmatchedByRep,
] = await Promise.all([
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
  prisma.territoryPlanDistrict.findMany({
    where: { plan: { ...ownerFilter, fiscalYear: currentFYInt - 1 } },
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
          AND school_yr IN (${priorSchoolYr}, ${defaultSchoolYr}, ${nextFYSchoolYr})
          AND district_lea_id != '_NOMAP'
        GROUP BY sales_rep_email, district_lea_id, school_yr
        HAVING SUM(open_pipeline) > 0
      `,
  getUnmatchedCountsByRep(rosterEmails),
]);
```

Note: `priorSchoolYr` is added to the SQL `IN` clause so `sumTargetsWithPipelineDeduction` can deduct pipeline for prior-year districts.

- [ ] **Step 4: Compute prior-FY targeted and wire into entries**

After the existing two `sumTargetsWithPipelineDeduction` calls (line ~147), add:

```ts
const targetedPriorFYByUser = sumTargetsWithPipelineDeduction(targetedPriorFYDistricts, priorSchoolYr);
```

In the `entries` map return object, replace the `targetedPriorFY: 0` placeholder from Task 2 with:

```ts
targetedPriorFY: targetedPriorFYByUser.get(profile.id) ?? 0,
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx vitest run src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/leaderboard/lib/fetch-leaderboard.ts src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts
git commit -m "feat(leaderboard): add prior-FY targeted query, wire targetedPriorFY into entries"
```

---

## Task 4: Update LeaderboardTeamTotals and queries.ts type

**Files:**
- Modify: `src/features/leaderboard/lib/fetch-leaderboard.ts`
- Modify: `src/features/leaderboard/lib/queries.ts`
- Modify: `src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts`

The team totals aggregate the per-entry values and are consumed by `RevenueOverviewTab` for the table footer row. Add 8 new fields (4 values + 4 unassigned counterparts).

- [ ] **Step 1: Write failing test**

Add to `fetch-leaderboard.test.ts`:

```ts
it("includes revenueNextFY, minPurchasesNextFY, pipelinePriorFY, targetedPriorFY in teamTotals", async () => {
  mockUserProfile.mockResolvedValue([
    { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
  ] as never);
  mockGetRepActualsBatch.mockResolvedValue(batchOf({
    "alice@x.com": {
      "2024-25": { openPipeline: 77 },
      "2025-26": { totalRevenue: 100 },
      "2026-27": { totalRevenue: 42, minPurchaseBookings: 99 },
    },
  }));
  mockTerritoryPlanDistrict
    .mockResolvedValueOnce([]) // currentFY
    .mockResolvedValueOnce([]) // nextFY
    .mockResolvedValueOnce([   // priorFY
      {
        districtLeaid: "D1",
        renewalTarget: 500,
        winbackTarget: 0, expansionTarget: 0, newBusinessTarget: 0,
        plan: { ownerId: "u1", userId: null },
      },
    ] as never);

  const payload = await fetchLeaderboardData();

  expect(payload.teamTotals.revenueNextFY).toBe(42);
  expect(payload.teamTotals.minPurchasesNextFY).toBe(99);
  expect(payload.teamTotals.pipelinePriorFY).toBe(77);
  expect(payload.teamTotals.targetedPriorFY).toBe(500);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx vitest run src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts 2>&1 | tail -20
```

- [ ] **Step 3: Add 8 new fields to LeaderboardTeamTotals interface**

In `fetch-leaderboard.ts`, extend `LeaderboardTeamTotals` (lines 5–26):

```ts
export interface LeaderboardTeamTotals {
  revenue: number;
  revenueCurrentFY: number;
  revenuePriorFY: number;
  revenueNextFY: number;               // ← NEW
  unassignedRevenue: number;
  unassignedRevenueCurrentFY: number;
  unassignedRevenuePriorFY: number;
  unassignedRevenueNextFY: number;     // ← NEW
  priorYearRevenue: number;
  minPurchasesCurrentFY: number;
  minPurchasesPriorFY: number;
  minPurchasesNextFY: number;          // ← NEW
  unassignedPriorYearRevenue: number;
  unassignedMinPurchasesCurrentFY: number;
  unassignedMinPurchasesPriorFY: number;
  unassignedMinPurchasesNextFY: number; // ← NEW
  pipelineCurrentFY: number;
  pipelineNextFY: number;
  pipelinePriorFY: number;             // ← NEW
  unassignedPipelineCurrentFY: number;
  unassignedPipelineNextFY: number;
  unassignedPipelinePriorFY: number;   // ← NEW
  targetedCurrentFY: number;
  targetedNextFY: number;
  targetedPriorFY: number;             // ← NEW
  unassignedTargetedCurrentFY: number;
  unassignedTargetedNextFY: number;
  unassignedTargetedPriorFY: number;   // ← NEW
}
```

- [ ] **Step 4: Wire new fields into the teamTotals object literal**

Find the `const teamTotals: LeaderboardTeamTotals = { ... }` block (around line 201) and add 8 new entries:

```ts
const teamTotals: LeaderboardTeamTotals = {
  revenue: sumActuals(repActuals, "revenue"),
  revenueCurrentFY: sumActuals(repActuals, "revenueCurrentFY"),
  revenuePriorFY: sumActuals(repActuals, "revenuePriorFY"),
  revenueNextFY: sumActuals(repActuals, "revenueNextFY"),
  unassignedRevenue: sumActuals(adminActuals, "revenue"),
  unassignedRevenueCurrentFY: sumActuals(adminActuals, "revenueCurrentFY"),
  unassignedRevenuePriorFY: sumActuals(adminActuals, "revenuePriorFY"),
  unassignedRevenueNextFY: sumActuals(adminActuals, "revenueNextFY"),
  priorYearRevenue: sumActuals(repActuals, "priorYearRevenue"),
  minPurchasesCurrentFY: sumActuals(repActuals, "minPurchasesCurrentFY"),
  minPurchasesPriorFY: sumActuals(repActuals, "minPurchasesPriorFY"),
  minPurchasesNextFY: sumActuals(repActuals, "minPurchasesNextFY"),
  unassignedPriorYearRevenue: sumActuals(adminActuals, "priorYearRevenue"),
  unassignedMinPurchasesCurrentFY: sumActuals(adminActuals, "minPurchasesCurrentFY"),
  unassignedMinPurchasesPriorFY: sumActuals(adminActuals, "minPurchasesPriorFY"),
  unassignedMinPurchasesNextFY: sumActuals(adminActuals, "minPurchasesNextFY"),
  pipelineCurrentFY: sumActuals(repActuals, "pipelineCurrentFY"),
  pipelineNextFY: sumActuals(repActuals, "pipelineNextFY"),
  pipelinePriorFY: sumActuals(repActuals, "pipelinePriorFY"),
  unassignedPipelineCurrentFY: sumActuals(adminActuals, "pipelineCurrentFY"),
  unassignedPipelineNextFY: sumActuals(adminActuals, "pipelineNextFY"),
  unassignedPipelinePriorFY: sumActuals(adminActuals, "pipelinePriorFY"),
  targetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, userIds),
  targetedNextFY: sumTargetedMap(targetedNextFYByUser, userIds),
  targetedPriorFY: sumTargetedMap(targetedPriorFYByUser, userIds),
  unassignedTargetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, adminUserIds),
  unassignedTargetedNextFY: sumTargetedMap(targetedNextFYByUser, adminUserIds),
  unassignedTargetedPriorFY: sumTargetedMap(targetedPriorFYByUser, adminUserIds),
};
```

- [ ] **Step 5: Update LeaderboardResponse in queries.ts**

Open `src/features/leaderboard/lib/queries.ts` and extend the `teamTotals` type inside `LeaderboardResponse` (around line 20) to include the 8 new fields:

```ts
teamTotals: {
  revenue: number;
  revenueCurrentFY: number;
  revenuePriorFY: number;
  revenueNextFY: number;
  unassignedRevenue: number;
  unassignedRevenueCurrentFY: number;
  unassignedRevenuePriorFY: number;
  unassignedRevenueNextFY: number;

  priorYearRevenue: number;
  minPurchasesCurrentFY: number;
  minPurchasesPriorFY: number;
  minPurchasesNextFY: number;
  unassignedPriorYearRevenue: number;
  unassignedMinPurchasesCurrentFY: number;
  unassignedMinPurchasesPriorFY: number;
  unassignedMinPurchasesNextFY: number;

  pipelineCurrentFY: number;
  pipelineNextFY: number;
  pipelinePriorFY: number;
  unassignedPipelineCurrentFY: number;
  unassignedPipelineNextFY: number;
  unassignedPipelinePriorFY: number;

  targetedCurrentFY: number;
  targetedNextFY: number;
  targetedPriorFY: number;
  unassignedTargetedCurrentFY: number;
  unassignedTargetedNextFY: number;
  unassignedTargetedPriorFY: number;
};
```

- [ ] **Step 6: Run all leaderboard tests — expect PASS**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx vitest run src/features/leaderboard 2>&1 | tail -20
```

Expected: All pass.

- [ ] **Step 7: Verify TypeScript is clean**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: Only errors in `RevenueOverviewTab.tsx` (addressed in Task 5). No new errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/leaderboard/lib/fetch-leaderboard.ts src/features/leaderboard/lib/queries.ts src/features/leaderboard/lib/__tests__/fetch-leaderboard.test.ts
git commit -m "feat(leaderboard): add revenueNextFY, minPurchasesNextFY, pipelinePriorFY, targetedPriorFY to team totals"
```

---

## Task 5: Frontend — replace four FY selectors with period pill group

**Files:**
- Modify: `src/features/leaderboard/components/RevenueOverviewTab.tsx`

Replace the four independent `revenueFY / minPurchasesFY / pipelineFY / targetedFY` state variables and the `FYSelect` filter row with a single `period` state and a pill group UI.

- [ ] **Step 1: Replace state and add getColumnValues helper**

Open `src/features/leaderboard/components/RevenueOverviewTab.tsx`. First ensure `LeaderboardEntry` is imported at the top — add it if absent:

```ts
import type { LeaderboardEntry } from "../lib/types";
```

Replace everything from the `type ForwardFYSelection` declaration through the `const [targetedFY, setTargetedFY]` line with:

```ts
type Period = "prior" | "current" | "next";

function getColumnValues(
  entry: LeaderboardEntry,
  period: Period,
) {
  switch (period) {
    case "prior":
      return {
        revenue: entry.revenuePriorFY,
        minPurchases: entry.minPurchasesPriorFY,
        pipeline: entry.pipelinePriorFY,
        targeted: entry.targetedPriorFY,
      };
    case "current":
      return {
        revenue: entry.revenueCurrentFY,
        minPurchases: entry.minPurchasesCurrentFY,
        pipeline: entry.pipelineCurrentFY,
        targeted: entry.targetedCurrentFY,
      };
    case "next":
      return {
        revenue: entry.revenueNextFY,
        minPurchases: entry.minPurchasesNextFY,
        pipeline: entry.pipelineNextFY,
        targeted: entry.targetedNextFY,
      };
  }
}
```

And inside `RevenueOverviewTab`, replace the four `useState` calls with one:

```ts
const [period, setPeriod] = useState<Period>(() => {
  if (typeof window === "undefined") return "current";
  return (sessionStorage.getItem("leaderboard-period") as Period) ?? "current";
});

const handlePeriod = (p: Period) => {
  setPeriod(p);
  sessionStorage.setItem("leaderboard-period", p);
};
```

Remove the `[sortColumn, setSortColumn]` and `[sortDirection, setSortDirection]` states — they stay as-is.

- [ ] **Step 2: Update projectedEntries memo**

Replace the `projectedEntries` useMemo with:

```ts
const projectedEntries = useMemo(() => {
  return (leaderboard?.entries ?? []).map((entry) => {
    const vals = getColumnValues(entry, period);
    return {
      ...entry,
      revenue: vals.revenue,
      priorYearRevenue: vals.minPurchases,
      pipeline: vals.pipeline,
      revenueTargeted: vals.targeted,
    };
  });
}, [leaderboard?.entries, period]);
```

- [ ] **Step 3: Update projectedTotals memo**

Replace the `projectedTotals` useMemo with:

```ts
const projectedTotals = useMemo<RevenueTableTotals | undefined>(() => {
  const t = leaderboard?.teamTotals;
  if (!t) return undefined;

  const maps: Record<Period, RevenueTableTotals> = {
    prior: {
      revenue: t.revenuePriorFY,
      priorYearRevenue: t.minPurchasesPriorFY,
      pipeline: t.pipelinePriorFY,
      revenueTargeted: t.targetedPriorFY,
      unassignedRevenue: t.unassignedRevenuePriorFY,
      unassignedPriorYearRevenue: t.unassignedMinPurchasesPriorFY,
      unassignedPipeline: t.unassignedPipelinePriorFY,
      unassignedRevenueTargeted: t.unassignedTargetedPriorFY,
    },
    current: {
      revenue: t.revenueCurrentFY,
      priorYearRevenue: t.minPurchasesCurrentFY,
      pipeline: t.pipelineCurrentFY,
      revenueTargeted: t.targetedCurrentFY,
      unassignedRevenue: t.unassignedRevenueCurrentFY,
      unassignedPriorYearRevenue: t.unassignedMinPurchasesCurrentFY,
      unassignedPipeline: t.unassignedPipelineCurrentFY,
      unassignedRevenueTargeted: t.unassignedTargetedCurrentFY,
    },
    next: {
      revenue: t.revenueNextFY,
      priorYearRevenue: t.minPurchasesNextFY,
      pipeline: t.pipelineNextFY,
      revenueTargeted: t.targetedNextFY,
      unassignedRevenue: t.unassignedRevenueNextFY,
      unassignedPriorYearRevenue: t.unassignedMinPurchasesNextFY,
      unassignedPipeline: t.unassignedPipelineNextFY,
      unassignedRevenueTargeted: t.unassignedTargetedNextFY,
    },
  };
  return maps[period];
}, [leaderboard?.teamTotals, period]);
```

- [ ] **Step 4: Replace the FYSelect filter bar with the pill group**

In the return JSX, find the `{/* FY selectors */}` block (the `{fy && (...)}` div containing four `<FYSelect>` components). Replace the entire block with:

```tsx
<div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F7F5FA] border-b border-[#EFEDF5]">
  {(["prior", "current", "next"] as Period[]).map((p) => {
    const label =
      p === "prior" ? `Prior Year${fy ? ` (${formatFYLabel(fy.priorFY)})` : ""}` :
      p === "current" ? `Current Year${fy ? ` (${formatFYLabel(fy.currentFY)})` : ""}` :
      `Next Year${fy ? ` (${formatFYLabel(fy.nextFY)})` : ""}`;
    return (
      <button
        key={p}
        onClick={() => handlePeriod(p)}
        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
          period === p
            ? "bg-[#403770] text-white"
            : "bg-[#EFEDF5] text-[#8A80A8] hover:text-[#403770]"
        }`}
      >
        {label}
      </button>
    );
  })}
</div>
```

- [ ] **Step 5: Simplify columnLabels**

Replace the `columnLabels` and `columnTooltips` blocks with:

```ts
const columnLabels: Partial<Record<RevenueSortColumn, string>> = {
  revenue: "Revenue",
  priorYearRevenue: "Min Purchases",
  pipeline: "Pipeline",
  revenueTargeted: "Targeted",
};

const columnTooltips: Partial<Record<RevenueSortColumn, string>> = {
  revenue: "Sum of Subscriptions + Sessions",
  priorYearRevenue: "Contracted floor per contract, summed across distinct contracts",
  pipeline: "Sum of Open Opportunities (stages 0–5)",
  revenueTargeted: "Sum of Plan District Targets minus Pipeline (untapped target)",
};
```

Remove the now-unused `forwardFYOptions`, `backwardFYOptions`, `forwardRangeLabel`, `backwardRangeLabel` variables and the `ForwardFYSelection`, `BackwardFYSelection` types.

Also remove the `FYSelect` component at the bottom of the file (the `function FYSelect(...)` block) and the `ChevronDown` import.

- [ ] **Step 6: Verify TypeScript is fully clean**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: No errors.

- [ ] **Step 7: Run full test suite**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan" && npx vitest run 2>&1 | tail -20
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/leaderboard/components/RevenueOverviewTab.tsx
git commit -m "feat(leaderboard): replace four FY dropdowns with unified Prior/Current/Next Year pill selector"
```

---

## Done

All five tasks produce a working, TypeScript-clean build. The leaderboard now has a single period pill that drives all four columns simultaneously, backed by complete per-FY data across all three years.
