# Cross-Year Map Comparison

**Date:** 2026-02-24
**Status:** Draft

## Problem Statement

The Territory Planner's map currently filters all vendor engagement categories by a single fiscal year. When a user selects FY26, every district is colored according to its FY26 Fullmind/competitor category (new, multi_year_growing, lapsed, etc.). To understand how a territory is *changing* across years -- which customers churned, which are new, which upgraded -- the user must manually toggle between FY26 and FY27 in the LayerBubble, mentally comparing what they saw moments ago. With ~13,000 districts, this is impractical.

Sales reps need cross-year comparison to answer questions like:
- "Which FY26 customers are not in my FY27 pipeline?" (churn risk)
- "Where did we gain new business in FY27 that we didn't have in FY26?" (growth pockets)
- "How is my Texas territory evolving year-over-year?" (territory health)

**Who benefits:** Sales reps doing annual territory planning, sales managers reviewing territory health across fiscal years.

**Why now:** FY27 pipeline data is now loaded alongside FY26 actuals. The `district_map_features` materialized view already contains per-FY category columns for FY24-FY27 for all vendors. The data infrastructure is ready; only the visualization layer is missing.

## Proposed Solution

Add a **Compare Years** mode to the map, accessible via a toggle in the LayerBubble. When activated, the user picks two fiscal years (FY_A and FY_B) and chooses between two visualization modes:

1. **Side-by-Side** -- The map canvas splits vertically into two locked panes, each rendering the same geographic area but colored by different fiscal years. Pan and zoom are synchronized. All layer controls (vendor toggles, engagement filters, state filters, etc.) are shared; only the fiscal year differs per pane. Each pane gets its own FY label badge.

2. **Changes (Diff Layer)** -- A single map replaces vendor engagement coloring with a **transition layer** that highlights what changed between FY_A and FY_B. Districts are colored by simplified transition buckets: Churned, New Customer, Upgraded, Downgraded, New Pipeline, and Unchanged. A floating legend/stats panel shows counts per bucket. The transition classification is computed client-side from the two FY category columns already present in tile data.

Both modes share the same entry point and can be toggled freely. Exiting compare mode restores the normal single-FY map.

## Technical Design

### Architecture Overview

The key insight is that the `district_map_features` materialized view already contains category columns for **all** fiscal years simultaneously (`fy24_fullmind_category`, `fy25_fullmind_category`, `fy26_fullmind_category`, `fy27_fullmind_category`, and similarly for competitors). The current tile API aliases one FY's columns to `fullmind_category`, etc., via the `fy=` query param. For comparison mode, we need the tile to expose **two** FYs' category columns simultaneously.

### Pre-requisite: MapV2Container Refactoring

`MapV2Container.tsx` is a 1,216-line monolith that takes zero props, reads ~20 store selectors directly, hardcodes its tile URL, manages tooltip state globally, and assigns itself to the `mapV2Ref` singleton on mount. It was never designed for multi-instance use. **This refactoring must be completed before side-by-side mode can work.**

The refactoring extracts reusable pieces without changing existing behavior:

1. **Extract `useMapLibreInstance` hook** -- Moves MapLibre `Map` creation, source/layer setup, and event wiring into a custom hook that accepts configuration:
   - `fyOverride?: string` -- When provided, overrides `selectedFiscalYear` from the store for the tile source URL. The initial tile URL should read `fyOverride ?? selectedFiscalYear` rather than hardcoding `fy26`.
   - `tileUrlSuffix?: string` -- Additional query params for the tile URL (e.g., `&fy2=fy27`).
   - `refKey?: "primary" | "secondary"` -- Controls `mapV2Ref` assignment (see below).
   - `tooltipPropertyMap?: Record<string, string>` -- Maps logical names to tile property names, allowing the tooltip handler to read `fullmind_category_a` instead of `fullmind_category` in compare mode.
   - Returns `{ mapRef, mapReady, containerRef }`.

2. **Promote `mapV2Ref` to hold both refs** -- Change `src/features/map/lib/ref.ts` from a singleton to:
   ```typescript
   export const mapV2Refs: {
     primary: maplibregl.Map | null;
     secondary: maplibregl.Map | null;
   } = { primary: null, secondary: null };
   ```
   The hook accepts a `refKey` prop. In normal mode and for the left pane in side-by-side, use `"primary"`. For the right pane, use `"secondary"`. On unmount, only null out the ref matching the instance's own `refKey`. Consumers that previously read `mapV2Ref.current` now read `mapV2Refs.primary`.

3. **Accept `fyOverride` and `tileUrlSuffix` props** on `MapV2Container` -- Passed through to the hook. The tile source URL effect reads `fyOverride ?? selectedFiscalYear` for the `fy=` param, and appends `tileUrlSuffix` if present.

4. **Conditionally skip `mapV2Ref` assignment** -- When `refKey` is `"secondary"`, the instance writes to `mapV2Refs.secondary` instead of `primary`. This prevents the second instance from overwriting the first's ref, and prevents unmount of the first from nulling the second's ref.

**Files affected by this pre-requisite:**

| File | Action | Description |
|------|--------|-------------|
| `src/features/map/lib/useMapLibreInstance.ts` | **Create** | Extracted hook for MapLibre instance lifecycle. |
| `src/features/map/lib/ref.ts` | **Modify** | Promote from singleton `mapV2Ref` to dual-ref `mapV2Refs` with `primary`/`secondary` keys. |
| `src/features/map/components/MapV2Container.tsx` | **Modify** | Refactor to use `useMapLibreInstance` hook. Accept `fyOverride`, `tileUrlSuffix`, and `refKey` props. Becomes a thinner component that wires the hook to the DOM and store. |

### Affected Files

| File | Action | Description |
|------|--------|-------------|
| `src/features/map/lib/store.ts` | **Modify** | Add comparison mode state: `compareMode`, `compareFyA`, `compareFyB`, `compareView` (side-by-side vs changes). Add actions to enter/exit compare mode. Update `getViewSnapshot()` and `applyViewSnapshot()` to serialize/deserialize new compare fields (see MapViewState changes below). |
| `src/features/map/lib/comparison.ts` | **Create** | Transition bucket classification logic. Maps (categoryA, categoryB) pairs to simplified buckets. Export `TRANSITION_BUCKETS` config with colors/labels. Category rank hierarchy. |
| `src/features/map/lib/useComparisonSummary.ts` | **Create** | React Query hook that fetches summary stats for the diff layer -- counts per transition bucket. |
| `src/features/map/components/LayerBubble.tsx` | **Modify** | Add "Compare Years" toggle and configuration UI (FY_A / FY_B dropdowns, side-by-side vs changes segmented control). |
| `src/features/map/components/ComparisonMapShell.tsx` | **Create** | Wrapper that renders either `SideBySideMap` or `ChangesMap` based on `compareView` store value. Replaces `MapV2Container` in the shell when compare mode is active. |
| `src/features/map/components/SideBySideMap.tsx` | **Create** | Renders two `MapV2Container` instances in a 50/50 horizontal split with synchronized pan/zoom. Left pane uses `refKey="primary"`, right pane uses `refKey="secondary"`. Each instance receives a different `fyOverride` prop. Includes FY label badges. |
| `src/features/map/components/ChangesMap.tsx` | **Create** | Single MapV2Container with `tileUrlSuffix` containing `fy2` param and `tooltipPropertyMap` for compare-mode property names. Renders transition-colored layer. Includes floating transition legend with counts. |
| `src/features/map/components/TransitionLegend.tsx` | **Create** | Floating legend panel showing transition bucket colors, labels, and district counts. Positioned near the summary bar area. |
| `src/features/map/components/MapV2Shell.tsx` | **Modify** | Conditionally render `ComparisonMapShell` instead of `MapV2Container` when `compareMode` is true. |
| `src/features/map/components/MapV2Container.tsx` | **Modify** | Accept `fyOverride`, `tileUrlSuffix`, `refKey`, and `tooltipPropertyMap` props (via pre-requisite refactoring). In compare/changes mode, the tooltip handler reads `fullmind_category_a`/`_b` via the property map and populates `customerCategoryA`, `customerCategoryB`, and `transitionBucket` on the tooltip data. |
| `src/features/map/components/MapV2Tooltip.tsx` | **Modify** | When `compareMode` is active: in changes view, show FY_A category, FY_B category, and transition bucket label with colored dot. In side-by-side view, show the category for the hovered pane's FY. |
| `src/features/map/components/MapSummaryBar.tsx` | **Modify** | When compare mode is active with the changes view, show transition summary stats instead of (or alongside) the normal financial stats. |
| `src/app/api/tiles/[z]/[x]/[y]/route.ts` | **Modify** | Accept optional `fy2` query param. When present, include both FYs' category columns in the MVT output (e.g., `fullmind_category_a` and `fullmind_category_b`). Update `isNationalView` optimization to OR across both FYs (see API Changes). |
| `src/app/api/districts/summary/compare/route.ts` | **Create** | New API endpoint that returns transition bucket counts for two FYs, respecting existing filters (states, owner, plan, account types). |
| `src/features/map/lib/layers.ts` | **Modify** | Add `buildTransitionFillExpression()` that reads `fullmind_category_a` and `fullmind_category_b` tile properties and maps them to transition bucket colors using MapLibre expressions. |
| `src/features/map/lib/__tests__/comparison.test.ts` | **Create** | Unit tests for transition bucket classification. |
| `src/features/map/components/__tests__/SideBySideMap.test.tsx` | **Create** | Component tests for side-by-side rendering and sync behavior. |
| `src/features/map/components/__tests__/ChangesMap.test.tsx` | **Create** | Component tests for changes/diff layer rendering. |

### Data Model Changes

None. No Prisma schema changes, no migrations.

The `district_map_features` materialized view already contains all FY-specific category columns needed (`fy24_*_category` through `fy27_*_category` for all vendors). No view changes are required.

### API Changes

#### Modified: `GET /api/tiles/[z]/[x]/[y]`

Add optional `fy2` query parameter. When present, the tile includes category columns for both fiscal years.

**Current behavior (unchanged when `fy2` is absent):**
```
GET /api/tiles/5/8/12?fy=fy26
→ MVT with: fullmind_category, proximity_category, elevate_category, tbt_category
  (aliased from fy26_fullmind_category, etc.)
```

**New behavior when `fy2` is present:**
```
GET /api/tiles/5/8/12?fy=fy26&fy2=fy27
→ MVT with:
  fullmind_category_a (from fy26_fullmind_category)
  fullmind_category_b (from fy27_fullmind_category)
  proximity_category_a, proximity_category_b
  elevate_category_a, elevate_category_b
  tbt_category_a, tbt_category_b
  (plus all existing non-FY columns: enrollment_signal, locale_signal, etc.)
```

The SQL change aliases the FY columns with `_a` / `_b` suffixes instead of the generic names. Both sets of columns are included so the client can read either FY's data from a single tile.

**`isNationalView` optimization update:** The existing tile route has a low-zoom optimization (`isNationalView`, zoom < 6) that only loads districts where the requested FY's category columns are non-null. When `fy2` is present, this filter must OR across **both** FYs:

```sql
-- Current (single FY):
AND (d.${fy}_fullmind_category IS NOT NULL OR d.${fy}_proximity_category IS NOT NULL ...)

-- With fy2 (must include districts visible in EITHER year):
AND (
  d.${fy}_fullmind_category IS NOT NULL OR d.${fy}_proximity_category IS NOT NULL ...
  OR d.${fy2}_fullmind_category IS NOT NULL OR d.${fy2}_proximity_category IS NOT NULL ...
)
```

Without this fix, districts that churned (had data in `fy` but not in `fy2`, or vice versa) would be invisible at national zoom -- exactly the districts the user most wants to see in comparison mode.

#### New: `GET /api/districts/summary/compare`

Returns transition bucket counts for Fullmind engagement between two fiscal years.

**Request:**
```
GET /api/districts/summary/compare?fyA=fy26&fyB=fy27&vendors=fullmind&states=TX,CA
```

All filter params from the existing `/api/districts/summary` are supported (states, owner, planId, accountTypes, vendors).

**Response (200):**
```json
{
  "fyA": "fy26",
  "fyB": "fy27",
  "vendor": "fullmind",
  "buckets": {
    "churned": { "count": 142, "totalEnrollment": 485000 },
    "new_customer": { "count": 58, "totalEnrollment": 210000 },
    "upgraded": { "count": 203, "totalEnrollment": 780000 },
    "downgraded": { "count": 67, "totalEnrollment": 245000 },
    "new_pipeline": { "count": 89, "totalEnrollment": 320000 },
    "unchanged": { "count": 1024, "totalEnrollment": 3900000 }
  },
  "total": { "count": 1583, "totalEnrollment": 5940000 }
}
```

The server computes buckets by reading both `fy{A}_{vendor}_category` and `fy{B}_{vendor}_category` columns from `district_map_features` and classifying each district into a transition bucket.

### Comparison Store State

New fields added to `MapV2State` in `src/features/map/lib/store.ts`:

```typescript
// Comparison mode
compareMode: boolean;                              // false = normal, true = compare active
compareView: "side_by_side" | "changes";           // which visualization
compareFyA: "fy24" | "fy25" | "fy26" | "fy27";   // "left" / "from" year
compareFyB: "fy24" | "fy25" | "fy26" | "fy27";   // "right" / "to" year
```

New actions in `MapV2Actions`:

```typescript
enterCompareMode: () => void;          // Sets compareMode = true, defaults to changes view
exitCompareMode: () => void;           // Restores normal single-FY mode
setCompareView: (view: "side_by_side" | "changes") => void;
setCompareFyA: (fy: "fy24" | "fy25" | "fy26" | "fy27") => void;
setCompareFyB: (fy: "fy24" | "fy25" | "fy26" | "fy27") => void;
```

Default values when entering compare mode:
- `compareFyA` defaults to the FY *before* the current `selectedFiscalYear` (e.g., if FY27 is selected, FY_A = fy26)
- `compareFyB` defaults to `selectedFiscalYear` (e.g., fy27)
- `compareView` defaults to `"changes"`

### V2TooltipData Changes

The existing `V2TooltipData` interface in `src/features/map/lib/store.ts` has a single `customerCategory` field that reads `fullmind_category` from tile properties. In compare mode, tile properties use `_a`/`_b` suffixes. Add new optional fields:

```typescript
// Existing field (unchanged for normal mode)
customerCategory?: string;

// New fields for compare mode
customerCategoryA?: string;   // FY_A category (from fullmind_category_a tile prop)
customerCategoryB?: string;   // FY_B category (from fullmind_category_b tile prop)
transitionBucket?: TransitionBucket;  // Classified bucket for changes view
```

The tooltip handler in `MapV2Container` reads the correct tile property names based on mode:
- Normal mode: reads `fullmind_category` -> populates `customerCategory`
- Compare/changes mode: reads `fullmind_category_a` and `fullmind_category_b` (via `tooltipPropertyMap` prop) -> populates `customerCategoryA`, `customerCategoryB`, and computes `transitionBucket` using `classifyTransition()`
- Side-by-side mode: reads `fullmind_category` (each pane has its own FY tile data) -> populates `customerCategory` as normal

### MapViewState Serialization Changes

The `MapViewState` interface in `src/features/map/lib/store.ts` gains optional compare fields so that saved views can capture and restore comparison mode:

```typescript
// Added to MapViewState
compareMode?: boolean;
compareView?: "side_by_side" | "changes";
compareFyA?: string;
compareFyB?: string;
```

Update `getViewSnapshot()` to include compare fields when `compareMode` is true:
```typescript
getViewSnapshot: () => {
  const s = get();
  return {
    ...existingFields,
    // Only include compare state when active
    ...(s.compareMode ? {
      compareMode: true,
      compareView: s.compareView,
      compareFyA: s.compareFyA,
      compareFyB: s.compareFyB,
    } : {}),
  };
},
```

Update `applyViewSnapshot()` to restore or clear compare state:
```typescript
applyViewSnapshot: (state: MapViewState) => {
  set({
    ...existingRestoration,
    compareMode: state.compareMode ?? false,
    compareView: state.compareView ?? "changes",
    compareFyA: (state.compareFyA ?? "fy26") as FiscalYear,
    compareFyB: (state.compareFyB ?? "fy27") as FiscalYear,
  });
},
```

### Transition Bucket Classification (`src/features/map/lib/comparison.ts`)

The classification maps a (categoryA, categoryB) pair to one of 6 buckets. Categories are the raw tile values: `target`, `new_business_pipeline`, `winback_pipeline`, `renewal_pipeline`, `expansion_pipeline`, `new` (first_year), `multi_year_growing`, `multi_year_flat`, `multi_year_shrinking`, `lapsed` (Fullmind), `churned` (competitor vendors), and `null` (no data). Note that Fullmind uses `lapsed` while competitors (Proximity, Elevate, TBT) use `churned` for the same business concept -- both are treated identically in the classification logic.

**Category hierarchy (for upgrade/downgrade detection):**

```typescript
const CATEGORY_RANK: Record<string, number> = {
  // No data / lapsed / churned — all treated as rank 0 (bottom)
  "": 0,
  "lapsed": 0,                 // Fullmind's term for lost customer
  "churned": 0,                // Competitor vendors' term for lost customer
  // Pipeline (pre-revenue)
  "target": 1,
  "new_business_pipeline": 2,
  "winback_pipeline": 3,
  "renewal_pipeline": 4,
  "expansion_pipeline": 5,
  // Active customer (has revenue)
  "new": 6,                    // first_year
  "multi_year_shrinking": 7,
  "multi_year_flat": 8,
  "multi_year_growing": 9,
};
```

Note: Both `lapsed` (Fullmind) and `churned` (competitor vendors) are ranked at 0 (same as no data). The materialized view uses `lapsed` for Fullmind and `churned` for Proximity/Elevate/TBT to describe the same business concept -- a district that had revenue in the prior year but not in the current year. Both are treated identically in the classification logic. Transitions *from* or *to* lapsed/churned are handled by explicit rules (Churned bucket, New Customer, New Pipeline) before the rank-based upgrade/downgrade check runs.

**Bucket classification rules (evaluated in order -- first match wins):**

| Bucket | Condition | Color | Description |
|--------|-----------|-------|-------------|
| **Unchanged** | categoryA === categoryB (including both null) | `#E5E7EB` (Gray-200) | No change between FYs |
| **Churned** | categoryA is a customer/pipeline category (rank >= 1), categoryB is `lapsed`/`churned` or `null` | `#F37167` (Coral) | Lost the customer between FY_A and FY_B |
| **New Customer** | categoryA is `null`/`target`/`lapsed`/`churned`/pipeline, categoryB is `new`/`multi_year_*` | `#4ECDC4` (Mint) | Gained a paying customer |
| **New Pipeline** | categoryA is `null`/`lapsed`/`churned`, categoryB is a pipeline category | `#C4E7E6` (Robins Egg) | District entered the pipeline (includes winback from lapsed/churned) |
| **Upgraded** | Both have rank >= 1, rank(categoryB) > rank(categoryA) | `#6EA3BE` (Steel Blue) | Moved to a higher engagement level |
| **Downgraded** | Both have rank >= 1, rank(categoryB) < rank(categoryA), categoryB is not `lapsed`/`churned`/`null` | `#FFCF70` (Golden) | Moved to a lower engagement level |

```typescript
export type TransitionBucket =
  | "churned"
  | "new_customer"
  | "upgraded"
  | "downgraded"
  | "new_pipeline"
  | "unchanged";

export interface TransitionBucketConfig {
  id: TransitionBucket;
  label: string;
  color: string;
  description: string;
}

export const TRANSITION_BUCKETS: TransitionBucketConfig[] = [
  { id: "churned",      label: "Churned",       color: "#F37167", description: "Customer in FY_A, lost in FY_B" },
  { id: "new_customer", label: "New Customer",   color: "#4ECDC4", description: "No revenue in FY_A, paying customer in FY_B" },
  { id: "upgraded",     label: "Upgraded",        color: "#6EA3BE", description: "Higher engagement in FY_B" },
  { id: "downgraded",   label: "Downgraded",      color: "#FFCF70", description: "Lower engagement in FY_B" },
  { id: "new_pipeline", label: "New Pipeline",    color: "#C4E7E6", description: "No data/lapsed/churned in FY_A, pipeline in FY_B" },
  { id: "unchanged",    label: "Unchanged",       color: "#E5E7EB", description: "Same category in both FYs" },
];

export function classifyTransition(
  categoryA: string | null,
  categoryB: string | null,
): TransitionBucket { /* ... */ }
```

### MapLibre Transition Fill Expression (`src/features/map/lib/layers.ts`)

For the changes/diff layer, we need a MapLibre expression that classifies two tile properties (`fullmind_category_a` and `fullmind_category_b`) into transition bucket colors at render time. MapLibre expressions support `case` with boolean conditions, which can encode the classification logic.

```typescript
export function buildTransitionFillExpression(
  vendorId: VendorId,
): ExpressionSpecification {
  const propA = `${VENDOR_CONFIGS[vendorId].tileProperty}_a`;
  const propB = `${VENDOR_CONFIGS[vendorId].tileProperty}_b`;

  const CUSTOMER_CATS = ["new", "multi_year_growing", "multi_year_flat", "multi_year_shrinking"];
  const PIPELINE_CATS = ["target", "new_business_pipeline", "winback_pipeline", "renewal_pipeline", "expansion_pipeline"];
  const NO_DATA_CATS = ["lapsed", "churned"]; // Both treated same as null; Fullmind uses "lapsed", competitors use "churned"

  // The expression uses nested "case" conditions to classify transitions.
  // Rules evaluated in order — first match wins.
  return [
    "case",
    // Unchanged: same category in both (most common — check first for perf)
    ["==", ["coalesce", ["get", propA], ""], ["coalesce", ["get", propB], ""]],
    "#E5E7EB",

    // Churned: had engagement in A (rank >= 1), null/lapsed/churned in B
    ["all",
      ["has", propA],
      ["!", ["in", ["get", propA], ["literal", [...NO_DATA_CATS]]]],
      ["any",
        ["!", ["has", propB]],
        ["in", ["get", propB], ["literal", NO_DATA_CATS]],
      ],
    ], "#F37167",

    // New Customer: null/target/lapsed/churned/pipeline in A, customer category in B
    ["all",
      ["any",
        ["!", ["has", propA]],
        ["in", ["get", propA], ["literal", [...PIPELINE_CATS, ...NO_DATA_CATS]]],
      ],
      ["in", ["get", propB], ["literal", CUSTOMER_CATS]],
    ], "#4ECDC4",

    // New Pipeline: null/lapsed/churned in A, pipeline category in B
    ["all",
      ["any",
        ["!", ["has", propA]],
        ["in", ["get", propA], ["literal", NO_DATA_CATS]],
      ],
      ["in", ["get", propB], ["literal", PIPELINE_CATS]],
    ], "#C4E7E6",

    // ... additional rank-based conditions for upgraded (#6EA3BE) and downgraded (#FFCF70)
    // using nested comparisons on CATEGORY_RANK values

    // Fallback (unchanged or unclassifiable)
    "#E5E7EB",
  ] as unknown as ExpressionSpecification;
}
```

### Side-by-Side Map Synchronization (`src/features/map/components/SideBySideMap.tsx`)

The side-by-side view renders two `MapV2Container` instances. Synchronization uses MapLibre's `move`, `zoom`, `pitch`, and `rotate` events.

```
┌─────────────────────────────┐
│  [FY26]    │    [FY27]      │
│            │                │
│   Map A    │    Map B       │
│  (fy=fy26) │  (fy=fy27)    │
│            │                │
│            │                │
└─────────────────────────────┘
```

Implementation approach:
- Both maps share the same `center`, `zoom`, `bearing`, `pitch` from a shared ref.
- When Map A fires a `move` event, update Map B's camera (and vice versa). Use a `syncing` ref flag to prevent infinite loops. The `syncing` flag is set to `true` before updating the other map's camera, then reset to `false` in a `requestAnimationFrame` callback (not a microtask) to ensure the other map's move handler has time to fire and check the flag.
- The left pane renders `<MapV2Container fyOverride={compareFyA} refKey="primary" />` and the right pane renders `<MapV2Container fyOverride={compareFyB} refKey="secondary" />`. The `refKey` prop ensures each instance writes to its own slot in `mapV2Refs` (see pre-requisite refactoring). The `fyOverride` prop controls the tile source URL.
- `SideBySideMap` accesses both map instances via `mapV2Refs.primary` and `mapV2Refs.secondary` for camera synchronization. It attaches `move`/`zoom`/`pitch`/`rotate` listeners to both and cross-updates using the syncing guard.
- Each pane has a small FY badge in the top-left corner (e.g., "FY26" / "FY27") using brand colors.
- Interaction (click-to-select, tooltip) works on both panes but drives the same store state.
- The FloatingPanel, LayerBubble, and MapSummaryBar remain in their normal positions, overlaying both panes.

### UI Changes

#### LayerBubble Compare Controls

Added below the existing FY selector in the "Sales Data" section:

```
┌─────────────────────────────────────┐
│  Sales Data                   FY26 ▼│
│                                     │
│  ☐ Compare Years                    │  ← New toggle
│  ┌─────────────────────────────┐    │
│  │ [Changes] [Side-by-Side]    │    │  ← Segmented control (visible when toggle ON)
│  │                             │    │
│  │  From: [FY26 ▼]            │    │
│  │  To:   [FY27 ▼]            │    │
│  └─────────────────────────────┘    │
│                                     │
│  Fullmind                           │
│  ☑ Target  ☑ Renewal  ...           │
└─────────────────────────────────────┘
```

When the "Compare Years" toggle is on:
- The existing single FY dropdown becomes disabled (greyed out). The compare FY_A/FY_B dropdowns take over.
- A segmented control lets the user switch between "Changes" and "Side-by-Side" modes.
- Two dropdown selectors appear: "From" (FY_A) and "To" (FY_B).
- **Side-by-side mode**: Engagement filter checkboxes remain fully functional and filter both panes identically, same as normal single-map mode. The existing `buildFilterExpression()` applies to each pane's `fullmind_category` property independently.
- **Changes mode**: Engagement filter checkboxes are **disabled** (greyed out with a tooltip: "Filters disabled in Changes view"). Rationale: (1) the transition layer reads `fullmind_category_a` and `fullmind_category_b` -- there is no single `fullmind_category` property for the existing `buildFilterExpression()` to target; (2) `target` is not included in the default engagement filter set, so target-related transitions (e.g., target in FY_A -> pipeline in FY_B = "New Pipeline") would be silently hidden, producing misleading transition counts; (3) the transition buckets already provide a purpose-built categorization -- layering engagement filters on top adds complexity without clear user value. When the user switches back to side-by-side mode or exits compare mode, the engagement filter checkboxes re-enable with their previous selections preserved.

#### Transition Legend (`src/features/map/components/TransitionLegend.tsx`)

A floating panel displayed only in "Changes" view, positioned below or adjacent to the MapSummaryBar:

```
┌──────────────────────────────────────┐
│  FY26 → FY27 Changes                │
│                                      │
│  ● Churned         142 districts     │
│  ● New Customer     58 districts     │
│  ● Upgraded        203 districts     │
│  ● Downgraded       67 districts     │
│  ● New Pipeline     89 districts     │
│  ○ Unchanged     1,024 districts     │
│                                      │
│  Total: 1,583 districts              │
└──────────────────────────────────────┘
```

Visual spec:
- Same floating card style as MapSummaryBar: `bg-off-white/85 backdrop-blur-md rounded-xl ring-1 ring-plum/[0.06] border border-white/60`
- Shadow: `0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)`
- Positioned: `absolute bottom-6 left-6 z-10` (replaces or stacks above MapSummaryBar)
- Each row: colored dot (10px circle), label in `text-xs font-medium text-plum/70`, count in `text-xs tabular-nums text-plum`
- Unchanged row uses an open circle (stroke only) to visually de-emphasize
- Header shows "FY{A} -> FY{B} Changes" in `text-xs font-semibold text-plum`

#### Side-by-Side FY Badges

Small floating badges in the top-left of each map pane:

- Style: `bg-plum text-white text-[10px] font-bold px-2 py-0.5 rounded-md`
- Content: "FY26" / "FY27"
- Position: `absolute top-3 left-3` within each pane
- A thin vertical divider (`w-px bg-plum/20`) separates the two panes

#### MapSummaryBar in Compare Mode

When compare mode is active:
- **Side-by-side view:** The summary bar shows stats for the `compareFyB` year (the "to" year), since that is the forward-looking data. A small label indicates which FY the stats reflect.
- **Changes view:** The summary bar is replaced by (or supplemented with) the TransitionLegend panel, which shows bucket counts. The normal financial metrics are hidden since they are not meaningful in a diff context.

#### Brand Color Reference

| Token | Hex | Usage in this feature |
|-------|-----|----------------------|
| Coral | `#F37167` | Churned bucket |
| Mint | `#4ECDC4` | New Customer bucket |
| Steel Blue | `#6EA3BE` | Upgraded bucket |
| Golden | `#FFCF70` | Downgraded bucket (avoids conflict with `#FFB347` used for existing `lapsed` category in vendor layers) |
| Robins Egg | `#C4E7E6` | New Pipeline bucket |
| Gray-200 | `#E5E7EB` | Unchanged bucket |
| Plum | `#403770` | Labels, FY badges, text |
| Off-white | `#FFFCFA` | Legend panel background (via backdrop) |

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **Same FY selected for both A and B** | Prevent in UI: "To" dropdown excludes the value selected in "From". If the user manages to set them equal (e.g., loading a saved view), all districts show as "Unchanged" and a subtle warning appears: "Select different fiscal years to see changes." |
| **FY24 comparison (sparse data)** | FY24 categories are degraded (only `target` for plan districts, null otherwise). The diff will show most districts as "Unchanged" (null -> null). The legend reflects this honestly. No special handling needed. |
| **District has null category in both FYs** | Classified as "Unchanged". In changes view these districts render with the gray unchanged color at low opacity, keeping them visible but de-emphasized. |
| **District has category in FY_A but not in FY_B (and not lapsed)** | This happens when a district was in a plan in FY_A but removed from all plans in FY_B. Classified as "Churned" since the district no longer has any engagement. |
| **Competitor vendor comparison** | The transition classification works for any vendor -- the tile API returns `{vendor}_category_a` and `{vendor}_category_b`. The user selects which vendor's transitions to view. Default: Fullmind. |
| **Multiple vendors active in side-by-side** | Each pane renders all active vendor layers, same as normal mode. Each vendor uses its own FY-specific categories from the tile. |
| **Tile loading performance** | When `fy2` is present, the tile includes roughly 2x the category columns. MVT is column-oriented and these are small string values, so the size increase is modest (~15-20% larger tiles). Tile cache keys include `fy2` to avoid stale data. |
| **Browser resize during side-by-side** | Both map instances receive `resize()` calls via a ResizeObserver on the container. The 50/50 split is CSS-based (`grid-cols-2`), so it adapts naturally. |
| **Entering compare mode with existing filters** | Spatial filters (states, owner, plan) are preserved and apply identically to both panes / the diff layer. Engagement filters are preserved in state but **disabled in Changes mode** (see LayerBubble Compare Controls above) -- they re-enable automatically when switching to side-by-side mode or exiting compare mode. Exiting compare mode restores the previous `selectedFiscalYear` and re-enables all filter controls. |
| **Saved views with compare mode** | The `MapViewState` interface gains optional `compareMode`, `compareView`, `compareFyA`, `compareFyB` fields (see MapViewState Serialization Changes above). `getViewSnapshot()` only includes compare fields when `compareMode` is true. `applyViewSnapshot()` restores compare state or clears it (defaults to `compareMode: false`). Loading a compare-mode view re-enters compare mode automatically. Loading a non-compare view while in compare mode exits compare mode. |
| **Pan/zoom sync race condition** | The sync mechanism uses a `syncing` ref flag. When Map A moves, the handler sets `syncing = true`, updates Map B's camera, then sets `syncing = false` in a `requestAnimationFrame` callback. Map B's move handler checks the flag and skips re-syncing if true. |
| **No data for selected FY pair** | If neither FY has any vendor data for the visible area (e.g., FY24 for competitors), the legend shows all zeros. This is correct and informative -- it tells the user there is nothing to compare. |
| **Tooltip in compare mode** | In side-by-side view, each pane reads `fullmind_category` from its own FY tile data and populates the existing `customerCategory` field -- no tooltip changes needed. In changes view, the tooltip handler reads `fullmind_category_a` and `fullmind_category_b` tile properties (via `tooltipPropertyMap`), populates `customerCategoryA` and `customerCategoryB` on `V2TooltipData`, and computes `transitionBucket`. `MapV2Tooltip.tsx` renders: district name, "FY26: [category_a label]", "FY27: [category_b label]", and a colored dot + bucket label (e.g., "Churned"). |
| **Mobile / narrow viewport** | Side-by-side mode requires sufficient width. On screens < 768px wide, side-by-side is disabled (the segmented control option is greyed out with a tooltip: "Wider screen required"). Changes mode works at any width. |

## Testing Strategy

### Unit Tests -- Priority 1 (`src/features/map/lib/__tests__/comparison.test.ts`)

Core transition classification logic. Pure functions, no mocking needed.

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 1 | Customer in A, null in B = Churned | Basic churn detection |
| 2 | Customer in A, lapsed in B = Churned | Lapsed variant of churn (Fullmind) |
| 3 | Customer in A, churned in B = Churned | Churned variant of churn (competitor vendors) |
| 4 | Pipeline in A, null in B = Churned | Pipeline churn (lost before converting) |
| 5 | Null in A, customer category in B = New Customer | New business detection |
| 6 | Target in A, new in B = New Customer | Pipeline-to-customer conversion |
| 7 | Lapsed in A, new in B = New Customer | Winback to customer (Fullmind) |
| 8 | Churned in A, new in B = New Customer | Winback to customer (competitor) |
| 9 | Pipeline in A, multi_year in B = Upgraded | Pipeline-to-revenue upgrade |
| 10 | multi_year_shrinking in A, multi_year_growing in B = Upgraded | Growth improvement |
| 11 | multi_year_growing in A, multi_year_shrinking in B = Downgraded | Growth decline |
| 12 | expansion_pipeline in A, new_business_pipeline in B = Downgraded | Pipeline downgrade |
| 13 | Null in A, pipeline in B = New Pipeline | New pipeline entry |
| 14 | Lapsed in A, pipeline in B = New Pipeline | Winback pipeline from lapsed (Fullmind) |
| 15 | Churned in A, pipeline in B = New Pipeline | Winback pipeline from churned (competitor) |
| 16 | Same category in both = Unchanged | No-op detection |
| 17 | Both null = Unchanged | No data in either FY |
| 18 | CATEGORY_RANK ordering is consistent | Rank values form a valid hierarchy |
| 19 | lapsed and churned both rank 0 (same as no data) | Prevents incorrect upgrade/downgrade for both vendor types |
| 20 | All known categories have a rank (including churned) | No missing entries |
| 21 | classifyTransition handles empty string same as null | Edge case normalization |

### Store Tests -- Priority 1 (`src/features/map/lib/__tests__/store-compare.test.ts`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 22 | enterCompareMode sets defaults correctly | compareFyA is one below selectedFiscalYear, compareView is "changes" |
| 23 | exitCompareMode resets to normal state | compareMode = false, selectedFiscalYear unchanged |
| 24 | setCompareFyA and setCompareFyB update independently | Store state updates correctly |
| 25 | setCompareView toggles between modes | "side_by_side" and "changes" both work |
| 26 | Cannot set compareFyA === compareFyB | Action is a no-op or swaps values |
| 27 | getViewSnapshot includes compare fields when compareMode is true | MapViewState serialization |
| 28 | applyViewSnapshot restores compare mode from saved state | MapViewState deserialization |
| 29 | applyViewSnapshot exits compare mode when saved state has no compare fields | Backwards compatibility |

### API Tests -- Priority 2 (`src/app/api/tiles/[z]/[x]/[y]/__tests__/route-compare.test.ts`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 30 | Tile with fy2 param includes both sets of category columns | MVT contains `_a` and `_b` suffixed properties |
| 31 | Tile without fy2 param returns normal columns (regression) | Existing behavior unchanged |
| 32 | Invalid fy2 value falls back to default | Error handling |
| 33 | isNationalView with fy2 includes districts with data in either FY | Churned districts visible at low zoom |

### API Tests -- Priority 2 (`src/app/api/districts/summary/compare/__tests__/route.test.ts`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 34 | Returns correct bucket counts for known data | End-to-end classification |
| 35 | Respects state filter | Only includes districts in specified states |
| 36 | Respects owner filter | Only includes districts with specified sales_executive |
| 37 | Returns zeros when no vendor data exists | Empty state is handled |
| 38 | Invalid FY params return 400 | Input validation |

### Component Tests -- Priority 2

| # | Test Case | What It Verifies | File |
|---|-----------|-----------------|------|
| 39 | LayerBubble shows compare controls when toggle is on | UI renders correctly | `LayerBubble.test.tsx` |
| 40 | TransitionLegend renders all 6 buckets with counts | Legend displays data | `TransitionLegend.test.tsx` |
| 41 | TransitionLegend shows loading state | Skeleton while fetching | `TransitionLegend.test.tsx` |
| 42 | SideBySideMap renders two map containers | DOM structure | `SideBySideMap.test.tsx` |
| 43 | SideBySideMap displays FY badges | Labels visible | `SideBySideMap.test.tsx` |
| 44 | ComparisonMapShell renders ChangesMap for "changes" view | Conditional rendering | `ComparisonMapShell.test.tsx` |
| 45 | ComparisonMapShell renders SideBySideMap for "side_by_side" view | Conditional rendering | `ComparisonMapShell.test.tsx` |

**Approximate total: 45 test cases across 7-8 test files (21 high-priority unit tests + 8 store tests + 9 API tests + 7 component tests).**

### Manual Testing Checklist

- [ ] Toggle compare mode on/off from LayerBubble -- map switches correctly
- [ ] Side-by-side: pan one pane, the other follows with no visible lag
- [ ] Side-by-side: zoom one pane, the other matches zoom level
- [ ] Changes mode: districts colored by transition buckets
- [ ] Changes mode: legend counts match visible districts
- [ ] Changes mode: tooltip shows both FY categories + bucket
- [ ] Switch between side-by-side and changes while keeping FY selections
- [ ] Apply state filter -- both panes / diff layer respect it
- [ ] Narrow viewport -- side-by-side disabled, changes works
- [ ] Exit compare mode -- map returns to normal single-FY view
- [ ] Existing FY selector dropdown disabled during compare mode
