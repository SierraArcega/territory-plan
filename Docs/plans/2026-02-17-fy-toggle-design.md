# Fiscal Year Toggle — Design

> **Scope:** Make the FY selector in the Build View panel actually switch map shading between fiscal years.
> **Out of scope:** Per-FY pipeline columns, plan rollup enrichment (see `2026-02-17-fy-pipeline-plan-rollup-vision.md`).

## Goal

When the user switches from FY26 to FY25 in the Sales Data section, the map re-shades Fullmind and competitor districts using that fiscal year's revenue-based categories. Market Data layers (Signals, Locale, Schools) and Filters (States, Owners, Account Types) are unaffected.

## Approach: Per-FY columns in materialized view (Approach A)

Pre-compute categories for each FY pair in the materialized view. The tile route aliases the correct FY columns based on a `?fy=` query param. Frontend filter expressions stay unchanged.

## Layer 1: Materialized View

Add per-FY category columns to `district_map_features`:

**Fullmind FY26** (current logic, relocated to `fy26_fullmind_category`):
- Uses FY25 vs FY26 net invoicing + FY26 pipeline + plan membership
- Categories: target, new_pipeline, renewal_pipeline, expansion_pipeline, lapsed, new, multi_year

**Fullmind FY25** (new column `fy25_fullmind_category`):
- Uses FY24 vs FY25 net invoicing (FY24 data not loaded yet, so limited)
- Without FY24: districts with FY25 revenue → `new`, no pipeline/target
- When FY24 is loaded later: full multi_year/new/lapsed categories

**Competitors FY26** (current logic, relocated to `fy26_{vendor}_category`):
- Uses FY25 vs FY26 spend from competitor_spend table
- Categories: multi_year, new, churned

**Competitors FY25** (new columns `fy25_{vendor}_category`):
- Uses FY24 vs FY25 spend — works immediately if FY24 records exist in competitor_spend

Remove the old unqualified columns (`fullmind_category`, `proximity_category`, etc.) — tile route aliases the FY-specific ones.

## Layer 2: Tile Route

`src/app/api/tiles/[z]/[x]/[y]/route.ts` accepts `?fy=fy25|fy26` (default: `fy26`).

Aliases selected FY columns to the canonical names:
```sql
d.fy26_fullmind_category AS fullmind_category,
d.fy26_proximity_category AS proximity_category,
d.fy26_elevate_category AS elevate_category,
d.fy26_tbt_category AS tbt_category
```

Frontend filter expressions (`["get", "fullmind_category"]`) work unchanged.

## Layer 3: Frontend Wiring

**MapV2Container.tsx:**
- Subscribe to `selectedFiscalYear` from store
- Append `&fy=${selectedFiscalYear}` to tile source URL
- When FY changes, update source URL → MapLibre re-fetches tiles

**LayerBubble.tsx:**
- Already done: FY dropdown in Sales Data header reads/writes `selectedFiscalYear`
- Already done: Saved views persist `selectedFiscalYear`

## Layer 4: Unchanged

- Signals, Locale, Schools — not FY-dependent, no changes
- States, Owners, Account Types filters — not FY-dependent, no changes
- Engagement sub-filters — apply to whichever FY's categories are in tiles

## FY Availability

For now, hardcode `["fy25", "fy26"]` in the dropdown. Later, make data-driven by querying which FY columns have non-null data.

## Data Dependencies

- Fullmind FY25 categories will be limited until FY24 data is loaded (only `new` category, no multi_year/lapsed)
- Competitor FY25 depends on FY24 records existing in competitor_spend
- Sierra has Fullmind data back to FY21 available to load when ready
