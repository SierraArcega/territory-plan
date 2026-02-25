# Flippable Plan Cards with Donut Summary

**Date:** 2026-02-24
**Status:** Draft

## Problem Statement

Territory plans are the central organizing unit for sales reps -- each plan groups districts, targets, activities, and tasks for a fiscal year. Today, plans appear in two home surfaces:

1. **HomePanel** (map sidebar home tab) -- a flat list of one-line items showing only color dot, plan name, and district count. No visual signal of what kind of work each plan represents or how the targeted dollars break down.
2. **HomeView** (full-page home) -- a 2-column grid of small cards showing a color swatch, name, and district count. Slightly better, but still no target summary or owner context.

Sales leadership regularly asks "how much of Plan X is renewal vs new business?" and "which plans belong to whom?" Answering either question requires clicking into each plan individually. With 5-10 plans per rep per fiscal year, this is tedious.

**Who benefits:** Sales reps and managers who need at-a-glance plan health from the home screen. Why now: denormalized rollup columns (`renewal_rollup`, `expansion_rollup`, `winback_rollup`, `new_business_rollup`) were added to the `territory_plans` table recently but are not yet surfaced anywhere in the UI.

## Proposed Solution

Replace the plan items in HomePanel and HomeView with larger **flippable cards**. Each card has two faces:

**Front face** shows the plan name, a proportional donut chart breaking down targeted dollar amounts by type (renewal, expansion, win back, new business), district count, and the owner avatar + name. This gives the at-a-glance "what is this plan about?" answer.

**Back face** shows secondary details: plan description, date range, states covered, status badge, task progress bar, and total enrollment. A small flip icon in the card corner triggers the flip animation; clicking anywhere else on the card navigates to the plan (preserving current behavior).

Above the card grid, **owner avatar chips** allow filtering plans to a specific owner, and a **sort dropdown** lets the user order by name, date modified, district count, or total target. Both controls appear on both surfaces (sidebar and full-page), sized appropriately for each context.

No data model changes are needed -- the rollup columns already exist. The API response just needs to include them. The proportional donut is a new lightweight SVG component (not Recharts) since it only needs 4 static arcs with no interactivity.

## Technical Design

### Affected Files

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/territory-plans/route.ts` | **Modify** | Add `renewalRollup`, `expansionRollup`, `winbackRollup`, `newBusinessRollup` to both the **GET** response (by selecting the columns from the plan model) and the **POST** response (hardcoded to `0` for a newly created plan with no districts). |
| `src/features/shared/types/api-types.ts` | **Modify** | Add the 4 rollup fields to the `TerritoryPlan` interface. |
| `src/features/plans/components/FlippablePlanCard.tsx` | **Create** | New component: flippable card with front/back faces, CSS 3D flip animation, proportional donut, and owner display. **Note:** coexists with the existing `src/features/plans/components/PlanCard.tsx`, which is used by `PlansView.tsx` for the full-page plans list and is not modified by this feature. The two components serve different surfaces. |
| `src/features/plans/components/ProportionalDonut.tsx` | **Create** | Lightweight SVG donut that renders up to 4 colored arc segments proportionally. No Recharts dependency. |
| `src/features/plans/components/PlanCardFilters.tsx` | **Create** | Owner avatar chip row + sort dropdown. Derives unique owners from the plans array. |
| `src/app/globals.css` | **Modify** | Add `--color-sage: #8AA891` to the CSS custom properties block alongside the other brand colors. Sage is already used in 40+ files as a de-facto brand color but has not been formally registered as a CSS variable or Tailwind theme token. |
| `src/features/map/components/panels/HomePanel.tsx` | **Modify** | Replace the plan list section (lines 493-551) with a grid of `FlippablePlanCard` components, preceded by `PlanCardFilters`. Cards are compact (sidebar-sized). |
| `src/features/shared/components/views/HomeView.tsx` | **Modify** | Replace the "My Plans" grid section (lines 464-513) with `FlippablePlanCard` components, preceded by `PlanCardFilters`. Cards are larger (full-page-sized). |
| `src/features/plans/components/__tests__/FlippablePlanCard.test.tsx` | **Create** | Unit tests for the flippable card component. |
| `src/features/plans/components/__tests__/ProportionalDonut.test.tsx` | **Create** | Unit tests for the proportional donut SVG. |
| `src/features/plans/components/__tests__/PlanCardFilters.test.tsx` | **Create** | Unit tests for the filter/sort controls. |

### Data Model Changes

None. The denormalized rollup columns already exist on `territory_plans`:

```prisma
renewalRollup     Decimal  @default(0) @map("renewal_rollup") @db.Decimal(15, 2)
expansionRollup   Decimal  @default(0) @map("expansion_rollup") @db.Decimal(15, 2)
winbackRollup     Decimal  @default(0) @map("winback_rollup") @db.Decimal(15, 2)
newBusinessRollup Decimal  @default(0) @map("new_business_rollup") @db.Decimal(15, 2)
```

These are synced by `src/features/plans/lib/rollup-sync.ts` whenever districts or targets change. No migration needed.

### API Changes

**Modified:** `GET /api/territory-plans` and `POST /api/territory-plans`

Add 4 fields to each plan object in the response:

```ts
{
  // ... existing fields ...
  renewalRollup: number;      // sum of renewal targets across all districts
  expansionRollup: number;    // sum of expansion targets
  winbackRollup: number;      // sum of winback targets
  newBusinessRollup: number;  // sum of new business targets
}
```

**GET handler implementation:** In `src/app/api/territory-plans/route.ts`, the `plans` query already selects from `prisma.territoryPlan.findMany()`. Add the 4 rollup columns to the `select` (they are top-level model fields, no join needed). Prisma returns `Decimal` objects for these fields, which serialize to strings in JSON -- convert explicitly via `Number(plan.renewalRollup)` etc., matching the existing pattern in `src/app/api/territory-plans/[id]/route.ts` lines 80-83 where `Number(pd.renewalTarget)` is used.

**POST handler implementation:** The POST response (lines 189-211 of the same file) also returns a `TerritoryPlan`-shaped object. A newly created plan has no districts, so all rollups are zero. Add `renewalRollup: 0, expansionRollup: 0, winbackRollup: 0, newBusinessRollup: 0` to the response literal.

### UI Changes

#### ProportionalDonut (`src/features/plans/components/ProportionalDonut.tsx`)

A pure SVG component that renders a multi-segment donut showing the proportional breakdown of up to 4 target types.

```tsx
interface ProportionalDonutProps {
  segments: Array<{
    value: number;
    color: string;
    label: string;
  }>;
  size?: number;         // diameter in px (default 40 for sidebar, 56 for full-page)
  strokeWidth?: number;  // ring thickness (default 5 for sidebar, 7 for full-page)
}
```

Visual behavior:
- SVG with a gray track circle (`#f0f0f0`) as background
- Colored arc segments drawn with `stroke-dasharray` + `stroke-dashoffset`, one `<circle>` per non-zero segment
- Segments start at 12 o'clock (`transform: rotate(-90deg)`) and flow clockwise
- `strokeLinecap="butt"` (not round) so adjacent segments meet cleanly
- When total value is 0 (no targets set), show the empty gray ring only
- No animation -- static render for simplicity in a card grid

Segment colors (consistent with existing brand palette):
| Type | Color | Hex | Notes |
|------|-------|-----|-------|
| Renewal | Sage | `#8AA891` | De-facto brand color used in 40+ files (status badges, task cards, etc.) but not yet in CSS custom properties. This feature adds `--color-sage: #8AA891` to `globals.css`. |
| Expansion | Steel Blue | `#6EA3BE` | Existing brand variable `--color-steel-blue` |
| Win Back | Coral | `#F37167` | Existing brand variable `--color-coral` |
| New Business | Plum | `#403770` | Existing brand variable `--color-plum` |

#### FlippablePlanCard (`src/features/plans/components/FlippablePlanCard.tsx`)

```tsx
interface FlippablePlanCardProps {
  plan: TerritoryPlan;
  variant: "compact" | "full";  // compact = sidebar, full = full-page HomeView
  onNavigate: (planId: string) => void;
}
```

**Card structure:**

The card uses CSS 3D transforms for the flip effect. A `flipped` state boolean toggles a `rotateY(180deg)` transform on the inner container. Both faces are absolutely positioned; the back face has `rotateY(180deg)` applied so its content reads correctly when flipped.

```
Container (perspective: 800px)
  Inner (transition: transform 0.5s, transform-style: preserve-3d)
    Front Face (backface-visibility: hidden)
    Back Face  (backface-visibility: hidden, rotateY(180deg))
```

**Front face layout:**

```
+---------------------------------------+
|  [color bar 3px left edge]            |
|                                       |
|  [ProportionalDonut]   Plan Name   [flip icon] |
|                         12 districts  |
|                         [avatar] Owner Name    |
|                                       |
+---------------------------------------+
```

- `compact` variant: card is ~full sidebar width, donut is 40px, text is `text-xs`/`text-[11px]`
- `full` variant: card width determined by grid, donut is 56px, text is `text-sm`/`text-xs`
- The left edge has a 3px rounded color bar using `plan.color`
- Plan name truncates with `truncate` class
- District count: `{plan.districtCount} district(s)` in gray
- Owner: small avatar circle (initials fallback if no `avatarUrl`) + name in `text-gray-500`
- Flip icon: a small SVG in the top-right corner. On hover, rotates slightly as affordance. Clicking it calls `setFlipped(!flipped)` and stops propagation.
- Clicking anywhere else on the card calls `onNavigate(plan.id)`

**Back face layout:**

```
+---------------------------------------+
|  [color bar 3px left edge]            |
|                                  [flip icon] |
|  Status: [badge]   FY27               |
|  Description (2-line clamp)           |
|  States: TX, CA, FL                   |
|  Dates: Jul 1 - Dec 31               |
|  Enrollment: 45.2K students           |
|  Tasks: [progress bar] 3/8           |
|                                       |
+---------------------------------------+
```

- Same flip icon in top-right, clicking flips back to front
- Status badge uses the same styling as `PlansListPanel` (`STATUS_STYLE` map)
- Description clamps to 2 lines (`line-clamp-2`)
- States listed as abbreviations, truncated if many
- Task progress bar matches the existing `PlansListPanel` pattern (thin bar + count)
- If no description/dates/tasks, those rows simply don't render (no empty placeholders)

**Brand colors used:**
| Token | Hex | Usage |
|-------|-----|-------|
| Plum | `#403770` | Plan name text, FY badge bg, New Business donut segment |
| Coral | `#F37167` | Win Back donut segment, "New plan" button hover |
| Steel Blue | `#6EA3BE` | Expansion donut segment |
| Sage | `#8AA891` | Renewal donut segment, "Working" status. Formalized as `--color-sage` in `globals.css` by this feature. |
| Off-white | `#FFFCFA` | Page background (inherited) |
| Card bg | `#FFFFFF` | Card background |

#### PlanCardFilters (`src/features/plans/components/PlanCardFilters.tsx`)

```tsx
interface PlanCardFiltersProps {
  plans: TerritoryPlan[];
  selectedOwnerId: string | null;
  onOwnerChange: (ownerId: string | null) => void;
  sortBy: PlanSortKey;
  onSortChange: (sort: PlanSortKey) => void;
  variant: "compact" | "full";
}

type PlanSortKey = "updated" | "name" | "districts" | "totalTarget";
```

**Owner avatar chips:**
- Derives unique owners from the plans array (deduplicating by `owner.id`)
- Renders a horizontal scrollable row of small circular avatar chips
- Each chip: avatar image (or initials fallback), border highlight when selected
- An "All" chip at the start clears the filter
- `compact` variant: avatars are 24px, single row with horizontal scroll
- `full` variant: avatars are 28px, wraps if needed

**Sort dropdown:**
- A small `<select>` or custom dropdown to the right of the avatar chips
- Options: "Recently updated" (default), "Name A-Z", "Most districts", "Largest target"
- `compact` variant: icon-only trigger with dropdown
- `full` variant: text label + dropdown

**Filter/sort state** is managed by the parent component (HomePanel or HomeView) via `useState`. The filtered + sorted plans array is computed with `useMemo`.

#### HomePanel Integration

Replace the plan list section (lines 493-551 of `HomePanel.tsx`):

**Before:**
```
Plans header + count
space-y-0.5 list of one-line buttons
New plan button
```

**After:**
```
Plans header + count
PlanCardFilters (compact variant)
space-y-2 grid of FlippablePlanCard (compact variant)
New plan button (unchanged)
```

The `fyPlans` filter (already in place, line 51-54) continues to work -- `PlanCardFilters` operates on the already-FY-filtered array.

#### HomeView Integration

Replace the "My Plans" section (lines 464-513 of `HomeView.tsx`):

**Before:**
```
My Plans header + "View all" link
2-column grid: Create plan button + plan tile buttons
```

**After:**
```
My Plans header + "View all" link
PlanCardFilters (full variant)
2-column (md) / 3-column (lg) grid of FlippablePlanCard (full variant)
Create plan dashed button (moved to first grid position, unchanged style)
```

The "View all" link still navigates to the Plans tab. The create button is the first item in the grid (before the cards), matching the current pattern.

**Navigation pattern note:** HomeView uses `window.history.pushState` + `window.dispatchEvent(new PopStateEvent("popstate"))` to navigate to a plan (setting `?tab=plans&plan={id}` in the URL so `page.tsx` reads both params). The `FlippablePlanCard`'s `onNavigate` callback in HomeView must wrap this same `pushState`/`popstate` pattern rather than using a simple route push. In HomePanel, the existing `viewPlan(plan.id)` store action is used instead -- each parent provides its own navigation callback to `onNavigate`.

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **All rollups are 0** (no targets set on any district) | ProportionalDonut shows empty gray ring. Front face still shows plan name, district count, and owner. |
| **Only one target type has a value** | Donut shows a single full-color ring (100% of that type). |
| **Plan has no owner** | Owner row on front face shows "Unassigned" in gray italic. Avatar chip row omits null owners; "All" chip is always present. |
| **Plan has no description, dates, states, or tasks** | Back face renders only the fields that have data. At minimum: status badge + FY. The card back is shorter than cards with full data -- that is fine, the flip still works. |
| **Extremely long plan name** | Truncated with `truncate` class on both front and back faces. |
| **Many plans (10+)** | HomePanel sidebar scrolls naturally (it already has `overflow-y-auto` on the parent). HomeView full-page wraps into additional grid rows. No pagination needed -- territory plans are typically <20 per user. |
| **Many unique owners (5+)** | Avatar chip row scrolls horizontally in compact variant. Wraps in full variant. |
| **Plans loading** | Show skeleton cards (same dimensions as FlippablePlanCard) with animated pulse. 2-3 skeletons in sidebar, 4-6 on full-page. |
| **Plans API error** | Show existing error state -- no change to error handling. |
| **Empty state (0 plans for selected FY)** | Preserve existing empty state messaging ("No plans for FY{XX}"). |
| **Flip state is per-card** | Each card manages its own `flipped` boolean. Flipping one card does not affect others. |
| **Keyboard accessibility** | Flip icon is a `<button>` with `aria-label="Show plan details"` / `"Show plan summary"`. Card itself is a `<button>` (or clickable `<div>` with `role="button"` and `tabIndex={0}`). Both are keyboard-focusable and activatable with Enter/Space. |
| **Touch devices** | Flip icon tap works the same as click. No hover-dependent behavior. |
| **CSS 3D transform support** | All modern browsers support `perspective`, `transform-style: preserve-3d`, and `backface-visibility: hidden`. No fallback needed (the app already requires modern browsers for MapLibre GL). |
| **Rollup values are stale** | Rollup sync runs on every district add/remove/target change. If a rollup is somehow stale, the donut will show slightly outdated proportions -- acceptable since the user will see correct values when they open the plan. |

## Testing Strategy

### Unit Tests -- ProportionalDonut (`src/features/plans/components/__tests__/ProportionalDonut.test.tsx`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 1 | Renders SVG with correct dimensions | `size` prop maps to SVG width/height |
| 2 | Empty ring when total is 0 | Only the gray track circle renders, no colored segments |
| 3 | Single segment fills entire ring | When only one type has a value, one colored circle with full circumference offset |
| 4 | Multiple segments render correct number of circles | 4 non-zero values produce 4 colored `<circle>` elements |
| 5 | Segment proportions are correct | Given values [100, 200, 50, 150], the dasharray offsets correspond to 20%, 40%, 10%, 30% of circumference |
| 6 | Segments use correct colors | Each circle's `stroke` matches the corresponding segment color |
| 7 | Custom size and strokeWidth apply | Passing `size={80}` and `strokeWidth={10}` produces correct SVG dimensions and circle radii |

### Unit Tests -- FlippablePlanCard (`src/features/plans/components/__tests__/FlippablePlanCard.test.tsx`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 8 | Front face renders plan name and district count | Text content matches plan data |
| 9 | Front face renders owner name | Owner fullName appears on front face |
| 10 | Front face renders "Unassigned" when no owner | Null owner shows fallback text |
| 11 | Clicking flip icon toggles to back face | After click, back face content is visible (via `rotateY` class change) |
| 12 | Clicking flip icon on back returns to front | Double-click flip icon returns to initial state |
| 13 | Clicking card body calls onNavigate | Click on front face (not flip icon) fires `onNavigate` with plan ID |
| 14 | Clicking card body does NOT flip | Click on card body does not toggle `flipped` state |
| 15 | Back face shows status badge | Status text appears in back face content |
| 16 | Back face shows description (clamped) | Description text is present |
| 17 | Back face hides description when null | No description element when `plan.description` is null |
| 18 | Compact variant uses smaller donut | Donut SVG has `width={40}` |
| 19 | Full variant uses larger donut | Donut SVG has `width={56}` |
| 20 | Flip icon has correct aria-label | `aria-label` toggles between "Show plan details" and "Show plan summary" |

### Unit Tests -- PlanCardFilters (`src/features/plans/components/__tests__/PlanCardFilters.test.tsx`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 21 | Renders "All" chip always | "All" chip is present regardless of owner data |
| 22 | Renders one chip per unique owner | Given 3 plans with 2 unique owners, renders 3 chips (All + 2 owners) |
| 23 | Deduplicates owners across plans | Two plans with same owner produce one owner chip |
| 24 | Clicking owner chip calls onOwnerChange | Click fires callback with owner ID |
| 25 | Clicking "All" chip calls onOwnerChange(null) | Clears the filter |
| 26 | Selected owner chip has highlight styling | Active chip has ring/border treatment |
| 27 | Sort dropdown renders all options | 4 sort options present in dropdown |
| 28 | Changing sort calls onSortChange | Selecting "Name A-Z" fires callback with `"name"` |

### Integration Tests -- HomePanel (`src/features/map/components/panels/__tests__/HomePanel.test.tsx`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 29 | Plan cards render when plans exist for selected FY | FlippablePlanCard components appear in DOM |
| 30 | Owner filter reduces visible cards | Selecting an owner hides plans from other owners |
| 31 | Sort changes card order | Switching to "Name A-Z" reorders cards alphabetically |
| 32 | Empty state shows when no plans for FY | "No plans" message renders when `fyPlans` is empty |

**Approximate total: 32 test cases across 4 test files (7 donut + 13 card + 8 filter + 4 integration).**

No API route tests needed -- the only API change is adding 4 existing columns to a SELECT, which is covered by the existing route structure. If desired, a lightweight smoke test for the response shape can be added as follow-up.
