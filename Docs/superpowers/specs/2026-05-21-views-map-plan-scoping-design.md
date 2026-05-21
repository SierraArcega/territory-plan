# Views Map — Plan Scoping, Highlight & Add-from-Map

**Date:** 2026-05-21
**Status:** Approved (design)
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar`
**Branch:** `worktree-saved-views-sidebar`

## Problem

The Views feature's **Map** tab (`src/features/views/components/views/MapViewContainer.tsx`)
mounts the full global map (`MapV2Container`) as-is, with a banner reading
"Showing all districts — <plan> scoping coming soon." It is not scoped to the
active plan: the plan's districts aren't highlighted, and reps can't add
districts to the plan from the map.

We want, when a rep is viewing a **plan** in the Views feature and opens the Map tab:

1. The plan's districts are **highlighted** over an otherwise-normal map (all
   districts stay visible — explore is the point).
2. The map frames the plan's **territory** on open.
3. Reps can **select** districts on the map and **add** the selection to the
   plan in one commit (select-then-add). The map does **not** remove districts
   (removal stays in the Table/list views).

## Scope

- **v1 = plans only.** When the active Views context is a **list** or the
  portfolio (no single active plan), none of this applies — the map renders as
  it does today and the "Showing all districts" banner logic is unchanged.
- **Add only on the map.** No remove affordance on the map.
- **All districts remain visible**; in-plan districts are emphasized, not
  isolated. We deliberately do **not** use the existing `filterPlanId`
  mechanism (it *hides* non-plan districts) nor `focusPlan` (it commandeers the
  global filter state).

## Decisions (locked with the user)

| Question | Decision |
|---|---|
| Add interaction | **Select then add** — accumulate a selection, commit with a button |
| Map removal | **No** — add only; removal stays in Table/list |
| What's shown | **All districts, plan ones highlighted** |
| Implementation approach | **Views-native selection bar** (not the global PLAN_ADD side panel, not a full prop-threaded refactor) |
| Already-in-plan districts | **Not selectable** — clicking one is a no-op; the bar's count excludes them |
| Territory framing | **Camera-only `fitBounds`** to the plan's states (no filter changes) |

## Existing building blocks (reuse)

- `useAddDistrictsToPlan()` — `src/features/plans/lib/queries.ts:108` (also via
  `@/lib/api`). Bulk add: `POST /api/territory-plans/[id]/districts` with
  `{ leaids: string[] }`. Server expands rollups, syncs tags + plan rollups.
- Always-on multi-select in the embedded map: a click calls
  `toggleLeaidSelection(leaid)` (set `selectedLeaids`) — `MapV2Container` click
  handler, "Priority 6: District base fill" (~lines 1226–1260). It also calls
  `openResultsPanel("districts")` and zoom-to-district, which we will suppress
  in plan-map context.
- `clearSelectedDistricts()` — `store.ts:806`, clears `selectedLeaids`.
- `STATE_BBOX` (exported from `MapV2Container.tsx:56`) + the combined-bbox
  computation in `PlanOverviewSection.handleFocusMap` (`PlanOverviewSection.tsx:133–158`)
  — mirror for camera framing.
- Plan-plum brand color: `plans: "#7B6BA4"` (`layers.ts:18`); exact fill/outline
  tokens per `Documentation/UI Framework/tokens.md`.
- Views data query key `["views", "data"]`; plan-stats query that feeds
  `GroupHeader` (pipeline coverage / contacts / open opps).

## Architecture

A new **isolated store slice** carries the Views→map binding; everything else
keys off it. The slice is intentionally separate from the existing
`planDistrictLeaids` / PLAN_ADD machinery so the two flows don't entangle.

### 1. Store slice — `viewsPlanContext` (`src/features/map/lib/store.ts`)

```ts
viewsPlanContext: {
  planId: string | null;
  highlightLeaids: Set<string>;  // the plan's saved districts (for highlight + "in plan" test)
};
setViewsPlanContext(planId: string, highlightLeaids: Set<string>): void;
clearViewsPlanContext(): void;
addToViewsHighlight(leaids: string[]): void; // optimistic, after a successful add
```

- Default: `{ planId: null, highlightLeaids: new Set() }`.
- Setting/clearing is a single `set()` (batched per CLAUDE.md perf rule).

### 2. Highlight layers (`src/features/map/lib/layers.ts` + `MapV2Container`)

- Add `views-plan-highlight-fill` and `views-plan-highlight-outline`, ordered
  **above** the base district fill.
- Filter: `["in", ["get", "leaid"], ["literal", [...highlightLeaids]]]`. Plan
  district counts are bounded (tens–low hundreds), so a literal-list filter is
  fine.
- Paint: translucent plan-plum fill (~18–25% opacity) + solid ~2px plan-plum
  outline. Final values from `tokens.md`.
- `MapV2Container` registers these layers and updates their filter when
  `viewsPlanContext.highlightLeaids` changes (subscribe to that narrow slice).
  Driven by the **client-side** set so newly-added districts highlight
  immediately after commit.

### 3. Click handling in plan-map context (`MapV2Container` click handler)

In the "Priority 6: District base fill" branch, before the existing
toggle/open/zoom block, add (~6 lines):

```ts
if (store.viewsPlanContext.planId) {
  if (store.viewsPlanContext.highlightLeaids.has(leaid)) return; // already in plan → no-op
  store.toggleLeaidSelection(leaid);  // selection only — no results panel, no zoom
  return;
}
```

This is the bounded change that keeps the embedded map's default chrome from
firing inside the Views tab.

### 4. `MapViewContainer.tsx`

- New prop `planId: string | null` (alongside existing `leaids`, `contextLabel`).
  The parent passes the active plan's id, its district leaids, and its state
  abbrevs (parent already has the active-plan object).
- On mount / when `planId` changes and is non-null:
  - `setViewsPlanContext(planId, new Set(leaids))`.
  - Compute combined bbox from the plan's state abbrevs via `STATE_BBOX` and
    `map.fitBounds(...)` (camera only — **no** filter mutation).
  - Render `<PlanMapSelectionBar planId={planId} />`.
- On unmount / `planId` → null: `clearViewsPlanContext()` (cleanup per CLAUDE.md).
- The legacy "Showing all districts … scoping coming soon" banner is removed for
  the plan case (the feature now scopes the map). The null-`planId` path
  (lists / portfolio) is unchanged.

### 5. `PlanMapSelectionBar.tsx` (new — `src/features/views/components/views/`)

- Fullmind-branded floating bar, bottom-center of the map canvas, above zoom
  controls / attribution.
- Subscribes narrowly to `selectedLeaids` and `viewsPlanContext.highlightLeaids`.
- Computes `toAdd = selectedLeaids \ highlightLeaids` (exclude already-in-plan).
- Visible only when `toAdd.length > 0`.
- Renders: **"{N} district(s) selected"** · **[Add to plan]** · **[Clear]**.
- **Add to plan** → `useAddDistrictsToPlan().mutateAsync({ planId, leaids: toAdd })`:
  - On success: `addToViewsHighlight(toAdd)` (instant highlight),
    `clearSelectedDistricts()`, and `invalidateQueries(["views","data"])` +
    invalidate the plan-stats query (so the grid + GroupHeader refresh).
  - While pending: button disabled + spinner; bar stays visible (never hide UI).
  - On error: inline error text; selection preserved for retry.
- **Clear** → `clearSelectedDistricts()`.

## Data flow

```
open Map tab (plan active)
  └─ MapViewContainer: setViewsPlanContext(planId, planLeaids) + fitBounds(territory)
        └─ highlight layers paint planLeaids
click district (not in plan)
  └─ toggleLeaidSelection  → selectedLeaids grows  → bar shows "N selected"
[Add to plan]
  └─ POST /territory-plans/[id]/districts {leaids: toAdd}
        ├─ addToViewsHighlight(toAdd)         (optimistic highlight)
        ├─ clearSelectedDistricts()
        └─ invalidate ["views","data"] + plan-stats  → grid + GroupHeader refresh
close tab / change plan
  └─ clearViewsPlanContext()
```

## Edge cases

- **No active plan** (list / portfolio): no context set, no bar, map unchanged.
- **Plan with zero districts**: highlight matches nothing; `fitBounds` falls back
  to US bounds when no valid state bbox.
- **Select an in-plan district**: ignored (no-op), excluded from the count.
- **Add fails**: selection retained, inline error, no highlight change.
- **Rollup leaids**: server already expands rollups → children; the optimistic
  highlight may briefly differ from server truth, reconciled on the
  `["views","data"]`/plan refetch.

## Testing

- **`PlanMapSelectionBar`** (Vitest + Testing Library):
  - Hidden when no selectable districts; visible with count = selected minus in-plan.
  - Add commits `mutateAsync` with exactly `toAdd` leaids and the active planId.
  - On success: clears selection, calls highlight-add, invalidates the two keys.
  - Disabled + spinner while pending; inline error on failure with selection kept.
- **Store slice**: `setViewsPlanContext` / `clearViewsPlanContext` /
  `addToViewsHighlight` behavior; click ignores in-plan leaids when context active.
- **Layer config**: highlight filter expression includes the highlight set and
  is ordered above the base fill.

## Out of scope (v1)

- Map-based removal from a plan.
- Box / lasso / marquee selection (selection stays click-to-toggle / shift-click).
- Plan scoping for **lists** and the portfolio map.
- Setting per-district targets at add time (added with null targets; targets are
  edited later in the Table view).
- Threading scope as props into `MapV2Container` (the deferred full embedded-mode
  refactor).
