# Educere Competitor Data Integration

**Date:** 2026-02-25
**Status:** Draft

## Problem Statement

The Territory Planner currently tracks competitor purchase order spend for three vendors -- Proximity Learning, Elevate K12, and Tutored By Teachers -- via GovSpend PO data stored in the `competitor_spend` table and rendered on the map as toggleable vendor layers. Educere is a fourth direct competitor in the K-12 virtual instruction space, and Sierra now has a CSV export of 1,894 unique Educere POs spanning FY21-FY26.

Without this data, the sales team has a blind spot: they cannot see which districts are buying Educere services, how much they are spending, or how that spending trends year-over-year. This matters for territory planning because Educere districts represent both competitive threats (districts spending with a rival) and conversion opportunities (districts already buying virtual instruction, potentially dissatisfied or open to switching).

**Who benefits:** Sales reps doing territory planning and competitive analysis. Sales managers reviewing territory competitive landscape.

**Why now:** The Educere PO data is freshly exported and ready. The infrastructure for competitor vendor layers, category classification, and map rendering already exists for three competitors. Adding a fourth is incremental, not architectural.

## Proposed Solution

Add Educere as a fourth competitor vendor across the full data pipeline: ETL import, materialized view, map tiles, vendor layer toggles, and district panel cards.

The implementation has three parts:

1. **ETL loader script** -- A standalone Python script (following the `competitor_spend.py` pattern) that reads the Educere CSV, normalizes NCES IDs via `normalize_leaid()`, parses currency amounts via `parse_currency()`, aggregates by district-competitor-FY, validates against the `districts` table, and upserts into `competitor_spend`. It deletes only Educere rows before inserting, leaving other competitors untouched. After insertion, it calls `refresh_map_features()` to update the materialized view. The script reuses the same ETL utilities as the main competitor loader.

2. **Map layer integration** -- Update the materialized view SQL to include Educere in the vendor category CTEs, producing `fy{XX}_educere_category` columns for FY24-FY27. Add `"educere"` to the `VendorId` type, `VENDOR_CONFIGS`, tile API `VENDOR_COLS`, and all downstream references. Educere appears as a toggleable vendor bubble in the LayerBubble, with its own fill palette (default: Plum), engagement filter checkboxes, and category coloring.

3. **PurchasingHistoryCard enhancement** -- Extend the existing Fullmind-only PurchasingHistoryCard to also show a "Competitor Spend" section below the Fullmind metrics. This fetches competitor spend data (including Educere) from the existing `/api/districts/[leaid]/competitor-spend` endpoint and renders it as grouped-by-competitor metric bars alongside Fullmind purchasing, creating a unified district purchasing overview. The standalone CompetitorSpendCard remains as-is.

## Technical Design

### Affected Files

| File | Action | Description |
|------|--------|-------------|
| `scripts/etl/loaders/load_educere_data.py` | **Create** | Standalone ETL loader for Educere CSV data. Reuses `parse_currency`, `normalize_leaid`, `refresh_map_features` from ETL utils. |
| `scripts/etl/loaders/competitor_spend.py` | **Modify** | Replace `TRUNCATE TABLE competitor_spend` with targeted `DELETE WHERE competitor IN (...)` to avoid wiping Educere rows on re-run. See ETL Ordering section. |
| `scripts/district-map-features-view.sql` | **Modify** | Add Educere to vendor CTEs and output columns |
| `src/features/map/lib/layers.ts` | **Modify** | Add `"educere"` to `VendorId`, `VENDOR_CONFIGS`, `VENDOR_IDS` |
| `src/features/map/lib/palettes.ts` | **Modify** | Add `educere` to `DEFAULT_VENDOR_PALETTE`. Import `VENDOR_IDS` from layers.ts to replace hardcoded vendor arrays. Add `educere: 0.75` to `buildDefaultCategoryOpacities()` internal `VENDOR_OPACITIES` map. |
| `src/features/map/lib/palette-storage.ts` | **Modify** | Add `educere` to `DEFAULT_VENDOR_OPACITIES`, bump `PREFS_VERSION` |
| `src/app/api/tiles/[z]/[x]/[y]/route.ts` | **Modify** | Add `"educere"` to `VENDOR_COLS` |
| `src/app/api/districts/summary/compare/route.ts` | **Modify** | Add `"educere"` to `VALID_VENDORS` array (line 7) |
| `src/app/api/districts/leaids/route.ts` | **Modify** | Add `"educere"` to `VALID_VENDORS` array (line 52) |
| `src/features/map/components/MapV2Container.tsx` | **Modify** | Replace hardcoded vendor array at line 356 with `VENDOR_IDS` import (file already uses `VENDOR_IDS` at lines 925, 953, 980, 1152) |
| `src/app/api/districts/[leaid]/competitor-spend/route.ts` | **Modify** | Add Educere entry to `COMPETITOR_COLORS` |
| `src/features/map/components/panels/district/PurchasingHistoryCard.tsx` | **Modify** | Add competitor spend section below Fullmind metrics. Accept new `leaid` prop. |
| `src/features/map/components/panels/district/DistrictDetailPanel.tsx` | **Modify** | Pass `leaid` prop to PurchasingHistoryCard |
| `src/features/map/components/panels/district/tabs/PlanningTab.tsx` | **Modify** | Pass `leaid` prop to PurchasingHistoryCard (PlanningTab already receives `leaid` as a prop) |
| `src/features/map/lib/store.ts` | **Modify** | Update default palette records and opacity records to include `"educere"`. TypeScript will enforce completeness once `VendorId` is extended. |
| `src/features/map/lib/__tests__/layers.test.ts` | **Modify** | Add Educere to parameterized competitor vendor test blocks (lines ~170 and ~420). Add config existence tests. |
| `src/features/map/lib/__tests__/palettes.test.ts` | **Modify** | Update `DEFAULT_CATEGORY_COLORS` count assertion from `37 + 19` to `46 + 19`. Add Educere default palette assertion. Update palette-storage round-trip test. |
| `src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts` | **Modify** | Update assertions to include Educere columns |

### Data Model Changes

**No Prisma schema changes required.** The `CompetitorSpend` model already stores arbitrary competitor names as a `VarChar(50)` string. Educere rows will use `competitor = 'Educere'` in the existing table.

**No migration needed.**

The `district_map_features` materialized view must be re-created (DROP + CREATE) to add Educere columns. This is handled by re-running the updated `district-map-features-view.sql` script. After the ETL loads Educere data into `competitor_spend`, the view refresh will populate the new `fy{XX}_educere_category` columns.

### Fix: `competitor_spend.py` TRUNCATE Risk

**File:** `scripts/etl/loaders/competitor_spend.py`

The existing `competitor_spend.py` uses `TRUNCATE TABLE competitor_spend` (line 205) which wipes **all** rows -- including Educere data loaded by the new Educere loader. This must be changed to a targeted delete before this feature ships.

**Before (line 205):**
```python
cur.execute("TRUNCATE TABLE competitor_spend")
```

**After:**
```python
cur.execute("DELETE FROM competitor_spend WHERE competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')")
```

This ensures `competitor_spend.py` only clears the three GovSpend competitors it manages, leaving Educere rows untouched.

### ETL Ordering

When running a full competitor data refresh, the scripts must be executed in this order:

1. **`competitor_spend.py`** -- loads GovSpend data for Proximity Learning, Elevate K12, Tutored By Teachers. Deletes only those three competitors' rows.
2. **`load_educere_data.py`** -- loads Educere data. Deletes only Educere rows.
3. **Materialized view refresh** -- both scripts call `refresh_map_features()` after insertion, but if running both back-to-back, only the final refresh matters.

If `competitor_spend.py` is run **after** `load_educere_data.py` without the TRUNCATE fix, it will destroy the Educere data. The TRUNCATE fix is therefore a prerequisite for safe coexistence.

### ETL Script Design (`scripts/etl/loaders/load_educere_data.py`)

The script follows the `competitor_spend.py` pattern: a single-file Python script that targets one competitor. It reuses the same ETL utilities (`parse_currency`, `normalize_leaid`, `refresh_map_features`) from `scripts/etl/utils/`.

**CSV column mapping:**

> **Note:** The Educere CSV uses different column names than the GovSpend CSV consumed by `competitor_spend.py`. The GovSpend CSV has `NCES ID - Clean`, `PO Spend`, `PO Date`, and `POID`. The Educere CSV has `Agency NCES ID`, `PO Amount`, `PO Signed Date`, `PO Number`, and a pre-computed `Fiscal Year` column. This means the Educere loader needs its own column mapping -- it cannot reuse `competitor_spend.py`'s `parse_csv_row()` function directly.

| CSV Column | Internal Field | Notes |
|-----------|---------------|-------|
| `Agency NCES ID` | `leaid` | Normalize via `normalize_leaid()`. 148 rows have empty values (skipped). 27 rows have 6-digit IDs (zero-padded to 7). |
| `Competitor` | `competitor` | Always "Educere" in this CSV. Hardcode rather than read from column. |
| `PO Amount` | `total_spend` | Parse via `parse_currency()`. Formats like "$2,495", "$11,063". |
| `PO Signed Date` | *(not used directly)* | Dates like "01/06/2026". The CSV already has a `Fiscal Year` column, so FY is read directly rather than computed from the date. |
| `Fiscal Year` | `fiscal_year` | Values like "FY26", "FY22". Read directly -- no date-based FY calculation needed. |
| `PO Number` | *(not stored)* | Individual PO IDs are not stored in the aggregated `competitor_spend` table. |

**Processing steps:**

1. Parse CSV with `csv.DictReader` (UTF-8-sig encoding for BOM handling)
2. For each row: normalize NCES ID, parse PO amount, read FY. Skip rows with empty NCES ID, zero/negative amount, or empty FY.
3. Aggregate by `(leaid, "Educere", fiscal_year)` -- summing `total_spend` and counting POs
4. Fetch valid LEAIDs from `districts` table
5. Filter aggregated records to only matched LEAIDs
6. `DELETE FROM competitor_spend WHERE competitor = 'Educere'` (targeted delete, not truncate)
7. Batch insert matched records
8. Commit
9. Print summary by FY
10. Call `refresh_map_features()` to update the materialized view

**Expected data profile:**
- ~1,894 raw PO rows
- ~148 rows skipped (empty NCES ID)
- ~1,746 rows with valid NCES IDs
- FY distribution: FY21 (111), FY22 (433), FY23 (420), FY24 (388), FY25 (416), FY26 (126)
- After aggregation by district-competitor-FY: fewer records (multiple POs per district-FY combo)

**CLI usage:**
```bash
cd /path/to/territory-plan
python scripts/etl/loaders/load_educere_data.py
```

The script hardcodes the CSV path relative to the project root: `data/Educere_Unique_POs.xlsx - Unique POs.csv`. Alternatively, accept a `--file` argument for flexibility.

### Materialized View Changes (`scripts/district-map-features-view.sql`)

Four types of changes to the view SQL:

#### 1. Add Educere to vendor CTE WHERE clauses

In `vendor_fy27`, `vendor_fy26`, `vendor_fy25`, and `vendor_fy24` CTEs, change:

```sql
-- Before:
WHERE competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')

-- After:
WHERE competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers', 'Educere')
```

Also update the `CASE vendor` mappings in `vendor_fy27` and `vendor_fy26` (which join against `vendor_financials` for pipeline data):

```sql
-- Add to CASE vendor block:
WHEN 'educere' THEN 'Educere'
```

And update the `vendor_financials` WHERE clause:

```sql
-- Before:
WHERE vendor IN ('proximity', 'elevate', 'tbt')

-- After:
WHERE vendor IN ('proximity', 'elevate', 'tbt', 'educere')
```

**Note:** Educere currently has no rows in `vendor_financials` (no pipeline data). The FULL OUTER JOIN handles this gracefully -- Educere districts will only get spend-based categories, not pipeline categories. If Educere pipeline data is added later, it will work automatically.

#### 2. Add Educere output columns to the SELECT

```sql
-- Add alongside existing competitor columns:
MAX(CASE WHEN v27.competitor = 'Educere' THEN v27.category END) AS fy27_educere_category,
MAX(CASE WHEN v26.competitor = 'Educere' THEN v26.category END) AS fy26_educere_category,
MAX(CASE WHEN v25.competitor = 'Educere' THEN v25.category END) AS fy25_educere_category,
MAX(CASE WHEN v24.competitor = 'Educere' THEN v24.category END) AS fy24_educere_category,
```

#### 3. Update partial indexes for has-data filtering

Add Educere to each `idx_dmf_has_data_fy{XX}` partial index:

```sql
CREATE INDEX idx_dmf_has_data_fy27 ON district_map_features(fy27_fullmind_category)
  WHERE fy27_fullmind_category IS NOT NULL
     OR fy27_proximity_category IS NOT NULL
     OR fy27_elevate_category IS NOT NULL
     OR fy27_tbt_category IS NOT NULL
     OR fy27_educere_category IS NOT NULL;
-- (repeat for fy26, fy25, fy24)
```

#### 4. Update summary query

Add Educere counts:

```sql
COUNT(*) FILTER (WHERE fy27_educere_category IS NOT NULL) AS fy27_educere,
COUNT(*) FILTER (WHERE fy26_educere_category IS NOT NULL) AS fy26_educere,
COUNT(*) FILTER (WHERE fy25_educere_category IS NOT NULL) AS fy25_educere,
COUNT(*) FILTER (WHERE fy24_educere_category IS NOT NULL) AS fy24_educere,
```

### API Changes

#### Modified: `GET /api/districts/[leaid]/competitor-spend`

**File:** `src/app/api/districts/[leaid]/competitor-spend/route.ts`

Add Educere to the `COMPETITOR_COLORS` map:

```typescript
const COMPETITOR_COLORS: Record<string, string> = {
  "Proximity Learning": "#6EA3BE",
  "Elevate K12": "#E07A5F",
  "Tutored By Teachers": "#7C3AED",
  "Educere": "#403770",  // Plum
};
```

No other changes needed. The API already returns all `competitor_spend` rows for the given LEAID, dynamically including any competitor name. The color is the only hardcoded piece.

#### Modified: `GET /api/tiles/[z]/[x]/[y]`

**File:** `src/app/api/tiles/[z]/[x]/[y]/route.ts`

Add `"educere"` to the `VENDOR_COLS` constant:

```typescript
// Before:
const VENDOR_COLS = ["fullmind", "proximity", "elevate", "tbt"] as const;

// After:
const VENDOR_COLS = ["fullmind", "proximity", "elevate", "tbt", "educere"] as const;
```

This single change cascades through the entire tile generation logic:
- Normal mode: tile includes `educere_category` (aliased from `fy{XX}_educere_category`)
- Comparison mode: tile includes `educere_category_a` and `educere_category_b`
- National view filter: includes `fy{XX}_educere_category IS NOT NULL` in the OR condition

#### Modified: `GET /api/districts/summary/compare`

**File:** `src/app/api/districts/summary/compare/route.ts`

Add `"educere"` to the `VALID_VENDORS` constant:

```typescript
// Before (line 7):
const VALID_VENDORS = ["fullmind", "proximity", "elevate", "tbt"] as const;

// After:
const VALID_VENDORS = ["fullmind", "proximity", "elevate", "tbt", "educere"] as const;
```

This route validates the `vendors` query parameter against `VALID_VENDORS`. Without adding `"educere"`, requests filtering by the Educere vendor in comparison summaries would be rejected as invalid.

#### Modified: `GET /api/districts/leaids`

**File:** `src/app/api/districts/leaids/route.ts`

Add `"educere"` to the `VALID_VENDORS` constant:

```typescript
// Before (line 52):
const VALID_VENDORS = ["fullmind", "proximity", "elevate", "tbt"];

// After:
const VALID_VENDORS = ["fullmind", "proximity", "elevate", "tbt", "educere"];
```

This route validates vendor parameters when filtering districts by vendor engagement. Without adding `"educere"`, the Educere vendor filter would be silently ignored.

### Map Layer Changes

#### `src/features/map/lib/layers.ts`

**1. Extend `VendorId` union type:**

```typescript
// Before:
export type VendorId = "fullmind" | "proximity" | "elevate" | "tbt";

// After:
export type VendorId = "fullmind" | "proximity" | "elevate" | "tbt" | "educere";
```

**2. Add Educere fill expression:**

Use the Plum palette by default. Educere is a competitor vendor, so the static `EDUCERE_FILL` uses the same simplified 3-category form as Proximity/Elevate/TBT (matching the `PROXIMITY_FILL`, `ELEVATE_FILL`, and `TBT_FILL` pattern). The dynamic palette system (`buildVendorFillExpression` and `buildVendorFillExpressionFromCategories` via `deriveVendorCategoryColors()`) generates the full 9-category expression at runtime from palette stops -- the static fill is only a fallback.

```typescript
// Colors from brand Plum tint/shade table
const EDUCERE_FILL: ExpressionSpecification = [
  "match",
  ["get", "educere_category"],
  "churned", "#ecebf1",    // Plum 90% tint (lightest)
  "new", "#665f8d",         // Plum 20% tint
  "multi_year", "#403770",  // Plum (full)
  "rgba(0,0,0,0)",
];
```

**3. Add to `VENDOR_CONFIGS`:**

```typescript
educere: {
  id: "educere",
  label: "Educere",
  tileProperty: "educere_category",
  fillColor: EDUCERE_FILL,
  fillOpacity: 0.75,
  shadingTooltip: "churned > new > multi-year",
},
```

**4. Add to `VENDOR_IDS`:**

```typescript
// Before:
export const VENDOR_IDS: VendorId[] = ["fullmind", "proximity", "elevate", "tbt"];

// After:
export const VENDOR_IDS: VendorId[] = ["fullmind", "proximity", "elevate", "tbt", "educere"];
```

#### `src/features/map/lib/palettes.ts`

**Add Educere to `DEFAULT_VENDOR_PALETTE`:**

```typescript
// Before:
export const DEFAULT_VENDOR_PALETTE: Record<VendorId, string> = {
  fullmind: "steel-blue",
  proximity: "coral",
  elevate: "steel-blue",
  tbt: "golden",
};

// After:
export const DEFAULT_VENDOR_PALETTE: Record<VendorId, string> = {
  fullmind: "steel-blue",
  proximity: "coral",
  elevate: "steel-blue",
  tbt: "golden",
  educere: "plum",
};
```

**Update `buildDefaultCategoryColors` and `buildDefaultCategoryOpacities`:**

These functions iterate over a hardcoded `vendorIds` array. Replace it with the canonical `VENDOR_IDS` import from layers.ts to avoid future drift when adding new vendors:

```typescript
// Before:
const vendorIds: VendorId[] = ["fullmind", "proximity", "elevate", "tbt"];

// After:
import { VENDOR_IDS } from "@/features/map/lib/layers";
// ... then use VENDOR_IDS directly instead of the local vendorIds array
```

This eliminates the hardcoded list and ensures `palettes.ts` automatically picks up any future vendor additions.

**Update `buildDefaultCategoryOpacities` internal `VENDOR_OPACITIES` map:**

The `buildDefaultCategoryOpacities()` function has an internal `VENDOR_OPACITIES` map that maps each vendor to its default opacity. Add Educere:

```typescript
// Inside buildDefaultCategoryOpacities():
const VENDOR_OPACITIES: Record<VendorId, number> = {
  fullmind: 0.75,
  proximity: 0.75,
  elevate: 0.8,
  tbt: 0.75,
  educere: 0.75,  // NEW
};
```

Without this, `buildDefaultCategoryOpacities()` would have no opacity value for Educere categories, resulting in missing opacity entries in the default category opacities record.

#### `src/features/map/lib/palette-storage.ts`

**Add Educere to `DEFAULT_VENDOR_OPACITIES`:**

```typescript
// Before:
const DEFAULT_VENDOR_OPACITIES: Record<VendorId, number> = {
  fullmind: 0.75,
  proximity: 0.75,
  elevate: 0.8,
  tbt: 0.75,
};

// After:
const DEFAULT_VENDOR_OPACITIES: Record<VendorId, number> = {
  fullmind: 0.75,
  proximity: 0.75,
  elevate: 0.8,
  tbt: 0.75,
  educere: 0.75,
};
```

**Bump `PREFS_VERSION`** from 3 to 4 to clear stale cached palette prefs that do not include Educere.

#### `src/features/map/lib/store.ts`

The store uses `VendorId` from layers.ts in typed records (`Record<VendorId, string>` for palettes, `Record<VendorId, number>` for opacities). Once `VendorId` is extended with `"educere"`, TypeScript will produce compile errors on any `Record<VendorId, ...>` literal that omits the `educere` key. This means the following changes are **enforced by the compiler** -- the build will fail without them:

- `vendorPalettes` initial value must include `educere: "plum"`
- `vendorOpacities` initial value must include `educere: 0.75`
- The `activeVendors` default set stays as `new Set(["fullmind"])` -- Educere is opt-in, not on by default

#### `src/features/map/components/MapV2Container.tsx`

**Fix hardcoded vendor array at line 356:**

The initial map layer setup loop hardcodes the vendor list instead of using the canonical `VENDOR_IDS`:

```typescript
// Before (line 356):
for (const vendorId of ["fullmind", "proximity", "elevate", "tbt"] as const) {

// After:
for (const vendorId of VENDOR_IDS) {
```

The file already imports and uses `VENDOR_IDS` at lines 925, 953, 980, and 1152. Line 356 is an oversight that must be updated to pick up Educere automatically. Without this fix, the Educere layer would not be initialized when the map loads, even though later logic (palette updates, visibility toggles) would reference it.

### UI Changes

#### PurchasingHistoryCard Enhancement

**File:** `src/features/map/components/panels/district/PurchasingHistoryCard.tsx`

The card currently shows only Fullmind metrics. Add a "Competitor Spend" section below the Fullmind data. This requires fetching competitor spend data from the existing API.

**New props:**

```typescript
interface PurchasingHistoryCardProps {
  fullmindData: FullmindData | null;
  leaid: string;  // NEW: needed to fetch competitor spend
}
```

**Internal data fetching:**

Add a TanStack Query call inside the component (same pattern as CompetitorSpendCard):

```typescript
const { data: competitorData } = useQuery<CompetitorSpendResponse>({
  queryKey: ["competitorSpend", leaid],
  queryFn: async () => {
    const res = await fetch(`/api/districts/${leaid}/competitor-spend`);
    if (!res.ok) throw new Error("Failed to fetch competitor spend");
    return res.json();
  },
  staleTime: 10 * 60 * 1000,
});
```

**Rendering the competitor section:**

Below the existing Fullmind FY sections, add a divider and competitor spend summary:

```
+-----------------------------------------+
| $ Fullmind Purchasing         ^ 12% YoY |
|-----------------------------------------|
| $142.5K  FY26 Revenue                   |
| [====== Sessions Revenue ====] $142.5K  |
| [======= Net Invoicing =====] $98.2K   |
| [======= Closed Won ========] $85.0K   |
|-----------------------------------------|
| Competitor Spend                        |
|                                         |
| * Educere                               |
|   FY26  $15.2K (3 POs)                 |
|   FY25  $28.4K (8 POs)                 |
| * Proximity Learning                    |
|   FY26  $8.5K (2 POs)                  |
+-----------------------------------------+
```

- Divider: `border-t border-gray-100` with `pt-3 mt-3`
- Section header: `text-xs font-semibold text-[#403770]` reading "Competitor Spend"
- Each competitor: colored dot (using color from API response), competitor name, FY rows with spend + PO count
- Only shown if `competitorData?.competitorSpend?.length > 0`
- Competitor list sorted by total spend descending (same as CompetitorSpendCard)

**Visibility logic update:**

The card currently returns `null` if there is no Fullmind data. With the competitor section added, the card should render if *either* Fullmind data or competitor data exists:

```typescript
const hasFullmindData = fy25Metrics.length > 0 || fy26Metrics.length > 0 || fy27Metrics.length > 0;
const hasCompetitorData = (competitorData?.competitorSpend?.length ?? 0) > 0;

if (!hasFullmindData && !hasCompetitorData) return null;
```

**Parent component updates:**

Two parent components render PurchasingHistoryCard and must pass the new `leaid` prop:

**1. `src/features/map/components/panels/district/DistrictDetailPanel.tsx`:**

```typescript
// Before:
<PurchasingHistoryCard fullmindData={data.fullmindData} />

// After:
<PurchasingHistoryCard fullmindData={data.fullmindData} leaid={selectedLeaid!} />
```

**2. `src/features/map/components/panels/district/tabs/PlanningTab.tsx`:**

PlanningTab already receives `leaid` as a prop in its interface, so it just needs to forward it:

```typescript
// Before (line 82):
<PurchasingHistoryCard fullmindData={data.fullmindData} />

// After:
<PurchasingHistoryCard fullmindData={data.fullmindData} leaid={leaid} />
```

#### LayerBubble -- No Direct Changes Required

The LayerBubble already dynamically renders competitor vendor toggles by iterating over `VENDOR_IDS.filter(v => v !== "fullmind")`. Adding `"educere"` to `VENDOR_IDS` causes it to appear automatically as a toggleable vendor with its own engagement filter checkboxes.

The Educere toggle will show:
- Vendor label: "Educere" (from `VENDOR_CONFIGS.educere.label`)
- Colored dot: Plum (from the default palette)
- Engagement filter checkboxes: same as other competitors (Pipeline group, Multi-Year group, New, Churned)

#### CompetitorSpendCard -- No Changes Required

This card already dynamically renders all competitors from the API response. Once Educere data exists in `competitor_spend` and has a color in `COMPETITOR_COLORS`, it appears automatically. The card sorts by total spend descending, shows up to 4 competitors in the summary bar (line 124: `sortedCompetitors.slice(0, 4)`), and displays all competitors in the detail view.

### Brand Color Reference

| Token | Hex | Usage |
|-------|-----|-------|
| Plum | `#403770` | Educere default map palette base color, competitor-spend API color, multi_year static fill |
| Plum 90% tint | `#ecebf1` | Educere churned static fill (lightest) |
| Plum 20% tint | `#665f8d` | Educere new static fill |

The dynamic palette system (`deriveVendorCategoryColors`) generates the full 9-category color set at runtime from the palette's 7 stops. The static `EDUCERE_FILL` only provides the simplified 3-category fallback.

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **Empty NCES ID in CSV** | 148 rows have empty `Agency NCES ID`. The ETL skips these rows and logs the count. These represent agencies without a matched school district (e.g., "Town of Shrewsbury" with no NCES ID). |
| **6-digit NCES IDs** | 27 rows have 6-digit IDs (e.g., `604020` for a California district). The `normalize_leaid()` function zero-pads to 7 characters (`0604020`). Already tested and working for other competitor loaders. |
| **NCES ID not in districts table** | Some Educere districts may not exist in the ~13,000-row districts table. The ETL validates against the `districts` table and reports unmatched records. Unmatched rows are logged but not inserted (foreign key constraint on `competitor_spend.leaid`). |
| **Duplicate POs per district-FY** | Multiple POs for the same district in the same FY (e.g., Mahwah Township has 2 POs on 11/20/2025). The ETL aggregates by `(leaid, "Educere", fiscal_year)`, summing amounts and counting POs. |
| **Re-running the Educere ETL** | Safe to re-run. The script deletes all existing Educere rows before inserting, ensuring idempotency. Other competitors are not affected. |
| **Running `competitor_spend.py` after Educere load** | **Requires the TRUNCATE fix first.** Without the fix, `competitor_spend.py`'s `TRUNCATE TABLE competitor_spend` wipes Educere rows. After the fix (targeted `DELETE WHERE competitor IN (...)`), both scripts coexist safely. See "Fix: `competitor_spend.py` TRUNCATE Risk" section. |
| **PurchasingHistoryCard with no Fullmind data but has competitor data** | The card renders with only the competitor spend section. The Fullmind headline shows "No purchasing history" and the competitor section renders below it. |
| **PurchasingHistoryCard with no competitor data** | The competitor section is hidden. The card behaves exactly as it does today (Fullmind-only). |
| **District with both Fullmind and Educere spend** | Both sections render. This is valuable competitive intelligence -- the district is buying from both vendors, indicating a potential expansion or displacement opportunity. |
| **Materialized view re-creation** | The view must be dropped and re-created (not just refreshed) to add new columns. The `district-map-features-view.sql` script handles this. During the brief window between DROP and CREATE, tile requests may fail. This is acceptable for a maintenance operation -- run during low-traffic hours. |
| **Stale cached palette preferences** | Bumping `PREFS_VERSION` in `palette-storage.ts` clears localStorage palette cache. Users will get fresh defaults that include Educere. Without this, the palette system would have missing keys for the new vendor. |
| **FY21 data in Educere but no FY21 columns in materialized view** | The view computes categories for FY24-FY27 only. FY21-FY23 Educere spend data is stored in `competitor_spend` and appears in the CompetitorSpendCard and PurchasingHistoryCard (which read directly from the table). It does NOT appear as a map layer category (no `fy21_educere_category` column). This is consistent with how other competitors work -- map layers only cover the FY range supported by the view. |
| **No Educere pipeline data in vendor_financials** | Educere has no rows in `vendor_financials` (no pipeline/revenue data beyond PO spend). The materialized view CTEs use FULL OUTER JOIN, so Educere gets spend-based categories only (new, multi_year_growing, etc.) but no pipeline categories (renewal_pipeline, expansion_pipeline, etc.) unless Educere pipeline data is loaded later. This is the correct behavior -- we should not fabricate pipeline categories from PO data alone. |

## Testing Strategy

### ETL Script Tests -- Manual Verification (Priority 1)

The ETL loader is a standalone Python script. Verification is done by running the script and checking output:

| # | Check | What It Verifies |
|---|-------|-----------------|
| 1 | Script parses all 1,894 CSV rows | CSV reading and column mapping |
| 2 | ~148 rows skipped (empty NCES ID) | Empty ID handling |
| 3 | 6-digit IDs zero-padded to 7 | `normalize_leaid()` for short IDs |
| 4 | PO amounts parsed correctly ($2,495 -> 2495.0) | `parse_currency()` for comma-formatted dollars |
| 5 | FY column read directly (no date calculation) | FY mapping |
| 6 | Aggregation reduces row count | Multiple POs per district-FY summed |
| 7 | Unmatched LEAIDs reported but not inserted | FK validation |
| 8 | `DELETE FROM competitor_spend WHERE competitor = 'Educere'` runs before insert | Targeted delete |
| 9 | Other competitors untouched after Educere ETL | Row counts for Proximity/Elevate/TBT unchanged |
| 10 | Materialized view refresh completes | `refresh_map_features()` call |
| 11 | `SELECT COUNT(*) FROM competitor_spend WHERE competitor = 'Educere' GROUP BY fiscal_year` returns expected FY distribution | Data integrity |
| 12 | Run `competitor_spend.py` after Educere load -- Educere rows survive | TRUNCATE fix verified (targeted DELETE) |
| 13 | Run `competitor_spend.py` -- only Proximity/Elevate/TBT rows replaced | GovSpend loader still works correctly after fix |

### Unit Tests -- Priority 1 (`src/features/map/lib/__tests__/layers.test.ts`)

Add tests to the existing layers test file, and update existing parameterized tests:

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 14 | `VENDOR_CONFIGS.educere` exists with correct properties | Config registration |
| 15 | `VENDOR_CONFIGS.educere.tileProperty` is `"educere_category"` | Tile property name |
| 16 | `VENDOR_IDS` contains `"educere"` | Vendor ID list |
| 17 | `new Set(VENDOR_IDS).size === VENDOR_IDS.length` | No accidental duplicates (count-independent) |
| 18 | `buildVendorFillExpression("educere", palette)` returns valid expression | Fill expression generation |
| 19 | `buildVendorFillExpressionFromCategories("educere", colors)` returns valid expression | Category color expression |
| 20 | `buildCategoryOpacityExpression("educere", opacities)` returns valid expression | Opacity expression |

**Existing test updates in layers.test.ts:**

- **Line ~170:** Update the parameterized competitor vendor `describe.each` block from `["proximity", "elevate", "tbt"]` to `["proximity", "elevate", "tbt", "educere"]`. This automatically runs the "9 categories" test suite (match expression structure, tileProperty naming, churned orange color mapping) for Educere.
- **Line ~420:** Update the second parameterized `describe.each` block from `["proximity", "elevate", "tbt"]` to `["proximity", "elevate", "tbt", "educere"]`. This runs the "competitor vendor with all keys provided" tests (category color expression from provided colors) for Educere.

### Unit Tests -- Priority 1 (`src/features/map/lib/__tests__/palettes.test.ts`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 21 | `DEFAULT_VENDOR_PALETTE.educere` is `"plum"` | Default palette assignment |
| 22 | `deriveVendorCategoryColors("educere", plumPalette)` returns all expected keys | Category color derivation |
| 23 | `DEFAULT_CATEGORY_COLORS` includes `"educere:churned"`, `"educere:new"`, `"educere:multi_year_growing"` etc. | Global defaults include Educere |

**Existing test updates in palettes.test.ts:**

- **`DEFAULT_CATEGORY_COLORS` count assertion (line ~170):** Update from `expect(Object.keys(DEFAULT_CATEGORY_COLORS).length).toBe(37 + 19)` to `expect(Object.keys(DEFAULT_CATEGORY_COLORS).length).toBe(46 + 19)`. The increase is +9 for Educere's category keys (churned, new, new_business_pipeline, winback_pipeline, renewal_pipeline, expansion_pipeline, multi_year_growing, multi_year_flat, multi_year_shrinking).
- **`default vendor palettes` assertion (line ~51):** Add `expect(DEFAULT_VENDOR_PALETTE.educere).toBe("plum")` alongside the existing four vendor assertions.
- **palette-storage round-trip test (line ~299):** Update the `vendorPalettes` object to include `educere: "plum"` and the `vendorOpacities` object to include `educere: 0.75`, so the round-trip test validates Educere persistence.

### API Tests -- Priority 2 (`src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts`)

| # | Test Case | What It Verifies |
|---|-----------|-----------------|
| 24 | Tile query includes `educere_category` column in normal mode | Column aliasing |
| 25 | Tile query includes `educere_category_a` and `educere_category_b` in comparison mode | Comparison aliasing |
| 26 | National view filter includes `educere_category IS NOT NULL` | Low-zoom optimization |

### Component Tests -- Priority 2

| # | Test Case | What It Verifies | File |
|---|-----------|-----------------|------|
| 27 | PurchasingHistoryCard renders competitor section when competitor data exists | Competitor section visibility | `PurchasingHistoryCard.test.tsx` (create) |
| 28 | PurchasingHistoryCard hides competitor section when no competitor data | Section hidden | `PurchasingHistoryCard.test.tsx` |
| 29 | PurchasingHistoryCard renders when only competitor data exists (no Fullmind) | Card visibility with competitors only | `PurchasingHistoryCard.test.tsx` |
| 30 | PurchasingHistoryCard shows Educere with correct color dot | Color mapping | `PurchasingHistoryCard.test.tsx` |
| 31 | CompetitorSpendCard renders Educere alongside other competitors | Dynamic rendering | Existing card already tested implicitly |

**Approximate total: 31 test cases (13 manual ETL checks + 10 unit tests + 3 API tests + 5 component tests).**

### Manual Testing Checklist

- [ ] Run Educere ETL script -- verify Educere rows appear in `competitor_spend`
- [ ] Run `competitor_spend.py` after Educere load -- verify Educere rows survive (TRUNCATE fix)
- [ ] Run `district-map-features-view.sql` -- verify `fy{XX}_educere_category` columns populated
- [ ] Open Territory Planner, toggle Educere layer in LayerBubble -- districts colored on map
- [ ] Click a district with Educere spend -- CompetitorSpendCard shows Educere data
- [ ] Click a district with Educere spend -- PurchasingHistoryCard shows competitor section with Educere
- [ ] Click a district with only Fullmind data -- PurchasingHistoryCard shows Fullmind only, no competitor section
- [ ] Click a district with only Educere data (no Fullmind) -- PurchasingHistoryCard shows competitor section only
- [ ] Toggle FY in LayerBubble (FY24-FY26) -- Educere layer updates categories correctly
- [ ] Comparison mode (if implemented) -- Educere categories appear in both FY panes
- [ ] Verify other competitor layers still work unchanged (Proximity, Elevate, TBT)
- [ ] Check palette picker -- Educere shows Plum default, switchable to other palettes
