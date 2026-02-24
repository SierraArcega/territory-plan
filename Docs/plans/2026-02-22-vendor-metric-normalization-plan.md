# Vendor Metric Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Normalize all vendor financial data into a single `vendor_financials` table with 10 unified metrics, and update the summary bar to display the same metrics for every vendor.

**Architecture:** New `vendor_financials` table replaces per-vendor column patterns. The summary API JOINs this table for all financial data. The hook and component use a single `SummaryTotals` type for all vendors — no discriminated unions.

**Tech Stack:** PostgreSQL, Prisma, Next.js API routes, React/TanStack Query

---

## Task 1: Create vendor_financials Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

**Step 1: Add the VendorFinancials model to Prisma schema**

Insert after the `CompetitorSpend` model (after line ~310):

```prisma
// ===== Vendor Financials =====
// Normalized financial metrics for all vendors (Fullmind + competitors)
// Source: Fullmind CSV, GovSpend PO data, user-provided CSV
model VendorFinancials {
  id                Int      @id @default(autoincrement())
  leaid             String   @db.VarChar(7)
  vendor            String   @db.VarChar(20)
  fiscalYear        String   @map("fiscal_year") @db.VarChar(4)
  openPipeline      Decimal  @default(0) @map("open_pipeline") @db.Decimal(15, 2)
  closedWonBookings Decimal  @default(0) @map("closed_won_bookings") @db.Decimal(15, 2)
  invoicing         Decimal  @default(0) @map("invoicing") @db.Decimal(15, 2)
  scheduledRevenue  Decimal  @default(0) @map("scheduled_revenue") @db.Decimal(15, 2)
  deliveredRevenue  Decimal  @default(0) @map("delivered_revenue") @db.Decimal(15, 2)
  deferredRevenue   Decimal  @default(0) @map("deferred_revenue") @db.Decimal(15, 2)
  totalRevenue      Decimal  @default(0) @map("total_revenue") @db.Decimal(15, 2)
  deliveredTake     Decimal  @default(0) @map("delivered_take") @db.Decimal(15, 2)
  scheduledTake     Decimal  @default(0) @map("scheduled_take") @db.Decimal(15, 2)
  allTake           Decimal  @default(0) @map("all_take") @db.Decimal(15, 2)
  lastUpdated       DateTime @default(now()) @map("last_updated")

  district District @relation(fields: [leaid], references: [leaid])

  @@unique([leaid, vendor, fiscalYear])
  @@index([leaid])
  @@index([vendor, fiscalYear])
  @@map("vendor_financials")
}
```

Also add the reverse relation on the `District` model (find the existing `competitorSpend CompetitorSpend[]` line and add below it):

```prisma
  vendorFinancials  VendorFinancials[]
```

**Step 2: Run migration**

Run: `npx prisma migrate dev --name vendor_financials`

Expected: Migration created successfully, table exists.

**Step 3: Commit**

```
git add prisma/
git commit -m "feat: add vendor_financials table for normalized vendor metrics"
```

---

## Task 2: Seed vendor_financials from existing data

**Files:**
- Create: `scripts/seed-vendor-financials.sql`

**Step 1: Write seed SQL**

This script copies existing Fullmind financial data from the `districts` table and competitor `total_spend` from `competitor_spend` into the new `vendor_financials` table.

```sql
-- Seed vendor_financials from existing district + competitor_spend data
-- Run once after migration to backfill existing data

-- Fullmind FY25
INSERT INTO vendor_financials (leaid, vendor, fiscal_year, open_pipeline, closed_won_bookings, invoicing, total_revenue, all_take)
SELECT
  d.leaid,
  'fullmind',
  'FY25',
  0, -- no FY25 pipeline data
  COALESCE(d.fy25_closed_won_net_booking, 0),
  COALESCE(d.fy25_net_invoicing, 0),
  COALESCE(d.fy25_sessions_revenue, 0),
  COALESCE(d.fy25_sessions_take, 0)
FROM districts d
WHERE COALESCE(d.fy25_sessions_revenue, 0) > 0
   OR COALESCE(d.fy25_net_invoicing, 0) > 0
   OR COALESCE(d.fy25_closed_won_net_booking, 0) > 0
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  closed_won_bookings = EXCLUDED.closed_won_bookings,
  invoicing = EXCLUDED.invoicing,
  total_revenue = EXCLUDED.total_revenue,
  all_take = EXCLUDED.all_take,
  last_updated = NOW();

-- Fullmind FY26
INSERT INTO vendor_financials (leaid, vendor, fiscal_year, open_pipeline, closed_won_bookings, invoicing, total_revenue, all_take)
SELECT
  d.leaid,
  'fullmind',
  'FY26',
  COALESCE(d.fy26_open_pipeline, 0),
  COALESCE(d.fy26_closed_won_net_booking, 0),
  COALESCE(d.fy26_net_invoicing, 0),
  COALESCE(d.fy26_sessions_revenue, 0),
  COALESCE(d.fy26_sessions_take, 0)
FROM districts d
WHERE COALESCE(d.fy26_sessions_revenue, 0) > 0
   OR COALESCE(d.fy26_net_invoicing, 0) > 0
   OR COALESCE(d.fy26_closed_won_net_booking, 0) > 0
   OR COALESCE(d.fy26_open_pipeline, 0) > 0
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  open_pipeline = EXCLUDED.open_pipeline,
  closed_won_bookings = EXCLUDED.closed_won_bookings,
  invoicing = EXCLUDED.invoicing,
  total_revenue = EXCLUDED.total_revenue,
  all_take = EXCLUDED.all_take,
  last_updated = NOW();

-- Competitors (from competitor_spend → total_spend maps to total_revenue)
INSERT INTO vendor_financials (leaid, vendor, fiscal_year, total_revenue)
SELECT
  cs.leaid,
  CASE cs.competitor
    WHEN 'Proximity Learning' THEN 'proximity'
    WHEN 'Elevate K12' THEN 'elevate'
    WHEN 'Tutored By Teachers' THEN 'tbt'
  END,
  cs.fiscal_year,
  cs.total_spend
FROM competitor_spend cs
WHERE cs.competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  total_revenue = EXCLUDED.total_revenue,
  last_updated = NOW();
```

**Step 2: Commit**

```
git add scripts/seed-vendor-financials.sql
git commit -m "feat: add seed script to backfill vendor_financials from existing data"
```

---

## Task 3: Update SummaryTotals type with 10 unified metrics

**Files:**
- Modify: `src/features/map/lib/useMapSummary.ts`

**Step 1: Replace SummaryTotals interface and remove competitor types**

Replace `SummaryTotals` with the new 10-metric shape. Remove `CompetitorVendorTotals`. Simplify `VendorTotalsMap` to drop the discriminated union — all vendors use the same `SummaryTotals`.

New `SummaryTotals`:
```typescript
export interface SummaryTotals {
  count: number;
  totalEnrollment: number;
  openPipeline: number;
  closedWonBookings: number;
  invoicing: number;
  scheduledRevenue: number;
  deliveredRevenue: number;
  deferredRevenue: number;
  totalRevenue: number;
  deliveredTake: number;
  scheduledTake: number;
  allTake: number;
}
```

Update `EMPTY_TOTALS` to match.

Update `SummaryResponse.byVendor` type — each vendor entry is `SummaryTotals & { byCategory: Record<string, SummaryTotals> }`.

Remove `CompetitorVendorTotals`, `VendorBreakdown` discriminated union. Replace `VendorTotalsMap`:
```typescript
export type VendorTotalsMap = Partial<Record<VendorId, { totals: SummaryTotals }>>;
```

Update `sumCategories` to sum all 10 fields.

Update the `totals` useMemo to use new field names.

Update the `vendorTotals` useMemo — remove the `type: "fullmind" | "competitor"` branching. All vendors get the same treatment: if fullmind and engagement filter is active, apply `sumCategories`; otherwise pass through.

**Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "(useMapSummary|MapSummaryBar|summary/route)"`

Expected: Errors in MapSummaryBar and route (not yet updated). No errors in useMapSummary itself.

**Step 3: Commit**

```
git add src/features/map/lib/useMapSummary.ts
git commit -m "feat: unify SummaryTotals to 10 metrics for all vendors"
```

---

## Task 4: Update API route to query vendor_financials

**Files:**
- Modify: `src/app/api/districts/summary/route.ts`

**Step 1: Rewrite combined query**

The combined query JOINs `vendor_financials vf` instead of reading financial columns from `districts d`. It still groups by `dmf.{fullmindCatCol}` for engagement filtering.

Key changes:
- JOIN: `LEFT JOIN vendor_financials vf ON dmf.leaid = vf.leaid AND vf.fiscal_year = '{FY}'`
- Filter `vf` rows to only active vendors: `AND vf.vendor = ANY($N)` (add vendorList as a param)
- SELECT: SUM each of the 10 `vf.*` columns
- Keep `d.enrollment` from districts JOIN

The combined query aggregates across ALL active vendors — this gives the combined row its totals.

**Step 2: Rewrite per-vendor queries**

All per-vendor queries now use the same structure — no more fullmind vs competitor branching:

```sql
SELECT
  dmf.{catCol} AS category,
  COUNT(DISTINCT dmf.leaid)::int AS count,
  COALESCE(SUM(d.enrollment), 0)::bigint AS total_enrollment,
  COALESCE(SUM(vf.open_pipeline), 0)::float AS open_pipeline,
  COALESCE(SUM(vf.closed_won_bookings), 0)::float AS closed_won_bookings,
  COALESCE(SUM(vf.invoicing), 0)::float AS invoicing,
  COALESCE(SUM(vf.scheduled_revenue), 0)::float AS scheduled_revenue,
  COALESCE(SUM(vf.delivered_revenue), 0)::float AS delivered_revenue,
  COALESCE(SUM(vf.deferred_revenue), 0)::float AS deferred_revenue,
  COALESCE(SUM(vf.total_revenue), 0)::float AS total_revenue,
  COALESCE(SUM(vf.delivered_take), 0)::float AS delivered_take,
  COALESCE(SUM(vf.scheduled_take), 0)::float AS scheduled_take,
  COALESCE(SUM(vf.all_take), 0)::float AS all_take
FROM district_map_features dmf
JOIN districts d ON dmf.leaid = d.leaid
LEFT JOIN vendor_financials vf ON dmf.leaid = vf.leaid
  AND vf.vendor = $X AND vf.fiscal_year = $Y
WHERE {baseConditions} AND dmf.{catCol} IS NOT NULL
GROUP BY dmf.{catCol}
```

Where `$X` is the vendor name string ('fullmind', 'proximity', etc.) and `$Y` is the FY ('FY25', 'FY26').

Remove `COMPETITOR_NAMES` mapping — vendors are stored by their short ID in `vendor_financials.vendor`.

Remove old competitor LEFT JOIN on `competitor_spend`.

**Step 3: Normalize response processing**

Single processing loop for all vendors (no fullmind vs competitor branching):

```typescript
for (const { vendor, rows } of vendorResults) {
  let totals = { ...emptyTotals };
  const byCat: Record<string, unknown> = {};
  for (const row of rows) {
    const cat = row.category || "uncategorized";
    const entry = {
      count: row.count,
      totalEnrollment: Number(row.total_enrollment),
      openPipeline: row.open_pipeline,
      closedWonBookings: row.closed_won_bookings,
      invoicing: row.invoicing,
      scheduledRevenue: row.scheduled_revenue,
      deliveredRevenue: row.delivered_revenue,
      deferredRevenue: row.deferred_revenue,
      totalRevenue: row.total_revenue,
      deliveredTake: row.delivered_take,
      scheduledTake: row.scheduled_take,
      allTake: row.all_take,
    };
    byCat[cat] = entry;
    // accumulate totals...
  }
  byVendor[vendor] = { ...totals, byCategory: byCat };
}
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "(summary/route)"`

Expected: No errors in route.ts.

**Step 5: Commit**

```
git add src/app/api/districts/summary/route.ts
git commit -m "feat: summary API queries vendor_financials with unified 10-metric shape"
```

---

## Task 5: Update MapSummaryBar to render unified metrics

**Files:**
- Modify: `src/features/map/components/MapSummaryBar.tsx`

**Step 1: Update combined row stats**

Replace the 7 old stats with 12 stats (count + enrollment + 10 financial):

```
Districts | Enrollment | Pipeline | Bookings | Invoicing |
Sched Rev | Deliv Rev | Def Rev | Total Rev |
Deliv Take | Sched Take | All Take
```

**Step 2: Simplify VendorRow**

Remove the `entry.type === "fullmind"` conditional. Every vendor renders the same stats. The `VendorRow` component just reads from `entry.totals` (which is always `SummaryTotals`).

**Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "(MapSummaryBar)"`

Expected: No errors.

**Step 4: Commit**

```
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "feat: summary bar renders unified 10 metrics for all vendors"
```

---

## Task 6: Full verification

**Step 1: Type check**

Run: `npx tsc --noEmit`

Expected: No new type errors in changed files.

**Step 2: Run tests**

Run: `npx vitest run`

Expected: No new test failures.

**Step 3: Final commit (if any fixups needed)**
