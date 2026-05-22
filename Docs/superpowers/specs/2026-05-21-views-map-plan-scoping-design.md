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
- The embedded map's click handler ("Priority 6: District base fill",
  `MapV2Container` ~lines 1226–1260) calls `toggleLeaidSelection` +
  `openResultsPanel("districts")` + zoom-to-district. We **do not** reuse
  `toggleLeaidSelection`/`selectedLeaids`: that set has a **hard cap of 20**
  (`store.ts` ~782) and mutates global `panelState`/`activeIconTab`, which would
  cap adds and churn the embedded map's panels. Instead we add a **dedicated,
  uncapped selection set** in the new slice and branch the click handler.
- District tiles: `source: "districts"`, `source-layer: "districts"`; features
  carry `leaid`. Base fill `district-base-fill` excludes rollups via
  `NOT_ROLLUP_FILTER` (`layers.ts`). Highlight layers mirror this source +
  `NOT_ROLLUP_FILTER`.
- `STATE_BBOX` (exported from `MapV2Container.tsx:56`). `PlanWithStats` has **no**
  `states` field — derive state abbrevs from each leaid's first-2-char FIPS via
  `fipsToAbbrev` (`src/lib/states.ts:84`), then union `STATE_BBOX` per abbrev for
  the camera bbox.
- Brand tokens (`Documentation/UI Framework/tokens.md`): Plum `#403770`
  (in-plan highlight), Coral `#F37167` (pending-selection highlight).
- Views data query key `["views", "data"]`; plan-stats query that feeds
  `GroupHeader` (pipeline coverage / contacts / open opps).

## Architecture

A new **isolated store slice** carries the Views→map binding; everything else
keys off it. The slice is intentionally separate from the existing
`planDistrictLeaids` / PLAN_ADD machinery so the two flows don't entangle.

### 1. Store fields — flat, isolated (`src/features/map/lib/store.ts`)

Flat fields (matching the store's existing `selectedLeaids: Set` / `planDistrictLeaids: Set` style) so components subscribe to the narrowest slice:

```ts
viewsPlanId: string | null;              // active Views plan, or null (no scoping)
viewsPlanHighlightLeaids: Set<string>;   // the plan's saved districts → plum highlight + "in plan" test
viewsPlanSelectedLeaids: Set<string>;    // pending-to-add (clicked, not yet committed) → coral highlight

setViewsPlanContext(planId: string, highlightLeaids: Set<string>): void; // single set(): sets id+highlight, clears selection
clearViewsPlanContext(): void;            // resets all three to null/empty
toggleViewsPlanSelection(leaid: string): void; // uncapped; no-op if leaid ∈ highlight set
clearViewsPlanSelection(): void;
addToViewsPlanHighlight(leaids: string[]): void; // optimistic, after a successful add
```

- Defaults: `viewsPlanId: null`, both sets empty.
- `toggleViewsPlanSelection` ignores leaids already in `viewsPlanHighlightLeaids`
  (in-plan = not selectable). No 20-cap; does **not** touch `panelState`/`activeIconTab`.
- Each action is a single `set()` (batched per CLAUDE.md perf rule).

### 2. Highlight layers (`src/features/map/lib/layers.ts` + `MapV2Container`)

Two layer pairs over the base district fill, each `source: "districts"`,
`source-layer: "districts"`:

- **In-plan (plum):** `views-plan-highlight-fill` (fill `#403770` @ ~0.22) +
  `views-plan-highlight-outline` (line `#403770` @ 2px). Filter:
  `["all", NOT_ROLLUP_FILTER, ["in", ["get","leaid"], ["literal", [...highlightLeaids]]]]`.
- **Pending selection (coral):** `views-plan-selection-fill` (fill `#F37167` @
  ~0.18) + `views-plan-selection-outline` (line `#F37167` @ 2.5px). Filter:
  same shape over `viewsPlanSelectedLeaids`.

Plan district counts and the selection are bounded (tens–low hundreds), so
literal-list filters are fine. `MapV2Container` registers the four layers once
(after the base fill / rollup outline) and updates each layer's filter
reactively via `setFilter` when its set changes (subscribe to each narrow
slice). Driven by the **client-side** sets so clicks and newly-added districts
re-paint immediately.

### 3. Click handling in plan-map context (`MapV2Container` click handler)

In the "Priority 6: District base fill" branch, before the existing
toggle/open/zoom block, add (~5 lines):

```ts
if (store.viewsPlanId) {
  store.toggleViewsPlanSelection(leaid); // no-op for in-plan; selection only — no results panel, no zoom
  store.addClickRipple(e.point.x, e.point.y, "plum"); // keep the existing tactile feedback
  return;
}
```

This is the bounded change that keeps the embedded map's default chrome from
firing inside the Views tab.

### 4. `MapViewContainer.tsx`

- New prop `planId: string | null` (alongside existing `leaids`, `contextLabel`).
  `GroupCanvas` passes `kind === "plan" ? plan.id : null` and the existing
  `leaids` (= `plan.districtLeaids`).
- On mount / when `planId` changes and is non-null:
  - `setViewsPlanContext(planId, new Set(leaids ?? []))`.
  - Derive state abbrevs from `leaids` (each leaid's first 2 chars → `fipsToAbbrev`),
    union `STATE_BBOX` per abbrev, and `map.fitBounds(...)` (camera only — **no**
    filter mutation). Fall back to `US_BOUNDS` when no valid bbox.
  - Render `<PlanMapSelectionBar planId={planId} />`.
- On unmount / `planId` → null: `clearViewsPlanContext()` (cleanup per CLAUDE.md).
- The legacy "Showing all districts … scoping coming soon" banner is removed for
  the plan case (the feature now scopes the map). The null-`planId` path
  (lists / portfolio) is unchanged.

### 5. `PlanMapSelectionBar.tsx` (new — `src/features/views/components/views/`)

- Fullmind-branded floating bar, bottom-center of the map canvas, above zoom
  controls / attribution.
- Subscribes narrowly to `viewsPlanSelectedLeaids`. `toggleViewsPlanSelection`
  already excludes in-plan leaids, so the set is exactly the pending adds.
- Visible only when `viewsPlanSelectedLeaids.size > 0`.
- Renders: **"{N} district(s) selected"** · **[Add to plan]** · **[Clear]**.
- **Add to plan** → `useAddDistrictsToPlan().mutateAsync({ planId, leaids: [...viewsPlanSelectedLeaids] })`:
  - On success: `addToViewsPlanHighlight([...selected])` (instant plum highlight),
    `clearViewsPlanSelection()`, and `invalidateQueries(["views","data"])` +
    `invalidateQueries(["views","plans"])` + `invalidateQueries(["views","plan", planId])`
    (so the grid + GroupHeader stats refresh).
  - While pending: button disabled + spinner; bar stays visible (never hide UI).
  - On error: inline error text; selection preserved for retry.
- **Clear** → `clearViewsPlanSelection()`.

## Data flow

```
open Map tab (plan active)
  └─ MapViewContainer: setViewsPlanContext(planId, planLeaids) + fitBounds(territory)
        └─ highlight layers paint planLeaids
click district (not in plan)
  └─ toggleViewsPlanSelection → viewsPlanSelectedLeaids grows (coral) → bar "N selected"
[Add to plan]
  └─ POST /territory-plans/[id]/districts {leaids: [...selected]}
        ├─ addToViewsPlanHighlight([...selected])   (optimistic plum highlight)
        ├─ clearViewsPlanSelection()
        └─ invalidate ["views","data"] + ["views","plans"] + ["views","plan",id]
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
