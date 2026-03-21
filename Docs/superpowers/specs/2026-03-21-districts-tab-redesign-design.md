# Districts Tab Redesign — Design Spec

**Date:** 2026-03-21
**Slug:** districts-tab-redesign
**Branch:** worktree-editable-targets-opportunities-tab
**Status:** Approved

## Problem

The PlanDistrictsTab in the PlanDetailModal is cluttered and hard to use:

1. **"Set" wall** — 4 target columns × N rows creates repetitive visual noise when targets aren't populated.
2. **Expanded row breaks scanning** — Inline accordion (pipeline stats + notes) pushes rows down and disrupts the table grid.
3. **Too many columns** — 8 columns (District, St, Renewal, Expansion, Winback, New Biz, Total, Actual) compete for ~750px. Columns overflow.
4. **Redundant state column** — Plans are often single-state, wasting space.
5. **No visual hierarchy** — Everything has equal weight. Nothing signals health or urgency.
6. **Unclear that targets are revenue targets** — Users need to understand they're setting revenue expectations.

## Design

### Collapsed Table (Default Scan View)

4 columns, replacing the current 8-column layout:

| Column | Content | Behavior |
|--------|---------|----------|
| **District** | Name with expand chevron | Click to expand |
| **Rev. Target** | Sum of all 4 target types, or italic "Not set" | — |
| **Rev. Actual** | Actual revenue for this FY | — |
| **Attain.** | Actual ÷ Target as %, color-coded badge | Green ≥70%, Golden 40-69%, Coral <40%, "—" if no target |

Section label above table: **"Revenue Targets"** (uppercase, muted).
Hint text: "Click row to edit targets & view pacing".

Footer: `N districts · Rev. Target: $XXK · Actual: $XXK`

### Expanded Row (Edit + Pacing View)

Click any row to expand. One row expanded at a time. The expanded area has three sections:

#### 1. Revenue Target Breakdown (top, full width)

4 editable cards across in a single row:

```
[ Renewal    $20K ] [ Expansion  $15K ] [ Winback    $10K ] [ New Biz     $5K ]
```

Each card: label on left, editable dollar value on right. Click to inline-edit (existing `InlineEditableCell` behavior). White background, `#E2DEEC` border, `rounded-lg`.

#### 2. YoY Pacing Table + Notes (below targets, side-by-side)

**Left ~60%: Pacing mini table** with grouped sub-columns.

Two column groups with headers:
- **📍 Same Date PFY** — Prior fiscal year value as of today's date last year (point-in-time comparison)
- **📊 Full PFY** — Prior fiscal year final total (full-year comparison)

4 metric rows:

| Metric | This Year | Same Date PFY Value | Pace | Full PFY Total | % of |
|--------|-----------|---------------------|------|----------------|------|
| Revenue | $12,400 | $10,200 | ▲ 22% | $28,000 | 44% |
| Pipeline | $32,000 | $22,000 | ▲ 45% | $35,000 | 91% |
| Deals | 3 | 2 | ▲ 50% | 4 | 75% |
| Sessions | 12 | 8 | ▲ 50% | 18 | 67% |

Pace badges: Green (▲ ahead), Golden (▼ slightly behind, >50%), Coral (▼ significantly behind, <50%).

**Right ~40%: Notes + Services**

- Notes: Auto-save textarea (existing behavior)
- Services: Colored pills for return/new services (existing behavior)

#### 3. Remove button

Trash icon visible in the expanded row header, right-aligned. Existing confirm-before-remove behavior.

### Attainment Badge Colors

| Range | Background | Text | Example |
|-------|-----------|------|---------|
| ≥100% | `#EFF5F0` | `#5a7a61` | `105%` |
| 70-99% | `#EFF5F0` | `#5a7a61` | `73%` |
| 40-69% | `#FEF3C7` | `#92700C` | `55%` |
| <40% | `#FEF2F1` | `#9B4D46` | `25%` |
| No target | — | `#C2BBD4` | `—` |

### YoY Pace Badge Colors

Same color logic as attainment:
- **▲ Ahead** (>0% improvement): Green (`#EFF5F0` / `#5a7a61`)
- **▼ Slightly behind** (0% to -30%): Golden (`#FEF3C7` / `#92700C`)
- **▼ Significantly behind** (<-30%): Coral (`#FEF2F1` / `#9B4D46`)

For "% of Full PFY": same thresholds applied to the percentage value.

## Data Requirements

### Existing Data (no backend changes needed)

- Revenue targets: `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget` on `TerritoryPlanDistrict`
- Current FY actuals: already fetched via `district_opportunity_actuals` materialized view
- Prior FY total revenue: already fetched (`priorFyRevenue`)
- Notes, services: existing fields

### New Data Needed

The YoY pacing table requires new backend queries for **point-in-time prior year** comparisons and additional metrics:

1. **Prior FY same-date revenue** — Total revenue from PFY opportunities where `created_at <= same date last year` (or use current actuals as proxy since the view aggregates closed opps)
2. **Prior FY same-date pipeline** — Weighted pipeline from PFY opportunities that existed by this date last year
3. **Prior FY full pipeline** — Total weighted pipeline for the full PFY
4. **Prior FY same-date deals** — Count of PFY opportunities created by this date last year
5. **Prior FY full deals** — Total PFY opportunity count
6. **Current FY sessions** — `scheduled_sessions` sum from current FY opportunities
7. **Prior FY same-date sessions** — `scheduled_sessions` from PFY opps created by this date
8. **Prior FY full sessions** — Total `scheduled_sessions` for full PFY

These can be fetched as a single batch query per plan (all districts at once) similar to the existing `currentRows`/`priorRows` pattern in the plan detail API route.

### API Changes

Extend the `GET /api/territory-plans/[id]` response to include pacing data per district:

```typescript
// Added to each district in the response
pacing?: {
  currentRevenue: number;
  currentPipeline: number;
  currentDeals: number;
  currentSessions: number;
  priorSameDateRevenue: number;
  priorSameDatePipeline: number;
  priorSameDateDeals: number;
  priorSameDateSessions: number;
  priorFullRevenue: number;
  priorFullPipeline: number;
  priorFullDeals: number;
  priorFullSessions: number;
}
```

## Component Changes

### Modified Files

| File | Change |
|------|--------|
| `src/features/map/components/SearchResults/PlanDistrictsTab.tsx` | Complete rewrite: 4-column collapsed table, new expanded detail layout |
| `src/features/shared/types/api-types.ts` | Add `DistrictPacing` type, add `pacing` field to `TerritoryPlanDistrict` |
| `src/app/api/territory-plans/[id]/route.ts` | Add pacing queries to GET handler |

### New Components (within PlanDistrictsTab.tsx)

All internal to the file — no new shared components:

- `PacingTable` — The YoY mini table with grouped sub-columns
- `TargetBreakdown` — The 4-across editable target cards
- `AttainmentBadge` — Color-coded percentage badge

## Out of Scope

- Opportunities tab (already implemented separately)
- Sorting by attainment or pacing metrics (can be added later)
- Bulk target editing across districts
- Prior year data backfill if opportunities table is sparse
