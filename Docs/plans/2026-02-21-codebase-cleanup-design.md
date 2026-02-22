# Codebase Cleanup Design

**Date:** 2026-02-21
**Scope:** Dead code removal, map-v1 → v2 replacement, panel cascade deletion, plan docs cleanup

## Motivation

- Previous audit (2026-02-20) reorganized ~85-90% of the codebase into feature-based structure
- Remaining dead code: fy27-trajectory page, map-v1 components, orphaned views, legacy panel chain
- Map-v2 is already the primary map but the sidebar "map" tab still renders v1
- 86 completed plan docs clutter Docs/plans/

## What Gets Deleted

### Dead Code (no importers)
- `src/app/fy27-trajectory/` — unused page + queries
- `src/components/fy27-trajectory/Dashboard.tsx` — only imported by deleted page
- `src/app/api/fy27-trajectory/route.ts` — API route for deleted page
- `src/features/shared/components/views/GoalsView.tsx` — orphaned, not imported
- `src/features/shared/components/map-v1/Controls.tsx` — not imported
- `src/features/shared/components/map-v1/Legend.tsx` — not imported

### Map-v1 → v2 Swap
- `src/features/shared/components/views/MapView.tsx` — renders map-v1, replaced by MapV2Shell
- All 11 files in `src/features/shared/components/map-v1/` — superseded by map-v2
- `src/app/map-v2/page.tsx` — standalone route no longer needed

### Panel Cascade (dead after MapView removal)
PanelContainer's only import was MapView.tsx. Once that's gone, the entire panel tree is dead:
- `src/features/shared/components/panel/` — all 16 files including tests
- Map-v2 already has its own AddToPlanButton, FindSimilarDistricts, and panel infrastructure

### Plan Docs
- All 86 files in `Docs/plans/` — in git history if ever needed

## What Changes

### src/app/page.tsx
- Remove `MapView` import
- Add dynamic import for `MapV2Shell` (SSR disabled, same pattern map-v2/page.tsx uses)
- `case "map":` renders `<MapV2Shell />` instead of `<MapView />`

## What Stays

- All `src/features/` code (map-v2 components, all other features)
- All `src/app/api/` routes (except fy27-trajectory)
- All `src/lib/` infrastructure (db, prisma, supabase, api barrel)
- Test files that aren't in the deleted panel directory

## Out of Scope

- Further restructuring of src/features/
- New test coverage
- API route cleanup
- Prisma schema changes
