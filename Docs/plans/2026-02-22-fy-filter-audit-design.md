# FY Filter Data Flow Audit & Fix Design

**Date:** 2026-02-22
**Goal:** Audit every query affected by the fiscal year filter, fix SQL bugs, extend ETL to load FY24/FY27 data, verify EK12 + Fullmind data integrity, and document expected behavior.

---

## 1. Current Architecture

### Data Flow

```
LayerBubble (FY selector)
  → store.selectedFiscalYear ("fy24"|"fy25"|"fy26"|"fy27")
    → useMapSummary hook (passes fy param to API)
      → GET /api/districts/summary?fy=fy26&vendors=fullmind,proximity&...
        → SQL: JOIN district_map_features + vendor_financials
          → Groups by ${fy}_fullmind_category
          → Filters vendor_financials by fiscal_year = 'FY26'
    → Tiles API (passes fy param)
      → SQL: SELECT ${fy}_fullmind_category, ${fy}_proximity_category, ...
```

### Key Tables

- **`district_map_features`** (materialized view): Pre-computed engagement categories for all FYs (fy24–fy27) per vendor. Categories degrade in richness for older FYs.
- **`vendor_financials`**: Normalized `(leaid, vendor, fiscal_year)` rows with 10 financial metric columns.
- **`districts`**: Fullmind-specific FY columns (fy25_sessions_revenue, fy26_open_pipeline, etc.) — legacy, being replaced by vendor_financials.

---

## 2. Issues Found

### A. ETL Gap: FY24 and FY27 data not loaded

The CSV (`Customer Book Consolidation - Combined Targets + Pipeline (1).csv`) contains:

| CSV Column | FY | Currently Loaded | Should Map To |
|---|---|---|---|
| FY24 Bookings | FY24 | **No** | `closed_won_bookings` |
| FY24 Revenues | FY24 | **No** | `total_revenue` |
| FY27 Open Pipeline | FY27 | **No** | `open_pipeline` |
| FY27 Pipeline | FY27 | **No** | Appears to be same as FY27 Open Pipeline (second column) |
| FY25 Bookings | FY25 | Yes | `closed_won_bookings` |
| FY25 Revenues | FY25 | Yes | `total_revenue` |
| FY26 Pipeline | FY26 | Yes | `open_pipeline` |
| FY26 Bookings | FY26 | Yes | `closed_won_bookings` |
| FY26 Delivered | FY26 | Yes | `delivered_revenue` |
| FY26 Scheduled | FY26 | Yes | `scheduled_revenue` |
| Deferred Revenue | FY26 | Yes | `deferred_revenue` |
| FY26 Revenue | FY26 | Yes | `total_revenue` |

The ETL (`vendor_financials.py`) only generates FY25 and FY26 records. FY24 and FY27 data from the CSV is silently dropped.

### B. SQL Bug: `SUM(DISTINCT d.enrollment)` in summary route

**File:** `src/app/api/districts/summary/route.ts`, lines 78 and 156

The combined query and per-vendor queries use:
```sql
COALESCE(SUM(DISTINCT d.enrollment), 0)::bigint AS total_enrollment
```

`SUM(DISTINCT value)` deduplicates by *value*, not by row. If two different districts have enrollment = 500, only one gets counted. This under-counts enrollment when districts share the same enrollment number (common for small districts).

**Fix:** Use a CTE to pre-deduplicate districts:
```sql
WITH dist AS (
  SELECT DISTINCT leaid, enrollment FROM districts
)
SELECT
  ...
  COALESCE(SUM(dist.enrollment), 0)::bigint AS total_enrollment,
  ...
FROM district_map_features dmf
JOIN dist ON dmf.leaid = dist.leaid
LEFT JOIN vendor_financials vf ON dmf.leaid = vf.leaid
  AND vf.vendor = ANY($1)
  AND vf.fiscal_year = $2
...
```

### C. Seed script vs ETL column mapping conflict

The seed script maps Fullmind `total_revenue` ← `fy25_sessions_revenue` (sessions-specific), while the ETL maps `total_revenue` ← `FY25 Revenues` (from CSV, could be broader). The `GREATEST()` upsert keeps whichever is larger, which may silently pick the wrong source.

### D. Several financial columns always $0

The ETL hardcodes `invoicing`, `delivered_take`, `scheduled_take`, `all_take` to 0 because the CSV doesn't have those columns. The MapSummaryBar displays all of these — they'll show $0 for everything loaded via CSV.

### E. Materialized view category degradation per FY

| FY | Fullmind Categories Available | Competitor Categories |
|---|---|---|
| FY27 | target, new_pipeline, renewal_pipeline, expansion_pipeline | multi_year_growing, multi_year_flat, multi_year_shrinking, new, churned |
| FY26 | multi_year_growing/flat/shrinking, new, lapsed, pipeline variants, target | multi_year_growing, multi_year_flat, multi_year_shrinking, new, churned |
| FY25 | new, target, NULL | Same as FY26 |
| FY24 | target, NULL | Same as FY26 (but limited data) |

Switching to FY24/FY25 causes many Fullmind districts to fall into "uncategorized" (NULL category). This is expected given data availability but should be documented.

---

## 3. Fix Plan

### Fix 1: Extend ETL for FY24 + FY27

In `scripts/etl/loaders/vendor_financials.py`, add parsing for:
- FY24: `parse_currency(row.get("FY24 Bookings"))`, `parse_currency(row.get("FY24 Revenues"))`
- FY27: `parse_currency(row.get("FY27 Open Pipeline"))` (check if "FY27 Pipeline" is a duplicate)

Generate FY24 and FY27 records with the same upsert pattern.

### Fix 2: CTE for enrollment dedup in summary route

Replace `SUM(DISTINCT d.enrollment)` with a CTE approach in both the combined query and per-vendor breakdown queries in `src/app/api/districts/summary/route.ts`.

### Fix 3: Verification queries

After re-running the ETL, verify with:
```sql
-- Row counts per vendor per FY
SELECT vendor, fiscal_year, COUNT(*) as rows,
       COUNT(*) FILTER (WHERE total_revenue > 0) AS has_revenue,
       COUNT(*) FILTER (WHERE open_pipeline > 0) AS has_pipeline,
       COUNT(*) FILTER (WHERE closed_won_bookings > 0) AS has_bookings
FROM vendor_financials
GROUP BY vendor, fiscal_year
ORDER BY vendor, fiscal_year;

-- Financial totals per vendor per FY (ground truth for summary bar)
SELECT vendor, fiscal_year,
       SUM(open_pipeline) as pipeline,
       SUM(closed_won_bookings) as bookings,
       SUM(total_revenue) as revenue
FROM vendor_financials
GROUP BY vendor, fiscal_year
ORDER BY vendor, fiscal_year;
```

### Fix 4: Update tests

Update `src/app/api/districts/summary/__tests__/route.test.ts` to verify the CTE-based enrollment query returns correct results when districts share enrollment values.

---

## 4. Expected Behavior Reference

### When user selects a FY in LayerBubble:

1. **Map shading** changes to use `${fy}_${vendor}_category` columns from the materialized view
2. **Summary bar totals** re-fetch from `/api/districts/summary?fy=${fy}`, which:
   - Filters `vendor_financials` to `fiscal_year = ${FY}`
   - Groups by `${fy}_fullmind_category`
   - Sums financial metrics across all active vendors
3. **Engagement sub-filters** (client-side) filter the API response by category

### Per-FY data availability (after ETL fix):

| FY | Fullmind | EK12 | Proximity | TBT |
|---|---|---|---|---|
| FY24 | Bookings, Revenue | Bookings, Revenue | Revenue (competitor_spend) | Revenue (competitor_spend) |
| FY25 | Bookings, Revenue | Bookings, Revenue | Revenue | Revenue |
| FY26 | Full (pipeline, bookings, delivered, scheduled, deferred, revenue) | Full | Revenue | Revenue |
| FY27 | Pipeline only | Pipeline only | Revenue | Revenue |

### Summary bar columns and their sources:

| UI Column | vendor_financials column | Has data for |
|---|---|---|
| Pipeline | open_pipeline | FY26 (all vendors), FY27 (pipeline only) |
| Bookings | closed_won_bookings | FY24-FY26 (Fullmind, EK12) |
| Invoicing | invoicing | **Always $0** (not in CSV) |
| Sched Rev | scheduled_revenue | FY26 only (Fullmind, EK12) |
| Deliv Rev | delivered_revenue | FY26 only (Fullmind, EK12) |
| Def Rev | deferred_revenue | FY26 only (Fullmind, EK12) |
| Total Rev | total_revenue | FY24-FY26 (varies by vendor) |
| Deliv Take | delivered_take | **Always $0** (not in CSV) |
| Sched Take | scheduled_take | **Always $0** (not in CSV) |
| All Take | all_take | **Always $0** (not in CSV, seed only for Fullmind FY25/26) |
