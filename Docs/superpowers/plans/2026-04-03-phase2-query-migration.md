# Phase 2a: Query Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap all app queries from districts FY columns and competitor_spend to read from district_financials (renamed vendor_financials), replace materialized view references, and keep all API response shapes identical so the frontend requires zero changes.

**Architecture:** Each API route is updated independently — include the `districtFinancials` Prisma relation or JOIN `district_financials` in raw SQL, then transform the result back to the existing flat FY field format. Routes that sort/aggregate by financial metrics switch to `$queryRaw` with JOINs (Prisma can't sort on filtered relation fields). A shared helper extracts FY-specific values from the `districtFinancials[]` array. The `district_map_features` materialized view is updated to read pipeline data from `district_financials` instead of districts FY columns.

**Tech Stack:** PostgreSQL, Prisma ORM, TypeScript, Next.js App Router

**Spec:** `docs/superpowers/specs/2026-04-01-db-normalization-claude-query-tool-design.md` (Phase 2 section)

**Deviation from spec:**
- The Claude query tool (spec Part 2) is deferred to a separate plan (Phase 2b). This plan covers only the query migration.
- Person FK migration (owner → owner_id) and state FK migration are deferred — they affect fewer queries and can be done independently.
- Frontend types/components are NOT changed. API response shapes stay identical. Frontend cleanup happens in Phase 3.

**Working directory:** `/Users/sierrastorm/thespot/territory-plan/.worktrees/db-normalization-query-tool`

**Key pattern — Prisma routes:**
```typescript
// BEFORE: select FY columns from districts
const district = await prisma.district.findUnique({
  where: { leaid },
  select: { fy26OpenPipeline: true, fy26NetInvoicing: true }
});
// response: { fy26OpenPipeline: 1000, fy26NetInvoicing: 2000 }

// AFTER: include districtFinancials relation, transform to same shape
const district = await prisma.district.findUnique({
  where: { leaid },
  include: {
    districtFinancials: {
      where: { vendor: 'fullmind' },
      select: { fiscalYear: true, openPipeline: true, invoicing: true }
    }
  }
});
const fy26 = district.districtFinancials.find(f => f.fiscalYear === 'FY26');
// response: { fy26OpenPipeline: fy26?.openPipeline ?? 0, fy26NetInvoicing: fy26?.invoicing ?? 0 }
```

**Key pattern — Raw SQL routes:**
```sql
-- BEFORE: read FY columns from districts
SELECT d.fy26_open_pipeline, d.fy25_net_invoicing FROM districts d

-- AFTER: JOIN district_financials
SELECT
  COALESCE(df26.open_pipeline, 0) AS fy26_open_pipeline,
  COALESCE(df25.invoicing, 0) AS fy25_net_invoicing
FROM districts d
LEFT JOIN district_financials df26 ON df26.leaid = d.leaid
  AND df26.vendor = 'fullmind' AND df26.fiscal_year = 'FY26'
LEFT JOIN district_financials df25 ON df25.leaid = d.leaid
  AND df25.vendor = 'fullmind' AND df25.fiscal_year = 'FY25'
```

---

### Task 1: Rename VendorFinancials → DistrictFinancials in Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

Phase 1 deferred this rename. Now we do it: rename the Prisma model and update `@@map` to rename the physical table. All relation references across the schema must update.

- [ ] **Step 1: Rename model and update all references in schema.prisma**

In `prisma/schema.prisma`:

1. Rename `model VendorFinancials` → `model DistrictFinancials`
2. Add/update `@@map("district_financials")` (the physical table rename)
3. Update the relation field on `District` model: `vendorFinancials VendorFinancials[]` → `districtFinancials DistrictFinancials[]`
4. Update the relation field on `UnmatchedAccount` model: `financials VendorFinancials[]` → `districtFinancials DistrictFinancials[]`
5. Update the `@@unique` constraint if it references the old name

- [ ] **Step 2: Create SQL migration for physical table rename**

Create: `prisma/migrations/manual/phase2_rename_vendor_financials.sql`

```sql
-- Rename physical table: vendor_financials → district_financials
ALTER TABLE vendor_financials RENAME TO district_financials;

-- Rename indexes to match new table name
ALTER INDEX IF EXISTS vendor_financials_pkey RENAME TO district_financials_pkey;
ALTER INDEX IF EXISTS vendor_financials_leaid_vendor_fiscal_year_key RENAME TO district_financials_leaid_vendor_fiscal_year_key;
ALTER INDEX IF EXISTS idx_vf_leaid RENAME TO idx_df_leaid;
ALTER INDEX IF EXISTS idx_vf_vendor_fy RENAME TO idx_df_vendor_fy;

-- Rename sequences
ALTER SEQUENCE IF EXISTS vendor_financials_id_seq RENAME TO district_financials_id_seq;
```

- [ ] **Step 3: Update all raw SQL references to vendor_financials**

Search the codebase for `vendor_financials` in raw SQL strings and update to `district_financials`. Files to update:

- `src/app/api/districts/summary/route.ts` — JOIN references
- `src/app/api/districts/summary/__tests__/route.test.ts` — test mocks
- `src/app/api/districts/search/route.ts` — Prisma relation filter (uses model name, auto-updates)
- `src/app/admin/icp-scoring/components/MethodologySummary.tsx` — display text only
- `scripts/district-map-features-view.sql` — view definition
- `scripts/seed-vendor-financials.sql` — seed script
- `scripts/verify-vendor-financials.sql` — verification script
- `scripts/vendor-comparison-view.sql` — view definition
- `scripts/etl/loaders/vendor_financials.py` — ETL loader

For each file, find `vendor_financials` in SQL strings/table references and replace with `district_financials`.

- [ ] **Step 4: Verify Prisma schema is valid**

Run: `cd /Users/sierrastorm/thespot/territory-plan/.worktrees/db-normalization-query-tool && npx prisma validate`
Expected: "Your Prisma schema is valid."

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/manual/phase2_rename_vendor_financials.sql
git add -u  # catch all updated raw SQL references
git commit -m "feat(schema): rename vendor_financials → district_financials (model + table)"
```

---

### Task 2: Create shared financial data helper

**Files:**
- Create: `src/features/shared/lib/financial-helpers.ts`
- Create: `src/features/shared/lib/__tests__/financial-helpers.test.ts`

This utility extracts FY-specific values from a `DistrictFinancials[]` array, returning the same flat structure the API currently returns. Every Prisma route swap will use this.

- [ ] **Step 1: Write the test**

Create `src/features/shared/lib/__tests__/financial-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractFullmindFinancials } from "../financial-helpers";

const mockFinancials = [
  {
    fiscalYear: "FY25",
    vendor: "fullmind",
    totalRevenue: 50000,
    allTake: 25000,
    sessionCount: 100,
    closedWonOppCount: 3,
    closedWonBookings: 45000,
    invoicing: 48000,
    openPipeline: 0,
    openPipelineOppCount: 0,
    weightedPipeline: 0,
  },
  {
    fiscalYear: "FY26",
    vendor: "fullmind",
    totalRevenue: 60000,
    allTake: 30000,
    sessionCount: 120,
    closedWonOppCount: 4,
    closedWonBookings: 55000,
    invoicing: 58000,
    openPipeline: 20000,
    openPipelineOppCount: 2,
    weightedPipeline: 15000,
  },
  {
    fiscalYear: "FY27",
    vendor: "fullmind",
    totalRevenue: 0,
    allTake: 0,
    sessionCount: 0,
    closedWonOppCount: 0,
    closedWonBookings: 0,
    invoicing: 0,
    openPipeline: 35000,
    openPipelineOppCount: 3,
    weightedPipeline: 28000,
  },
];

describe("extractFullmindFinancials", () => {
  it("extracts FY25 session fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy25SessionsRevenue).toBe(50000);
    expect(result.fy25SessionsTake).toBe(25000);
    expect(result.fy25SessionsCount).toBe(100);
  });

  it("extracts FY26 booking fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy26ClosedWonOppCount).toBe(4);
    expect(result.fy26ClosedWonNetBooking).toBe(55000);
    expect(result.fy26NetInvoicing).toBe(58000);
  });

  it("extracts FY26 pipeline fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy26OpenPipeline).toBe(20000);
    expect(result.fy26OpenPipelineOppCount).toBe(2);
    expect(result.fy26OpenPipelineWeighted).toBe(15000);
  });

  it("extracts FY27 pipeline fields", () => {
    const result = extractFullmindFinancials(mockFinancials);
    expect(result.fy27OpenPipeline).toBe(35000);
    expect(result.fy27OpenPipelineOppCount).toBe(3);
    expect(result.fy27OpenPipelineWeighted).toBe(28000);
  });

  it("returns zeros for empty array", () => {
    const result = extractFullmindFinancials([]);
    expect(result.fy25SessionsRevenue).toBe(0);
    expect(result.fy26OpenPipeline).toBe(0);
    expect(result.fy27OpenPipeline).toBe(0);
  });

  it("handles missing fiscal years gracefully", () => {
    const partial = [mockFinancials[1]]; // only FY26
    const result = extractFullmindFinancials(partial);
    expect(result.fy25SessionsRevenue).toBe(0);
    expect(result.fy26NetInvoicing).toBe(58000);
    expect(result.fy27OpenPipeline).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/sierrastorm/thespot/territory-plan/.worktrees/db-normalization-query-tool && npx vitest run src/features/shared/lib/__tests__/financial-helpers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the helper**

Create `src/features/shared/lib/financial-helpers.ts`:

```typescript
/**
 * Financial data from the DistrictFinancials relation.
 * Matches the shape returned by Prisma select on the model.
 */
interface FinancialRecord {
  fiscalYear: string;
  vendor: string;
  totalRevenue: unknown; // Prisma Decimal
  allTake: unknown;
  sessionCount: number | null;
  closedWonOppCount: number | null;
  closedWonBookings: unknown;
  invoicing: unknown;
  openPipeline: unknown;
  openPipelineOppCount: number | null;
  weightedPipeline: unknown;
}

/** Convert Prisma Decimal or number to plain number */
function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "toNumber" in (v as Record<string, unknown>)) {
    return Number(v);
  }
  return Number(v) || 0;
}

/**
 * Select fields needed from districtFinancials for the helper.
 * Use this in Prisma `include` to get the right shape.
 */
export const FULLMIND_FINANCIALS_SELECT = {
  fiscalYear: true,
  vendor: true,
  totalRevenue: true,
  allTake: true,
  sessionCount: true,
  closedWonOppCount: true,
  closedWonBookings: true,
  invoicing: true,
  openPipeline: true,
  openPipelineOppCount: true,
  weightedPipeline: true,
} as const;

/**
 * Extract flat FY-specific fields from a DistrictFinancials[] array.
 * Returns the same shape as the current API responses use,
 * so frontend code doesn't need to change.
 */
export function extractFullmindFinancials(financials: FinancialRecord[]) {
  const fy25 = financials.find((f) => f.fiscalYear === "FY25");
  const fy26 = financials.find((f) => f.fiscalYear === "FY26");
  const fy27 = financials.find((f) => f.fiscalYear === "FY27");

  return {
    // FY25 Sessions
    fy25SessionsRevenue: toNum(fy25?.totalRevenue),
    fy25SessionsTake: toNum(fy25?.allTake),
    fy25SessionsCount: fy25?.sessionCount ?? 0,
    // FY26 Sessions
    fy26SessionsRevenue: toNum(fy26?.totalRevenue),
    fy26SessionsTake: toNum(fy26?.allTake),
    fy26SessionsCount: fy26?.sessionCount ?? 0,
    // FY25 Bookings
    fy25ClosedWonOppCount: fy25?.closedWonOppCount ?? 0,
    fy25ClosedWonNetBooking: toNum(fy25?.closedWonBookings),
    fy25NetInvoicing: toNum(fy25?.invoicing),
    // FY26 Bookings
    fy26ClosedWonOppCount: fy26?.closedWonOppCount ?? 0,
    fy26ClosedWonNetBooking: toNum(fy26?.closedWonBookings),
    fy26NetInvoicing: toNum(fy26?.invoicing),
    // FY26 Pipeline
    fy26OpenPipelineOppCount: fy26?.openPipelineOppCount ?? 0,
    fy26OpenPipeline: toNum(fy26?.openPipeline),
    fy26OpenPipelineWeighted: toNum(fy26?.weightedPipeline),
    // FY27 Pipeline
    fy27OpenPipelineOppCount: fy27?.openPipelineOppCount ?? 0,
    fy27OpenPipeline: toNum(fy27?.openPipeline),
    fy27OpenPipelineWeighted: toNum(fy27?.weightedPipeline),
  };
}

/**
 * Get a single financial metric for a given vendor and fiscal year.
 * Useful for routes that need one specific value (e.g., pipeline for a plan's FY).
 */
export function getFinancialValue(
  financials: FinancialRecord[],
  vendor: string,
  fiscalYear: string,
  field: keyof Omit<FinancialRecord, "fiscalYear" | "vendor">
): number {
  const record = financials.find(
    (f) => f.vendor === vendor && f.fiscalYear === fiscalYear
  );
  if (!record) return 0;
  const value = record[field];
  return typeof value === "number" ? value : toNum(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/sierrastorm/thespot/territory-plan/.worktrees/db-normalization-query-tool && npx vitest run src/features/shared/lib/__tests__/financial-helpers.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/lib/financial-helpers.ts src/features/shared/lib/__tests__/financial-helpers.test.ts
git commit -m "feat: add extractFullmindFinancials helper for query migration"
```

---

### Task 3: Update district_map_features materialized view

**Files:**
- Modify: `scripts/district-map-features-view.sql`

The view currently reads `d.fy26_open_pipeline` and `d.fy27_open_pipeline` from districts, and `competitor_spend` for competitor categories. Update to read all financial data from `district_financials`.

- [ ] **Step 1: Update fullmind_fy27 CTE to read pipeline from district_financials**

In `scripts/district-map-features-view.sql`, find the `fullmind_fy27` CTE (around line 24).

Replace all `d.fy27_open_pipeline` references with `COALESCE(df27.open_pipeline, 0)` and add a JOIN:

```sql
fullmind_fy27 AS (
  SELECT
    d.leaid,
    CASE
      WHEN COALESCE(vf26.total_revenue, 0) > 0
        AND COALESCE(df27.open_pipeline, 0) > COALESCE(vf26.total_revenue, 0)
      THEN 'expansion_pipeline'

      WHEN COALESCE(vf26.total_revenue, 0) > 0
        AND COALESCE(df27.open_pipeline, 0) > 0
      THEN 'renewal_pipeline'

      WHEN COALESCE(df27.open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM district_financials vf
          WHERE vf.leaid = d.leaid AND vf.vendor = 'fullmind' AND vf.total_revenue > 0
        )
      THEN 'winback_pipeline'

      WHEN COALESCE(df27.open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
      THEN 'new_business_pipeline'

      WHEN ip.leaid IS NOT NULL
      THEN 'target'

      ELSE NULL
    END AS fy27_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
  LEFT JOIN district_financials vf26 ON d.leaid = vf26.leaid
    AND vf26.vendor = 'fullmind' AND vf26.fiscal_year = 'FY26'
  LEFT JOIN district_financials df27 ON d.leaid = df27.leaid
    AND df27.vendor = 'fullmind' AND df27.fiscal_year = 'FY27'
),
```

- [ ] **Step 2: Update fullmind_fy26 CTE to read pipeline from district_financials**

Same pattern: replace `d.fy26_open_pipeline` with `COALESCE(df26.open_pipeline, 0)` and add a JOIN for `df26` specifically for pipeline:

```sql
fullmind_fy26 AS (
  SELECT
    d.leaid,
    CASE
      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(vf26.total_revenue, 0) > 0
        AND vf26.total_revenue > vf25.total_revenue
      THEN 'multi_year_growing'

      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(vf26.total_revenue, 0) > 0
        AND vf26.total_revenue < vf25.total_revenue
      THEN 'multi_year_shrinking'

      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(vf26.total_revenue, 0) > 0
      THEN 'multi_year_flat'

      WHEN COALESCE(vf26.total_revenue, 0) > 0
        AND NOT COALESCE(vf25.total_revenue, 0) > 0
      THEN 'new'

      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(df26_pipe.open_pipeline, 0) > COALESCE(vf25.total_revenue, 0)
      THEN 'expansion_pipeline'

      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(df26_pipe.open_pipeline, 0) > 0
      THEN 'renewal_pipeline'

      WHEN COALESCE(df26_pipe.open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM district_financials vf
          WHERE vf.leaid = d.leaid AND vf.vendor = 'fullmind' AND vf.total_revenue > 0
        )
      THEN 'winback_pipeline'

      WHEN COALESCE(df26_pipe.open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
      THEN 'new_business_pipeline'

      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND NOT COALESCE(vf26.total_revenue, 0) > 0
      THEN 'lapsed'

      WHEN ip.leaid IS NOT NULL
      THEN 'target'

      ELSE NULL
    END AS fy26_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
  LEFT JOIN district_financials vf25 ON d.leaid = vf25.leaid
    AND vf25.vendor = 'fullmind' AND vf25.fiscal_year = 'FY25'
  LEFT JOIN district_financials vf26 ON d.leaid = vf26.leaid
    AND vf26.vendor = 'fullmind' AND vf26.fiscal_year = 'FY26'
  LEFT JOIN district_financials df26_pipe ON d.leaid = df26_pipe.leaid
    AND df26_pipe.vendor = 'fullmind' AND df26_pipe.fiscal_year = 'FY26'
),
```

Note: `vf26` and `df26_pipe` are the same row here — simplify by reusing `vf26.open_pipeline` directly since it's already joined. The `d.fy26_open_pipeline` → `vf26.open_pipeline` swap is the key change.

- [ ] **Step 3: Update vendor_fy27 and vendor_fy26 CTEs to read from district_financials instead of competitor_spend**

Replace the `competitor_spend` subqueries with `district_financials` queries (Phase 1 merged competitor data into this table):

In `vendor_fy27`, replace:
```sql
  FROM (
    SELECT leaid, competitor,
      SUM(CASE WHEN fiscal_year = 'FY26' THEN total_spend ELSE 0 END) AS fy26_spend,
      SUM(CASE WHEN fiscal_year = 'FY27' THEN total_spend ELSE 0 END) AS fy27_spend
    FROM competitor_spend
    WHERE competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers', 'Educere')
    GROUP BY leaid, competitor
  ) cs_agg
```

With:
```sql
  FROM (
    SELECT leaid,
      CASE vendor
        WHEN 'proximity' THEN 'Proximity Learning'
        WHEN 'elevate' THEN 'Elevate K12'
        WHEN 'tbt' THEN 'Tutored By Teachers'
        WHEN 'educere' THEN 'Educere'
      END AS competitor,
      SUM(CASE WHEN fiscal_year = 'FY26' THEN total_revenue ELSE 0 END) AS fy26_spend,
      SUM(CASE WHEN fiscal_year = 'FY27' THEN total_revenue ELSE 0 END) AS fy27_spend
    FROM district_financials
    WHERE vendor IN ('proximity', 'elevate', 'tbt', 'educere')
      AND fiscal_year IN ('FY26', 'FY27')
    GROUP BY leaid, vendor
  ) cs_agg
```

Also update the `EXISTS` subquery in the winback check from `competitor_spend` to `district_financials`:
```sql
      WHEN COALESCE(vp.pipeline, 0) > 0
        AND EXISTS (
          SELECT 1 FROM district_financials df2
          WHERE df2.leaid = COALESCE(cs_agg.leaid, vp.leaid)
            AND df2.vendor = (
              CASE COALESCE(cs_agg.competitor, vp.competitor)
                WHEN 'Proximity Learning' THEN 'proximity'
                WHEN 'Elevate K12' THEN 'elevate'
                WHEN 'Tutored By Teachers' THEN 'tbt'
                WHEN 'Educere' THEN 'educere'
              END
            )
            AND df2.total_revenue > 0
        )
      THEN 'winback_pipeline'
```

Apply the same pattern to `vendor_fy26`, `vendor_fy25`, and `vendor_fy24` CTEs. For `vendor_fy25` and `vendor_fy24` (which have no pipeline data), just swap `competitor_spend` → `district_financials` with the vendor name mapping.

- [ ] **Step 4: Verify SQL syntax**

Review the complete updated file for SQL syntax errors. The file should have zero references to `competitor_spend` or `d.fy26_open_pipeline` / `d.fy27_open_pipeline`.

Run: `grep -c 'competitor_spend\|d\.fy2[67]_open_pipeline' scripts/district-map-features-view.sql`
Expected: 0

- [ ] **Step 5: Commit**

```bash
git add scripts/district-map-features-view.sql
git commit -m "feat(views): update district_map_features to read from district_financials only"
```

---

### Task 4: Replace district_opportunity_actuals materialized view usage

**Files:**
- Modify: `src/lib/opportunity-actuals.ts`
- Modify: `src/app/api/territory-plans/[id]/route.ts` (lines ~75-90)
- Modify: `src/app/api/districts/summary/compare/route.ts`
- Modify: `src/app/api/districts/leaids/route.ts`
- Modify: `src/app/api/team-progress/route.ts`
- Modify: `src/app/api/districts/summary/route.ts`

The `district_opportunity_actuals` materialized view provides aggregated revenue/pipeline by district and school year. After normalization, `district_financials` provides the same data. Replace all references.

- [ ] **Step 1: Update territory-plans/[id]/route.ts**

Find the two `$queryRaw` calls that SELECT FROM `district_opportunity_actuals` (around lines 75-90).

Replace:
```sql
SELECT district_lea_id,
       COALESCE(SUM(total_revenue), 0) AS total_revenue,
       COALESCE(SUM(total_take), 0) AS total_take,
       COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline
FROM district_opportunity_actuals
WHERE district_lea_id = ANY(${allLeaIds})
  AND school_yr = ${schoolYr}
GROUP BY district_lea_id
```

With:
```sql
SELECT leaid AS district_lea_id,
       COALESCE(total_revenue, 0)::float AS total_revenue,
       COALESCE(all_take, 0)::float AS total_take,
       COALESCE(weighted_pipeline, 0)::float AS weighted_pipeline
FROM district_financials
WHERE leaid = ANY(${allLeaIds})
  AND vendor = 'fullmind'
  AND fiscal_year = ${schoolYr}
```

Note: `school_yr` in the mat view maps to `fiscal_year` in district_financials (both use "FY26" format). The `GROUP BY` is no longer needed because district_financials has one row per leaid/vendor/fiscal_year.

Apply the same pattern to the prior-year query (the second `$queryRaw` around line 83).

- [ ] **Step 2: Update districts/summary/route.ts**

Read the file to find where it references `district_opportunity_actuals`. Replace the mat view query with a `district_financials` query using the same column mapping:
- `total_revenue` → `total_revenue`
- `total_take` → `all_take`
- `weighted_pipeline` → `weighted_pipeline`

- [ ] **Step 3: Update districts/summary/compare/route.ts**

This file references both `district_opportunity_actuals` and `district_vendor_comparison`. Replace both:
- `district_opportunity_actuals` queries → `district_financials WHERE vendor = 'fullmind'`
- `district_vendor_comparison` queries → `district_financials` with appropriate vendor filters

- [ ] **Step 4: Update districts/leaids/route.ts**

Replace `district_opportunity_actuals` or `district_map_features` references with `district_financials` queries.

- [ ] **Step 5: Update team-progress/route.ts**

Replace any `district_map_features` financial aggregation with `district_financials` joins.

- [ ] **Step 6: Update src/lib/opportunity-actuals.ts**

If this utility provides shared query logic or the `fiscalYearToSchoolYear` function, update references. The `fiscalYearToSchoolYear` helper stays (it's still useful for the opportunities table which uses school_yr format).

- [ ] **Step 7: Verify no remaining mat view references**

Run: `grep -rn 'district_opportunity_actuals\|district_vendor_comparison' src/`
Expected: Zero matches

- [ ] **Step 8: Commit**

```bash
git add -u
git commit -m "feat: replace district_opportunity_actuals with district_financials queries"
```

---

### Task 5: Swap districts list API

**Files:**
- Modify: `src/app/api/districts/route.ts`

This route has a `getMetricColumn()` function mapping metric+year to Prisma FY column names, then uses dynamic `orderBy` and `select`. Since Prisma can't sort on filtered relation fields, convert the sorted query to a two-step approach: raw SQL for sorted IDs, then Prisma for full data.

- [ ] **Step 1: Replace getMetricColumn to return district_financials column + FY**

Replace the `getMetricColumn` function with a mapping to `district_financials` columns:

```typescript
type MetricType =
  | "sessions_revenue"
  | "sessions_take"
  | "sessions_count"
  | "closed_won_net_booking"
  | "net_invoicing"
  | "open_pipeline"
  | "open_pipeline_weighted";

function getFinancialColumn(metric: MetricType): string {
  const map: Record<MetricType, string> = {
    sessions_revenue: "total_revenue",
    sessions_take: "all_take",
    sessions_count: "session_count",
    closed_won_net_booking: "closed_won_bookings",
    net_invoicing: "invoicing",
    open_pipeline: "open_pipeline",
    open_pipeline_weighted: "weighted_pipeline",
  };
  return map[metric] || "invoicing";
}
```

- [ ] **Step 2: Replace Prisma query with two-step approach**

Step 1 — raw SQL to get sorted, paginated LEAIDs:
```typescript
const dfColumn = getFinancialColumn(metric);
const fiscalYear = year.toUpperCase(); // "fy26" → "FY26"

// Build WHERE clauses for raw SQL (state, salesExec, search filters)
// ... (keep existing filter logic, adapted to raw SQL)

const sortedIds = await prisma.$queryRaw<{ leaid: string }[]>`
  SELECT d.leaid
  FROM districts d
  LEFT JOIN district_financials df ON df.leaid = d.leaid
    AND df.vendor = 'fullmind'
    AND df.fiscal_year = ${fiscalYear}
  WHERE 1=1
    ${state ? Prisma.sql`AND d.state_abbrev = ${state}` : Prisma.empty}
    ${salesExec ? Prisma.sql`AND d.sales_executive = ${salesExec}` : Prisma.empty}
    ${search ? Prisma.sql`AND d.name ILIKE ${'%' + search + '%'}` : Prisma.empty}
  ORDER BY COALESCE(df.${Prisma.raw(dfColumn)}, 0) DESC
  LIMIT ${limit} OFFSET ${offset}
`;
```

Step 2 — Prisma query for full district data using those LEAIDs:
```typescript
const leaids = sortedIds.map((r) => r.leaid);
const districts = await prisma.district.findMany({
  where: { leaid: { in: leaids } },
  select: {
    leaid: true,
    name: true,
    // ... keep all existing non-FY select fields ...
    isCustomer: true,
    hasOpenPipeline: true,
    accountType: true,
    cityLocation: true,
    stateAbbrev: true,
    // Replace FY columns with relation include:
    districtFinancials: {
      where: { vendor: "fullmind" },
      select: FULLMIND_FINANCIALS_SELECT,
    },
  },
});
```

- [ ] **Step 3: Transform response using the helper**

```typescript
import { extractFullmindFinancials, FULLMIND_FINANCIALS_SELECT } from "@/features/shared/lib/financial-helpers";

// Maintain sort order from raw SQL
const districtMap = new Map(districts.map((d) => [d.leaid, d]));
const sorted = leaids.map((id) => districtMap.get(id)).filter(Boolean);

const result = sorted.map((d) => {
  const fin = extractFullmindFinancials(d.districtFinancials);
  return {
    leaid: d.leaid,
    name: d.name,
    // ... keep all existing non-FY fields ...
    ...fin,
    isCustomer: d.isCustomer ?? false,
    hasOpenPipeline: d.hasOpenPipeline ?? false,
  };
});
```

- [ ] **Step 4: Get total count for pagination**

Add a count query (the current route may already have one — if so, update it to not rely on FY column filtering):

```typescript
const total = await prisma.district.count({
  where: {
    ...(state ? { stateAbbrev: state } : {}),
    ...(salesExec ? { salesExecutive: salesExec } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  },
});
```

- [ ] **Step 5: Verify the route still compiles**

Run: `cd /Users/sierrastorm/thespot/territory-plan/.worktrees/db-normalization-query-tool && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in this file

- [ ] **Step 6: Commit**

```bash
git add src/app/api/districts/route.ts
git commit -m "feat(api): swap districts list to read from district_financials"
```

---

### Task 6: Swap district detail API

**Files:**
- Modify: `src/app/api/districts/[leaid]/route.ts`

This route fetches a single district by LEAID and returns all fields including FY data. Switch from selecting FY columns to including the `districtFinancials` relation.

- [ ] **Step 1: Replace FY column selects with districtFinancials include**

In the Prisma query, remove all `fy25*`, `fy26*`, `fy27*` field selects. Add:

```typescript
districtFinancials: {
  where: { vendor: "fullmind" },
  select: FULLMIND_FINANCIALS_SELECT,
},
```

- [ ] **Step 2: Transform response using the helper**

In the response mapping (around lines 83-103), replace the manual FY field assignments:

```typescript
const fin = extractFullmindFinancials(district.districtFinancials);
return {
  // ... keep all non-FY fields ...
  ...fin,
  isCustomer: district.isCustomer ?? false,
  hasOpenPipeline: district.hasOpenPipeline ?? false,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/districts/[leaid]/route.ts
git commit -m "feat(api): swap district detail to read from district_financials"
```

---

### Task 7: Swap territory plans APIs

**Files:**
- Modify: `src/app/api/territory-plans/route.ts`

The plan list route selects `fy26OpenPipeline` and `fy27OpenPipeline` from plan districts to compute pipeline totals. Switch to using the `districtFinancials` relation.

- [ ] **Step 1: Replace FY selects in the Prisma include**

In the nested `districts > district` select (around line 29), replace:
```typescript
fy26OpenPipeline: true,
fy27OpenPipeline: true,
```

With:
```typescript
districtFinancials: {
  where: { vendor: "fullmind" },
  select: { fiscalYear: true, openPipeline: true },
},
```

- [ ] **Step 2: Update pipeline calculation**

Replace the pipeline reduction (around lines 70-78):

```typescript
const pipelineTotal = plan.districts.reduce((sum, d) => {
  const fy = `FY${plan.fiscalYear - 2000}`; // 2026 → "FY26"
  const record = d.district.districtFinancials.find(
    (f) => f.fiscalYear === fy
  );
  return sum + (record ? Number(record.openPipeline ?? 0) : 0);
}, 0);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/territory-plans/route.ts
git commit -m "feat(api): swap territory-plans list to read from district_financials"
```

---

### Task 8: Swap explore API

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts`

This is the most complex route — it has FY column selects, FY aggregates (`_sum`), LTV calculations, competitor sorts via `competitor_spend`, and FY27 pipeline raw SQL. Each concern is addressed independently.

- [ ] **Step 1: Replace FY column selects in buildSelect()**

In the `buildSelect()` function, replace FY column selects:

Remove: `select.fy25ClosedWonNetBooking = true`, etc. (lines ~160-177)
Add: `select.districtFinancials = { where: { vendor: "fullmind" }, select: FULLMIND_FINANCIALS_SELECT }`

For `ltv` computation, the source data now comes from the relation.
For the always-included `fy26OpenPipeline` / `fy26ClosedWonNetBooking`, these come from the relation too.

- [ ] **Step 2: Replace Prisma _sum aggregates**

The route does `_sum: { enrollment: true, fy26OpenPipeline: true, fy26ClosedWonNetBooking: true }` (lines ~329, ~375). Since we can't aggregate on a relation field, switch to a raw SQL aggregate:

```typescript
const finAgg = await prisma.$queryRaw<[{
  pipeline_sum: number;
  closed_won_sum: number;
}]>`
  SELECT
    COALESCE(SUM(df.open_pipeline), 0)::float AS pipeline_sum,
    COALESCE(SUM(df.closed_won_bookings), 0)::float AS closed_won_sum
  FROM district_financials df
  WHERE df.leaid = ANY(${leaidArray}::varchar[])
    AND df.vendor = 'fullmind'
    AND df.fiscal_year = 'FY26'
`;
```

Keep the enrollment `_sum` in the Prisma aggregate (it's still on the districts table).

- [ ] **Step 3: Replace competitor_spend sort query**

The route sorts by competitor spend using a raw SQL query that JOINs `competitor_spend` (line ~340). Replace `competitor_spend` with `district_financials`:

```sql
SELECT sub.leaid
FROM unnest(${leaidArray}::varchar[]) AS sub(leaid)
LEFT JOIN district_financials df
  ON df.leaid = sub.leaid
  AND df.vendor = ${vendorSlug}
  AND df.fiscal_year = ${fyValue}
ORDER BY COALESCE(df.total_revenue, 0) DESC
LIMIT ${pageSize} OFFSET ${offsetVal}
```

Where `vendorSlug` is the lowercase vendor name (map from competitor display name).

- [ ] **Step 4: Replace LTV calculation**

In the response mapping (lines ~411-421), replace direct FY column reads with helper:

```typescript
const fin = extractFullmindFinancials(d.districtFinancials);
const ltv =
  fin.fy25ClosedWonNetBooking + fin.fy26ClosedWonNetBooking +
  Math.max(fin.fy25NetInvoicing, fin.fy25SessionsRevenue) +
  Math.max(fin.fy26NetInvoicing, fin.fy26SessionsRevenue);
row.ltv = ltv || null;
```

- [ ] **Step 5: Replace FY27 pipeline raw SQL**

Update the FY27 pipeline query (lines ~899-906) to read from `district_financials`:

```sql
SELECT COALESCE(SUM(df.open_pipeline), 0)::float AS total
FROM territory_plan_districts tpd
JOIN district_financials df ON df.leaid = tpd.district_leaid
  AND df.vendor = 'fullmind' AND df.fiscal_year = 'FY27'
WHERE tpd.plan_id IN (
  SELECT id FROM territory_plans WHERE user_id = ${userId}::uuid
)
```

- [ ] **Step 6: Update plan entity response mapping**

For the plan entity type (lines ~837-841), replace:
```typescript
fmRevenue: d.district.fy26NetInvoicing ? Number(d.district.fy26NetInvoicing) : 0,
```
With financial helper extraction.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/explore/[entity]/route.ts
git commit -m "feat(api): swap explore entity to read from district_financials"
```

---

### Task 9: Swap profile APIs

**Files:**
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/app/api/profile/goals/[fiscalYear]/route.ts`

Both routes fetch user's plan districts and compute FY actuals by summing FY columns. Switch to including `districtFinancials` and using the helper.

- [ ] **Step 1: Update profile/route.ts**

In the Prisma query's nested `district` select, add:
```typescript
districtFinancials: {
  where: { vendor: "fullmind" },
  select: FULLMIND_FINANCIALS_SELECT,
},
```

Replace the manual FY reductions (lines ~27-59) with:
```typescript
const totals = userDistricts.reduce(
  (acc, d) => {
    const fin = extractFullmindFinancials(d.district.districtFinancials);
    acc.fy25Revenue += fin.fy25NetInvoicing;
    acc.fy25Take += fin.fy25SessionsTake;
    acc.fy26Revenue += fin.fy26NetInvoicing;
    acc.fy26Take += fin.fy26SessionsTake;
    acc.fy26Pipeline += fin.fy26OpenPipeline;
    acc.fy27Pipeline += fin.fy27OpenPipeline;
    return acc;
  },
  { fy25Revenue: 0, fy25Take: 0, fy26Revenue: 0, fy26Take: 0, fy26Pipeline: 0, fy27Pipeline: 0 }
);
```

Then use `totals.*` in the response object.

- [ ] **Step 2: Update profile/goals/[fiscalYear]/route.ts**

Same pattern: add `districtFinancials` include, use `extractFullmindFinancials` or `getFinancialValue` to compute actuals per FY.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/route.ts src/app/api/profile/goals/[fiscalYear]/route.ts
git commit -m "feat(api): swap profile routes to read from district_financials"
```

---

### Task 10: Swap state APIs

**Files:**
- Modify: `src/app/api/states/[code]/route.ts`
- Modify: `src/app/api/states/[code]/districts/route.ts`

- [ ] **Step 1: Update states/[code]/route.ts**

The route uses `_sum: { fy26OpenPipeline: true, fy27OpenPipeline: true }`. Replace with a raw SQL aggregate:

```typescript
const pipelineAgg = await prisma.$queryRaw<[{
  fy26_pipeline: number;
  fy27_pipeline: number;
}]>`
  SELECT
    COALESCE(SUM(CASE WHEN df.fiscal_year = 'FY26' THEN df.open_pipeline END), 0)::float AS fy26_pipeline,
    COALESCE(SUM(CASE WHEN df.fiscal_year = 'FY27' THEN df.open_pipeline END), 0)::float AS fy27_pipeline
  FROM district_financials df
  JOIN districts d ON d.leaid = df.leaid
  WHERE d.state_abbrev = ${stateAbbrev}
    AND df.vendor = 'fullmind'
    AND df.fiscal_year IN ('FY26', 'FY27')
`;
const pipelineValue = (pipelineAgg[0]?.fy26_pipeline ?? 0) + (pipelineAgg[0]?.fy27_pipeline ?? 0);
```

Remove the `fy26OpenPipeline` and `fy27OpenPipeline` from the Prisma `_sum`.

- [ ] **Step 2: Update states/[code]/districts/route.ts**

Replace `fy26NetInvoicing`, `fy26OpenPipeline`, `fy27OpenPipeline` selects with `districtFinancials` include and transform using the helper.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/states/[code]/route.ts src/app/api/states/[code]/districts/route.ts
git commit -m "feat(api): swap state routes to read from district_financials"
```

---

### Task 11: Swap raw SQL routes (customer-dots, quantiles)

**Files:**
- Modify: `src/app/api/customer-dots/route.ts`
- Modify: `src/app/api/metrics/quantiles/route.ts`

- [ ] **Step 1: Update customer-dots/route.ts**

This route classifies districts into categories (multi_year, new, lapsed, pipeline, target) using FY columns in raw SQL. Replace with `district_financials` JOINs:

```sql
SELECT
  d.leaid,
  d.name,
  ST_X(ST_Centroid(d.geometry)) as lng,
  ST_Y(ST_Centroid(d.geometry)) as lat,
  CASE
    WHEN COALESCE(df25.invoicing, 0) > 0 OR COALESCE(df25.total_revenue, 0) > 0)
      AND (COALESCE(df26.invoicing, 0) > 0 OR COALESCE(df26.total_revenue, 0) > 0)
    THEN 'multi_year'
    WHEN (COALESCE(df26.invoicing, 0) > 0 OR COALESCE(df26.total_revenue, 0) > 0)
      AND NOT (COALESCE(df25.invoicing, 0) > 0 OR COALESCE(df25.total_revenue, 0) > 0)
    THEN 'new'
    WHEN (COALESCE(df25.invoicing, 0) > 0 OR COALESCE(df25.total_revenue, 0) > 0)
      AND NOT (COALESCE(df26.invoicing, 0) > 0 OR COALESCE(df26.total_revenue, 0) > 0)
    THEN 'lapsed'
    WHEN d.has_open_pipeline = true
    THEN 'pipeline'
    WHEN EXISTS (SELECT 1 FROM territory_plan_districts tpd WHERE tpd.district_leaid = d.leaid)
    THEN 'target'
    ELSE NULL
  END AS category
FROM districts d
LEFT JOIN district_financials df25 ON df25.leaid = d.leaid
  AND df25.vendor = 'fullmind' AND df25.fiscal_year = 'FY25'
LEFT JOIN district_financials df26 ON df26.leaid = d.leaid
  AND df26.vendor = 'fullmind' AND df26.fiscal_year = 'FY26'
WHERE d.geometry IS NOT NULL
```

- [ ] **Step 2: Update metrics/quantiles/route.ts**

Replace the `METRIC_COLUMNS` mapping (which maps to districts table FY columns) with `district_financials` JOINs:

```typescript
function getFinancialColumn(metric: string): string {
  const map: Record<string, string> = {
    sessions_revenue: "total_revenue",
    sessions_take: "all_take",
    sessions_count: "session_count",
    closed_won_net_booking: "closed_won_bookings",
    net_invoicing: "invoicing",
    open_pipeline: "open_pipeline",
    open_pipeline_weighted: "weighted_pipeline",
  };
  return map[metric] || "invoicing";
}
```

Update the percentile query to JOIN `district_financials`:
```sql
SELECT percentile_cont(ARRAY[0.2, 0.4, 0.6, 0.8])
  WITHIN GROUP (ORDER BY COALESCE(df.${Prisma.raw(dfColumn)}, 0))
FROM districts d
LEFT JOIN district_financials df ON df.leaid = d.leaid
  AND df.vendor = 'fullmind' AND df.fiscal_year = ${fiscalYear}
WHERE COALESCE(df.${Prisma.raw(dfColumn)}, 0) > 0
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/customer-dots/route.ts src/app/api/metrics/quantiles/route.ts
git commit -m "feat(api): swap customer-dots and quantiles to read from district_financials"
```

---

### Task 12: Swap districts search API

**Files:**
- Modify: `src/app/api/districts/search/route.ts`

This route uses Prisma relation filters for `competitorChurned` (checking `vendorFinancials` some/none). The relation name changed from `vendorFinancials` → `districtFinancials`. Also has FY column selects.

- [ ] **Step 1: Update relation name in filters**

Replace `vendorFinancials` with `districtFinancials` in the churned filter (around lines 224-242):
```typescript
districtFinancials: {
  some: {
    vendor: { not: "fullmind" },
    fiscalYear: "FY25",
    totalRevenue: { gt: 0 },
  },
},
```

- [ ] **Step 2: Replace FY column selects**

Replace `fy26OpenPipeline: true` etc. with `districtFinancials` include and transform using the helper.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/districts/search/route.ts
git commit -m "feat(api): swap districts search to use districtFinancials relation"
```

---

### Task 13: Update competitor-spend API

**Files:**
- Modify: `src/app/api/districts/[leaid]/competitor-spend/route.ts`
- Modify: `src/app/api/explore/competitor-meta/route.ts`
- Modify: `src/features/map/components/panels/district/CompetitorSpendCard.tsx` (if it queries directly)
- Modify: `src/features/districts/components/CompetitorSpend.tsx` (if it queries directly)

After Phase 1 merged competitor_spend data into district_financials, update these endpoints to read from `district_financials WHERE vendor != 'fullmind'` instead of the `competitor_spend` table.

- [ ] **Step 1: Update districts/[leaid]/competitor-spend/route.ts**

Read the file first, then replace `competitor_spend` table queries with:
```typescript
const spend = await prisma.districtFinancials.findMany({
  where: {
    leaid,
    vendor: { not: "fullmind" },
  },
  select: {
    vendor: true,
    fiscalYear: true,
    totalRevenue: true,
    poCount: true,
  },
  orderBy: [{ vendor: "asc" }, { fiscalYear: "desc" }],
});
```

Transform the response to match the existing shape (vendor display name mapping, etc.).

- [ ] **Step 2: Update explore/competitor-meta/route.ts**

Replace `competitor_spend` aggregation query with `district_financials` equivalent. This likely provides metadata like distinct competitors and fiscal years.

- [ ] **Step 3: Verify frontend components don't query competitor_spend directly**

The `CompetitorSpendCard.tsx` and `CompetitorSpend.tsx` components should be fetching from the API endpoints updated above, not querying the DB directly. Verify and update if needed.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(api): swap competitor-spend endpoints to read from district_financials"
```

---

### Task 14: Update Customer Book ETL to dual-write

**Files:**
- Modify: `scripts/import-customer-book.ts`
- Modify: `scripts/etl/loaders/fullmind.py`

The ETL currently writes FY columns to the `districts` table. Update to also write to `district_financials`. During Phase 2, both are kept in sync (dual-write). In Phase 3, the districts FY column writes are removed.

- [ ] **Step 1: Read and understand import-customer-book.ts**

Read the file to identify where FY columns are written to districts. Map each write to the corresponding `district_financials` upsert.

- [ ] **Step 2: Add district_financials upserts after each districts update**

After each districts update that sets FY columns, add an upsert to `district_financials`:

```typescript
await prisma.districtFinancials.upsert({
  where: {
    leaid_vendor_fiscalYear: {
      leaid: district.leaid,
      vendor: "fullmind",
      fiscalYear: "FY26",
    },
  },
  update: {
    totalRevenue: sessionsRevenue,
    allTake: sessionsTake,
    sessionCount: sessionsCount,
    closedWonBookings: closedWonNetBooking,
    closedWonOppCount: closedWonOppCount,
    invoicing: netInvoicing,
    openPipeline: openPipeline,
    openPipelineOppCount: openPipelineOppCount,
    weightedPipeline: openPipelineWeighted,
  },
  create: {
    leaid: district.leaid,
    vendor: "fullmind",
    fiscalYear: "FY26",
    totalRevenue: sessionsRevenue,
    // ... all fields ...
  },
});
```

- [ ] **Step 3: Update fullmind.py ETL loader**

Add matching `INSERT ... ON CONFLICT UPDATE` statements to the Python loader so it writes to `district_financials` alongside the districts table updates.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-customer-book.ts scripts/etl/loaders/fullmind.py
git commit -m "feat(etl): dual-write to district_financials from Customer Book import"
```

---

## Verification Checklist

After all tasks are complete, verify:

1. **No FY column reads in app code:**
   ```bash
   grep -rn 'fy25Sessions\|fy25ClosedWon\|fy25Net\|fy26Sessions\|fy26ClosedWon\|fy26Net\|fy26Open\|fy27Open' src/app/api/ src/lib/
   ```
   Expected: Zero matches (frontend files in `src/features/` still have them — that's OK, they read from API responses)

2. **No competitor_spend table reads:**
   ```bash
   grep -rn 'competitor_spend\|competitorSpend' src/app/api/ src/lib/ scripts/district-map-features-view.sql
   ```
   Expected: Zero matches

3. **No materialized view reads (except district_map_features):**
   ```bash
   grep -rn 'district_opportunity_actuals\|district_vendor_comparison' src/
   ```
   Expected: Zero matches

4. **TypeScript compiles:**
   ```bash
   npx tsc --noEmit
   ```

5. **Tests pass:**
   ```bash
   npx vitest run
   ```

## Out of Scope (Phase 2b / Phase 3)

- Claude query tool (schema reference YAML, /api/ai/query endpoint, chat UI) — separate plan
- Person FK migration (owner → owner_id lookups) — independent work
- State FK migration (state_abbrev → state_fips lookups) — independent work
- Frontend type/component cleanup (removing FY-specific fields from api-types.ts) — Phase 3
- Dropping FY columns from districts table — Phase 3
- Dropping competitor_spend table — Phase 3
- Dropping materialized views — Phase 3
- Stopping dual-write in ETL — Phase 3
