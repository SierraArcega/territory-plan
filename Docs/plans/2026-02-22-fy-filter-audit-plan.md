# FY Filter Audit & Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the enrollment SQL bug, extend the ETL to load FY24+FY27 data from the Customer Book CSV, verify EK12+Fullmind data integrity, and update tests.

**Architecture:** The summary API route uses a CTE to pre-join districts with enrollment, avoiding the `SUM(DISTINCT d.enrollment)` anti-pattern. The Python ETL gains FY24 and FY27 record generation alongside the existing FY25/FY26 logic. A verification SQL script compares DB state against CSV expectations.

**Tech Stack:** TypeScript (Next.js API routes), Python (ETL loader), PostgreSQL, Vitest

---

### Task 1: Fix enrollment dedup bug in summary route — write failing test

**Files:**
- Modify: `src/app/api/districts/summary/__tests__/route.test.ts`

**Step 1: Write the failing test**

Add a new test case that exposes the `SUM(DISTINCT enrollment)` bug. The test asserts the CTE structure exists in the generated SQL query, proving the bug fix is in place.

```typescript
it("uses CTE for enrollment dedup (not SUM DISTINCT)", async () => {
  mockQuery.mockResolvedValue({ rows: [] });

  const req = new NextRequest(
    "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind"
  );
  await GET(req);

  const [sql] = mockQuery.mock.calls[0];
  // Should use CTE approach, not SUM(DISTINCT d.enrollment)
  expect(sql).toContain("WITH dist AS");
  expect(sql).toContain("dist.enrollment");
  expect(sql).not.toContain("SUM(DISTINCT d.enrollment)");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/districts/summary/__tests__/route.test.ts`

Expected: FAIL — the current route uses `SUM(DISTINCT d.enrollment)` and does not have a `WITH dist AS` CTE.

---

### Task 2: Fix enrollment dedup bug in summary route — implement CTE

**Files:**
- Modify: `src/app/api/districts/summary/route.ts:74-96` (combined query)
- Modify: `src/app/api/districts/summary/route.ts:152-174` (per-vendor query)

**Step 1: Fix the combined query (lines 74-96)**

Replace the current combined query with a CTE-based approach. The full replacement for lines 74-96:

```typescript
    const combinedQuery = `
      WITH dist AS (
        SELECT DISTINCT leaid, enrollment FROM districts
      )
      SELECT
        dmf.${fullmindCatCol} AS category,
        COUNT(DISTINCT dmf.leaid)::int AS count,
        COALESCE(SUM(dist.enrollment), 0)::bigint AS total_enrollment,
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
      JOIN dist ON dmf.leaid = dist.leaid
      LEFT JOIN vendor_financials vf ON dmf.leaid = vf.leaid
        AND vf.vendor = ANY($${vendorParamIdx})
        AND vf.fiscal_year = $${fyParamIdx}
      ${combinedWhere}
      GROUP BY dmf.${fullmindCatCol}
    `;
```

Key changes:
- Added `WITH dist AS (SELECT DISTINCT leaid, enrollment FROM districts)` CTE
- Changed `JOIN districts d ON dmf.leaid = d.leaid` → `JOIN dist ON dmf.leaid = dist.leaid`
- Changed `SUM(DISTINCT d.enrollment)` → `SUM(dist.enrollment)`

**Step 2: Fix the per-vendor breakdown queries (lines 152-174)**

Replace the per-vendor query template with the same CTE approach:

```typescript
          const vQuery = `
            WITH dist AS (
              SELECT DISTINCT leaid, enrollment FROM districts
            )
            SELECT
              dmf.${catCol} AS category,
              COUNT(DISTINCT dmf.leaid)::int AS count,
              COALESCE(SUM(dist.enrollment), 0)::bigint AS total_enrollment,
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
            JOIN dist ON dmf.leaid = dist.leaid
            LEFT JOIN vendor_financials vf ON dmf.leaid = vf.leaid
              AND vf.vendor = $${paramIdx}
              AND vf.fiscal_year = $${paramIdx + 1}
            ${vWhere}
            GROUP BY dmf.${catCol}
          `;
```

**Step 3: Run the tests**

Run: `npx vitest run src/app/api/districts/summary/__tests__/route.test.ts`

Expected: ALL PASS — the new test verifies the CTE exists, and existing tests still pass since the mock query interface hasn't changed.

**Step 4: Commit**

```bash
git add src/app/api/districts/summary/route.ts src/app/api/districts/summary/__tests__/route.test.ts
git commit -m "fix: use CTE for enrollment dedup in summary route

Replace SUM(DISTINCT d.enrollment) with a CTE that pre-deduplicates
districts by leaid. The old approach deduplicated by value, silently
under-counting enrollment when districts shared the same number."
```

---

### Task 3: Extend ETL to load FY24 data

**Files:**
- Modify: `scripts/etl/loaders/vendor_financials.py:112-190`

**Step 1: Add FY24 record list alongside existing lists**

At line 115, after `fy25_records = []`, add:

```python
    fy24_records = []
```

**Step 2: Add FY24 parsing after the FY25 block (after line 185)**

Insert after the `has_fy25` block:

```python
        # Parse FY24 metrics
        fy24_bookings = parse_currency(row.get("FY24 Bookings"))
        fy24_revenue = parse_currency(row.get("FY24 Revenues"))

        has_fy24 = any([fy24_bookings, fy24_revenue])
        if has_fy24:
            fy24_records.append((
                leaid, vendor, "FY24",
                0,                # open_pipeline
                fy24_bookings,    # closed_won_bookings
                0,                # invoicing
                0,                # scheduled_revenue
                0,                # delivered_revenue
                0,                # deferred_revenue
                fy24_revenue,     # total_revenue
                0,                # delivered_take
                0,                # scheduled_take
                0,                # all_take
            ))
```

**Step 3: Include FY24 records in the all_records list**

Change line 187 from:
```python
    all_records = fy26_records + fy25_records
```
to:
```python
    all_records = fy26_records + fy25_records + fy24_records
```

**Step 4: Update the print statements**

Change line 190 from:
```python
    print(f"Prepared {len(fy26_records)} FY26 records, {len(fy25_records)} FY25 records")
```
to:
```python
    print(f"Prepared {len(fy26_records)} FY26, {len(fy25_records)} FY25, {len(fy24_records)} FY24 records")
```

**Step 5: Update the logging line**

Change line 234 from:
```python
            (len(all_records), f"FY26: {len(fy26_records)}, FY25: {len(fy25_records)}, generated LEAIDs: {generated}"),
```
to:
```python
            (len(all_records), f"FY26: {len(fy26_records)}, FY25: {len(fy25_records)}, FY24: {len(fy24_records)}, generated LEAIDs: {generated}"),
```

**Step 6: Update docstring**

Change line 11 from:
```python
- Multi-FY loading: FY25 and FY26 metrics from a single row
```
to:
```python
- Multi-FY loading: FY24, FY25, and FY26 metrics from a single row, plus FY27 pipeline
```

**Step 7: Dry-run test**

Run: `python3 scripts/etl/loaders/vendor_financials.py --dry-run`

Expected output should show FY24 record counts (Fullmind ~120, Elevate ~154 nonzero rows).

**Step 8: Commit**

```bash
git add scripts/etl/loaders/vendor_financials.py
git commit -m "feat: extend ETL to load FY24 bookings and revenue data

FY24 Bookings and FY24 Revenues columns from the Customer Book CSV
were silently dropped. Now generates FY24 records for vendor_financials."
```

---

### Task 4: Extend ETL to load FY27 data

**Files:**
- Modify: `scripts/etl/loaders/vendor_financials.py`

**Step 1: Add FY27 record list**

At line 115 (after `fy24_records = []`), add:

```python
    fy27_records = []
```

**Step 2: Add FY27 parsing after the FY24 block**

Insert after the FY24 block:

```python
        # Parse FY27 metrics (pipeline only)
        # CSV has two FY27 columns ("FY27 Open Pipeline" and "FY27 Pipeline")
        # that contain identical values — use the first one.
        fy27_pipeline = parse_currency(row.get("FY27 Open Pipeline"))

        has_fy27 = fy27_pipeline > 0
        if has_fy27:
            fy27_records.append((
                leaid, vendor, "FY27",
                fy27_pipeline,    # open_pipeline
                0,                # closed_won_bookings
                0,                # invoicing
                0,                # scheduled_revenue
                0,                # delivered_revenue
                0,                # deferred_revenue
                0,                # total_revenue
                0,                # delivered_take
                0,                # scheduled_take
                0,                # all_take
            ))
```

**Step 3: Include FY27 in all_records**

```python
    all_records = fy26_records + fy25_records + fy24_records + fy27_records
```

**Step 4: Update print and log statements**

```python
    print(f"Prepared {len(fy26_records)} FY26, {len(fy25_records)} FY25, {len(fy24_records)} FY24, {len(fy27_records)} FY27 records")
```

Log line:
```python
            (len(all_records), f"FY26: {len(fy26_records)}, FY25: {len(fy25_records)}, FY24: {len(fy24_records)}, FY27: {len(fy27_records)}, generated LEAIDs: {generated}"),
```

**Step 5: Dry-run test**

Run: `python3 scripts/etl/loaders/vendor_financials.py --dry-run`

Expected: FY27 records should show ~243 rows (Fullmind ~104, EK12 ~139).

**Step 6: Commit**

```bash
git add scripts/etl/loaders/vendor_financials.py
git commit -m "feat: extend ETL to load FY27 pipeline data

FY27 Open Pipeline column from the Customer Book CSV was being dropped.
Now generates FY27 vendor_financials records with open_pipeline values."
```

---

### Task 5: Create verification SQL script

**Files:**
- Create: `scripts/verify-vendor-financials.sql`

**Step 1: Write the verification script**

```sql
-- Verification queries for vendor_financials data integrity
-- Run against Supabase after ETL to confirm EK12 + Fullmind data loaded correctly.
--
-- Usage: psql $DATABASE_URL -f scripts/verify-vendor-financials.sql

-- 1. Row counts per vendor per FY
SELECT
  vendor,
  fiscal_year,
  COUNT(*) AS rows,
  COUNT(*) FILTER (WHERE open_pipeline > 0) AS has_pipeline,
  COUNT(*) FILTER (WHERE closed_won_bookings > 0) AS has_bookings,
  COUNT(*) FILTER (WHERE total_revenue > 0) AS has_revenue,
  COUNT(*) FILTER (WHERE delivered_revenue > 0) AS has_delivered,
  COUNT(*) FILTER (WHERE scheduled_revenue > 0) AS has_scheduled,
  COUNT(*) FILTER (WHERE deferred_revenue > 0) AS has_deferred
FROM vendor_financials
GROUP BY vendor, fiscal_year
ORDER BY vendor, fiscal_year;

-- 2. Financial totals per vendor per FY (ground truth for MapSummaryBar)
SELECT
  vendor,
  fiscal_year,
  SUM(open_pipeline)::numeric(15,2) AS pipeline,
  SUM(closed_won_bookings)::numeric(15,2) AS bookings,
  SUM(invoicing)::numeric(15,2) AS invoicing,
  SUM(scheduled_revenue)::numeric(15,2) AS sched_rev,
  SUM(delivered_revenue)::numeric(15,2) AS deliv_rev,
  SUM(deferred_revenue)::numeric(15,2) AS def_rev,
  SUM(total_revenue)::numeric(15,2) AS total_rev,
  SUM(all_take)::numeric(15,2) AS all_take
FROM vendor_financials
GROUP BY vendor, fiscal_year
ORDER BY vendor, fiscal_year;

-- 3. Spot check: Fullmind FY26 vs EK12 FY26 (should both have data)
SELECT
  vendor,
  COUNT(*) AS districts,
  SUM(total_revenue)::numeric(15,2) AS total_revenue,
  SUM(open_pipeline)::numeric(15,2) AS pipeline
FROM vendor_financials
WHERE fiscal_year = 'FY26'
  AND vendor IN ('fullmind', 'elevate')
GROUP BY vendor;

-- 4. Check for FY24 and FY27 data (should be non-empty after ETL fix)
SELECT
  fiscal_year,
  COUNT(*) AS rows,
  COUNT(DISTINCT vendor) AS vendors
FROM vendor_financials
WHERE fiscal_year IN ('FY24', 'FY27')
GROUP BY fiscal_year
ORDER BY fiscal_year;
```

**Step 2: Commit**

```bash
git add scripts/verify-vendor-financials.sql
git commit -m "feat: add vendor_financials verification queries

SQL script to check row counts, financial totals, and FY coverage
per vendor. Run after ETL to confirm data integrity."
```

---

### Task 6: Run ETL and verify data

**Step 1: Run the ETL loader against the database**

Run: `python3 scripts/etl/loaders/vendor_financials.py`

Expected output should show record counts for all 4 FYs:
- FY24: ~270+ records (Fullmind + EK12)
- FY25: existing + new from CSV
- FY26: existing + new from CSV
- FY27: ~243 records

**Step 2: Run the verification queries**

Run: `psql $DIRECT_URL -f scripts/verify-vendor-financials.sql`

Check:
- `fullmind` rows exist for FY24, FY25, FY26, FY27
- `elevate` rows exist for FY24, FY25, FY26, FY27
- FY26 has the richest data (pipeline, bookings, delivered, scheduled, deferred, revenue)
- FY24 has bookings + revenue only
- FY27 has pipeline only

**Step 3: Commit verification results**

No file changes needed — this is a manual verification step. If data looks wrong, investigate before proceeding.

---

### Task 7: Update route test for per-vendor CTE verification

**Files:**
- Modify: `src/app/api/districts/summary/__tests__/route.test.ts`

**Step 1: Add test for per-vendor breakdown CTE**

```typescript
it("uses CTE in per-vendor breakdown queries", async () => {
  // First call: combined query
  mockQuery.mockResolvedValueOnce({
    rows: [
      {
        category: "multi_year_growing",
        count: 10,
        total_enrollment: 50000,
        open_pipeline: 100000,
        closed_won_bookings: 200000,
        invoicing: 0,
        scheduled_revenue: 0,
        delivered_revenue: 0,
        deferred_revenue: 0,
        total_revenue: 300000,
        delivered_take: 0,
        scheduled_take: 0,
        all_take: 0,
      },
    ],
  });
  // Vendor breakdown queries (fullmind + proximity)
  mockQuery.mockResolvedValueOnce({
    rows: [
      {
        category: "multi_year_growing",
        count: 5,
        total_enrollment: 25000,
        open_pipeline: 50000,
        closed_won_bookings: 100000,
        invoicing: 0,
        scheduled_revenue: 0,
        delivered_revenue: 0,
        deferred_revenue: 0,
        total_revenue: 150000,
        delivered_take: 0,
        scheduled_take: 0,
        all_take: 0,
      },
    ],
  });
  mockQuery.mockResolvedValueOnce({
    rows: [
      {
        category: "multi_year_growing",
        count: 5,
        total_enrollment: 25000,
        open_pipeline: 50000,
        closed_won_bookings: 100000,
        invoicing: 0,
        scheduled_revenue: 0,
        delivered_revenue: 0,
        deferred_revenue: 0,
        total_revenue: 150000,
        delivered_take: 0,
        scheduled_take: 0,
        all_take: 0,
      },
    ],
  });

  const req = new NextRequest(
    "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind,proximity"
  );
  const res = await GET(req);
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.byVendor).toBeDefined();

  // All queries should use the CTE approach
  for (const call of mockQuery.mock.calls) {
    const [sql] = call;
    expect(sql).toContain("WITH dist AS");
    expect(sql).not.toContain("SUM(DISTINCT d.enrollment)");
  }
});
```

**Step 2: Run all summary tests**

Run: `npx vitest run src/app/api/districts/summary/__tests__/route.test.ts`

Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/app/api/districts/summary/__tests__/route.test.ts
git commit -m "test: verify CTE used in per-vendor breakdown queries

Adds a test that triggers the multi-vendor code path and verifies
all generated SQL queries use the CTE enrollment dedup approach."
```

---

### Task 8: Run full test suite and verify

**Step 1: Run all map-related tests**

Run: `npx vitest run src/features/map/ src/app/api/districts/`

Expected: ALL PASS

**Step 2: Run the full test suite**

Run: `npx vitest run`

Expected: ALL PASS — no regressions

**Step 3: Final commit if any cleanup needed**

Only if adjustments were needed during the test run.
