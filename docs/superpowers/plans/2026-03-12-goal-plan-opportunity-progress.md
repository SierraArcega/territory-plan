# Goal & Plan Opportunity Progress — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real opportunity data from the scheduler into goals dashboard, plan districts table, district detail panel, and plan summary cards.

**Architecture:** Materialized SQL view (`district_opportunity_actuals`) aggregates opportunities by district/FY/rep/category. API routes query this view via `prisma.$queryRaw`. Frontend components consume new actuals fields alongside existing targets. No new Prisma models — view lives outside Prisma, queried with raw SQL.

**Tech Stack:** PostgreSQL materialized view, Prisma raw SQL, Next.js API routes, React/TypeScript, TanStack Query, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-12-goal-plan-opportunity-progress-spec.md`

---

## File Structure

**New files:**
- `scripts/district-opportunity-actuals-view.sql` — Materialized view definition
- `prisma/migrations/YYYYMMDD_add_district_opportunity_actuals_view/migration.sql` — Migration to create view
- `src/lib/opportunity-actuals.ts` — Shared query helpers for the materialized view
- `src/lib/__tests__/opportunity-actuals.test.ts` — Tests for query helpers
- `src/features/plans/components/DistrictPerformanceSection.tsx` — Performance section for Planning tab
- `src/features/plans/components/__tests__/DistrictPerformanceSection.test.tsx` — Tests

**Modified files:**
- `src/features/shared/types/api-types.ts` — Add new fields to GoalDashboard, plan types
- `src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts` — Wire actuals from view
- `src/app/api/territory-plans/route.ts` — Add plan-level actuals (revenueActual, takeActual, priorFyRevenue)
- `src/app/api/territory-plans/[id]/route.ts` — Add per-district actuals to plan detail
- `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts` — Add full district actuals + opportunity list
- `src/features/plans/components/DistrictsTable.tsx` — Add Revenue, Take, Pipeline, Prior FY columns with tooltips
- `src/features/plans/components/FlippablePlanCard.tsx` — Revenue vs target headline
- `src/features/plans/components/PlanDistrictPanel.tsx` — Include DistrictPerformanceSection in Planning tab

---

## Chunk 1: Data Layer + Goals Dashboard API

### Task 1: Create Materialized View SQL

**Files:**
- Create: `scripts/district-opportunity-actuals-view.sql`

- [ ] **Step 1: Write the materialized view SQL**

```sql
-- scripts/district-opportunity-actuals-view.sql
-- Materialized view: district_opportunity_actuals
-- Aggregates opportunities by district, school year, sales rep, and category.
-- Refreshed after each scheduler sync cycle (hourly).

DROP MATERIALIZED VIEW IF EXISTS district_opportunity_actuals;

CREATE MATERIALIZED VIEW district_opportunity_actuals AS
WITH stage_weights AS (
  SELECT unnest(ARRAY[0, 1, 2, 3, 4, 5]) AS prefix,
         unnest(ARRAY[0.05, 0.10, 0.25, 0.50, 0.75, 0.90]) AS weight
),
categorized_opps AS (
  SELECT
    o.*,
    CASE
      WHEN LOWER(o.contract_type) LIKE '%renewal%' THEN 'renewal'
      WHEN LOWER(o.contract_type) LIKE '%winback%' OR LOWER(o.contract_type) LIKE '%win back%' THEN 'winback'
      WHEN LOWER(o.contract_type) LIKE '%expansion%' THEN 'expansion'
      ELSE 'new_business'
    END AS category,
    -- Extract numeric stage prefix (first character(s) before space or dash)
    CASE
      WHEN o.stage ~ '^\d' THEN (regexp_match(o.stage, '^(\d+)'))[1]::int
      ELSE NULL
    END AS stage_prefix
  FROM opportunities o
  WHERE o.district_lea_id IS NOT NULL
)
SELECT
  co.district_lea_id,
  co.school_yr,
  co.sales_rep_email,
  co.category,
  -- Bookings: closed-won (stage prefix >= 6)
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix >= 6), 0) AS bookings,
  -- Open pipeline: stages 0-5, unweighted
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS open_pipeline,
  -- Weighted pipeline
  COALESCE(SUM(co.net_booking_amount * sw.weight) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS weighted_pipeline,
  -- Revenue
  COALESCE(SUM(co.total_revenue), 0) AS total_revenue,
  COALESCE(SUM(co.completed_revenue), 0) AS completed_revenue,
  COALESCE(SUM(co.scheduled_revenue), 0) AS scheduled_revenue,
  -- Take
  COALESCE(SUM(co.total_take), 0) AS total_take,
  COALESCE(SUM(co.completed_take), 0) AS completed_take,
  COALESCE(SUM(co.scheduled_take), 0) AS scheduled_take,
  -- Take rate (per-row, do NOT SUM across rows)
  CASE WHEN SUM(co.total_revenue) > 0
    THEN SUM(co.total_take) / SUM(co.total_revenue)
    ELSE NULL
  END AS avg_take_rate,
  -- Financial
  COALESCE(SUM(co.invoiced), 0) AS invoiced,
  COALESCE(SUM(co.credited), 0) AS credited,
  -- Count
  COUNT(*)::int AS opp_count
FROM categorized_opps co
LEFT JOIN stage_weights sw ON sw.prefix = co.stage_prefix
GROUP BY co.district_lea_id, co.school_yr, co.sales_rep_email, co.category;

-- Indexes for query patterns
CREATE INDEX idx_doa_district ON district_opportunity_actuals (district_lea_id);
CREATE INDEX idx_doa_school_yr ON district_opportunity_actuals (school_yr);
CREATE INDEX idx_doa_rep ON district_opportunity_actuals (sales_rep_email);
CREATE INDEX idx_doa_category ON district_opportunity_actuals (category);
CREATE INDEX idx_doa_district_yr ON district_opportunity_actuals (district_lea_id, school_yr);
CREATE INDEX idx_doa_district_yr_rep ON district_opportunity_actuals (district_lea_id, school_yr, sales_rep_email);

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_doa_unique ON district_opportunity_actuals (district_lea_id, school_yr, sales_rep_email, category);

ANALYZE district_opportunity_actuals;

-- Verify
SELECT COUNT(*) AS row_count,
       COUNT(DISTINCT district_lea_id) AS district_count,
       COUNT(DISTINCT school_yr) AS fy_count
FROM district_opportunity_actuals;
```

- [ ] **Step 2: Verify the SQL runs against the database**

Run: `psql "$SUPABASE_DB_URL" -f scripts/district-opportunity-actuals-view.sql`
Expected: View created, indexes created, row counts printed.

Note: This requires the `opportunities` table to exist (created by the scheduler). If the table doesn't exist yet, the migration will fail — that's expected and correct.

- [ ] **Step 3: Commit**

```bash
git add scripts/district-opportunity-actuals-view.sql
git commit -m "feat: add district_opportunity_actuals materialized view SQL"
```

---

### Task 2: Create Prisma Migration

**Files:**
- Create: `prisma/migrations/YYYYMMDD_add_district_opportunity_actuals_view/migration.sql`

- [ ] **Step 1: Create migration directory**

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d)_add_district_opportunity_actuals_view
```

- [ ] **Step 2: Write migration SQL**

Copy the contents of `scripts/district-opportunity-actuals-view.sql` into `prisma/migrations/YYYYMMDD_add_district_opportunity_actuals_view/migration.sql`.

The script file is the source of truth; the migration is a copy for the Prisma migration chain.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/
git commit -m "feat: add migration for district_opportunity_actuals view"
```

---

### Task 3: Shared Query Helpers

**Files:**
- Create: `src/lib/opportunity-actuals.ts`
- Create: `src/lib/__tests__/opportunity-actuals.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/opportunity-actuals.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
  },
}));

import prisma from "@/lib/prisma";
import {
  getDistrictActuals,
  getRepActuals,
  getDistrictOpportunities,
  fiscalYearToSchoolYear,
} from "@/lib/opportunity-actuals";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fiscalYearToSchoolYear", () => {
  it("converts FY26 to 2025-26", () => {
    expect(fiscalYearToSchoolYear(26)).toBe("2025-26");
    expect(fiscalYearToSchoolYear(2026)).toBe("2025-26");
  });

  it("converts FY25 to 2024-25", () => {
    expect(fiscalYearToSchoolYear(25)).toBe("2024-25");
    expect(fiscalYearToSchoolYear(2025)).toBe("2024-25");
  });

  it("converts FY27 to 2026-27", () => {
    expect(fiscalYearToSchoolYear(27)).toBe("2026-27");
  });
});

describe("getDistrictActuals", () => {
  it("returns aggregated actuals for a district and school year", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        total_revenue: 50000,
        completed_revenue: 30000,
        scheduled_revenue: 20000,
        total_take: 12000,
        completed_take: 8000,
        scheduled_take: 4000,
        weighted_pipeline: 25000,
        open_pipeline: 40000,
        bookings: 35000,
        invoiced: 28000,
        credited: 1200,
        opp_count: 3,
      },
    ]);

    const result = await getDistrictActuals("1234567", "2025-26");
    expect(result).toEqual({
      totalRevenue: 50000,
      completedRevenue: 30000,
      scheduledRevenue: 20000,
      totalTake: 12000,
      completedTake: 8000,
      scheduledTake: 4000,
      weightedPipeline: 25000,
      openPipeline: 40000,
      bookings: 35000,
      invoiced: 28000,
      credited: 1200,
      oppCount: 3,
      takeRate: 0.24, // 12000/50000
    });
  });

  it("returns zeros when no data found", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await getDistrictActuals("9999999", "2025-26");
    expect(result.totalRevenue).toBe(0);
    expect(result.oppCount).toBe(0);
    expect(result.takeRate).toBeNull();
  });
});

describe("getRepActuals", () => {
  it("returns rep-scoped aggregated actuals for a school year", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        total_revenue: 200000,
        total_take: 45000,
        completed_take: 30000,
        scheduled_take: 15000,
        weighted_pipeline: 150000,
        bookings: 180000,
        invoiced: 160000,
      },
    ]);

    const result = await getRepActuals("rep@example.com", "2025-26");
    expect(result.totalRevenue).toBe(200000);
    expect(result.totalTake).toBe(45000);
    expect(result.completedTake).toBe(30000);
    expect(result.scheduledTake).toBe(15000);
  });
});

describe("getNewDistrictsCount", () => {
  it("returns count of districts with current FY opps but no prior FY opps", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 5 }]);

    const result = await getNewDistrictsCount("rep@example.com", "2025-26", "2024-25");
    expect(result).toBe(5);
  });

  it("returns 0 when no new districts", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

    const result = await getNewDistrictsCount("rep@example.com", "2025-26", "2024-25");
    expect(result).toBe(0);
  });
});

describe("getDistrictOpportunities", () => {
  it("returns individual opportunity records for a district", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: "opp-1",
        name: "FY26 Renewal",
        stage: "5 - Closed Won",
        net_booking_amount: 50000,
        total_revenue: 48000,
        total_take: 12000,
        completed_revenue: 30000,
        scheduled_revenue: 18000,
      },
    ]);

    const result = await getDistrictOpportunities("1234567", "2025-26");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "opp-1",
      name: "FY26 Renewal",
      stage: "5 - Closed Won",
      netBookingAmount: 50000,
      totalRevenue: 48000,
      totalTake: 12000,
      completedRevenue: 30000,
      scheduledRevenue: 18000,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/opportunity-actuals.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/opportunity-actuals.ts
import prisma from "@/lib/prisma";

/**
 * Convert a fiscal year number (26 or 2026) to school year string ("2025-26").
 * School year "2025-26" = FY26 (fiscal year starts July 1 of the first year).
 */
export function fiscalYearToSchoolYear(fy: number): string {
  const year = fy < 100 ? 2000 + fy : fy;
  const startYear = year - 1;
  const endYearShort = String(year).slice(-2);
  return `${startYear}-${endYearShort}`;
}

export interface DistrictActuals {
  totalRevenue: number;
  completedRevenue: number;
  scheduledRevenue: number;
  totalTake: number;
  completedTake: number;
  scheduledTake: number;
  weightedPipeline: number;
  openPipeline: number;
  bookings: number;
  invoiced: number;
  credited: number;
  oppCount: number;
  takeRate: number | null;
}

interface RawDistrictActuals {
  total_revenue: number;
  completed_revenue: number;
  scheduled_revenue: number;
  total_take: number;
  completed_take: number;
  scheduled_take: number;
  weighted_pipeline: number;
  open_pipeline: number;
  bookings: number;
  invoiced: number;
  credited: number;
  opp_count: number;
}

const EMPTY_ACTUALS: DistrictActuals = {
  totalRevenue: 0,
  completedRevenue: 0,
  scheduledRevenue: 0,
  totalTake: 0,
  completedTake: 0,
  scheduledTake: 0,
  weightedPipeline: 0,
  openPipeline: 0,
  bookings: 0,
  invoiced: 0,
  credited: 0,
  oppCount: 0,
  takeRate: null,
};

function mapRawToActuals(row: RawDistrictActuals): DistrictActuals {
  const totalRevenue = Number(row.total_revenue);
  const totalTake = Number(row.total_take);
  return {
    totalRevenue,
    completedRevenue: Number(row.completed_revenue),
    scheduledRevenue: Number(row.scheduled_revenue),
    totalTake,
    completedTake: Number(row.completed_take),
    scheduledTake: Number(row.scheduled_take),
    weightedPipeline: Number(row.weighted_pipeline),
    openPipeline: Number(row.open_pipeline),
    bookings: Number(row.bookings),
    invoiced: Number(row.invoiced),
    credited: Number(row.credited),
    oppCount: Number(row.opp_count),
    takeRate: totalRevenue > 0 ? totalTake / totalRevenue : null,
  };
}

/**
 * Get aggregated actuals for a specific district and school year.
 * NOT rep-scoped — shows all opportunities for the district.
 */
export async function getDistrictActuals(
  districtLeaId: string,
  schoolYr: string
): Promise<DistrictActuals> {
  const rows = await prisma.$queryRaw<RawDistrictActuals[]>`
    SELECT
      COALESCE(SUM(total_revenue), 0) AS total_revenue,
      COALESCE(SUM(completed_revenue), 0) AS completed_revenue,
      COALESCE(SUM(scheduled_revenue), 0) AS scheduled_revenue,
      COALESCE(SUM(total_take), 0) AS total_take,
      COALESCE(SUM(completed_take), 0) AS completed_take,
      COALESCE(SUM(scheduled_take), 0) AS scheduled_take,
      COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline,
      COALESCE(SUM(open_pipeline), 0) AS open_pipeline,
      COALESCE(SUM(bookings), 0) AS bookings,
      COALESCE(SUM(invoiced), 0) AS invoiced,
      COALESCE(SUM(credited), 0) AS credited,
      COALESCE(SUM(opp_count), 0)::int AS opp_count
    FROM district_opportunity_actuals
    WHERE district_lea_id = ${districtLeaId}
      AND school_yr = ${schoolYr}
  `;

  if (rows.length === 0) return { ...EMPTY_ACTUALS };
  return mapRawToActuals(rows[0]);
}

export interface RepActuals {
  totalRevenue: number;
  totalTake: number;
  completedTake: number;
  scheduledTake: number;
  weightedPipeline: number;
  bookings: number;
  invoiced: number;
}

/**
 * Get rep-scoped aggregated actuals across all districts for a school year.
 * Used by the goals dashboard.
 */
export async function getRepActuals(
  salesRepEmail: string,
  schoolYr: string
): Promise<RepActuals> {
  const rows = await prisma.$queryRaw<
    {
      total_revenue: number;
      total_take: number;
      completed_take: number;
      scheduled_take: number;
      weighted_pipeline: number;
      bookings: number;
      invoiced: number;
    }[]
  >`
    SELECT
      COALESCE(SUM(total_revenue), 0) AS total_revenue,
      COALESCE(SUM(total_take), 0) AS total_take,
      COALESCE(SUM(completed_take), 0) AS completed_take,
      COALESCE(SUM(scheduled_take), 0) AS scheduled_take,
      COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline,
      COALESCE(SUM(bookings), 0) AS bookings,
      COALESCE(SUM(invoiced), 0) AS invoiced
    FROM district_opportunity_actuals
    WHERE sales_rep_email = ${salesRepEmail}
      AND school_yr = ${schoolYr}
  `;

  if (rows.length === 0) {
    return {
      totalRevenue: 0,
      totalTake: 0,
      completedTake: 0,
      scheduledTake: 0,
      weightedPipeline: 0,
      bookings: 0,
      invoiced: 0,
    };
  }

  const row = rows[0];
  return {
    totalRevenue: Number(row.total_revenue),
    totalTake: Number(row.total_take),
    completedTake: Number(row.completed_take),
    scheduledTake: Number(row.scheduled_take),
    weightedPipeline: Number(row.weighted_pipeline),
    bookings: Number(row.bookings),
    invoiced: Number(row.invoiced),
  };
}

/**
 * Count districts that have current FY opportunities but no prior FY opportunities.
 * Used for "new districts" actual on the goals dashboard.
 */
export async function getNewDistrictsCount(
  salesRepEmail: string,
  currentSchoolYr: string,
  priorSchoolYr: string
): Promise<number> {
  const rows = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(DISTINCT curr.district_lea_id)::int AS count
    FROM district_opportunity_actuals curr
    WHERE curr.sales_rep_email = ${salesRepEmail}
      AND curr.school_yr = ${currentSchoolYr}
      AND curr.district_lea_id NOT IN (
        SELECT DISTINCT prior.district_lea_id
        FROM district_opportunity_actuals prior
        WHERE prior.sales_rep_email = ${salesRepEmail}
          AND prior.school_yr = ${priorSchoolYr}
      )
  `;
  return rows[0]?.count ?? 0;
}

export interface OpportunityDetail {
  id: string;
  name: string;
  stage: string;
  netBookingAmount: number;
  totalRevenue: number;
  totalTake: number;
  completedRevenue: number;
  scheduledRevenue: number;
}

/**
 * Get individual opportunities for a district in a specific school year.
 * Queries the raw opportunities table (not the materialized view).
 */
export async function getDistrictOpportunities(
  districtLeaId: string,
  schoolYr: string
): Promise<OpportunityDetail[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      name: string;
      stage: string;
      net_booking_amount: number;
      total_revenue: number;
      total_take: number;
      completed_revenue: number;
      scheduled_revenue: number;
    }[]
  >`
    SELECT id, name, stage,
           COALESCE(net_booking_amount, 0) AS net_booking_amount,
           COALESCE(total_revenue, 0) AS total_revenue,
           COALESCE(total_take, 0) AS total_take,
           COALESCE(completed_revenue, 0) AS completed_revenue,
           COALESCE(scheduled_revenue, 0) AS scheduled_revenue
    FROM opportunities
    WHERE district_lea_id = ${districtLeaId}
      AND school_yr = ${schoolYr}
    ORDER BY net_booking_amount DESC
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    stage: r.stage,
    netBookingAmount: Number(r.net_booking_amount),
    totalRevenue: Number(r.total_revenue),
    totalTake: Number(r.total_take),
    completedRevenue: Number(r.completed_revenue),
    scheduledRevenue: Number(r.scheduled_revenue),
  }));
}

/**
 * Get actuals for a set of districts (used for plan-level rollups and goals dashboard).
 * Returns totals aggregated across all provided district IDs.
 * Optional salesRepEmail scopes to a specific rep (used by goals dashboard).
 */
export async function getPlanDistrictActuals(
  districtLeaIds: string[],
  schoolYr: string,
  salesRepEmail?: string
): Promise<{ totalRevenue: number; totalTake: number; bookings: number }> {
  if (districtLeaIds.length === 0) {
    return { totalRevenue: 0, totalTake: 0, bookings: 0 };
  }

  if (salesRepEmail) {
    const rows = await prisma.$queryRaw<
      { total_revenue: number; total_take: number; bookings: number }[]
    >`
      SELECT
        COALESCE(SUM(total_revenue), 0) AS total_revenue,
        COALESCE(SUM(total_take), 0) AS total_take,
        COALESCE(SUM(bookings), 0) AS bookings
      FROM district_opportunity_actuals
      WHERE district_lea_id = ANY(${districtLeaIds})
        AND school_yr = ${schoolYr}
        AND sales_rep_email = ${salesRepEmail}
    `;
    if (rows.length === 0) return { totalRevenue: 0, totalTake: 0, bookings: 0 };
    return {
      totalRevenue: Number(rows[0].total_revenue),
      totalTake: Number(rows[0].total_take),
      bookings: Number(rows[0].bookings),
    };
  }

  const rows = await prisma.$queryRaw<
    { total_revenue: number; total_take: number; bookings: number }[]
  >`
    SELECT
      COALESCE(SUM(total_revenue), 0) AS total_revenue,
      COALESCE(SUM(total_take), 0) AS total_take,
      COALESCE(SUM(bookings), 0) AS bookings
    FROM district_opportunity_actuals
    WHERE district_lea_id = ANY(${districtLeaIds})
      AND school_yr = ${schoolYr}
  `;

  if (rows.length === 0) return { totalRevenue: 0, totalTake: 0, bookings: 0 };
  return {
    totalRevenue: Number(rows[0].total_revenue),
    totalTake: Number(rows[0].total_take),
    bookings: Number(rows[0].bookings),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/opportunity-actuals.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/opportunity-actuals.ts src/lib/__tests__/opportunity-actuals.test.ts
git commit -m "feat: add shared opportunity actuals query helpers"
```

---

### Task 4: Update TypeScript Types

**Files:**
- Modify: `src/features/shared/types/api-types.ts`

- [ ] **Step 1: Update GoalDashboard interface**

In `src/features/shared/types/api-types.ts`, find the `GoalDashboard` interface (around line 731) and update it:

Add `takeTarget` to the `goals` object:
```typescript
    takeTarget: number | null;
```

Add new fields to the `actuals` object:
```typescript
    completedTake: number;
    scheduledTake: number;
    bookings: number;
    invoiced: number;
```

Add new fields to the `plans` array items:
```typescript
    revenueActual: number;
    takeActual: number;
    bookingsActual: number;
```

- [ ] **Step 2: Add DistrictActuals type for plan district responses**

Add after the GoalDashboard interface:

```typescript
export interface PlanDistrictActuals {
  totalRevenue: number;
  completedRevenue: number;
  scheduledRevenue: number;
  totalTake: number;
  completedTake: number;
  scheduledTake: number;
  takeRate: number | null;
  openPipeline: number;
  weightedPipeline: number;
  invoiced: number;
  credited: number;
  oppCount: number;
  priorFyRevenue: number;
  priorFyTake: number;
  yoyRevenueChange: number | null;
}

export interface PlanDistrictOpportunity {
  id: string;
  name: string;
  stage: string;
  netBookingAmount: number;
  totalRevenue: number;
  totalTake: number;
  completedRevenue: number;
  scheduledRevenue: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/types/api-types.ts
git commit -m "feat: add opportunity actuals types to GoalDashboard and plan district"
```

---

### Task 5: Update Goals Dashboard API Route

**Files:**
- Modify: `src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts`

- [ ] **Step 1: Read the current route**

Read `src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts` fully to understand the current structure. The route currently computes actuals from hardcoded FY columns on the districts table. We need to replace that with queries to the materialized view.

- [ ] **Step 2: Import helpers and update actuals computation**

Add import at top:
```typescript
import {
  getRepActuals,
  getNewDistrictsCount,
  getPlanDistrictActuals,
  fiscalYearToSchoolYear,
} from "@/lib/opportunity-actuals";
```

Replace the section that computes actuals (the FY-specific column lookups) with:

```typescript
const schoolYr = fiscalYearToSchoolYear(fiscalYear);
const priorSchoolYr = fiscalYearToSchoolYear(fiscalYear - 1);

const [repActuals, newDistrictsCount] = await Promise.all([
  getRepActuals(user.email, schoolYr),
  getNewDistrictsCount(user.email, schoolYr, priorSchoolYr),
]);

const BASE_SALARY = 130000;
const COMMISSION_RATE = 0.10;

const actuals = {
  earnings: BASE_SALARY + repActuals.totalTake * COMMISSION_RATE,
  revenue: repActuals.totalRevenue,
  take: repActuals.totalTake,
  completedTake: repActuals.completedTake,
  scheduledTake: repActuals.scheduledTake,
  pipeline: repActuals.weightedPipeline,
  bookings: repActuals.bookings,
  invoiced: repActuals.invoiced,
  newDistricts: newDistrictsCount,
};
```

- [ ] **Step 3: Add takeTarget to goals response**

In the goals object construction, add `takeTarget` and ensure `newDistrictsTarget` is included:
```typescript
goals: userGoal
  ? {
      earningsTarget: Number(userGoal.earningsTarget) || null,
      takeRatePercent: Number(userGoal.takeRatePercent) || null,
      takeTarget: Number(userGoal.takeTarget) || null,
      renewalTarget: Number(userGoal.renewalTarget) || null,
      winbackTarget: Number(userGoal.winbackTarget) || null,
      expansionTarget: Number(userGoal.expansionTarget) || null,
      newBusinessTarget: Number(userGoal.newBusinessTarget) || null,
      newDistrictsTarget: userGoal.newDistrictsTarget,
    }
  : null,
```

- [ ] **Step 4: Add per-plan actuals**

After computing per-plan target totals, add actuals for each plan. Replace/augment the plans mapping:

```typescript
const plansWithActuals = await Promise.all(
  plans.map(async (plan) => {
    const districtLeaIds = plan.districts.map((d) => d.districtLeaid);
    const planActuals = await getPlanDistrictActuals(districtLeaIds, schoolYr, user.email);

    return {
      id: plan.id,
      name: plan.name,
      color: plan.color,
      status: plan.status,
      districtCount: plan.districts.length,
      renewalTarget: plan.districts.reduce((s, d) => s + Number(d.renewalTarget ?? 0), 0),
      winbackTarget: plan.districts.reduce((s, d) => s + Number(d.winbackTarget ?? 0), 0),
      expansionTarget: plan.districts.reduce((s, d) => s + Number(d.expansionTarget ?? 0), 0),
      newBusinessTarget: plan.districts.reduce((s, d) => s + Number(d.newBusinessTarget ?? 0), 0),
      totalTarget: plan.districts.reduce(
        (s, d) =>
          s +
          Number(d.renewalTarget ?? 0) +
          Number(d.winbackTarget ?? 0) +
          Number(d.expansionTarget ?? 0) +
          Number(d.newBusinessTarget ?? 0),
        0
      ),
      revenueActual: planActuals.totalRevenue,
      takeActual: planActuals.totalTake,
      bookingsActual: planActuals.bookings,
    };
  })
);
```

Note: `getPlanDistrictActuals` is called with `user.email` for rep-scoping (goals dashboard shows only the rep's own actuals per plan). The `bookings` field is included in the return type from Task 3.

- [ ] **Step 5: Verify the route builds**

Run: `npx next build` (or `npx tsc --noEmit` for type checking)
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts
git commit -m "feat: wire goals dashboard actuals to opportunity materialized view"
```

---

## Chunk 2: Plan APIs + UI Components

### Task 6: Update Plan List API (Plan Summary Card Data)

**Files:**
- Modify: `src/app/api/territory-plans/route.ts`

- [ ] **Step 1: Read the current route**

Read `src/app/api/territory-plans/route.ts` to understand how `pipelineTotal` is computed at query time. The new `revenueActual`, `takeActual`, and `priorFyRevenue` follow the same pattern.

- [ ] **Step 2: Import helpers**

```typescript
import { getPlanDistrictActuals, fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";
```

- [ ] **Step 3: Add actuals to plan response**

The existing plan list route maps plans synchronously. Change this to use `Promise.all` with an async mapper. Replace the `plans.map(...)` block with:

```typescript
const plansResponse = await Promise.all(
  plans.map(async (plan) => {
    // Existing pipelineTotal computation stays as-is
    const pipelineTotal = plan.districts.reduce((sum, d) => {
      const pipeline = plan.fiscalYear === 2026
        ? Number(d.district.fy26OpenPipeline ?? 0)
        : plan.fiscalYear === 2027
          ? Number(d.district.fy27OpenPipeline ?? 0)
          : 0;
      return sum + pipeline;
    }, 0);

    // NEW: opportunity actuals (not rep-scoped for plan list)
    const schoolYr = fiscalYearToSchoolYear(plan.fiscalYear);
    const priorSchoolYr = fiscalYearToSchoolYear(plan.fiscalYear - 1);
    const districtLeaIds = plan.districts.map((d) => d.districtLeaid);

    const [currentActuals, priorActuals] = await Promise.all([
      getPlanDistrictActuals(districtLeaIds, schoolYr),
      getPlanDistrictActuals(districtLeaIds, priorSchoolYr),
    ]);

    return {
      // ...existing plan fields (id, name, color, status, etc.)
      pipelineTotal,
      revenueActual: currentActuals.totalRevenue,
      takeActual: currentActuals.totalTake,
      priorFyRevenue: priorActuals.totalRevenue,
    };
  })
);
```

Note: This makes 2 SQL queries per plan. For a typical rep with 2-5 plans, this is 4-10 queries total which is acceptable. If plan counts grow, consider batching all district IDs into a single query grouped by plan.

- [ ] **Step 4: Update TerritoryPlan type**

In `src/features/shared/types/api-types.ts`, add to the `TerritoryPlan` interface (optional to handle cached/stale data):
```typescript
revenueActual?: number;
takeActual?: number;
priorFyRevenue?: number;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/territory-plans/route.ts src/features/shared/types/api-types.ts
git commit -m "feat: add revenue/take/priorFY actuals to plan list API"
```

---

### Task 7: Update Plan Detail API (Per-District Actuals)

**Files:**
- Modify: `src/app/api/territory-plans/[id]/route.ts`

- [ ] **Step 1: Read the current route**

Read `src/app/api/territory-plans/[id]/route.ts` to understand the plan detail response structure.

- [ ] **Step 2: Import helpers**

```typescript
import { getDistrictActuals, fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";
```

- [ ] **Step 3: Add per-district actuals**

After fetching the plan with districts, batch-fetch actuals for all districts in 2 queries (current + prior FY) rather than N+1:

```typescript
import { fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";

const schoolYr = fiscalYearToSchoolYear(plan.fiscalYear);
const priorSchoolYr = fiscalYearToSchoolYear(plan.fiscalYear - 1);
const allLeaIds = plan.districts.map((d) => d.districtLeaid);

// Batch: 2 queries total, not 2 per district
const [currentRows, priorRows] = await Promise.all([
  prisma.$queryRaw<
    { district_lea_id: string; total_revenue: number; total_take: number; weighted_pipeline: number }[]
  >`
    SELECT district_lea_id,
           COALESCE(SUM(total_revenue), 0) AS total_revenue,
           COALESCE(SUM(total_take), 0) AS total_take,
           COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline
    FROM district_opportunity_actuals
    WHERE district_lea_id = ANY(${allLeaIds})
      AND school_yr = ${schoolYr}
    GROUP BY district_lea_id
  `,
  prisma.$queryRaw<
    { district_lea_id: string; total_revenue: number }[]
  >`
    SELECT district_lea_id,
           COALESCE(SUM(total_revenue), 0) AS total_revenue
    FROM district_opportunity_actuals
    WHERE district_lea_id = ANY(${allLeaIds})
      AND school_yr = ${priorSchoolYr}
    GROUP BY district_lea_id
  `,
]);

// Index by district ID for O(1) lookup
const currentByDistrict = new Map(currentRows.map((r) => [r.district_lea_id, r]));
const priorByDistrict = new Map(priorRows.map((r) => [r.district_lea_id, r]));

// Map districts, attaching actuals from the batch results
const districtsWithActuals = plan.districts.map((d) => {
  const curr = currentByDistrict.get(d.districtLeaid);
  const prior = priorByDistrict.get(d.districtLeaid);
  return {
    // ...existing district fields (spread existing mapping)
    actuals: curr
      ? {
          totalRevenue: Number(curr.total_revenue),
          totalTake: Number(curr.total_take),
          weightedPipeline: Number(curr.weighted_pipeline),
          priorFyRevenue: prior ? Number(prior.total_revenue) : 0,
        }
      : undefined,
  };
});
```

- [ ] **Step 4: Update TerritoryPlanDistrict type**

In `src/features/shared/types/api-types.ts`, add to `TerritoryPlanDistrict`:
```typescript
actuals?: {
  totalRevenue: number;
  totalTake: number;
  weightedPipeline: number;
  priorFyRevenue: number;
};
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/territory-plans/[id]/route.ts src/features/shared/types/api-types.ts
git commit -m "feat: add per-district opportunity actuals to plan detail API"
```

---

### Task 8: Update District Detail API (Full Actuals + Opportunity List)

**Files:**
- Modify: `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts`

- [ ] **Step 1: Read the current route**

Read `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts` to understand the GET handler.

- [ ] **Step 2: Import helpers**

```typescript
import {
  getDistrictActuals,
  getDistrictOpportunities,
  fiscalYearToSchoolYear,
} from "@/lib/opportunity-actuals";
```

- [ ] **Step 3: Add actuals and opportunities to GET response**

After fetching the plan district, look up the plan's fiscal year and compute actuals:

```typescript
// Get the plan's fiscal year
const plan = await prisma.territoryPlan.findUnique({
  where: { id: planId },
  select: { fiscalYear: true },
});

let actuals = null;
let opportunities: OpportunityDetail[] = [];

if (plan) {
  const schoolYr = fiscalYearToSchoolYear(plan.fiscalYear);
  const priorSchoolYr = fiscalYearToSchoolYear(plan.fiscalYear - 1);

  const [currentActuals, priorActuals, opps] = await Promise.all([
    getDistrictActuals(leaid, schoolYr),
    getDistrictActuals(leaid, priorSchoolYr),
    getDistrictOpportunities(leaid, schoolYr),
  ]);

  const yoyRevenueChange =
    priorActuals.totalRevenue > 0
      ? ((currentActuals.totalRevenue - priorActuals.totalRevenue) /
          priorActuals.totalRevenue) *
        100
      : null;

  actuals = {
    totalRevenue: currentActuals.totalRevenue,
    completedRevenue: currentActuals.completedRevenue,
    scheduledRevenue: currentActuals.scheduledRevenue,
    totalTake: currentActuals.totalTake,
    completedTake: currentActuals.completedTake,
    scheduledTake: currentActuals.scheduledTake,
    takeRate: currentActuals.takeRate,
    openPipeline: currentActuals.openPipeline,
    weightedPipeline: currentActuals.weightedPipeline,
    invoiced: currentActuals.invoiced,
    credited: currentActuals.credited,
    oppCount: currentActuals.oppCount,
    priorFyRevenue: priorActuals.totalRevenue,
    priorFyTake: priorActuals.totalTake,
    yoyRevenueChange: yoyRevenueChange ? Math.round(yoyRevenueChange * 100) / 100 : null,
  };
  opportunities = opps;
}

// Add actuals and opportunities to the existing response object:
return NextResponse.json({
  // ...existing district detail fields
  actuals,
  opportunities,
});
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/territory-plans/[id]/districts/[leaid]/route.ts
git commit -m "feat: add full actuals and opportunity list to district detail API"
```

---

### Task 9: Update DistrictsTable Component

**Files:**
- Modify: `src/features/plans/components/DistrictsTable.tsx`

- [ ] **Step 1: Read the current component**

Read `src/features/plans/components/DistrictsTable.tsx` fully. Note the existing column structure and the Tooltip pattern from GoalEditorModal.

- [ ] **Step 2: Add Tooltip component**

Add the Tooltip component (reuse the pattern from GoalEditorModal or create a shared one). If already available as a shared component, import it. Otherwise, add inline:

```typescript
function ColumnTooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-block ml-1">
      <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 cursor-help inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-[#403770] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 z-50 whitespace-normal">
        {text}
        <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-[#403770]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add tooltips to existing target column headers**

Update the `<thead>` section. For each existing target column header, add a tooltip:

```typescript
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
  Renewal
  <ColumnTooltip text="Target revenue from renewal opportunities in this district for the current fiscal year" />
</th>
```

Repeat for Winback, Expansion, New Biz with their respective tooltip texts from the spec.

- [ ] **Step 4: Add new columns to header**

After the New Biz column and before Services, add:

```typescript
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
  Revenue
  <ColumnTooltip text="Actual revenue from completed and scheduled sessions vs your combined revenue targets (renewal + winback + expansion + new business) for this district" />
</th>
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
  Take
  <ColumnTooltip text="Total take (revenue minus educator costs) for this district in the current fiscal year" />
</th>
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
  Pipeline
  <ColumnTooltip text="Total weighted open pipeline (stages 0-5) for this district in the current fiscal year" />
</th>
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
  Prior FY
  <ColumnTooltip text="Total revenue from opportunities in this district during the previous fiscal year" />
</th>
```

- [ ] **Step 5: Add new columns to each row**

After the New Biz `<td>` and before Services `<td>`, add:

```typescript
<td className="px-3 py-3 text-right">
  {district.actuals ? (
    <div>
      <span className="text-[13px] text-gray-600">
        {formatCurrency(district.actuals.totalRevenue)}
      </span>
      <span className="text-[11px] text-gray-400">
        {" / "}
        {formatCurrency(
          (district.renewalTarget || 0) +
          (district.winbackTarget || 0) +
          (district.expansionTarget || 0) +
          (district.newBusinessTarget || 0)
        )}
      </span>
    </div>
  ) : (
    <span className="text-[13px] text-gray-400">-</span>
  )}
</td>
<td className="px-3 py-3 text-right">
  <span className="text-[13px] text-gray-600">
    {district.actuals ? formatCurrency(district.actuals.totalTake) : "-"}
  </span>
</td>
<td className="px-3 py-3 text-right">
  <span className="text-[13px] text-gray-600">
    {district.actuals ? formatCurrency(district.actuals.weightedPipeline) : "-"}
  </span>
</td>
<td className="px-3 py-3 text-right">
  <span className="text-[13px] text-gray-400">
    {district.actuals ? formatCurrency(district.actuals.priorFyRevenue) : "-"}
  </span>
</td>
```

- [ ] **Step 6: Update footer totals**

Add actuals totals to the existing `totals` reduce. Merge into the existing initializer:

```typescript
const totals = districts.reduce(
  (acc, d) => ({
    renewalTarget: acc.renewalTarget + (d.renewalTarget || 0),
    winbackTarget: acc.winbackTarget + (d.winbackTarget || 0),
    expansionTarget: acc.expansionTarget + (d.expansionTarget || 0),
    newBusinessTarget: acc.newBusinessTarget + (d.newBusinessTarget || 0),
    enrollment: acc.enrollment + (d.enrollment || 0),
    revenueActual: acc.revenueActual + (d.actuals?.totalRevenue || 0),
    takeActual: acc.takeActual + (d.actuals?.totalTake || 0),
    pipelineActual: acc.pipelineActual + (d.actuals?.weightedPipeline || 0),
    priorFyRevenue: acc.priorFyRevenue + (d.actuals?.priorFyRevenue || 0),
  }),
  {
    renewalTarget: 0, winbackTarget: 0, expansionTarget: 0, newBusinessTarget: 0,
    enrollment: 0, revenueActual: 0, takeActual: 0, pipelineActual: 0, priorFyRevenue: 0,
  }
);
```

Update the footer JSX to display actuals totals alongside the existing grand total:

```typescript
<div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
  <span className="text-[12px] font-medium text-gray-400 tracking-wide">
    {districts.length} district{districts.length !== 1 ? "s" : ""}
  </span>
  <div className="flex gap-4 text-[12px] text-gray-400">
    <span>Target: <span className="font-medium text-gray-500">{formatCurrency(grandTotal)}</span></span>
    <span>Revenue: <span className="font-medium text-gray-500">{formatCurrency(totals.revenueActual)}</span></span>
    <span>Take: <span className="font-medium text-gray-500">{formatCurrency(totals.takeActual)}</span></span>
    <span>Pipeline: <span className="font-medium text-gray-500">{formatCurrency(totals.pipelineActual)}</span></span>
  </div>
</div>
```

- [ ] **Step 7: Commit**

```bash
git add src/features/plans/components/DistrictsTable.tsx
git commit -m "feat: add revenue, take, pipeline, prior FY columns to districts table"
```

---

### Task 10: Update FlippablePlanCard Component

**Files:**
- Modify: `src/features/plans/components/FlippablePlanCard.tsx`

- [ ] **Step 1: Read the current component**

Read `src/features/plans/components/FlippablePlanCard.tsx`. Note the existing `pipelineTotal` progress bar.

- [ ] **Step 2: Replace pipeline bar with revenue vs target bar**

Update the progress calculation:

```typescript
const totalTarget =
  plan.renewalRollup + plan.expansionRollup + plan.winbackRollup + plan.newBusinessRollup;
const revenueActual = plan.revenueActual ?? 0;
const pctToTarget =
  totalTarget > 0 ? Math.min(Math.round((revenueActual / totalTarget) * 100), 999) : 0;
```

Update the label:
```typescript
<span className={`text-gray-400 ${isCompact ? "text-[10px]" : "text-[11px]"}`}>
  {formatCompact(revenueActual)} / {formatCompact(totalTarget)} revenue
</span>
```

- [ ] **Step 3: Commit**

```bash
git add src/features/plans/components/FlippablePlanCard.tsx
git commit -m "feat: update plan card to show revenue vs target instead of pipeline"
```

---

### Task 11: Create DistrictPerformanceSection Component

**Files:**
- Create: `src/features/plans/components/DistrictPerformanceSection.tsx`
- Create: `src/features/plans/components/__tests__/DistrictPerformanceSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/plans/components/__tests__/DistrictPerformanceSection.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DistrictPerformanceSection from "../DistrictPerformanceSection";
import type { PlanDistrictActuals, PlanDistrictOpportunity } from "@/features/shared/types/api-types";

const mockActuals: PlanDistrictActuals = {
  totalRevenue: 50000,
  completedRevenue: 30000,
  scheduledRevenue: 20000,
  totalTake: 12000,
  completedTake: 8000,
  scheduledTake: 4000,
  takeRate: 0.24,
  openPipeline: 40000,
  weightedPipeline: 25000,
  invoiced: 28000,
  credited: 1200,
  oppCount: 3,
  priorFyRevenue: 38500,
  priorFyTake: 9000,
  yoyRevenueChange: 29.87,
};

const mockOpportunities: PlanDistrictOpportunity[] = [
  {
    id: "opp-1",
    name: "FY26 Renewal — Reading Program",
    stage: "5 - Closed Won",
    netBookingAmount: 28000,
    totalRevenue: 26000,
    totalTake: 6200,
    completedRevenue: 20000,
    scheduledRevenue: 6000,
  },
];

describe("DistrictPerformanceSection", () => {
  it("renders metric values", () => {
    render(
      <DistrictPerformanceSection
        actuals={mockActuals}
        opportunities={mockOpportunities}
        revenueTarget={50000}
        goalTakeRatePercent={20}
      />
    );

    expect(screen.getByText("$50,000")).toBeInTheDocument(); // revenue
    expect(screen.getByText(/\$12,000/)).toBeInTheDocument(); // take
    expect(screen.getByText("24.0%")).toBeInTheDocument(); // take rate
  });

  it("renders opportunity list", () => {
    render(
      <DistrictPerformanceSection
        actuals={mockActuals}
        opportunities={mockOpportunities}
        revenueTarget={50000}
        goalTakeRatePercent={20}
      />
    );

    expect(screen.getByText("FY26 Renewal — Reading Program")).toBeInTheDocument();
    expect(screen.getByText("5 - Closed Won")).toBeInTheDocument();
  });

  it("shows empty state when no actuals", () => {
    render(
      <DistrictPerformanceSection
        actuals={null}
        opportunities={[]}
        revenueTarget={50000}
        goalTakeRatePercent={20}
      />
    );

    expect(screen.getByText("No opportunity data available for this fiscal year.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/plans/components/__tests__/DistrictPerformanceSection.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the component**

Write the component. Use @frontend-design skill for visual polish if desired, but provide the functional implementation here:

```typescript
// src/features/plans/components/DistrictPerformanceSection.tsx
"use client";

import type {
  PlanDistrictActuals,
  PlanDistrictOpportunity,
} from "@/features/shared/types/api-types";

interface DistrictPerformanceSectionProps {
  actuals: PlanDistrictActuals | null;
  opportunities: PlanDistrictOpportunity[];
  revenueTarget: number;
  goalTakeRatePercent: number | null;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `$${Math.round(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function MetricCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold text-[#403770] mt-1">{value}</div>
      {subtext && <div className="text-[10px] text-gray-400 mt-1">{subtext}</div>}
    </div>
  );
}

export default function DistrictPerformanceSection({
  actuals,
  opportunities,
  revenueTarget,
  goalTakeRatePercent,
}: DistrictPerformanceSectionProps) {
  if (!actuals) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        No opportunity data available for this fiscal year.
      </div>
    );
  }

  const takeRateDisplay = actuals.takeRate != null
    ? `${(actuals.takeRate * 100).toFixed(1)}%`
    : "-";
  const goalRateDisplay = goalTakeRatePercent != null
    ? `Goal: ${goalTakeRatePercent}%`
    : undefined;
  const yoyDisplay = actuals.yoyRevenueChange != null
    ? `${actuals.yoyRevenueChange > 0 ? "↑" : "↓"} ${Math.abs(actuals.yoyRevenueChange).toFixed(0)}% YoY`
    : undefined;

  return (
    <div>
      <h4 className="text-[11px] font-semibold text-[#403770] uppercase tracking-wide mb-3">
        Performance
      </h4>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricCard
          label="Revenue vs Target"
          value={`${formatCurrency(actuals.totalRevenue)} / ${formatCurrency(revenueTarget)}`}
        />
        <MetricCard
          label="Take"
          value={formatCurrency(actuals.completedTake)}
          subtext={actuals.scheduledTake > 0 ? `+ ${formatCurrency(actuals.scheduledTake)} scheduled` : undefined}
        />
        <MetricCard label="Take Rate" value={takeRateDisplay} subtext={goalRateDisplay} />
        <MetricCard
          label="Pipeline"
          value={formatCurrency(actuals.weightedPipeline)}
          subtext={`${actuals.oppCount} open opp${actuals.oppCount !== 1 ? "s" : ""}`}
        />
        <MetricCard label="Invoiced" value={formatCurrency(actuals.invoiced)} />
        <MetricCard
          label="Prior FY Revenue"
          value={formatCurrency(actuals.priorFyRevenue)}
          subtext={yoyDisplay}
        />
      </div>

      {/* Opportunities list */}
      <h4 className="text-[11px] font-semibold text-[#403770] uppercase tracking-wide mb-2">
        Opportunities ({opportunities.length})
      </h4>
      {opportunities.length === 0 ? (
        <p className="text-sm text-gray-400">No opportunities in this fiscal year.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {opportunities.map((opp, idx) => (
            <div
              key={opp.id}
              className={`flex justify-between items-start px-3 py-2.5 text-sm ${
                idx < opportunities.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <div>
                <div className="font-medium text-gray-700">{opp.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{opp.stage}</div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-700">{formatCurrency(opp.netBookingAmount)}</div>
                <div className="text-xs text-gray-400 mt-0.5">Take: {formatCurrency(opp.totalTake)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/plans/components/__tests__/DistrictPerformanceSection.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/plans/components/DistrictPerformanceSection.tsx src/features/plans/components/__tests__/DistrictPerformanceSection.test.tsx
git commit -m "feat: add DistrictPerformanceSection component"
```

---

### Task 12: Integrate DistrictPerformanceSection into PlanDistrictPanel

**Files:**
- Modify: `src/features/plans/components/PlanDistrictPanel.tsx`

- [ ] **Step 1: Read the current component**

Read `src/features/plans/components/PlanDistrictPanel.tsx` to understand the Planning tab structure.

- [ ] **Step 2: Import and add DistrictPerformanceSection**

Import the component and the hook for fetching district detail with actuals:

```typescript
import DistrictPerformanceSection from "./DistrictPerformanceSection";
import { usePlanDistrictDetail } from "@/lib/api";
import { useGoalDashboard } from "@/lib/api";
```

The PlanDistrictPanel receives `planId` and `leaid` as props. Use the existing `usePlanDistrictDetail` hook (which hits the route we updated in Task 8) to get actuals and opportunities. Also fetch the user's goal take rate via `useGoalDashboard`.

In the component body, add the data fetch:

```typescript
// This hook already exists and hits GET /api/territory-plans/[id]/districts/[leaid]
// which now returns actuals and opportunities (from Task 8)
const { data: planDistrict } = usePlanDistrictDetail(planId, leaid);

// Get the user's goal take rate for comparison display
// The plan's fiscalYear is available from the parent plan data
const { data: goalDashboard } = useGoalDashboard(fiscalYear);
const goalTakeRatePercent = goalDashboard?.goals?.takeRatePercent ?? null;
```

In the Planning tab's render, after existing content:

```typescript
{/* Performance Section */}
<div className="border-t border-gray-200 mt-4 pt-4">
  <DistrictPerformanceSection
    actuals={planDistrict?.actuals ?? null}
    opportunities={planDistrict?.opportunities ?? []}
    revenueTarget={
      (planDistrict?.renewalTarget || 0) +
      (planDistrict?.winbackTarget || 0) +
      (planDistrict?.expansionTarget || 0) +
      (planDistrict?.newBusinessTarget || 0)
    }
    goalTakeRatePercent={goalTakeRatePercent}
  />
</div>
```

Note: `usePlanDistrictDetail` is already called in this component for existing district data. If so, reuse the existing call — just access the new `actuals` and `opportunities` fields from its response. If it's not called yet, add it as shown above. The `fiscalYear` prop may need to be threaded through from the parent — check `PlanDistrictPanel`'s existing props.

- [ ] **Step 3: Commit**

```bash
git add src/features/plans/components/PlanDistrictPanel.tsx
git commit -m "feat: add performance section to plan district panel Planning tab"
```

---

### Task 13: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (pre-existing failures in route.test.ts files are expected — ignore those)

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup and final verification"
```
