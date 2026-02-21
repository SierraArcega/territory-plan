# Remove Data Snapshots & Data Reconciliation Tab

**Date:** 2026-02-18
**Status:** Approved

## Context

Data discrepancy issues are resolved. The data reconciliation feature (snapshot infrastructure, Data tab UI, related API routes) is no longer needed.

## Scope

### Delete

- `data/snapshots/` — entire directory
- `src/components/views/DataView.tsx` — Data Reconciliation UI
- `src/app/api/data/` — 3 routes (district-profiles, reconciliation, snapshot-metadata)
- `src/app/api/unmatched/` and `src/app/api/unmatched/by-state/`
- `scripts/snapshot-data.ts` and `scripts/com.territory-plan.snapshot.plist`

### Edit

- `src/app/page.tsx` — remove DataView import/rendering
- `src/lib/api.ts` — remove snapshot/reconciliation hooks and interfaces
- `src/middleware.ts` — remove public route exclusions for `/api/data/*`
- `package.json` — remove snapshot npm scripts
- `.gitignore` — remove snapshot log entries

### Out of scope

- Historical design docs in `Docs/plans/`
- Database schema changes (`unmatched_accounts` table)
- Environment variable cleanup in `.env`
