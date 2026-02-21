# Enriched Territory Footprint Card — Design

**Date:** 2026-02-19
**Status:** Approved

## Overview

Enrich the Territory Footprint focus mode card with three new data dimensions:
1. **Pipeline Share** — what % of the plan's total pipeline comes from this state
2. **FY25 Revenue Share** — what % of previous FY revenue was attributed to this state
3. **Top 5 Accounts with Pipeline vs. Target** — per-district pipeline compared to the sum of all four target categories

## Decisions

- **Target metric:** Sum of all four targets (renewal + expansion + winback + newBusiness)
- **Pipeline metric:** Plan FY only (based on `plan.fiscalYear` — e.g. FY26 plan uses `fy26OpenPipeline`)
- **Top accounts:** Expanded from 3 to 5, sorted by pipeline descending
- **No schema changes needed** — all data exists in `District` and `TerritoryPlanDistrict`

## API Changes

**File:** `src/app/api/focus-mode/[planId]/route.ts`

### Enriched `topDistricts` shape

Current:
```ts
topDistricts: [{ leaid, name, fy26Invoicing }]  // top 3 by invoicing
```

New:
```ts
topDistricts: [{ leaid, name, fy26Invoicing, pipeline, totalTarget }]  // top 5 by pipeline
```

### Query changes

- Join `TerritoryPlanDistrict` (via `plan.districts`) to get per-district targets
- Pick pipeline column dynamically: `plan.fiscalYear === 2026 ? fy26OpenPipeline : fy27OpenPipeline`
- Sum 4 target columns: `renewalTarget + expansionTarget + winbackTarget + newBusinessTarget`
- Sort by pipeline descending, take 5 instead of 3

### No new aggregate fields needed

Pipeline share and FY25 revenue share are computed frontend-side from existing per-state data:
- Pipeline share = `statePlanPipeline / totalPlanPipeline` (sum across all states)
- FY25 share = `statePlanFy25Invoicing / totalPlanFy25Invoicing` (sum across all states)

## Frontend Changes

**File:** `src/components/map-v2/focus-mode/FootprintCard.tsx`

### New metrics: Pipeline Share + FY25 Revenue Share

Two side-by-side mini metrics between "Open Pipeline" and "Top Accounts":

| Metric | Calculation | Bar color |
|--------|-------------|-----------|
| Pipeline Share | state plan pipeline / total plan pipeline | Steel Blue `#6EA3BE` |
| FY25 Revenue Share | state plan FY25 invoicing / total plan FY25 invoicing | Plum `#403770` |

Each shows: percentage label + small horizontal bar fill.

### Expanded Top Accounts

- 5 districts instead of 3
- Sorted by pipeline (not invoicing)
- Each row: name, `$pipeline / $target`, progress bar, percentage
- Bar color varies by attainment:
  - < 75%: Golden `#FFCF70` (caution)
  - 75–100%: Plum `#403770`
  - > 100%: Mint `#EDFFE3` bg with `#5f665b` text
- If `totalTarget === 0`: show pipeline only with muted "No target" label

### Type changes

`FocusModeStateData.topDistricts` array items gain two new fields:
- `pipeline: number`
- `totalTarget: number`

## Card Layout

```
┌─── Territory Footprint ──────────┐
│ [CA] [TX] [FL]                   │
│                                  │
│ CUSTOMERS                        │
│ 47          of 312               │
│ ████████░░░░░░░░  15%            │
│                                  │
│ OPEN PIPELINE                    │
│ $1.2M       12 opps              │
│                                  │
│ PIPELINE SHARE        FY25 SHARE │
│  34%  ██████░░         28%  ████ │
│                                  │
│ TOP ACCOUNTS (PIPELINE → TARGET) │
│ 1 Springfield USD                │
│   $420K / $500K  ████████░░ 84%  │
│ 2 Riverside Unified              │
│   $280K / $300K  █████████░ 93%  │
│ ...                              │
└──────────────────────────────────┘
```

## Files to Modify

- `src/app/api/focus-mode/[planId]/route.ts` — enrich topDistricts query
- `src/lib/api.ts` — update `FocusModeStateData` type
- `src/components/map-v2/focus-mode/FootprintCard.tsx` — new metrics + expanded accounts
