# Frontend Discovery: Pacing Revenue & Sessions by Service Type

**Date:** 2026-03-24
**Spec:** `docs/superpowers/specs/2026-03-24-pacing-revenue-sessions-by-service-type-design.md`
**Primary file:** `src/features/map/components/SearchResults/PlanDistrictsTab.tsx`

---

## 1. PacingTable Component

**Location:** Lines 443-508 of `PlanDistrictsTab.tsx` (private function, not exported)

### Signature

```typescript
function PacingTable({ pacing, fiscalYear }: { pacing?: DistrictPacing; fiscalYear: number })
```

### Metrics Array Construction

When `pacing` is defined, the component builds a 4-element array:

```typescript
const metrics = pacing
  ? [
      { label: "Revenue",  current: pacing.currentRevenue,  sameDate: pacing.priorSameDateRevenue,  full: pacing.priorFullRevenue,  isCurrency: true },
      { label: "Pipeline", current: pacing.currentPipeline, sameDate: pacing.priorSameDatePipeline, full: pacing.priorFullPipeline, isCurrency: true },
      { label: "Deals",    current: pacing.currentDeals,    sameDate: pacing.priorSameDateDeals,    full: pacing.priorFullDeals,    isCurrency: false },
      { label: "Sessions", current: pacing.currentSessions, sameDate: pacing.priorSameDateSessions, full: pacing.priorFullSessions, isCurrency: false },
    ]
  : null;
```

When `pacing` is undefined, `metrics` is `null`.

### Row Rendering

Each metric row renders as a 4-column CSS grid row:

```
grid-cols-[1fr_1fr_1fr_1fr]
```

Column layout:
1. **Label** (`px-2`, 10px, `#6E6390`, medium weight)
2. **Current value** (`px-2`, right-aligned, 11px, bold `#544A78`, tabular-nums)
3. **Same Date PFY** (center-aligned, `border-l border-[#f0edf5]`) -- value + optional `getPaceBadge`
4. **Full PFY** (center-aligned, `border-l border-[#f0edf5]`) -- value + optional `getPercentOfBadge`

Formatting: `isCurrency ? formatCurrency : (v: number) => String(v)`

Rows are separated by `border-b border-[#f0edf5]` except the last row.

Badge rendering (both columns): `text-[7px] px-1 py-0.5 rounded font-semibold` with dynamic `bg` and `text` color classes.

### Table Header

A group header row sits above the metric rows:

```
grid-cols-[1fr_1fr_1fr_1fr] bg-[#FAFAFE] border-b border-[#E2DEEC]
```

- Col 1-2: empty
- Col 3: "Same Date PFY" (8px bold `#8A80A8`, centered, left border)
- Col 4: "Full PFY" (8px bold `#8A80A8`, centered, left border)

Above the table: section label "Year-over-Year Pacing" + FY badge.

### Wrapper

```html
<div class="bg-white border border-[#E2DEEC] rounded-lg overflow-hidden">
```

### Empty State

When `metrics` is null (no pacing data):

```html
<div class="px-3 py-4 text-center text-[10px] text-[#C2BBD4] italic">No prior year data</div>
```

### Helper Functions

**`formatCurrency(value: number | null | undefined): string`** (line 19-25)
- `null/undefined` -> `"--"`
- `0` -> `"$0"`
- `>= 1M` -> `$X.XM`
- `>= 1K` -> `$X.XK`
- Otherwise -> `$X` with locale formatting

**`getPaceBadge(current, prior): { label, bg, text } | null`** (line 40-48)
- Both zero -> `null`
- Prior is zero, current nonzero -> `{ label: "New", bg: "bg-[#EBF0F7]", text: "text-[#3D5A80]" }`
- Positive change -> green (`bg-[#EFF5F0]`, `text-[#5a7a61]`)
- Zero change -> neutral (`bg-[#f0edf5]`, `text-[#8A80A8]`)
- Negative > -30% -> amber (`bg-[#FEF3C7]`, `text-[#92700C]`)
- Negative <= -30% -> red (`bg-[#FEF2F1]`, `text-[#9B4D46]`)

**`getPercentOfBadge(current, fullPrior): { label, bg, text } | null`** (line 50-56)
- `fullPrior === 0` -> `null`
- `>= 70%` -> green
- `>= 40%` -> amber
- `< 40%` -> red

---

## 2. DistrictRow Component

**Location:** Lines 194-359 of `PlanDistrictsTab.tsx`

### How It Passes Pacing to PacingTable

At line 328:
```tsx
<PacingTable pacing={district.pacing} fiscalYear={fiscalYear} />
```

`district` is typed as `TerritoryPlanDistrict`, where `pacing?: DistrictPacing`.

### Expand/Collapse Pattern

The parent `PlanDistrictsTab` manages a single `expandedLeaid: string | null` state (line 70). Only one district can be expanded at a time.

`DistrictRow` receives:
```typescript
{
  district: TerritoryPlanDistrict;
  planId: string;
  fiscalYear: number;
  isExpanded: boolean;
  onToggle: () => void;
}
```

**Collapsed row** (always rendered): A CSS grid row with `grid-cols-[1fr_110px_110px_55px_28px]`. Clicking the entire row calls `onToggle()`. A small SVG chevron (8x8, right-pointing triangle) rotates 90 degrees when expanded.

**Expanded detail** (conditionally rendered with `{isExpanded && (...)}`): Renders below the collapsed row inside the same `<div>`, with `px-5 pb-4 pl-8 pt-3 bg-[#FAFAFE] space-y-3.5`. Contains:
1. Revenue Target Breakdown (4 editable TargetCards in `grid-cols-4`)
2. Side-by-side layout: `grid-cols-[3fr_2fr]`
   - Left: `<PacingTable pacing={district.pacing} fiscalYear={fiscalYear} />`
   - Right: Services, Notes, LMS link

No animation/transition on expand -- pure conditional render.

---

## 3. Type Definitions

**File:** `src/features/shared/types/api-types.ts`

### DistrictPacing (lines 339-352)

```typescript
export interface DistrictPacing {
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

No `serviceTypeBreakdown` field exists yet. The spec requires adding `ServiceTypePacing` interface and `serviceTypeBreakdown?: ServiceTypePacing[]` to `DistrictPacing`.

### TerritoryPlanDistrict (lines 319-337)

```typescript
export interface TerritoryPlanDistrict {
  leaid: string;
  addedAt: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  owner: string | null;
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
  notes: string | null;
  returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
  newServices: Array<{ id: number; name: string; slug: string; color: string }>;
  tags: Array<{ id: number; name: string; color: string }>;
  actuals?: PlanDistrictActuals;
  opportunities?: PlanDistrictOpportunity[];
  pacing?: DistrictPacing;
}
```

`pacing` is optional -- populated by the API route when pacing data exists for a district.

### TerritoryPlanDetail (line 354-356)

```typescript
export interface TerritoryPlanDetail extends Omit<TerritoryPlan, "districtCount"> {
  districts: TerritoryPlanDistrict[];
}
```

---

## 4. API Hook (TanStack Query)

**File:** `src/features/plans/lib/queries.ts`, lines 22-30

```typescript
export function useTerritoryPlan(planId: string | null) {
  return useQuery({
    queryKey: ["territoryPlan", planId],
    queryFn: () =>
      fetchJson<TerritoryPlanDetail>(`${API_BASE}/territory-plans/${planId}`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
```

- **Query key:** `["territoryPlan", planId]`
- **Endpoint:** `GET /api/territory-plans/[id]`
- **Response type:** `TerritoryPlanDetail` (includes `districts` array, each with optional `pacing`)
- **Stale time:** 2 minutes

The pacing data is embedded in each district object within the plan detail response -- there is no separate pacing query. The `serviceTypeBreakdown` will be added to the same response, requiring no new hooks or queries on the frontend.

### Optimistic Update Awareness

`useUpdateDistrictTargets()` (same file, line 192) performs optimistic updates on the `["territoryPlan", planId]` cache. It patches target fields, notes, and services but does NOT touch `pacing`. This means pacing data (including the new `serviceTypeBreakdown`) will not be affected by optimistic updates -- it flows in read-only from the API.

### API Route

**File:** `src/app/api/territory-plans/[id]/route.ts`

The pacing object is constructed at lines 205-222 from three lookup maps (`currentPacingByDistrict`, `priorSameDateByDistrict`, `priorFullByDistrict`). If all three are missing for a district, `pacing` is set to `undefined`. The spec adds 3 new parallel sessions-table queries and restructures how revenue/sessions are populated.

---

## 5. Existing Expandable Row Patterns

### Pattern A: PlanDistrictsTab DistrictRow (same file -- most relevant)

The `DistrictRow` within the pacing table's parent component uses:
- Parent holds `expandedLeaid: string | null` (single-expand)
- Child receives `isExpanded: boolean` + `onToggle: () => void`
- Conditional render: `{isExpanded && (<div>...</div>)}`
- No animation, immediate show/hide
- SVG chevron with `rotate-90` transition via `transition-transform`

This is the **exact parent** of the PacingTable. The new expandable "Revenue & Sessions" row will be a nested expand within an already-expanded DistrictRow.

### Pattern B: DataGrid Expandable Rows

**Files:** `src/features/shared/components/DataGrid/types.ts` + `DataGrid.tsx`

The shared DataGrid supports expandable rows via three optional props:
```typescript
expandedRowIds?: Set<string>;
onToggleExpand?: (id: string) => void;
renderExpandedRow?: (row: Record<string, unknown>) => ReactNode;
```

When both `expandedRowIds` and `renderExpandedRow` are provided:
- A chevron button appears in each row
- Clicking toggles `onToggleExpand(rowId)`
- Expanded content renders in a full-colspan `<tr>` below the data row

Used in practice by the Explore view's plan entity (`PlanExpansionRow` in `cellRenderers.tsx`).

This pattern is for `<table>`-based DataGrid. The PacingTable uses CSS Grid, not `<table>`, so the DataGrid pattern is a conceptual reference only.

### Pattern C: Collapsible Sections (district panel cards)

Components like `DistrictInfo`, `DemographicsChart`, `StaffingSalaries` use:
```typescript
const [isExpanded, setIsExpanded] = useState(true);
```
With a button header and `{isExpanded && (<div>...</div>)}` body. These use a ChevronDown SVG that rotates. This is a section-level collapse, not a table-row expand.

### Recommended Pattern for PacingTable

Since the PacingTable uses CSS Grid rows (not `<table>`), the simplest approach mirrors the DistrictRow pattern:
1. Add `useState<boolean>(false)` for the expanded state within PacingTable
2. Make the first metric row ("Revenue & Sessions") clickable
3. Add an inline SVG chevron that rotates on expand
4. Conditionally render sub-rows between the combined row and the Pipeline row
5. Sub-rows use the same `grid-cols-[1fr_1fr_1fr_1fr]` layout with additional `pl-5` on the label cell

No new shared components are needed. The expand state is local to PacingTable since it only affects rendering within the table itself.

---

## Summary of Changes Required

| Area | File | What Changes |
|------|------|-------------|
| Types | `src/features/shared/types/api-types.ts` | Add `ServiceTypePacing` interface; add `serviceTypeBreakdown?: ServiceTypePacing[]` to `DistrictPacing` |
| Component | `src/features/map/components/SearchResults/PlanDistrictsTab.tsx` | Refactor `PacingTable`: remove separate Revenue + Sessions rows, add combined expandable row with sub-rows |
| API | `src/app/api/territory-plans/[id]/route.ts` | Add 3 sessions-table queries, restructure pacing construction |
| Hook | `src/features/plans/lib/queries.ts` | No changes needed -- same endpoint, same query key, type change flows through `TerritoryPlanDetail` |
