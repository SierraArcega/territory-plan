# Backend Context: Team Progress

## Data Sources

### 1. Territory Plan Targets (Prisma)
- **Model**: `TerritoryPlan` → `TerritoryPlanDistrict`
- **Per-district targets**: `renewalTarget`, `expansionTarget`, `winbackTarget`, `newBusinessTarget` (Decimal 15,2)
- **Plan-level rollups** (denormalized): `renewalRollup`, `expansionRollup`, `winbackRollup`, `newBusinessRollup`
- **Rollup sync**: `src/lib/plans/rollup-sync.ts` — triggered when district targets change

### 2. Opportunity Actuals (Materialized View)
- **View**: `district_opportunity_actuals`
- **Grouped by**: `district_lea_id`, `school_yr`, `sales_rep_email`, `category`
- **Key columns**: `total_revenue`, `total_take`, `bookings`, `open_pipeline`, `weighted_pipeline`, `opp_count`
- **Category column** (from contract_type): renewal, expansion, winback, new_business
- **Refreshed**: hourly via scheduler

### 3. Raw Opportunities Table
- **Table**: `opportunities`
- **Key columns**: `id`, `name`, `stage`, `contract_type`, `district_lea_id`, `school_yr`, `net_booking_amount`, `total_revenue`, `total_take`
- Used for individual opportunity detail drill-down

## Category Classification Logic (User-Defined)

Categories are determined by **district revenue history**, not contract_type:

| Category | Condition | Actual Value |
|----------|-----------|--------------|
| Renewal | District had revenue in prior year | min(current_revenue, prior_year_revenue) |
| Expansion | District had revenue in prior year AND current > prior | max(0, current_revenue - prior_year_revenue) |
| Winback | No prior year revenue, but had revenue 2 years ago | All current revenue |
| New Business | No revenue in prior year OR 2 years ago | All current revenue |

### Data Required Per District
- Current year revenue: `SUM(total_revenue)` from `district_opportunity_actuals` WHERE `school_yr = currentFY`
- Prior year revenue: `SUM(total_revenue)` WHERE `school_yr = priorFY`
- Two-years-ago revenue: `SUM(total_revenue)` WHERE `school_yr = twoYearsAgoFY`

### Fiscal Year Mapping
- `fiscalYearToSchoolYear(fy)` in `src/lib/opportunity-actuals.ts`
- FY2026 → "2025-26", FY2027 → "2026-27"

## Unmapped Opportunities
Districts with revenue NOT in any territory plan need to be surfaced.
- Query: all `district_lea_id` values in `district_opportunity_actuals` for current FY
- Exclude: `district_lea_id` values present in ANY `territory_plan_districts` row

## Existing Patterns
- **Auth**: `getUser()` from `@/lib/supabase/server`
- **DB**: `prisma` singleton from `@/lib/prisma`
- **Raw queries**: `prisma.$queryRaw` with tagged templates for materialized view queries
- **Safe queries**: `safeQueryRaw()` wrapper catches 42P01 (undefined table) errors
- **API**: Next.js route handlers with `dynamic = "force-dynamic"`
- **Frontend queries**: TanStack Query hooks in `src/features/plans/lib/queries.ts`
- **Zustand store**: `TabId` union in `src/features/shared/lib/app-store.ts`
