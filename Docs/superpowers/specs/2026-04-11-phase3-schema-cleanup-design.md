# Phase 3: Schema Cleanup

**Date:** 2026-04-11
**Status:** Phase 3a complete, Phase 3b complete, Phase 3c complete
**Branch:** `feat/db-normalization-query-tool`
**Parent spec:** `Docs/superpowers/specs/2026-04-01-db-normalization-claude-query-tool-design.md`

## Summary

Remove all deprecated columns, tables, and shims left over from Phases 1–2b. The `extractFullmindFinancials` helper currently converts normalized `districtFinancials` rows back into the old flat FY-column shape for backward compatibility. Phase 3 eliminates this shim, drops the dead schema, and cleans up external dependencies.

## Approach: Layered cleanup

Three sub-phases, each independently shippable and testable:

- **3a** — Remove the `extractFullmindFinancials` shim (frontend refactor, biggest change)
- **3b** — Drop deprecated columns and tables (Prisma schema cleanup, mechanical)
- **3c** — External and cosmetic cleanup (API rename, ETL changes, worktree cleanup)

---

## Phase 3a: Remove `extractFullmindFinancials` shim

### Current state

API routes fetch `districtFinancials` via Prisma include, then `extractFullmindFinancials()` in `src/features/shared/lib/financial-helpers.ts` flattens the rows back into 18 FY-named fields (`fy25SessionsRevenue`, `fy25NetInvoicing`, etc.). Frontend types in `api-types.ts` define these flat fields on `FullmindData`, `DistrictDetail`, and related interfaces.

### Target state

API routes return `districtFinancials: DistrictFinancial[]` directly. Frontend components query the array by vendor and fiscal year.

### New shared type

Replace the 18 FY fields in `FullmindData` / `DistrictDetail` / related interfaces with:

```ts
type DistrictFinancial = {
  vendor: string
  fiscalYear: string
  totalRevenue: number | null
  allTake: number | null
  sessionCount: number | null
  closedWonOppCount: number | null
  closedWonBookings: number | null
  invoicing: number | null
  openPipelineOppCount: number | null
  openPipeline: number | null
  weightedPipeline: number | null
  poCount: number | null
}
```

### Frontend helper

A small utility to replace the old property-access pattern:

```ts
getFinancial(financials: DistrictFinancial[], vendor: string, fy: string, field: keyof DistrictFinancial): number | null
```

Usage: `district.fy25SessionsRevenue` becomes `getFinancial(district.districtFinancials, 'fullmind', 'FY25', 'totalRevenue')`.

### Changes

1. **API routes** — Remove all `extractFullmindFinancials()` calls. Return the `districtFinancials` relation data as-is (already fetched via Prisma include).
2. **Frontend types** (`api-types.ts`) — Replace 18 FY fields with `districtFinancials: DistrictFinancial[]` on all interfaces that carry financial data.
3. **Frontend components** — Update every component that reads flat FY fields to use `getFinancial()` or direct array access.
4. **Delete** `extractFullmindFinancials` from `financial-helpers.ts`.

---

## Phase 3b: Drop deprecated columns and tables

Depends on 3a — no code should reference these after 3a is complete.

### Columns to drop from `districts`

- 18 FY columns: `fy25_sessions_revenue`, `fy25_sessions_take`, `fy25_sessions_count`, `fy26_sessions_revenue`, `fy26_sessions_take`, `fy26_sessions_count`, `fy25_closed_won_opp_count`, `fy25_closed_won_net_booking`, `fy25_net_invoicing`, `fy26_closed_won_opp_count`, `fy26_closed_won_net_booking`, `fy26_net_invoicing`, `fy26_open_pipeline_opp_count`, `fy26_open_pipeline`, `fy26_open_pipeline_weighted`, `fy27_open_pipeline_opp_count`, `fy27_open_pipeline`, `fy27_open_pipeline_weighted`
- `sales_executive` (string) — replaced by `sales_executive_id` UUID FK
- `state_location` — replaced by `states.name` via FK join

### Columns to drop from other tables

- `schools.owner` (string) — replaced by `owner_id` UUID FK
- `states.territory_owner` (string) — replaced by `territory_owner_id` UUID FK
- `unmatched_accounts.sales_executive` (string) — replaced by `sales_executive_id` UUID FK
- `unmatched_accounts` FY columns: `fy25_net_invoicing`, `fy26_net_invoicing`, `fy26_open_pipeline`, `fy27_open_pipeline`

### Models/tables to drop

- `CompetitorSpend` model / `competitor_spend` table

### Views to drop

- `district_vendor_comparison` materialized view

### state_location migration

- API routes that select `stateLocation` switch to including the `states` relation and returning state name from `states.name`
- ~8 frontend locations that render `district.stateLocation` switch to `district.state.name`
- Drop `stateLocation` from frontend types

### Type fixes

- `StateDistrictListItem.salesExecutive`: change from `string | null` to `PersonRef | null` (route already returns `PersonRef`)
- Remove all FY field definitions from `api-types.ts` interfaces
- Remove `stateLocation` from types

---

## Phase 3c: External and cosmetic cleanup — COMPLETE

### API response rename — DONE

- ✅ Renamed `competitorSpend` key in API response → `competitors`
- ✅ Renamed `CompetitorSpend.tsx` → `Competitors.tsx`, `CompetitorSpendCard.tsx` → `CompetitorCard.tsx`
- ✅ Updated all consuming components (DistrictInfoTab, DistrictDetailPanel, PlanningTab, PurchasingHistoryCard, DistrictExploreModal)
- ✅ Updated types from `CompetitorSpendRecord`/`CompetitorSpendResponse` → `CompetitorRecord`/`CompetitorsResponse`
- ✅ Updated queryKey from `"competitorSpend"` → `"competitors"`
- ✅ Updated PurchasingHistoryCard test file
- ✅ Updated ICP scoring MethodologySummary documentation references

### ETL dual-write stop — DOCUMENTED

- ✅ Created `Docs/etl-dual-write-stop.md` with full list of deprecated columns to stop writing
- Python `fullmind.py` changes happen outside this repo — document is the handoff artifact

### Deferred consideration — FLAGGED

- ✅ Added TODO comments in `src/lib/opportunity-actuals.ts` and `prisma/migrations/manual/create_refresh_fullmind_financials.sql`
- Consolidating `district_opportunity_actuals` and `refresh_fullmind_financials()` — flagged for future work, not Phase 3

---

## Out of scope

- Changing the opportunities sync pipeline (Railway Docker) — column names stay as-is
- `district_opportunity_actuals` materialized view consolidation (flagged, not Phase 3)
- MCP tool implementation
- Row-level security / per-user data scoping
