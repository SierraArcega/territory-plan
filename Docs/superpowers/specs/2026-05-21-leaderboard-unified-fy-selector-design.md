# Leaderboard — Unified FY Period Selector

**Date:** 2026-05-21
**Status:** Approved

## Problem

The Leaderboard filter bar has four independent FY dropdowns (Revenue, Min Purchases, Pipeline, Targeted), each operable in isolation. There is no coherent "what year are we looking at" concept — a rep can accidentally mix FY25 revenue with FY27 pipeline. The nav widget's toggle is also completely disconnected from this state.

## Solution

Replace the four dropdowns with a single **period pill group**:

```
[ Prior Year ]  [ Current Year ]  [ Next Year ]
```

All four table columns — Revenue, Min Purchases, Pipeline, Targeted — reflect the selected period simultaneously. The nav widget is unchanged (its FY toggle is independent and intentional).

---

## Section 1 — State & UI (RevenueOverviewTab)

Replace four independent state variables with one:

```ts
type Period = "prior" | "current" | "next";
const [period, setPeriod] = useState<Period>(() => {
  if (typeof window === "undefined") return "current";
  return (sessionStorage.getItem("leaderboard-period") as Period) ?? "current";
});
```

Persist on change:
```ts
const handlePeriod = (p: Period) => {
  setPeriod(p);
  sessionStorage.setItem("leaderboard-period", p);
};
```

**Pill group UI** — replaces the `FYSelect` row:
- Three buttons: `Prior Year`, `Current Year`, `Next Year`
- Active: `bg-[#403770] text-white`
- Inactive: `bg-[#EFEDF5] text-[#8A80A8]`
- Same compact styling as the nav widget's existing FY toggle

**Column headers** — drop the FY annotation. Headers become: `Revenue`, `Min Purchases`, `Pipeline`, `Targeted`. The global pill communicates the FY context.

**Default:** `Current Year` on first visit.

---

## Section 2 — Period-to-column mapping

Replace the four separate `getXxxValue` helpers with a single lookup:

```ts
function getColumnValues(entry: LeaderboardEntry, period: Period) {
  switch (period) {
    case "prior":   return { revenue: entry.revenuePriorFY,   minPurchases: entry.minPurchasesPriorFY,   pipeline: entry.pipelinePriorFY,   targeted: entry.targetedPriorFY };
    case "current": return { revenue: entry.revenueCurrentFY, minPurchases: entry.minPurchasesCurrentFY, pipeline: entry.pipelineCurrentFY, targeted: entry.targetedCurrentFY };
    case "next":    return { revenue: entry.revenueNextFY,    minPurchases: entry.minPurchasesNextFY,    pipeline: entry.pipelineNextFY,    targeted: entry.targetedNextFY };
  }
}
```

The `projectedEntries` and `projectedTotals` memos both consume `period` as their sole FY input.

If a value is genuinely zero (e.g. FY27 revenue before any deals close), show `$0` — no special treatment. Data will populate naturally as business closes.

---

## Section 3 — Backend changes (fetch-leaderboard.ts)

### 3a — Wire existing fetched-but-dropped fields

The batch fetch at line 55 already returns all three years. Three new fields are just mapping gaps:

In the `repActuals` mapping (lines 63–74), add:

```ts
revenueNextFY:       next?.totalRevenue        ?? 0,
minPurchasesNextFY:  next?.minPurchaseBookings  ?? 0,
pipelinePriorFY:     prior?.openPipeline        ?? 0,
```

### 3b — Add prior-year targeted query

Add a fourth `prisma.territoryPlanDistrict.findMany` alongside the existing current/next queries:

```ts
prisma.territoryPlanDistrict.findMany({
  where: { plan: { ...ownerFilter, fiscalYear: currentFY - 1 } },
  select: {
    districtLeaid: true,
    renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
    plan: { select: { ownerId: true, userId: true } },
  },
}),
```

Note: the SQL pipeline query (line 111) filters `school_yr IN (defaultSchoolYr, nextFYSchoolYr)` — extend to include `priorSchoolYr` so `sumTargetsWithPipelineDeduction` can deduct prior-year pipeline correctly.

Compute:
```ts
const targetedPriorFYByUser = sumTargetsWithPipelineDeduction(targetedPriorFYDistricts, priorSchoolYr);
```

### 3c — Wire into entry and totals

Add to each `LeaderboardEntry`:
```ts
revenueNextFY:      a.revenueNextFY,
minPurchasesNextFY: a.minPurchasesNextFY,
pipelinePriorFY:    a.pipelinePriorFY,
targetedPriorFY:    targetedPriorFYByUser.get(profile.id) ?? 0,
```

Add corresponding `unassigned*` fields to `LeaderboardTeamTotals` following the same pattern as existing fields.

---

## Section 4 — Type changes

### LeaderboardEntry (types.ts)
Add four fields:
```ts
revenueNextFY:      number;
minPurchasesNextFY: number;
pipelinePriorFY:    number;
targetedPriorFY:    number;
```

### LeaderboardTeamTotals (fetch-leaderboard.ts + queries.ts)
Add:
```ts
revenueNextFY:               number;
minPurchasesNextFY:          number;
pipelinePriorFY:             number;
targetedPriorFY:             number;
unassignedRevenueNextFY:     number;
unassignedMinPurchasesNextFY: number;
unassignedPipelinePriorFY:   number;
unassignedTargetedPriorFY:   number;
```

---

## Section 5 — Nav widget

No changes. The `LeaderboardNavWidget` toggle (Current / Next FY) is independent, intentional, and remains as-is.

---

## Out of scope

- "Both" / combined multi-year view — not needed; was an artifact of the old per-column UI
- Changes to `RevenueRankResponse` or the `/api/leaderboard/revenue-rank` route
- Changes to `LowHangingFruitView` or any other leaderboard tab

---

## Files to touch

| File | Change |
|---|---|
| `src/features/leaderboard/lib/types.ts` | Add 4 fields to `LeaderboardEntry` |
| `src/features/leaderboard/lib/fetch-leaderboard.ts` | Wire 3 mapped fields, add prior-FY targeted query, extend SQL years, update totals |
| `src/features/leaderboard/lib/queries.ts` | Add 8 new fields to `teamTotals` type in `LeaderboardResponse` |
| `src/features/leaderboard/components/RevenueOverviewTab.tsx` | Replace 4 state vars + 4 helpers with `period` + `getColumnValues`; swap `FYSelect` row for pill group |

`src/app/api/leaderboard/route.ts` — no changes needed; it passes `fetchLeaderboardData()` through directly with no locally declared types.
