# Phase 3a: Remove extractFullmindFinancials Shim

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat FY-field API shape (`fy25SessionsRevenue`, etc.) with a normalized `districtFinancials: DistrictFinancial[]` array across all API routes and frontend components.

**Architecture:** API routes stop calling `extractFullmindFinancials()` and return the Prisma relation data directly. A new `DistrictFinancial` type and `getFinancial()` helper replace the 18 flat FY fields. Frontend components switch from `fullmindData.fy25SessionsRevenue` to `getFinancial(financials, 'fullmind', 'FY25', 'totalRevenue')`.

**Tech Stack:** TypeScript, Next.js App Router, Prisma, React, TanStack Query, Vitest

**Spec:** `Docs/superpowers/specs/2026-04-11-phase3-schema-cleanup-design.md`

---

### Task 1: Add `DistrictFinancial` type and `getFinancial()` helper

**Files:**
- Modify: `src/features/shared/types/api-types.ts:39-71`
- Modify: `src/features/shared/lib/financial-helpers.ts`
- Modify: `src/features/shared/lib/__tests__/financial-helpers.test.ts`

- [ ] **Step 1: Add DistrictFinancial type to api-types.ts**

Add the new type after the `District` interface (before `FullmindData`):

```ts
export interface DistrictFinancial {
  vendor: string;
  fiscalYear: string;
  totalRevenue: number | null;
  allTake: number | null;
  sessionCount: number | null;
  closedWonOppCount: number | null;
  closedWonBookings: number | null;
  invoicing: number | null;
  openPipelineOppCount: number | null;
  openPipeline: number | null;
  weightedPipeline: number | null;
  poCount: number | null;
}
```

- [ ] **Step 2: Write tests for `getFinancial()` helper**

In `src/features/shared/lib/__tests__/financial-helpers.test.ts`, add a new describe block:

```ts
describe("getFinancial", () => {
  const financials: DistrictFinancial[] = [
    {
      vendor: "fullmind", fiscalYear: "FY25",
      totalRevenue: 100000, allTake: 50000, sessionCount: 120,
      closedWonOppCount: 3, closedWonBookings: 85000, invoicing: 98000,
      openPipelineOppCount: null, openPipeline: null, weightedPipeline: null,
      poCount: null,
    },
    {
      vendor: "fullmind", fiscalYear: "FY26",
      totalRevenue: 142500, allTake: 70000, sessionCount: 180,
      closedWonOppCount: 5, closedWonBookings: 120000, invoicing: 130000,
      openPipelineOppCount: 2, openPipeline: 50000, weightedPipeline: 30000,
      poCount: null,
    },
    {
      vendor: "fullmind", fiscalYear: "FY27",
      totalRevenue: null, allTake: null, sessionCount: null,
      closedWonOppCount: null, closedWonBookings: null, invoicing: null,
      openPipelineOppCount: 1, openPipeline: 25000, weightedPipeline: 15000,
      poCount: null,
    },
  ];

  it("returns value for matching vendor and fiscal year", () => {
    expect(getFinancial(financials, "fullmind", "FY25", "totalRevenue")).toBe(100000);
  });

  it("returns value for FY26 pipeline fields", () => {
    expect(getFinancial(financials, "fullmind", "FY26", "openPipeline")).toBe(50000);
    expect(getFinancial(financials, "fullmind", "FY26", "weightedPipeline")).toBe(30000);
  });

  it("returns null when field is null", () => {
    expect(getFinancial(financials, "fullmind", "FY25", "openPipeline")).toBeNull();
  });

  it("returns null for missing vendor/FY combination", () => {
    expect(getFinancial(financials, "elevate", "FY25", "totalRevenue")).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(getFinancial([], "fullmind", "FY25", "totalRevenue")).toBeNull();
  });
});
```

Import `getFinancial` and `DistrictFinancial` at the top of the test file.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run src/features/shared/lib/__tests__/financial-helpers.test.ts`

Expected: FAIL — `getFinancial` is not exported (only `getFinancialValue` exists, which returns `number` not `number | null`).

- [ ] **Step 4: Implement `getFinancial()` in financial-helpers.ts**

Add the new function. This is distinct from the existing `getFinancialValue()` — it takes the new `DistrictFinancial` type (plain numbers, not Prisma Decimals) and returns `number | null` instead of defaulting to 0:

```ts
import type { DistrictFinancial } from "@/features/shared/types/api-types";

/**
 * Get a single financial metric from a DistrictFinancial[] array.
 * Returns null if no matching record or if the field is null.
 */
export function getFinancial(
  financials: DistrictFinancial[],
  vendor: string,
  fiscalYear: string,
  field: keyof Omit<DistrictFinancial, "vendor" | "fiscalYear">
): number | null {
  const record = financials.find(
    (f) => f.vendor === vendor && f.fiscalYear === fiscalYear
  );
  if (!record) return null;
  return record[field];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run src/features/shared/lib/__tests__/financial-helpers.test.ts`

Expected: All new tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/features/shared/types/api-types.ts src/features/shared/lib/financial-helpers.ts src/features/shared/lib/__tests__/financial-helpers.test.ts && git commit -m "feat: add DistrictFinancial type and getFinancial() helper"
```

---

### Task 2: Add `serializeFinancials()` helper for API routes

API routes currently get Prisma Decimal objects from the DB. We need a small serializer that converts `districtFinancials` relation data into the `DistrictFinancial[]` shape (plain numbers).

**Files:**
- Modify: `src/features/shared/lib/financial-helpers.ts`
- Modify: `src/features/shared/lib/__tests__/financial-helpers.test.ts`

- [ ] **Step 1: Write tests for `serializeFinancials()`**

Add to `financial-helpers.test.ts`:

```ts
describe("serializeFinancials", () => {
  it("converts Prisma Decimal-like objects to plain numbers", () => {
    const prismaRecords = [
      {
        vendor: "fullmind", fiscalYear: "FY26",
        totalRevenue: { toNumber: () => 142500 },
        totalTake: { toNumber: () => 70000 },
        sessionCount: 180,
        closedWonOppCount: 5,
        closedWonBookings: { toNumber: () => 120000 },
        invoicing: { toNumber: () => 130000 },
        openPipelineOppCount: 2,
        openPipeline: { toNumber: () => 50000 },
        weightedPipeline: { toNumber: () => 30000 },
        poCount: null,
      },
    ];
    const result = serializeFinancials(prismaRecords);
    expect(result).toEqual([
      {
        vendor: "fullmind", fiscalYear: "FY26",
        totalRevenue: 142500, allTake: 70000, sessionCount: 180,
        closedWonOppCount: 5, closedWonBookings: 120000, invoicing: 130000,
        openPipelineOppCount: 2, openPipeline: 50000, weightedPipeline: 30000,
        poCount: null,
      },
    ]);
  });

  it("handles null values", () => {
    const prismaRecords = [
      {
        vendor: "fullmind", fiscalYear: "FY27",
        totalRevenue: null, totalTake: null, sessionCount: null,
        closedWonOppCount: null, closedWonBookings: null, invoicing: null,
        openPipelineOppCount: 1, openPipeline: { toNumber: () => 25000 },
        weightedPipeline: { toNumber: () => 15000 },
        poCount: null,
      },
    ];
    const result = serializeFinancials(prismaRecords);
    expect(result[0].totalRevenue).toBeNull();
    expect(result[0].openPipeline).toBe(25000);
  });

  it("returns empty array for empty input", () => {
    expect(serializeFinancials([])).toEqual([]);
  });
});
```

Import `serializeFinancials` at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run src/features/shared/lib/__tests__/financial-helpers.test.ts`

Expected: FAIL — `serializeFinancials` is not exported.

- [ ] **Step 3: Implement `serializeFinancials()`**

Add to `financial-helpers.ts`:

```ts
/** Convert Prisma Decimal or number to plain number | null */
function toNumOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "toNumber" in (v as Record<string, unknown>)) {
    return Number(v);
  }
  return Number(v) || null;
}

/**
 * Convert Prisma districtFinancials relation data to plain DistrictFinancial[].
 * Handles Decimal → number conversion and renames totalTake → allTake.
 */
export function serializeFinancials(
  prismaRecords: Array<{
    vendor: string;
    fiscalYear: string;
    totalRevenue: unknown;
    totalTake: unknown;
    sessionCount: number | null;
    closedWonOppCount: number | null;
    closedWonBookings: unknown;
    invoicing: unknown;
    openPipelineOppCount: number | null;
    openPipeline: unknown;
    weightedPipeline: unknown;
    poCount?: number | null;
  }>
): DistrictFinancial[] {
  return prismaRecords.map((r) => ({
    vendor: r.vendor,
    fiscalYear: r.fiscalYear,
    totalRevenue: toNumOrNull(r.totalRevenue),
    allTake: toNumOrNull(r.totalTake),
    sessionCount: r.sessionCount,
    closedWonOppCount: r.closedWonOppCount,
    closedWonBookings: toNumOrNull(r.closedWonBookings),
    invoicing: toNumOrNull(r.invoicing),
    openPipelineOppCount: r.openPipelineOppCount,
    openPipeline: toNumOrNull(r.openPipeline),
    weightedPipeline: toNumOrNull(r.weightedPipeline),
    poCount: r.poCount ?? null,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run src/features/shared/lib/__tests__/financial-helpers.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/features/shared/lib/financial-helpers.ts src/features/shared/lib/__tests__/financial-helpers.test.ts && git commit -m "feat: add serializeFinancials() helper for Prisma → DistrictFinancial conversion"
```

---

### Task 3: Update `FullmindData` type — replace FY fields with `districtFinancials`

**Files:**
- Modify: `src/features/shared/types/api-types.ts:39-71`

- [ ] **Step 1: Replace flat FY fields with districtFinancials array**

Replace the `FullmindData` interface at lines 39-71:

```ts
export interface FullmindData {
  leaid: string;
  accountName: string | null;
  salesExecutive: PersonRef | null;
  lmsid: string | null;
  districtFinancials: DistrictFinancial[];
  isCustomer: boolean;
  hasOpenPipeline: boolean;
}
```

This removes all 18 `fy*` fields and replaces them with the normalized array.

- [ ] **Step 2: Run type check to identify all breakages**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx tsc --noEmit 2>&1 | head -80`

Expected: Type errors in all frontend components that read `fullmindData.fy*` fields. This confirms the scope of changes needed. Save the list of erroring files for reference.

- [ ] **Step 3: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/features/shared/types/api-types.ts && git commit -m "feat: replace FullmindData FY fields with districtFinancials array"
```

---

### Task 4: Update `StateDistrictListItem` and `FocusModeStateData` types

**Files:**
- Modify: `src/features/shared/types/api-types.ts:729-740` (StateDistrictListItem)
- Modify: `src/features/shared/types/api-types.ts:1017-1046` (FocusModeStateData)

- [ ] **Step 1: Update StateDistrictListItem**

Replace the FY fields and fix the salesExecutive type:

```ts
export interface StateDistrictListItem {
  leaid: string;
  name: string;
  enrollment: number | null;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
  salesExecutive: PersonRef | null;
  districtFinancials: DistrictFinancial[];
  tags: Array<{ id: number; name: string; color: string }>;
}
```

This replaces `fy26NetInvoicing`, `fy26OpenPipeline`, `fy27OpenPipeline` with the normalized array, and fixes the `salesExecutive` type from `string | null` to `PersonRef | null`.

- [ ] **Step 2: Update FocusModeStateData**

Replace hard-coded FY fields with `districtFinancials` in both the `state` and `plan` objects:

```ts
export interface FocusModeStateData {
  abbrev: string;
  name: string;
  state: {
    totalDistricts: number;
    totalCustomers: number;
    totalWithPipeline: number;
    districtFinancials: DistrictFinancial[];
  };
  plan: {
    districtCount: number;
    customerCount: number;
    districtFinancials: DistrictFinancial[];
  };
  topDistricts: Array<{
    leaid: string;
    name: string;
    districtFinancials: DistrictFinancial[];
  }>;
}
```

- [ ] **Step 3: Update UnmatchedAccount type**

Replace FY fields on `UnmatchedAccount` at line 237-251:

```ts
export interface UnmatchedAccount {
  id: number;
  accountName: string;
  salesExecutive: PersonRef | null;
  stateAbbrev: string;
  lmsid: string | null;
  leaidRaw: string | null;
  matchFailureReason: string;
  districtFinancials: DistrictFinancial[];
  isCustomer: boolean;
  hasOpenPipeline: boolean;
}
```

This replaces `fy25NetInvoicing`, `fy26NetInvoicing`, `fy26OpenPipeline`, `fy27OpenPipeline` with the normalized array.

- [ ] **Step 4: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/features/shared/types/api-types.ts && git commit -m "feat: normalize FY fields on StateDistrictListItem, FocusModeStateData, UnmatchedAccount"
```

---

### Task 5: Migrate district detail API route (`/api/districts/[leaid]`)

**Files:**
- Modify: `src/app/api/districts/[leaid]/route.ts`

- [ ] **Step 1: Replace extractFullmindFinancials with serializeFinancials**

Change the import:

```ts
import {
  serializeFinancials,
  FULLMIND_FINANCIALS_SELECT,
} from "@/features/shared/lib/financial-helpers";
```

- [ ] **Step 2: Update response building**

Replace line 100 (`...extractFullmindFinancials(district.districtFinancials),`) with:

```ts
districtFinancials: serializeFinancials(district.districtFinancials),
```

The fullmindData block (lines 91-103) becomes:

```ts
fullmindData: district.isCustomer != null ? {
  leaid: district.leaid,
  accountName: district.accountName,
  salesExecutive: district.salesExecutiveUser
    ? { id: district.salesExecutiveUser.id, fullName: district.salesExecutiveUser.fullName, avatarUrl: district.salesExecutiveUser.avatarUrl }
    : district.salesExecutive
    ? { id: null, fullName: district.salesExecutive, avatarUrl: null }
    : null,
  lmsid: district.lmsid,
  districtFinancials: serializeFinancials(district.districtFinancials),
  isCustomer: district.isCustomer ?? false,
  hasOpenPipeline: district.hasOpenPipeline ?? false,
} : null,
```

- [ ] **Step 3: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/app/api/districts/[leaid]/route.ts && git commit -m "feat: return districtFinancials array from district detail route"
```

---

### Task 6: Migrate districts list API route (`/api/districts`)

**Files:**
- Modify: `src/app/api/districts/route.ts`

- [ ] **Step 1: Replace the getFinancialKey lookup with getFinancialValue**

The districts list route uses `extractFullmindFinancials` to get a metric value for sorting/display. Replace the entire `getFinancialKey` function (lines 24-63) and the `extractFullmindFinancials` call with `getFinancialValue`:

Change the import:

```ts
import {
  getFinancialValue,
  FULLMIND_FINANCIALS_SELECT,
} from "@/features/shared/lib/financial-helpers";
```

Replace `getFinancialKey` with a mapping from `(metric, year)` to `(fiscalYear, field)`:

```ts
function getFinancialLookup(metric: MetricType, year: FiscalYear): { fiscalYear: string; field: "totalRevenue" | "totalTake" | "sessionCount" | "closedWonBookings" | "invoicing" | "openPipeline" | "weightedPipeline" } {
  const fyMap: Record<FiscalYear, string> = { fy25: "FY25", fy26: "FY26", fy27: "FY27" };
  const fieldMap: Record<MetricType, "totalRevenue" | "totalTake" | "sessionCount" | "closedWonBookings" | "invoicing" | "openPipeline" | "weightedPipeline"> = {
    sessions_revenue: "totalRevenue",
    sessions_take: "totalTake",
    sessions_count: "sessionCount",
    closed_won_net_booking: "closedWonBookings",
    net_invoicing: "invoicing",
    open_pipeline: "openPipeline",
    open_pipeline_weighted: "weightedPipeline",
  };
  return { fiscalYear: fyMap[year], field: fieldMap[metric] };
}
```

- [ ] **Step 2: Update the map function**

Replace the districtList mapping (lines 143-158):

```ts
const lookup = getFinancialLookup(metric, year);
const districtList = districts.map((d) => {
  const metricValue = getFinancialValue(d.districtFinancials, "fullmind", lookup.fiscalYear, lookup.field);

  return {
    leaid: d.leaid,
    name: d.name,
    stateAbbrev: d.stateAbbrev,
    isCustomer: d.isCustomer || false,
    hasOpenPipeline: d.hasOpenPipeline || false,
    accountType: d.accountType || "district",
    cityLocation: d.cityLocation,
    stateLocation: d.stateLocation,
    metricValue,
  };
});
```

Note: `stateLocation` stays for now — it gets removed in Phase 3b.

- [ ] **Step 3: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/app/api/districts/route.ts && git commit -m "feat: use getFinancialValue in districts list route, remove extractFullmindFinancials"
```

---

### Task 7: Migrate profile routes (`/api/profile` and `/api/profile/goals/[fiscalYear]`)

**Files:**
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/app/api/profile/goals/[fiscalYear]/route.ts`

- [ ] **Step 1: Update profile route**

Change the import:

```ts
import { getFinancialValue, FULLMIND_FINANCIALS_SELECT } from "@/features/shared/lib/financial-helpers";
```

Replace the `calculateActuals` function (lines 17-76). Instead of `extractFullmindFinancials`, use `getFinancialValue` directly:

```ts
async function calculateActuals(userId: string) {
  const userDistricts = await prisma.territoryPlanDistrict.findMany({
    where: { plan: { userId } },
    include: {
      district: {
        select: {
          isCustomer: true,
          districtFinancials: {
            where: { vendor: "fullmind" },
            select: FULLMIND_FINANCIALS_SELECT,
          },
        },
      },
    },
  });

  const totals = userDistricts.reduce(
    (acc, d) => {
      const fin = d.district.districtFinancials;
      acc.fy25Revenue += getFinancialValue(fin, "fullmind", "FY25", "invoicing");
      acc.fy25Take += getFinancialValue(fin, "fullmind", "FY25", "totalTake");
      acc.fy26Revenue += getFinancialValue(fin, "fullmind", "FY26", "invoicing");
      acc.fy26Take += getFinancialValue(fin, "fullmind", "FY26", "totalTake");
      acc.fy26Pipeline += getFinancialValue(fin, "fullmind", "FY26", "openPipeline");
      acc.fy27Pipeline += getFinancialValue(fin, "fullmind", "FY27", "openPipeline");
      return acc;
    },
    { fy25Revenue: 0, fy25Take: 0, fy26Revenue: 0, fy26Take: 0, fy26Pipeline: 0, fy27Pipeline: 0 }
  );

  const fy26NewDistricts = userDistricts.filter((d) => !d.district.isCustomer).length;

  return {
    2025: { revenueActual: totals.fy25Revenue, takeActual: totals.fy25Take, pipelineActual: 0, newDistrictsActual: 0 },
    2026: { revenueActual: totals.fy26Revenue, takeActual: totals.fy26Take, pipelineActual: totals.fy26Pipeline, newDistrictsActual: fy26NewDistricts },
    2027: { revenueActual: 0, takeActual: 0, pipelineActual: totals.fy27Pipeline, newDistrictsActual: 0 },
  };
}
```

- [ ] **Step 2: Apply same pattern to goals route**

In `src/app/api/profile/goals/[fiscalYear]/route.ts`, make the same import change and update `calculateActualsForYear` to use `getFinancialValue` instead of `extractFullmindFinancials`:

```ts
import { getFinancialValue, FULLMIND_FINANCIALS_SELECT } from "@/features/shared/lib/financial-helpers";
```

Replace the reduce block (lines 35-47) with the same pattern as Step 1.

- [ ] **Step 3: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/app/api/profile/route.ts src/app/api/profile/goals/[fiscalYear]/route.ts && git commit -m "feat: use getFinancialValue in profile routes, remove extractFullmindFinancials"
```

---

### Task 8: Migrate explore entity route (`/api/explore/[entity]`)

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts`

- [ ] **Step 1: Remove extractFullmindFinancials from import**

Change the import at line 17-20:

```ts
import {
  FULLMIND_FINANCIALS_SELECT,
  getFinancialValue,
} from "@/features/shared/lib/financial-helpers";
```

- [ ] **Step 2: Update the LTV computation and FY field spreading (lines 438-449)**

Replace:

```ts
if (d.districtFinancials) {
  const fin = extractFullmindFinancials(d.districtFinancials);
  const ltv =
    fin.fy25ClosedWonNetBooking + fin.fy26ClosedWonNetBooking +
    Math.max(fin.fy25NetInvoicing, fin.fy25SessionsRevenue) +
    Math.max(fin.fy26NetInvoicing, fin.fy26SessionsRevenue);
  row.ltv = ltv || null;

  // Spread all Fullmind FY fields for any column that maps to them
  Object.assign(row, fin);
}
```

With:

```ts
if (d.districtFinancials) {
  const gfv = (fy: string, field: string) =>
    getFinancialValue(d.districtFinancials, "fullmind", fy, field);

  const ltv =
    gfv("FY25", "closedWonBookings") + gfv("FY26", "closedWonBookings") +
    Math.max(gfv("FY25", "invoicing"), gfv("FY25", "totalRevenue")) +
    Math.max(gfv("FY26", "invoicing"), gfv("FY26", "totalRevenue"));
  row.ltv = ltv || null;

  // Spread flat FY fields for explore table columns
  row.fy25SessionsRevenue = gfv("FY25", "totalRevenue");
  row.fy25SessionsTake = gfv("FY25", "totalTake");
  row.fy25SessionsCount = gfv("FY25", "sessionCount");
  row.fy26SessionsRevenue = gfv("FY26", "totalRevenue");
  row.fy26SessionsTake = gfv("FY26", "totalTake");
  row.fy26SessionsCount = gfv("FY26", "sessionCount");
  row.fy25ClosedWonOppCount = gfv("FY25", "closedWonOppCount");
  row.fy25ClosedWonNetBooking = gfv("FY25", "closedWonBookings");
  row.fy25NetInvoicing = gfv("FY25", "invoicing");
  row.fy26ClosedWonOppCount = gfv("FY26", "closedWonOppCount");
  row.fy26ClosedWonNetBooking = gfv("FY26", "closedWonBookings");
  row.fy26NetInvoicing = gfv("FY26", "invoicing");
  row.fy26OpenPipelineOppCount = gfv("FY26", "openPipelineOppCount");
  row.fy26OpenPipeline = gfv("FY26", "openPipeline");
  row.fy26OpenPipelineWeighted = gfv("FY26", "weightedPipeline");
  row.fy27OpenPipelineOppCount = gfv("FY27", "openPipelineOppCount");
  row.fy27OpenPipeline = gfv("FY27", "openPipeline");
  row.fy27OpenPipelineWeighted = gfv("FY27", "weightedPipeline");
}
```

Note: The explore table has its own column definitions that reference flat FY keys. These columns are part of the explore DataGrid config and consume the row data shape, not the API types directly. We keep the flat keys in the explore row output so the DataGrid columns continue to work. Explore column cleanup is a separate task.

- [ ] **Step 3: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/app/api/explore/[entity]/route.ts && git commit -m "feat: use getFinancialValue in explore route, remove extractFullmindFinancials"
```

---

### Task 9: Migrate state districts route (`/api/states/[code]/districts`)

**Files:**
- Modify: `src/app/api/states/[code]/districts/route.ts`

- [ ] **Step 1: Update response to return districtFinancials array**

Replace lines 97-99 that use `getFinancialValue` to produce flat FY keys:

```ts
fy26NetInvoicing: getFinancialValue(d.districtFinancials, "fullmind", "FY26", "invoicing"),
fy26OpenPipeline: getFinancialValue(d.districtFinancials, "fullmind", "FY26", "openPipeline"),
fy27OpenPipeline: getFinancialValue(d.districtFinancials, "fullmind", "FY27", "openPipeline"),
```

With:

```ts
districtFinancials: serializeFinancials(d.districtFinancials),
```

Add the import:

```ts
import { serializeFinancials } from "@/features/shared/lib/financial-helpers";
```

Remove the `getFinancialValue` import if it's no longer used in this file.

- [ ] **Step 2: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/app/api/states/[code]/districts/route.ts && git commit -m "feat: return districtFinancials array from state districts route"
```

---

### Task 10: Migrate search route (`/api/districts/search`)

**Files:**
- Modify: `src/app/api/districts/search/route.ts`

- [ ] **Step 1: Update the response transformation**

The search route (around line 359-364) currently flattens to `fy26OpenPipeline` and `fy26ClosedWonNetBooking`. Replace with the `districtFinancials` array using `serializeFinancials`:

Replace:

```ts
const fy26 = districtFinancials?.[0];
return {
  ...rest,
  fy26OpenPipeline: fy26?.openPipeline ? Number(fy26.openPipeline) : 0,
  fy26ClosedWonNetBooking: fy26?.closedWonBookings ? Number(fy26.closedWonBookings) : 0,
};
```

With:

```ts
return {
  ...rest,
  districtFinancials: serializeFinancials(districtFinancials ?? []),
};
```

Add the import for `serializeFinancials`.

- [ ] **Step 2: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/app/api/districts/search/route.ts && git commit -m "feat: return districtFinancials array from search route"
```

---

### Task 11: Migrate FullmindMetrics component

**Files:**
- Modify: `src/features/districts/components/FullmindMetrics.tsx:101-122`

- [ ] **Step 1: Update the component to use getFinancial()**

Add import:

```ts
import { getFinancial } from "@/features/shared/lib/financial-helpers";
import type { DistrictFinancial } from "@/features/shared/types/api-types";
```

Update the props type to accept `districtFinancials: DistrictFinancial[]` (check current prop type — it's likely `fullmindData: FullmindData`).

Replace the `fyData` useMemo (lines 105-122):

```ts
const fyData = useMemo(() => {
  const g = (fy: string, field: keyof Omit<DistrictFinancial, "vendor" | "fiscalYear">) =>
    getFinancial(fullmindData.districtFinancials, "fullmind", fy, field) ?? 0;

  return {
    fy25: [
      { def: METRICS[0], value: g("FY25", "totalRevenue") },
      { def: METRICS[1], value: g("FY25", "invoicing") },
      { def: METRICS[2], value: g("FY25", "closedWonBookings") },
    ],
    fy26: [
      { def: METRICS[0], value: g("FY26", "totalRevenue") },
      { def: METRICS[1], value: g("FY26", "invoicing") },
      { def: METRICS[2], value: g("FY26", "closedWonBookings") },
      { def: METRICS[3], value: g("FY26", "openPipeline") },
    ],
    fy27: [
      { def: METRICS[3], value: g("FY27", "openPipeline") },
    ],
  };
}, [fullmindData]);
```

- [ ] **Step 2: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/features/districts/components/FullmindMetrics.tsx && git commit -m "feat: use getFinancial() in FullmindMetrics component"
```

---

### Task 12: Migrate PurchasingHistoryCard component

**Files:**
- Modify: `src/features/map/components/panels/district/PurchasingHistoryCard.tsx:64-97,186-188`
- Modify: `src/features/map/components/panels/district/__tests__/PurchasingHistoryCard.test.tsx`

- [ ] **Step 1: Update the component**

Add import:

```ts
import { getFinancial } from "@/features/shared/lib/financial-helpers";
import type { DistrictFinancial } from "@/features/shared/types/api-types";
```

Replace lines 65-97. Use a local shorthand helper:

```ts
export default function PurchasingHistoryCard({ fullmindData, leaid }: PurchasingHistoryCardProps) {
  const g = (fy: string, field: keyof Omit<DistrictFinancial, "vendor" | "fiscalYear">) =>
    getFinancial(fullmindData?.districtFinancials ?? [], "fullmind", fy, field) ?? 0;

  const fy25Revenue = g("FY25", "totalRevenue");
  const fy26Revenue = g("FY26", "totalRevenue");

  const yoyChange = useMemo(() => {
    if (fy25Revenue <= 0) return null;
    return ((fy26Revenue - fy25Revenue) / fy25Revenue) * 100;
  }, [fy25Revenue, fy26Revenue]);

  const fy26Metrics = useMemo(() => {
    if (!fullmindData) return [];
    return [
      { label: "Sessions Revenue", value: g("FY26", "totalRevenue"), color: COLORS.revenue },
      { label: "Net Invoicing", value: g("FY26", "invoicing"), color: COLORS.invoicing },
      { label: "Closed Won", value: g("FY26", "closedWonBookings"), color: COLORS.closedWon },
      { label: "Open Pipeline", value: g("FY26", "openPipeline"), color: COLORS.pipeline },
    ].filter((m) => m.value > 0);
  }, [fullmindData]);

  const fy25Metrics = useMemo(() => {
    if (!fullmindData) return [];
    return [
      { label: "Sessions Revenue", value: g("FY25", "totalRevenue"), color: COLORS.revenue },
      { label: "Net Invoicing", value: g("FY25", "invoicing"), color: COLORS.invoicing },
      { label: "Closed Won", value: g("FY25", "closedWonBookings"), color: COLORS.closedWon },
    ].filter((m) => m.value > 0);
  }, [fullmindData]);

  const fy27Metrics = useMemo(() => {
    if (!fullmindData) return [];
    return [
      { label: "Open Pipeline", value: g("FY27", "openPipeline"), color: COLORS.pipeline },
    ].filter((m) => m.value > 0);
  }, [fullmindData]);
```

Also update the session count display (line 186-188):

```ts
{fullmindData && g("FY26", "sessionCount") > 0 && (
  <div className="text-xs text-gray-500">
    {g("FY26", "sessionCount").toLocaleString()} sessions delivered (FY26)
  </div>
)}
```

- [ ] **Step 2: Update the test mock data**

In `PurchasingHistoryCard.test.tsx`, replace the mock `FullmindData` object. Remove all flat FY fields and replace with:

```ts
const mockFullmindData: FullmindData = {
  leaid: "123456",
  accountName: "Test District",
  salesExecutive: null,
  lmsid: null,
  districtFinancials: [
    {
      vendor: "fullmind", fiscalYear: "FY25",
      totalRevenue: 100000, allTake: 50000, sessionCount: 120,
      closedWonOppCount: 3, closedWonBookings: 85000, invoicing: 98000,
      openPipelineOppCount: null, openPipeline: null, weightedPipeline: null,
      poCount: null,
    },
    {
      vendor: "fullmind", fiscalYear: "FY26",
      totalRevenue: 142500, allTake: 70000, sessionCount: 180,
      closedWonOppCount: 5, closedWonBookings: 120000, invoicing: 130000,
      openPipelineOppCount: 2, openPipeline: 50000, weightedPipeline: 30000,
      poCount: null,
    },
    {
      vendor: "fullmind", fiscalYear: "FY27",
      totalRevenue: null, allTake: null, sessionCount: null,
      closedWonOppCount: null, closedWonBookings: null, invoicing: null,
      openPipelineOppCount: 1, openPipeline: 25000, weightedPipeline: 15000,
      poCount: null,
    },
  ],
  isCustomer: true,
  hasOpenPipeline: true,
};
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run src/features/map/components/panels/district/__tests__/PurchasingHistoryCard.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/features/map/components/panels/district/PurchasingHistoryCard.tsx src/features/map/components/panels/district/__tests__/PurchasingHistoryCard.test.tsx && git commit -m "feat: use getFinancial() in PurchasingHistoryCard"
```

---

### Task 13: Migrate DistrictExploreModal component

**Files:**
- Modify: `src/features/map/components/SearchResults/DistrictExploreModal.tsx:474-501`

- [ ] **Step 1: Update the Pipeline & Revenue section**

Add import:

```ts
import { getFinancial } from "@/features/shared/lib/financial-helpers";
import type { DistrictFinancial } from "@/features/shared/types/api-types";
```

Replace lines 474-501 in the FullmindSection component. Use a local shorthand:

```ts
const g = (fy: string, field: keyof Omit<DistrictFinancial, "vendor" | "fiscalYear">) =>
  getFinancial(fullmindData.districtFinancials, "fullmind", fy, field) ?? 0;
```

Then replace all `fullmindData.fy*` references:

```tsx
{/* Pipeline & Revenue */}
{fullmindData && (
  <div className="mb-6">
    <SectionLabel>Pipeline &amp; Revenue</SectionLabel>
    <div className="flex flex-col">
      <DataRow label="FY27 Open Pipeline" value={fmtMoney(g("FY27", "openPipeline"))} sub={(g("FY27", "openPipelineOppCount")) > 0 ? `(${g("FY27", "openPipelineOppCount")} opps)` : undefined} />
      <DataRow label="FY26 Open Pipeline" value={fmtMoney(g("FY26", "openPipeline"))} sub={(g("FY26", "openPipelineOppCount")) > 0 ? `(${g("FY26", "openPipelineOppCount")} opps)` : undefined} />
      <DataRow label="FY26 Weighted Pipeline" value={fmtMoney(g("FY26", "weightedPipeline"))} />
      <DataRow label="FY26 Closed Won" value={fmtMoney(g("FY26", "closedWonBookings"))} />
      <DataRow label="FY26 Net Invoicing" value={fmtMoney(g("FY26", "invoicing"))} />
      <DataRow label="FY25 Closed Won" value={fmtMoney(g("FY25", "closedWonBookings"))} />
      <DataRow label="FY25 Net Invoicing" value={fmtMoney(g("FY25", "invoicing"))} last />
    </div>
  </div>
)}

{/* Sessions */}
{fullmindData && (g("FY26", "sessionCount") > 0 || g("FY25", "sessionCount") > 0) && (
  <div className="mb-6">
    <SectionLabel>Sessions</SectionLabel>
    <div className="flex flex-col">
      {g("FY26", "sessionCount") > 0 && (
        <DataRow label="FY26 Sessions" value={`${g("FY26", "sessionCount")}`} sub={`($${g("FY26", "totalRevenue").toLocaleString()} rev)`} />
      )}
      {g("FY25", "sessionCount") > 0 && (
        <DataRow label="FY25 Sessions" value={`${g("FY25", "sessionCount")}`} sub={`($${g("FY25", "totalRevenue").toLocaleString()} rev)`} last />
      )}
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/features/map/components/SearchResults/DistrictExploreModal.tsx && git commit -m "feat: use getFinancial() in DistrictExploreModal"
```

---

### Task 14: Migrate SearchResults and DistrictSearchCard

**Files:**
- Modify: `src/features/map/components/SearchResults/index.tsx:41-42,415-416`
- Modify: `src/features/map/components/SearchResults/DistrictSearchCard.tsx:20-21,168-169`

- [ ] **Step 1: Update DistrictCardData type in both files**

In `index.tsx`, replace the `fy26OpenPipeline` and `fy26ClosedWonNetBooking` fields in the `DistrictCardData` interface:

```ts
districtFinancials: DistrictFinancial[];
```

Add the import for `DistrictFinancial` and `getFinancial`.

Do the same in `DistrictSearchCard.tsx`.

- [ ] **Step 2: Update CSV export in index.tsx (lines 415-416)**

Replace:

```ts
d.fy26OpenPipeline ?? "",
d.fy26ClosedWonNetBooking ?? "",
```

With:

```ts
getFinancial(d.districtFinancials, "fullmind", "FY26", "openPipeline") ?? "",
getFinancial(d.districtFinancials, "fullmind", "FY26", "closedWonBookings") ?? "",
```

- [ ] **Step 3: Update DistrictSearchCard pipeline display (lines 168-169)**

Replace:

```ts
if (district.fy26OpenPipeline != null && Number(district.fy26OpenPipeline) > 0) {
  metrics.push({ label: "Pipeline", value: `$${(Number(district.fy26OpenPipeline) / 1000).toFixed(0)}k` });
}
```

With:

```ts
const pipeline = getFinancial(district.districtFinancials, "fullmind", "FY26", "openPipeline");
if (pipeline != null && pipeline > 0) {
  metrics.push({ label: "Pipeline", value: `$${(pipeline / 1000).toFixed(0)}k` });
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add src/features/map/components/SearchResults/index.tsx src/features/map/components/SearchResults/DistrictSearchCard.tsx && git commit -m "feat: use getFinancial() in SearchResults and DistrictSearchCard"
```

---

### Task 15: Delete extractFullmindFinancials and run full test suite

**Files:**
- Modify: `src/features/shared/lib/financial-helpers.ts`
- Modify: `src/features/shared/lib/__tests__/financial-helpers.test.ts`

- [ ] **Step 1: Verify no remaining references to extractFullmindFinancials**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && grep -r "extractFullmindFinancials" src/ --include="*.ts" --include="*.tsx" -l`

Expected: Only `financial-helpers.ts` and `financial-helpers.test.ts`.

- [ ] **Step 2: Delete extractFullmindFinancials function and related code**

In `financial-helpers.ts`:
- Delete the `FinancialRecord` interface (lines 5-17) — replaced by the function parameter type on `serializeFinancials`
- Delete the `toNum` function (lines 20-27) — replaced by `toNumOrNull`
- Delete `FULLMIND_FINANCIALS_SELECT` constant (lines 33-45) — the Prisma select is now inline or uses the `serializeFinancials` input type
- Delete `extractFullmindFinancials` function (lines 52-83)
- Delete `getFinancialValue` function (lines 89-101) — replaced by `getFinancial` which works on the new type

Wait — `FULLMIND_FINANCIALS_SELECT` is still used by API routes that haven't switched to `serializeFinancials` yet (profile routes use `getFinancialValue` with the Prisma data). Keep `FULLMIND_FINANCIALS_SELECT` and `getFinancialValue` if they're still imported.

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && grep -r "FULLMIND_FINANCIALS_SELECT\|getFinancialValue" src/ --include="*.ts" --include="*.tsx" -l`

If any routes still import these, keep them. Only delete what's unused.

- [ ] **Step 3: Delete extractFullmindFinancials tests**

Remove the test cases that test `extractFullmindFinancials` from the test file. Keep tests for `getFinancialValue` (if kept), `getFinancial`, and `serializeFinancials`.

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run`

Expected: All tests PASS.

- [ ] **Step 5: Run type check**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add -A && git commit -m "feat: delete extractFullmindFinancials shim, Phase 3a complete"
```

---

### Task 16: Smoke test the dev server

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npm run dev`

- [ ] **Step 2: Test key pages**

Open `http://localhost:3005` and verify:
- District list page loads with metric values
- District detail page shows Pipeline & Revenue, Sessions, and Purchasing History data
- Explore table renders financial columns correctly
- State detail page shows district list with financial data
- Profile/goals page shows actuals

- [ ] **Step 3: Stop dev server and confirm**

All pages render financial data correctly using the new `districtFinancials` array format.
