# Feature Spec: Team Progress

**Date:** 2026-03-14
**Slug:** team-progress
**Branch:** worktree-team-progress

## Requirements

A top-level "Progress" sidebar tab that serves as a one-stop shop to understand:
1. How much revenue is being targeted by category (renewal, expansion, winback, new business)
2. How the team is performing against those targets using actuals from opportunities
3. Which opportunities are generating revenue but aren't mapped to any plan

### Category Classification (District Revenue History)

Categories are derived from **district revenue history**, NOT the `contract_type` field:

| Category | Condition | Actual Calculation |
|----------|-----------|-------------------|
| **Renewal** | District had revenue in prior FY | `min(currentRevenue, priorRevenue)` |
| **Expansion** | District had revenue in prior FY AND current > prior | `max(0, currentRevenue - priorRevenue)` |
| **Winback** | No prior FY revenue, but had revenue 2 FYs ago | All `currentRevenue` |
| **New Business** | No revenue in prior FY or 2 FYs ago | All `currentRevenue` |

A single district can contribute to BOTH renewal AND expansion simultaneously.

### Unmapped Opportunities
Districts with current-year revenue that are NOT in any territory plan should be surfaced in a distinct section, showing aggregate revenue and individual opportunities.

## Visual Design

**Layout (Hybrid of Approach A + B):**

1. **Header**: "Team Progress" title + FY selector dropdown
2. **Category Cards**: 4 summary cards (Renewal, Expansion, Winback, New Business) showing target vs actual with progress percentage
3. **Stacked Progress Bar**: Horizontal bar showing actual revenue by category against total target
4. **Unmapped Alert**: Warning banner if unmapped opportunities exist
5. **Plan Drill-down Table**: Expandable rows: Plan → District → Opportunities, with inline progress bars per category

**Color Mapping:**
- Renewal: Plum `#403770`
- Expansion: Steel Blue `#6EA3BE`
- Winback: Deep Coral `#F37167`
- New Business: Sage `#8AA891`

## API Design

### `GET /api/team-progress?fiscalYear=2026`

Returns all data in a single request.

```typescript
interface TeamProgressResponse {
  fiscalYear: number;
  totals: {
    renewal: { target: number; actual: number };
    expansion: { target: number; actual: number };
    winback: { target: number; actual: number };
    newBusiness: { target: number; actual: number };
    combined: { target: number; actual: number };
  };
  plans: PlanProgress[];
  unmapped: {
    totalRevenue: number;
    districtCount: number;
    districts: UnmappedDistrict[];
  };
}

interface PlanProgress {
  id: string;
  name: string;
  color: string;
  owner: { id: string; fullName: string; avatarUrl: string | null } | null;
  districtCount: number;
  renewal: { target: number; actual: number };
  expansion: { target: number; actual: number };
  winback: { target: number; actual: number };
  newBusiness: { target: number; actual: number };
  total: { target: number; actual: number };
  districts: DistrictProgress[];
}

interface DistrictProgress {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  category: "renewal" | "expansion" | "winback" | "new_business" | "renewal+expansion";
  renewalActual: number;
  expansionActual: number;
  winbackActual: number;
  newBusinessActual: number;
  renewalTarget: number;
  expansionTarget: number;
  winbackTarget: number;
  newBusinessTarget: number;
  currentRevenue: number;
  priorRevenue: number;
  opportunities: OpportunityItem[];
}

interface OpportunityItem {
  id: string;
  name: string;
  stage: string;
  contractType: string | null;
  netBookingAmount: number;
  totalRevenue: number;
  totalTake: number;
}

interface UnmappedDistrict {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  currentRevenue: number;
  opportunities: OpportunityItem[];
}
```

### Query Strategy

Three batched queries against `district_opportunity_actuals`:
1. Current FY revenue per district (all districts)
2. Prior FY revenue per district (all districts)
3. Two-FYs-ago revenue per district (all districts)

Plus one query for individual opportunities (for drill-down).

Unmapped districts = districts in query 1 that are NOT in any `territory_plan_districts` row.

## Component Plan

### New Components (under `src/features/progress/`)

| Component | Purpose |
|-----------|---------|
| `TeamProgressView` | Top-level view, data fetching, layout |
| `CategoryCard` | Single category metric card with progress ring/bar |
| `StackedProgressBar` | Horizontal stacked bar showing category breakdown |
| `UnmappedAlert` | Warning banner for unmapped opportunities |
| `PlanProgressTable` | Expandable plan rows |
| `DistrictProgressRow` | Expandable district within a plan |
| `OpportunityList` | Individual opportunity items |

### Existing Components to Reuse
- `ViewToggle` — not needed for this view
- SVG icons from `Sidebar.tsx` — new chart icon for Progress tab

### Navigation Changes
- Add `"progress"` to `TabId` union in `app-store.ts` and `Sidebar.tsx`
- Add Progress icon + tab to `MAIN_TABS` in `Sidebar.tsx`
- Add `TeamProgressView` rendering in `page.tsx`

## States

- **Loading**: Skeleton cards + skeleton table rows
- **Empty**: "No territory plans found" message with link to Plans tab
- **Error**: Standard error message with retry
- **No Unmapped**: Alert banner hidden

## Out of Scope

- Editing targets from this view (use Plans tab)
- Adding districts to plans from this view
- Historical trend charts / time series
- Export / download functionality
- Per-rep filtering (team-wide view only)
