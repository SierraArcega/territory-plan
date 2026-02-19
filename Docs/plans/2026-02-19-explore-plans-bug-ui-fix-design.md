# Explore Page — Plans Bug & UI Fix Marathon

**Date**: 2026-02-19
**Goal**: Fix 8 bugs and UI issues in the Explore page related to Territory Plans.

---

## Fix 1: KPI Card Key Mismatch

**Problem**: API routes return aggregate keys that don't match what `ExploreKPICards` expects. KPI cards show "—" for most values.

**Root cause**: API uses snake_case (`completed_count`, `fy26_open_pipeline_sum`) but KPI cards expect camelCase (`completed`, `pipelineSum`).

**Fix**: Update the API route's return objects in all 4 entity handlers (districts, activities, tasks, contacts) to use the camelCase keys the component expects.

**Affected files**: `src/app/api/explore/[entity]/route.ts`

---

## Fix 2: Plans Computed Field DB Columns

**Problem**: `districtCount`, `stateCount`, `renewalRollup`, `expansionRollup`, `winbackRollup`, `newBusinessRollup` are computed in JS after the query. Filtering or sorting by these silently does nothing.

**Fix**:
1. Add 6 columns to `territory_plans` table: `district_count INT`, `state_count INT`, `renewal_rollup DECIMAL`, `expansion_rollup DECIMAL`, `winback_rollup DECIMAL`, `new_business_rollup DECIMAL`
2. Backfill from existing data via SQL
3. Add app-level sync in API routes that modify plan districts/targets (add/remove district, update targets)
4. Update `PLANS_FIELD_MAP` in `explore-filters.ts` so filtering/sorting works
5. Update the explore API `handlePlans` to read from columns instead of computing in JS

**Affected files**:
- `prisma/schema.prisma`
- Migration SQL
- `src/lib/explore-filters.ts`
- `src/app/api/explore/[entity]/route.ts`
- `src/app/api/territory-plans/[id]/districts/route.ts` (sync on add/remove)
- `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts` (sync on target update)

---

## Fix 3: Plans Aggregate Query Ignores Filters

**Problem**: The raw SQL for plan aggregates always sums across ALL user plans, ignoring active explore filters.

**Fix**: Thread the Prisma `where` clause into the aggregate query. Use Prisma's aggregate API instead of raw SQL so filters are respected.

**Affected files**: `src/app/api/explore/[entity]/route.ts`

---

## Fix 4: Plan Color Column → Color Swatch

**Problem**: The "Color" column shows raw hex text like `#403770`.

**Fix**: Add a cell renderer in `ExploreTable` that detects the `color` column for plans entity and renders a small colored circle + hex label.

**Affected files**: `src/components/map-v2/explore/ExploreTable.tsx`

---

## Fix 5: Plan Status → Styled Badges

**Problem**: Status column shows unstyled raw text like `working`, `planning`.

**Fix**: Add a cell renderer that shows status as brand-colored soft badges:
- `planning` → Steel Blue badge
- `working` → Plum badge
- `stale` → Golden badge
- `archived` → Gray badge

**Affected files**: `src/components/map-v2/explore/ExploreTable.tsx`

---

## Fix 6: Fiscal Year → FY Format

**Problem**: Fiscal year shows raw number `2026` instead of `FY26`.

**Fix**: Add formatting in the cell renderer for the `fiscalYear` column to display `FY{last2digits}`.

**Affected files**: `src/components/map-v2/explore/ExploreTable.tsx`

---

## Fix 7: Plan Expanded Row Totals

**Problem**: The expanded district subtable has no totals row, making it hard to see plan-level sums at a glance.

**Fix**: Add a footer row with summed Renewal, Expansion, Win Back, New Business columns. Styled with a top border, bold text, and "Total" label.

**Affected files**: `src/components/map-v2/explore/ExploreTable.tsx`

---

## Fix 8: Plan Row Click → Summary Panel

**Problem**: Clicking a plan row in Explore does nothing. Districts open a detail card, but plans don't.

**Fix**:
1. Add `plan_card` type to `RightPanel` content types
2. Create a `PlanCard` component showing: plan name, status badge, FY, owner, color swatch, total rollups, and a scrollable district list with per-district targets
3. Wire up `handleRowClick` in `ExploreOverlay` to open the panel for plans

**Affected files**:
- `src/lib/map-v2-store.ts` (add plan_card type)
- `src/components/map-v2/RightPanel.tsx` (render PlanCard)
- New: `src/components/map-v2/PlanCard.tsx`
- `src/components/map-v2/explore/ExploreOverlay.tsx` (handleRowClick)

---

## Out of Scope

- Adding new plan features (edit from panel, delete, duplicate)
- Changing the plan workspace page
- Adding plan-level charts or analytics
- Changing other entity tabs (activities, tasks, contacts) beyond the KPI key fix
