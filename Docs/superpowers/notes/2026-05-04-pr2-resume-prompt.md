# PR 2 resume prompt — map plans MVT client cutover

> Paste this into a fresh Claude Code session **after PR #173 has merged to `main`**.
> It's self-contained — no need to reference the prior conversation.

---

PR #173 (`feat(map-plans): add MVT tile endpoint + lightweight /list endpoint`) just merged to main. Time to start **PR 2 of 3** for the map-plans-vector-tiles initiative — the client cutover.

## Context (no need to re-derive)

- **Spec:** `Docs/superpowers/specs/2026-05-01-map-plans-vector-tiles-design.md`
- **Plan:** `Docs/superpowers/plans/2026-05-04-map-plans-vector-tiles.md`
- **PR 1 (now merged):** added `/api/map/plans/[z]/[x]/[y].mvt` (binary MVT) and
  `/api/map/plans/list` (flat JSON, no geometry). Allowlisted the MVT route in the
  Supabase auth middleware. Left the legacy `/api/map/plans` GeoJSON route untouched —
  PR 2 is what flips the client off it.

## What PR 2 does

Flip the React client off the legacy GeoJSON endpoint:
- **Map source:** MapLibre swaps from a GeoJSON source to a vector source pointed at
  `/api/map/plans/{z}/{x}/{y}.mvt`. Plan layers get `'source-layer': 'plans'`.
- **Sidebar / cross-filter:** `useMapPlans`, `PlansTab`, `PlanCard`,
  `SearchResults` tab counts, `useCrossFilter`, and the Zustand store all stop
  consuming `FeatureCollection<Geometry>` and start consuming `PlanFeatureRow[]`
  from `/api/map/plans/list`.
- The legacy `/api/map/plans` route stays on disk (untouched) so this PR is a
  one-line revert if smoke fails. PR 3 deletes it after ~1 week of soak.

## How to run this

1. Use the **`superpowers:start-session`** skill — pull main, announce
   readiness, then create a worktree via `superpowers:using-git-worktrees`.
   Branch name per the plan: `feat/map-plans-mvt-client`.
2. Use the **`superpowers:subagent-driven-development`** skill to execute
   Tasks 9 onward from the plan file. Two-stage review (spec compliance then
   code quality) per task. Same pattern PR 1 used.
3. PR 2 task list (per plan):
   - **Task 9:** branch setup + baseline tests.
   - **Task 10:** add `PlanFeatureRow` type to `src/features/map/lib/queries.ts`,
     make `extractLeaids` (`src/features/map/lib/filter-utils.ts:41`) shape-tolerant
     (accepts both `FeatureCollection` and `PlanFeatureRow[]`).
   - **Task 11:** rewire `useMapPlans` to call `/list`, export
     `buildMapPlansTileUrl(filters)` for MapLibre.
   - **Task 12:** retype `overlayGeoJSON.plans` in `src/features/map/lib/store.ts`
     (lines ~286, 450, 604, 1211–1213) from `FeatureCollection | null` to
     `PlanFeatureRow[] | null`.
   - **Task 13+:** swap MapLibre source in
     `src/features/map/components/MapV2Container.tsx` (lines ~244–247, 308–318, 847)
     from GeoJSON → vector, call `setTiles([newUrl])` when filters change.
     Add `'source-layer': 'plans'` to fill + outline specs in
     `src/features/map/lib/pin-layers.ts:242–266` (`getPlanLayers`).
   - **Tasks for sidebar:** `PlansTabContainer`, `PlansTab` (replace
     `FeatureCollection<Geometry>` typing with `PlanFeatureRow[]`),
     `PlanCard.tsx:22` (take `PlanFeatureRow` not `Feature`),
     `SearchResults/index.tsx:462–468` (update `tabCounts` loop).
   - **Final task:** manual smoke (run `npm run dev`, exercise the map at
     several zoom levels and with each filter set; verify PlansTab still
     renders correctly and cross-filter still narrows other overlays),
     then push and open PR 2 against `main`.

## Smoke checklist before opening PR 2

- Pan + zoom feels instant on the unfiltered case (this is the whole point).
- PlansTab sidebar shows the same plans/districts as before.
- Selecting a plan in the sidebar still cross-filters the contacts /
  vacancies / activities overlays via `useCrossFilter`.
- Filter dropdowns (status, fiscalYear, owner) all narrow both the map polys
  AND the sidebar list.
- No console errors on map load or filter change.
- Network tab shows `.mvt` requests hitting `/api/map/plans/{z}/{x}/{y}.mvt`
  (binary, ~KB-scale per tile) — no more multi-MB GeoJSON request.

## Don't do in PR 2

- **Don't delete `src/app/api/map/plans/route.ts`.** That's PR 3, after a
  week of soak. Keeping it in place means PR 2 reverts cleanly with one
  client-side commit.
- Don't add backwards-compatibility shims for the old GeoJSON shape. The
  new flat-array shape is the only shape after PR 2.

## When done

Open PR 2 with title `feat(map-plans): cut client over to MVT vector source + /list`,
base `main`, and reference both the spec and plan files in the body.
Stop after PR 2 ships — PR 3 (delete legacy route) is a separate session
roughly a week later.
