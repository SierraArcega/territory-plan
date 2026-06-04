# Copilot: query → districts on the map

**Date:** 2026-05-27
**Branch:** `feat/ai-copilot-core-objects`
**Status:** Approved design, pending implementation plan

## Context

The AI Copilot already answers open-ended questions by running read-only SQL
and rendering a result table in its panel. We briefly built a *filter-based*
"map view" capability (create a saved view from a description; load one by
name), but in testing it proved too limiting: a rep's real ask — e.g. *"the
Iowa districts in my plan that'd be a good fit for tutoring"* — is a **data
selection**, not a filter combination, and a map view's coarse filters
(state, vendor, signal, …) can't express it.

The decision: **drop the Copilot's filter-based map views entirely** and make
the Copilot behave like the query tool — ask any open-ended question
*regardless of the map's current filters*, and **see the matching districts
displayed on the map** (plus listed in chat). The map reacts to the answer
automatically; no filter-building, no save step, no confirm click.

This replaces, not extends, the earlier work.

## Goal / behavior

> Rep: "show me Iowa districts in my plan that'd be a good fit for tutoring"
> → Copilot answers, listing the districts (name + the fields asked about; no
>   raw IDs) in chat.
> → The map switches to the Map tab and isolates + zooms to exactly those
>   districts, ignoring whatever filters were set. An exit-focus control
>   restores the prior filters.

## Non-goals

- No saving the result (that's a List — a separate, feature-gated concept).
- No new map filters or radius/geographic filters (geographic asks are handled
  on the query side; the app already supports ZIP/city search).
- No new model tool or confirm card — plotting is an automatic client reaction
  to an answer that contains districts.

## Remove (revert the 4 unpushed map-view commits)

All Copilot map-view code is removed, restoring the pre-feature state:
- `map_view.create` / `map_view.apply` actions, their catalog entries, prompt
  text, and tests.
- The `clientAction` flag threaded through `ActionDef` / `RegisteredAction` /
  `ProposedAction`, the stream-route propagation, and the execute-route guard.
- `resolveAndApplyMapView`, the `CopilotPanel.onConfirm` client-action branch,
  the `map_view` invalidation key, and the apply-on-create logic.
- `src/features/map/lib/view-defaults.ts` (incl. `DEFAULT_MAP_VIEW_STATE`) and
  `map-view-service.ts`; `/api/map-views/route.ts` returns to its original
  inline form; `store.ts` constants (`ALL_METRIC_IDS`, `SchoolType`, …) move
  back inline.

**Untouched:** the `/api/map-views` GET/POST behavior and the manual "Save
View" button in `ViewActionsBar` — they never depended on the Copilot code and
keep working exactly as before.

## Build

### 1. `focusDistricts(leaids: string[])` store action
A generalization of the existing Focus Map (`focusPlan` / `focusLeaids`):
- Stash the current filters (reuse the existing `preFocusFilters` slot) so they
  can be restored.
- Set `focusLeaids = leaids` (the map already renders an isolation filter
  `["in", ["get","leaid"], ["literal", focusLeaids]]`, `MapV2Container.tsx`).
- Compute and queue `pendingFitBounds = boundsForLeaids(leaids)`
  (`views-plan-bounds.ts`).
- The existing exit-focus path restores `preFocusFilters`.
- **Isolate** (show only the result districts), not dim — matches "see exactly
  those." Dimming is a later option if context proves useful.

### 2. Auto-plot hook in `CopilotPanel.applyResult`
When an `answer`-kind turn result's `columns` include `leaid`:
- Extract distinct leaids from `rows` via a small testable helper,
  `extractDistrictLeaids(columns, rows)`, **capped** at a constant
  (`MAX_PLOTTED_DISTRICTS ≈ 200`); if the result has more, plot the cap and add
  a chat note ("showing the first N on the map").
- Call `focusDistricts(leaids)` and `setActiveTab("map")`.
- If no `leaid` column, behave exactly as today (table only, map untouched).

### 3. Hide id columns in the Copilot result table
The panel's inline result table currently renders every column. Filter out
id-like columns for display using `isIdColumn` from
`reports/components/ResultsTable.tsx` (export it if not already), so raw
`leaid`/`*_id` values never reach the rep — the leaid stays available in `rows`
for plotting. This also aligns the Copilot table with the no-raw-IDs rule the
reports `ResultsTable` already follows.

### 4. System-prompt nudge
In the answer-rail guidance: when the rep wants to *see / find / show / map* a
set of districts, `SELECT leaid, name` (plus any fields they asked about) so the
result can be plotted on the map; the leaid is used only for plotting — never
describe or print it to the rep.

## Testing

- `focusDistricts` store action: sets `focusLeaids`, stashes/restores filters,
  queues bounds; exit restores prior filters.
- `extractDistrictLeaids(columns, rows)`: returns distinct leaids when a `leaid`
  column is present, `[]` when absent, dedupes, and caps at the limit.
- Result-table id-hiding: `leaid`/id columns are excluded from the displayed
  columns while `rows` retain them.
- Manual E2E (port 3005): ask a district-returning question → chat lists them
  (no IDs) → map isolates + zooms to exactly those; ask a non-district question
  → table only, map unchanged; exit-focus restores filters.

## Open risk

- Geographic asks ("within 100 mi of Houston") depend on the query rail being
  able to compute distance from district location/ZIP data — a prompt/query
  capability, separate from this plotting work. Out of scope here; flagged.
