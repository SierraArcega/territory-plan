# Follow-up: Orphaned `FloatingPanel` / `DistrictCard` system (cleanup)

## Summary

A whole subtree of map-panel components is defined in the codebase but **never rendered**. The root is `FloatingPanel.tsx` — it has no importers anywhere outside its own tests. Everything that's only reachable via `FloatingPanel` is dead code that can be deleted in a future cleanup PR. The live map UI uses a different panel implementation (`PlanTabs`, `PlanCard` wide right panel, `DistrictExploreModal`, etc.).

## Discovered during

Performance work on the district card tab-switching feature (branch `feat/district-tab-perf`, 2026-05-01). Tasks 3–5 of the plan added prefetch + fade-up animation + loading dots to `right-panels/DistrictCard.tsx`. Local browser verification revealed the component was unreachable from any user flow. Grep confirmed `FloatingPanel` is the sole consumer and is itself never imported.

The Promise.all speedup in `src/app/api/districts/[leaid]/route.ts` (Task 2) is preserved — that endpoint is consumed by `ActivitiesPanel`, `PlanDistrictPanel`, `DistrictExploreModal`, and `SelectionListPanel`, all of which are live.

## Confirmed orphaned files

Verified by `grep -rln <name>` across `src/` and excluding the file's own definition / tests:

| File | Imported by |
|------|-------------|
| `src/features/map/components/FloatingPanel.tsx` | **Nothing** — root of the dead subtree |
| `src/features/map/components/RightPanel.tsx` | Only `FloatingPanel` |
| `src/features/map/components/PanelContent.tsx` | Only `RightPanel` + `FloatingPanel` |
| `src/features/map/components/panels/PlanWorkspace.tsx` | Only `PanelContent` + `FloatingPanel` |
| `src/features/map/components/panels/PlanOverviewSection.tsx` | Only `PlanWorkspace` |
| `src/features/map/components/right-panels/DistrictCard.tsx` | Only `RightPanel` |

The store action `viewPlan(planId)` (which sets `panelState: "PLAN_OVERVIEW"`) is the only entry point that would activate this subtree. It is called from three places — `PlansListPanel`, `HomePanel`, and `SearchResults/PlanDistrictsTab` — all of which are themselves only reachable via `PanelContent` (orphaned).

## Likely-orphaned (verify before deletion)

These are reachable from the dead chain only — but each should be re-grepped before deletion in case a live component took a dependency I missed:

- `src/features/map/components/panels/PlansListPanel.tsx`
- `src/features/map/components/panels/HomePanel.tsx`
- `src/features/map/components/panels/PlanActivitiesSection.tsx`
- `src/features/map/components/panels/PlanTasksSection.tsx`
- `src/features/map/components/panels/PlanContactsSection.tsx`
- `src/features/map/components/panels/PlanPerfSection.tsx`
- `src/features/map/components/panels/SelectionListPanel.tsx`
- `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx` (only used by orphaned `DistrictCard`)
- All `right-panels/PlanCard.tsx` — note this is **not** the wide tabbed PlanCard the user sees (that's `plans/components/PlanTabs.tsx`); confirm via grep
- `right-panels/TaskForm.tsx`, `ActivityForm.tsx`, `ContactDetail.tsx`, `PlanEditForm.tsx`, `VacancyDetail.tsx`, `VacancyForm.tsx` — ditto, only mounted via `RightPanel`

## Tests added by `feat/district-tab-perf` that target the orphaned code

Delete alongside the components:

- `src/features/map/components/right-panels/__tests__/DistrictCard.prefetch.test.tsx`
- `src/features/map/components/right-panels/__tests__/DistrictCard.rollup.test.tsx`
- `src/features/map/components/panels/district/tabs/__tests__/DistrictTabStrip.test.tsx`

## Store cleanup that follows

If the chain is removed, the following enum values in `src/features/map/lib/store.ts` become unused and should be culled:

- `PanelState`: `PLAN_OVERVIEW`, `PLAN_ACTIVITIES`, `PLAN_TASKS`, `PLAN_CONTACTS`, `PLAN_PERF`, `PLAN_ADD`, `PLAN_VIEW`
- `RightPanelContent.type`: `district_card`, `plan_card` (verify — `plan_card` is dispatched from `MapV2Container.tsx:1192` but never consumed if `RightPanel` is gone)
- Actions: `viewPlan`, `setPlanSection`, `finishAddingDistricts`, `addDistrictToPlan`, `removeDistrictFromPlan`, `createPlan` (verify each)

## Recommended cleanup workflow

1. Re-grep every "Likely-orphaned" file to confirm zero non-orphaned importers (codebase may have evolved since this doc was written)
2. Delete in dependency order: leaf components → `PanelContent` / `RightPanel` → `FloatingPanel`
3. Cull store enums and actions; run `tsc --noEmit` to surface anything that breaks
4. Delete the three test files listed above
5. Run full `npm test` — the suite should still be green
6. Open a single cleanup PR titled "chore(map): remove orphaned FloatingPanel/DistrictCard subtree"

## Why not delete now

Out of scope for the perf branch. The dead code doesn't ship to users (Next.js tree-shakes unrendered components from the client bundle), so there's no immediate cost. A dedicated cleanup PR is safer than mixing it with a perf change that already touches some of the same files.

## Status

Open. No owner assigned. Not blocking.

## Related

- Branch `feat/district-tab-perf` — Tasks 1+2 retained (`buildActivitiesQueryString` export + `Promise.all` in district detail route); Tasks 3–5 (prefetch / animation / loading dots) target this orphaned chain
- See `docs/superpowers/specs/2026-05-01-district-card-tab-performance-design.md` for the patterns we built — they can be re-applied to live components if the same cold-tab problem ever surfaces there
