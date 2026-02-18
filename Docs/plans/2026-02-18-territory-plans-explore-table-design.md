# Territory Plans Explore Table — Design

## Overview

Add a "Plans" entity tab to the Explore overlay, following the existing entity-polymorphic pattern. Shows territory plans in a filterable/sortable table with expandable rows revealing per-district target breakdowns.

## KPI Cards

Five cards, all filter-responsive (sum only visible/filtered plans):

| Card | Aggregate | Format |
|------|-----------|--------|
| Total Districts | Distinct district count across visible plans | Number |
| Renewal Rollup | `SUM(renewalTarget)` across all plan-districts | Currency |
| Expansion Rollup | `SUM(expansionTarget)` | Currency |
| Win Back Rollup | `SUM(winbackTarget)` | Currency |
| New Business Rollup | `SUM(newBusinessTarget)` | Currency |

## Default Columns

| Column | Key | Type | Group | Default |
|--------|-----|------|-------|---------|
| Name | `name` | text | Core | yes |
| Status | `status` | enum (planning/working/stale/archived) | Core | yes |
| Fiscal Year | `fiscalYear` | number | Core | yes |
| Owner | `ownerName` | text | Core | yes |
| District Count | `districtCount` | number | Core | yes |
| Renewal Rollup | `renewalRollup` | number | Targets | yes |
| Expansion Rollup | `expansionRollup` | number | Targets | yes |
| Win Back Rollup | `winbackRollup` | number | Targets | yes |
| New Business Rollup | `newBusinessRollup` | number | Targets | yes |
| Created | `createdAt` | date | Dates | yes |
| Updated | `updatedAt` | date | Dates | yes |

Additional non-default columns: `description`, `color`, `stateCount`.

## Expandable Rows

Each plan row has a chevron toggle. Expanding reveals a nested sub-table showing the plan's districts:

| Sub-column | Source |
|------------|--------|
| District Name | `district.name` via `TerritoryPlanDistrict` join |
| Renewal Target | `TerritoryPlanDistrict.renewalTarget` |
| Expansion Target | `TerritoryPlanDistrict.expansionTarget` |
| Win Back Target | `TerritoryPlanDistrict.winbackTarget` |
| New Business Target | `TerritoryPlanDistrict.newBusinessTarget` |
| Notes | `TerritoryPlanDistrict.notes` |

## Backend

### API Handler — `handlePlans()`

Added to `src/app/api/explore/[entity]/route.ts` alongside existing handlers.

- Query: `prisma.territoryPlan.findMany()` with `include: { districts: { include: { district: { select: { name, leaid } } } }, owner: { select: { name } } }`
- `PLANS_FIELD_MAP` maps client keys to Prisma fields for filtering/sorting
- Aggregates computed via a parallel query summing targets across `TerritoryPlanDistrict` rows (filtered to match visible plans)
- Returns expanded district data in each plan row for client-side expansion rendering

### Field Map

```
name → name
status → status
fiscalYear → fiscalYear
ownerName → owner.name
districtCount → _count.districts
renewalRollup → (computed)
expansionRollup → (computed)
winbackRollup → (computed)
newBusinessRollup → (computed)
createdAt → createdAt
updatedAt → updatedAt
```

## Frontend Changes

1. **Type**: Add `"plans"` to `ExploreEntity` union
2. **Tab**: Add Plans tab to `ENTITY_TABS` in `ExploreOverlay.tsx`
3. **Columns**: New `planColumns.ts` in `columns/` directory
4. **KPI**: Add plans case to `getCardsForEntity()` in `ExploreKPICards.tsx`
5. **Store**: Add `plans` key to all `Record<ExploreEntity, ...>` maps in Zustand
6. **Table**: Add expandable row rendering in `ExploreTable.tsx` (chevron + nested district sub-table)
7. **Filters**: `explore-filters.ts` gets `PLANS_FIELD_MAP` for server-side filtering

## What Works Automatically

Filters, sorting, column picker, saved views, pagination — all driven by the entity-polymorphic pattern. No changes needed.
