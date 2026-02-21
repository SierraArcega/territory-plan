# Competitor FY Columns in Explore — Design

**Date:** 2026-02-19
**Approach:** Hybrid — hardcoded competitor list, data-driven FYs

## Problem

The Explore table for districts has no visibility into competitor spend data. The `competitor_spend` table tracks per-district, per-competitor, per-FY spend amounts, but none of this is exposed as filterable or visible columns.

## Design

### Column Structure

Three known competitors are defined as constants:

| Competitor | Slug | Color |
|---|---|---|
| Proximity Learning | `proximity_learning` | #6EA3BE |
| Elevate K12 | `elevate_k12` | #E07A5F |
| Tutored By Teachers | `tutored_by_teachers` | #7C3AED |

For each competitor, one `number`-type column is generated per available FY, showing `total_spend`. Column keys follow the pattern `comp_{slug}_{fy}`.

Example columns (with FY24-FY26 data):

| Key | Label | Group | filterType |
|---|---|---|---|
| `comp_proximity_learning_fy26` | Proximity Learning FY26 ($) | Competitor Spend | number |
| `comp_elevate_k12_fy26` | Elevate K12 FY26 ($) | Competitor Spend | number |
| `comp_tutored_by_teachers_fy26` | Tutored By Teachers FY26 ($) | Competitor Spend | number |

All columns are `isDefault: false` — users opt in by selecting them.

### Data Flow

1. **Metadata endpoint** — `GET /api/explore/competitor-meta` returns `{ fiscalYears: ["fy24", "fy25", "fy26"] }` via `SELECT DISTINCT fiscal_year FROM competitor_spend ORDER BY fiscal_year`.

2. **Client hook** — `useCompetitorFYs()` in `src/lib/api.ts` fetches once, SWR-cached.

3. **Dynamic column generation** — `getCompetitorColumns(fiscalYears)` in `districtColumns.ts` produces `ColumnDef[]` from `COMPETITORS x fiscalYears`.

4. **Explore API** — When competitor columns are visible or filtered:
   - **Select:** Fetch `competitorSpend` relation for each district, then pivot into flat keys (e.g., `comp_proximity_learning_fy26: 45000`).
   - **Filter:** Handle `comp_*` columns in `buildRelationWhere()` — translate `comp_proximity_learning_fy26 > 10000` to `competitorSpend: { some: { competitor: "Proximity Learning", fiscalYear: "fy26", totalSpend: { gt: 10000 } } }`.
   - **Row mapping:** Flatten competitor spend records into per-key values on each district row object.

5. **Table display** — Currency formatting already triggers for columns with `($)` in label.

### Files to Change

| File | Change |
|---|---|
| `src/components/map-v2/explore/columns/districtColumns.ts` | Add `COMPETITORS` constant, `getCompetitorColumns()` function |
| `src/lib/api.ts` | Add `useCompetitorFYs()` SWR hook |
| `src/app/api/explore/competitor-meta/route.ts` | **New** — returns distinct FYs |
| `src/app/api/explore/[entity]/route.ts` | Handle competitor columns in select + where + row mapping |
| `src/components/map-v2/explore/ExploreFilters.tsx` | Merge dynamic competitor columns into `COLUMNS_BY_ENTITY` |
| `src/components/map-v2/explore/ExploreTable.tsx` | Merge dynamic columns for table rendering |

### Not Changed

- `src/lib/explore-filters.ts` — competitor filters use relation approach, not scalar FIELD_MAP
- Filter input components — competitor columns use `filterType: "number"` which already has full support
