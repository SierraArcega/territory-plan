# Customer Rank, Churn Risk, and Plan Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new columns to the districts grid in the Table view — Customer Rank (global derived label), Churn Risk (per-plan editable dropdown), and Plan Notes (per-plan inline-editable free text).

**Architecture:** Customer Rank is derived from a SQL CTE over `district_financials` with a 5-minute in-memory cache, computed in the existing `/api/views/data` route alongside the plan enrichment. Churn Risk and Notes are per-plan-per-district fields on `territory_plan_districts` — Notes already exists, Churn Risk needs one new nullable VARCHAR column with a CHECK constraint. Edits go through the existing `PUT /api/territory-plans/[id]/districts/[leaid]` route (extended). Frontend dispatches custom cell renderers in `GridView.tsx` by `column.id`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, raw SQL (`prisma.$queryRaw`), TanStack Query, Tailwind 4, Vitest + Testing Library.

**Working directory:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar`

**Reference spec:** `docs/superpowers/specs/2026-05-18-customer-rank-churn-notes-design.md`

---

## File Inventory

**Create:**
- `prisma/migrations/<timestamp>_add_churn_risk_to_territory_plan_districts/migration.sql`
- `src/app/api/views/data/global-customer-labels.ts` — rank CTE + 5-min cache
- `src/app/api/views/data/__tests__/global-customer-labels.test.ts`
- `src/features/views/components/grid/cells/ChurnRiskCell.tsx`
- `src/features/views/components/grid/cells/PlanNotesCell.tsx`
- `src/features/views/components/grid/cells/CustomerRankCell.tsx`
- `src/features/views/components/grid/cells/__tests__/ChurnRiskCell.test.tsx`
- `src/features/views/components/grid/cells/__tests__/PlanNotesCell.test.tsx`

**Modify:**
- `prisma/schema.prisma` — add `churnRisk` field to `TerritoryPlanDistrict`
- `src/app/api/views/data/route.ts` — call `getGlobalCustomerLabels`, extend `fetchDistrictPlanEnrichment`, merge new fields into rows
- `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts` — accept and return `churnRisk`
- `src/features/views/lib/columns.ts` — three new `ColumnDef`s in the `districts` array
- `src/features/views/lib/queries.ts` — two mutation hooks
- `src/lib/saved-views/source-fields.ts` — add `churn_risk` (virtual) and `customer_rank` (virtual) field defs
- `src/lib/saved-views/sql-compiler.ts` — virtual filter handler for `churn_risk`; virtual sort handler for `customer_rank` + `churn_risk`
- `src/features/views/components/grid/GridView.tsx` — dispatch on `column.id` for custom cells; pass `planId` to cells

---

## Task 1: Database migration — add `churn_risk` column

**Files:**
- Create: `prisma/migrations/<timestamp>_add_churn_risk_to_territory_plan_districts/migration.sql`
- Modify: `prisma/schema.prisma` (line ~548, inside `model TerritoryPlanDistrict`)

- [ ] **Step 1: Update the Prisma schema**

Open `prisma/schema.prisma`. Find `model TerritoryPlanDistrict` (around line 538). Below the existing `newBusinessTarget` line and above `notes`, insert:

```prisma
  churnRisk         String?  @map("churn_risk") @db.VarChar(16)
```

So the model field block now reads:

```prisma
  renewalTarget     Decimal? @map("renewal_target") @db.Decimal(15, 2)
  winbackTarget     Decimal? @map("winback_target") @db.Decimal(15, 2)
  expansionTarget   Decimal? @map("expansion_target") @db.Decimal(15, 2)
  newBusinessTarget Decimal? @map("new_business_target") @db.Decimal(15, 2)
  churnRisk         String?  @map("churn_risk") @db.VarChar(16)
  notes             String?
```

- [ ] **Step 2: Generate the migration**

Run:
```bash
npx prisma migrate dev --name add_churn_risk_to_territory_plan_districts --create-only
```
Expected: Prisma writes a new directory under `prisma/migrations/` with an empty `migration.sql` file, opens nothing further. Note the directory name printed in output.

- [ ] **Step 3: Edit the migration SQL to add the CHECK constraint**

Open the new `prisma/migrations/<timestamp>_add_churn_risk_to_territory_plan_districts/migration.sql`. Prisma generated the column-add line. Append the CHECK constraint so the full file reads:

```sql
-- AlterTable
ALTER TABLE "territory_plan_districts" ADD COLUMN "churn_risk" VARCHAR(16);

-- Constrain allowed values at the DB layer
ALTER TABLE "territory_plan_districts"
  ADD CONSTRAINT "territory_plan_districts_churn_risk_check"
  CHECK ("churn_risk" IS NULL OR "churn_risk" IN ('low','medium','high','churned'));
```

- [ ] **Step 4: Apply the migration**

Run:
```bash
npx prisma migrate dev
```
Expected: migration applies cleanly; Prisma regenerates the client. No errors mentioning `churn_risk`.

- [ ] **Step 5: Verify the constraint by running a smoke test in psql**

Run (one-liner):
```bash
psql "$DATABASE_URL" -c "INSERT INTO territory_plan_districts (plan_id, district_leaid, added_at, churn_risk) VALUES ('00000000-0000-0000-0000-000000000000','0000000',NOW(),'bogus'); ROLLBACK;" 2>&1 | grep -i 'violates check'
```
Expected: output line containing `new row for relation "territory_plan_districts" violates check constraint`. If you see no output, the constraint isn't enforcing — investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(views): add churn_risk column to territory_plan_districts"
```

---

## Task 2: Global Customer Labels helper — rank CTE with cache

**Files:**
- Create: `src/app/api/views/data/global-customer-labels.ts`
- Create: `src/app/api/views/data/__tests__/global-customer-labels.test.ts`

- [ ] **Step 1: Write failing tests for the label computation**

Create `src/app/api/views/data/__tests__/global-customer-labels.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeLabelsFromRows,
  __resetCacheForTests,
  type GlobalLabel,
} from "../global-customer-labels";

describe("computeLabelsFromRows", () => {
  it("ranks districts with FY26 revenue descending and labels as 'rank'", () => {
    const rows = [
      { leaid: "A", fy26: 1000, fy25: 0, fy24: 0 },
      { leaid: "B", fy26: 5000, fy25: 0, fy24: 0 },
      { leaid: "C", fy26: 2500, fy25: 0, fy24: 0 },
    ];
    const out = computeLabelsFromRows(rows);
    expect(out.get("B")).toEqual<GlobalLabel>({ rank: 1, label: "rank" });
    expect(out.get("C")).toEqual<GlobalLabel>({ rank: 2, label: "rank" });
    expect(out.get("A")).toEqual<GlobalLabel>({ rank: 3, label: "rank" });
  });

  it("labels districts with FY25 revenue but no FY26 as 'win_back'", () => {
    const rows = [{ leaid: "D", fy26: 0, fy25: 500, fy24: 0 }];
    const out = computeLabelsFromRows(rows);
    expect(out.get("D")).toEqual<GlobalLabel>({ rank: null, label: "win_back" });
  });

  it("labels districts with FY24 revenue but no FY25/FY26 as 'win_back'", () => {
    const rows = [{ leaid: "E", fy26: 0, fy25: 0, fy24: 800 }];
    const out = computeLabelsFromRows(rows);
    expect(out.get("E")).toEqual<GlobalLabel>({ rank: null, label: "win_back" });
  });

  it("labels districts with no FY24/FY25/FY26 revenue as 'new'", () => {
    const rows = [{ leaid: "F", fy26: 0, fy25: 0, fy24: 0 }];
    const out = computeLabelsFromRows(rows);
    expect(out.get("F")).toEqual<GlobalLabel>({ rank: null, label: "new" });
  });

  it("treats null revenue same as zero", () => {
    const rows = [{ leaid: "G", fy26: null, fy25: null, fy24: null }];
    const out = computeLabelsFromRows(rows);
    expect(out.get("G")).toEqual<GlobalLabel>({ rank: null, label: "new" });
  });

  it("handles ties — both get the same rank", () => {
    const rows = [
      { leaid: "H", fy26: 100, fy25: 0, fy24: 0 },
      { leaid: "I", fy26: 100, fy25: 0, fy24: 0 },
      { leaid: "J", fy26: 50, fy25: 0, fy24: 0 },
    ];
    const out = computeLabelsFromRows(rows);
    expect(out.get("H")?.rank).toBe(1);
    expect(out.get("I")?.rank).toBe(1);
    expect(out.get("J")?.rank).toBe(3);
  });
});

describe("getGlobalCustomerLabels caching", () => {
  beforeEach(() => {
    __resetCacheForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
  });

  it("calls fetcher on first request and serves from cache for 5 minutes", async () => {
    const { getGlobalCustomerLabels } = await import("../global-customer-labels");
    const fetcher = vi.fn().mockResolvedValue(new Map([["X", { rank: 1, label: "rank" as const }]]));

    const m1 = await getGlobalCustomerLabels(fetcher);
    expect(m1.get("X")?.rank).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 4 minutes later — still cached
    vi.setSystemTime(new Date("2026-05-18T12:04:00Z"));
    await getGlobalCustomerLabels(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 6 minutes after the first call — refetches
    vi.setSystemTime(new Date("2026-05-18T12:06:00Z"));
    await getGlobalCustomerLabels(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:
```bash
npx vitest run src/app/api/views/data/__tests__/global-customer-labels.test.ts
```
Expected: FAIL — `Cannot find module '../global-customer-labels'`.

- [ ] **Step 3: Implement the helper module**

Create `src/app/api/views/data/global-customer-labels.ts`:

```typescript
/**
 * Global customer rank + label resolution for the districts grid.
 *
 * Reads district_financials rows for vendor='fullmind' across FY24/25/26,
 * ranks districts with FY26 revenue descending, and labels districts
 * without FY26 revenue as 'win_back' (had FY24 or FY25) or 'new' (no
 * recent revenue history).
 *
 * Cached in module-scoped memory with a 5-minute TTL — the underlying
 * district_financials table refreshes hourly so stale-by-5min is fine.
 */
import prisma from "@/lib/prisma";

export type LabelKind = "rank" | "win_back" | "new";

export interface GlobalLabel {
  rank: number | null;
  label: LabelKind;
}

interface RevenueRow {
  leaid: string;
  fy26: number | null;
  fy25: number | null;
  fy24: number | null;
}

const TTL_MS = 5 * 60 * 1000;

let cache: { byLeaid: Map<string, GlobalLabel>; expiresAt: number } | null = null;

/** Test-only cache reset. */
export function __resetCacheForTests(): void {
  cache = null;
}

/**
 * Pure function — takes revenue rows, returns the labeled Map. Exported for
 * unit-testing without a database.
 */
export function computeLabelsFromRows(rows: RevenueRow[]): Map<string, GlobalLabel> {
  const withFy26 = rows
    .map((r) => ({ leaid: r.leaid, fy26: Number(r.fy26 ?? 0), fy25: Number(r.fy25 ?? 0), fy24: Number(r.fy24 ?? 0) }))
    .filter((r) => r.fy26 > 0)
    .sort((a, b) => b.fy26 - a.fy26);

  const byLeaid = new Map<string, GlobalLabel>();

  // Compute dense-ish RANK() — ties share the lowest rank, the next distinct
  // value skips by the size of the tie group (matches Postgres RANK()).
  let prevVal: number | null = null;
  let prevRank = 0;
  withFy26.forEach((r, idx) => {
    const rank = r.fy26 === prevVal ? prevRank : idx + 1;
    byLeaid.set(r.leaid, { rank, label: "rank" });
    prevVal = r.fy26;
    prevRank = rank;
  });

  for (const r of rows) {
    if (byLeaid.has(r.leaid)) continue;
    const fy25 = Number(r.fy25 ?? 0);
    const fy24 = Number(r.fy24 ?? 0);
    const label: LabelKind = fy25 > 0 || fy24 > 0 ? "win_back" : "new";
    byLeaid.set(r.leaid, { rank: null, label });
  }

  return byLeaid;
}

/** Default fetcher — runs the rank CTE. Injected for testing. */
async function defaultFetcher(): Promise<Map<string, GlobalLabel>> {
  const rows = await prisma.$queryRaw<RevenueRow[]>`
    SELECT
      leaid,
      SUM(total_revenue) FILTER (WHERE fiscal_year = '26')::float AS fy26,
      SUM(total_revenue) FILTER (WHERE fiscal_year = '25')::float AS fy25,
      SUM(total_revenue) FILTER (WHERE fiscal_year = '24')::float AS fy24
    FROM district_financials
    WHERE vendor = 'fullmind'
      AND fiscal_year IN ('24', '25', '26')
      AND leaid IS NOT NULL
    GROUP BY leaid
  `.catch(() => [] as RevenueRow[]);
  return computeLabelsFromRows(rows);
}

/**
 * Returns the labeled Map, cached for 5 minutes. The fetcher arg is for
 * tests — production callers pass nothing.
 */
export async function getGlobalCustomerLabels(
  fetcher: () => Promise<Map<string, GlobalLabel>> = defaultFetcher,
): Promise<Map<string, GlobalLabel>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.byLeaid;
  const byLeaid = await fetcher();
  cache = { byLeaid, expiresAt: now + TTL_MS };
  return byLeaid;
}
```

- [ ] **Step 4: Run the tests**

Run:
```bash
npx vitest run src/app/api/views/data/__tests__/global-customer-labels.test.ts
```
Expected: PASS — all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/views/data/global-customer-labels.ts src/app/api/views/data/__tests__/global-customer-labels.test.ts
git commit -m "feat(views): global customer rank/label helper with 5min cache"
```

---

## Task 3: Extend `fetchDistrictPlanEnrichment` to read churnRisk + notes

**Files:**
- Modify: `src/app/api/views/data/route.ts:361-548` (interface + Promise.all block)

- [ ] **Step 1: Extend the `DistrictEnrichmentEntry` interface**

In `src/app/api/views/data/route.ts`, find the `DistrictEnrichmentEntry` interface (line 361). Add two fields right after `activitiesCount90d: number;`:

```typescript
  /** Per-plan churn risk assessment. NULL = not yet set. */
  churnRisk: string | null;
  /** Per-plan free-form notes for this district. */
  notes: string | null;
```

- [ ] **Step 2: Add them to the `blank()` initializer**

In the same file, find the `blank` arrow function (around line 390). Add:

```typescript
    churnRisk: null,
    notes: null,
```

to the returned object.

- [ ] **Step 3: Add a new query to the `Promise.all` for territory_plan_districts**

In `fetchDistrictPlanEnrichment`, the `Promise.all` block starts around line 442 with 5 queries: `targetRows`, `oppsRows`, `lastActRows`, `nextActRows`, `actCountRows`. Add a sixth:

First, add the type definition above the `Promise.all`, alongside the others:

```typescript
  type TpdRow = {
    district_leaid: string;
    churn_risk: string | null;
    notes: string | null;
  };
```

Then extend the `Promise.all` — add the destructuring slot:

```typescript
  const [targetRows, oppsRows, lastActRows, nextActRows, actCountRows, tpdRows] = await Promise.all([
```

And add the query as the last element of the array (after `actCountRows`):

```typescript
    prisma.$queryRaw<TpdRow[]>`
      SELECT district_leaid, churn_risk, notes
      FROM territory_plan_districts
      WHERE plan_id = ${planId}
        AND district_leaid = ANY(${leaids})
    `.catch(() => [] as TpdRow[]),
```

- [ ] **Step 4: Merge the rows into the byLeaid map**

After the existing for-loop that merges `actCountRows` (the last existing loop), add:

```typescript
  for (const r of tpdRows) {
    const cur = byLeaid.get(r.district_leaid) ?? blank();
    cur.churnRisk = r.churn_risk;
    cur.notes = r.notes;
    byLeaid.set(r.district_leaid, cur);
  }
```

- [ ] **Step 5: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors mentioning `route.ts`. If errors elsewhere, ignore — only investigate failures introduced by this task.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/views/data/route.ts
git commit -m "feat(views): enrichment reads churn_risk + notes from plan districts"
```

---

## Task 4: Wire enrichments into the rows mapper in views/data route

**Files:**
- Modify: `src/app/api/views/data/route.ts:276-310` (enrichment mapping block)

- [ ] **Step 1: Surface churnRisk and notes on the enriched row**

In `src/app/api/views/data/route.ts`, find the block that maps `enrichment.byLeaid` onto rows (around line 286). Add two new fields to the spread returned for each row:

```typescript
            ...r,
            target: e?.target ?? null,
            pipeline_min: e?.pipelineMin ?? null,
            pipeline_max: e?.pipelineMax ?? null,
            won_min: e?.wonMin ?? null,
            won_max: e?.wonMax ?? null,
            open_count: e?.openCount ?? 0,
            won_count: e?.wonCount ?? 0,
            lost_count: e?.lostCount ?? 0,
            last_activity_date: e?.lastActivityDate ?? null,
            last_activity_name: e?.lastActivityName ?? null,
            next_activity_date: e?.nextActivityDate ?? null,
            next_activity_name: e?.nextActivityName ?? null,
            activities_count_90d: e?.activitiesCount90d ?? 0,
            churn_risk: e?.churnRisk ?? null,
            plan_notes: e?.notes ?? null,
```

The frontend accessor uses `planNotes` (camelized) so we expose `plan_notes` in DB-naming — the existing `camelizeRow` (line 313) handles conversion.

- [ ] **Step 2: Add the global customer labels enrichment**

Still in `route.ts`, near the top add the import:

```typescript
import { getGlobalCustomerLabels } from "./global-customer-labels";
```

Find the block right after the plan-context enrichment (still inside the `if (typedSource === "districts" && rows.length > 0)` outer scope — but note plan enrichment only runs when `planId` is set; global labels run regardless when source is districts).

Re-structure the post-query block so the global labels apply for ANY districts source request (with or without `planId`). Replace the existing `if (typedSource === "districts" && planId && rows.length > 0) { … }` block with this:

```typescript
    // 15. Districts source enrichment — runs globally (rank/label) plus
    // plan-scoped (target, pipeline, won, lost, activities, churnRisk, notes).
    if (typedSource === "districts" && rows.length > 0) {
      const leaids = rows
        .map((r) => (typeof r.leaid === "string" ? r.leaid : null))
        .filter((x): x is string => x !== null);

      // Global rank/label — always runs, cached 5 min.
      const labels = leaids.length > 0
        ? await getGlobalCustomerLabels()
        : new Map();

      // Plan-scoped enrichment — only when a planId is in scope.
      const enrichment = planId && leaids.length > 0
        ? await fetchDistrictPlanEnrichment(planId, leaids)
        : { byLeaid: new Map() };

      rows = rows.map((r) => {
        const leaid = typeof r.leaid === "string" ? r.leaid : null;
        if (!leaid) return r;
        const e = enrichment.byLeaid.get(leaid);
        const g = labels.get(leaid);
        return {
          ...r,
          target: e?.target ?? null,
          pipeline_min: e?.pipelineMin ?? null,
          pipeline_max: e?.pipelineMax ?? null,
          won_min: e?.wonMin ?? null,
          won_max: e?.wonMax ?? null,
          open_count: e?.openCount ?? 0,
          won_count: e?.wonCount ?? 0,
          lost_count: e?.lostCount ?? 0,
          last_activity_date: e?.lastActivityDate ?? null,
          last_activity_name: e?.lastActivityName ?? null,
          next_activity_date: e?.nextActivityDate ?? null,
          next_activity_name: e?.nextActivityName ?? null,
          activities_count_90d: e?.activitiesCount90d ?? 0,
          churn_risk: e?.churnRisk ?? null,
          plan_notes: e?.notes ?? null,
          // Global rank: encode `{rank|null, label}` as a single string the
          // grid renderer can dispatch on:
          //   rank → "#1", "#2", …
          //   win_back → "Win Back"
          //   new (or missing) → "New"
          customer_rank:
            g == null
              ? "New"
              : g.label === "rank" && g.rank != null
                ? `#${g.rank}`
                : g.label === "win_back"
                  ? "Win Back"
                  : "New",
        };
      });
    }
```

- [ ] **Step 3: Manual smoke test the route**

In another shell, start the dev server if not running:
```bash
npm run dev
```
Then hit the API directly:
```bash
curl -s "http://localhost:3005/api/views/data?source=districts&limit=3" | jq '.rows[0] | {leaid, customer_rank, churn_risk, plan_notes}'
```
Expected: a row with `leaid` set, `customer_rank` = `"#N"` or `"Win Back"` or `"New"`, `churn_risk` = `null`, `plan_notes` = `null`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/views/data/route.ts
git commit -m "feat(views): merge global rank + plan churn/notes into row payload"
```

---

## Task 5: Extend PUT route to accept `churnRisk`

**Files:**
- Modify: `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts`

- [ ] **Step 1: Read the existing route shape**

Read lines 129-180 of `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts` to find the PUT handler's body-destructure block.

- [ ] **Step 2: Add validation constant and extend the destructure**

Near the top of the route file (after imports, before route handlers), add:

```typescript
const VALID_CHURN_RISKS = ["low", "medium", "high", "churned"] as const;
type ChurnRisk = (typeof VALID_CHURN_RISKS)[number];

function isValidChurnRisk(v: unknown): v is ChurnRisk | null {
  return v === null || (typeof v === "string" && (VALID_CHURN_RISKS as readonly string[]).includes(v));
}
```

In the PUT handler, change the body destructure line (currently ~line 137):

```typescript
const { renewalTarget, winbackTarget, expansionTarget, newBusinessTarget, notes, returnServiceIds, newServiceIds, churnRisk } = body;
```

Right after the destructure, add the validation guard:

```typescript
if (churnRisk !== undefined && !isValidChurnRisk(churnRisk)) {
  return NextResponse.json(
    { error: `Invalid churnRisk; must be one of ${VALID_CHURN_RISKS.join(", ")} or null` },
    { status: 400 }
  );
}
```

- [ ] **Step 3: Add it to `updateData`**

Find the `updateData` build block (currently ~line 157). Right after the `if (notes !== undefined) updateData.notes = notes;` line, add:

```typescript
if (churnRisk !== undefined) updateData.churnRisk = churnRisk;
```

- [ ] **Step 4: Include `churnRisk` in the response**

Find every place the route returns a JSON body that includes `notes` (there are two such response objects in this file, around lines 245 and 268). Right next to each `notes:` line, add:

```typescript
        churnRisk: updatedPlanDistrict.churnRisk,
```

(and on the GET return at line 110 alongside `notes`):
```typescript
      churnRisk: planDistrict.churnRisk,
```

- [ ] **Step 5: Manual smoke test**

Pick any real plan id and leaid you have access to:
```bash
PLAN_ID="<a-real-plan-uuid>"
LEAID="<a-real-leaid>"
curl -s -X PUT "http://localhost:3005/api/territory-plans/$PLAN_ID/districts/$LEAID" \
  -H "Content-Type: application/json" \
  --cookie "<your-session-cookie>" \
  -d '{"churnRisk":"medium"}' | jq .churnRisk
```
Expected: `"medium"`. Then:
```bash
curl -s -X PUT "http://localhost:3005/api/territory-plans/$PLAN_ID/districts/$LEAID" \
  -H "Content-Type: application/json" \
  --cookie "<your-session-cookie>" \
  -d '{"churnRisk":"bogus"}'
```
Expected: HTTP 400 with `{"error":"Invalid churnRisk; ..."}`.

If you don't have a cookie at hand, skip this smoke test and rely on the component-level integration in later tasks.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/territory-plans/[id]/districts/[leaid]/route.ts"
git commit -m "feat(plans): accept and return churnRisk on plan-district PUT"
```

---

## Task 6: Source-fields entries + sql-compiler virtual handlers

**Files:**
- Modify: `src/lib/saved-views/source-fields.ts`
- Modify: `src/lib/saved-views/sql-compiler.ts`

- [ ] **Step 1: Register the new virtual fields**

In `src/lib/saved-views/source-fields.ts`, find the `districts:` field list (where `has_target` lives, around line 132). After the `has_target` entry, append:

```typescript
    {
      // Virtual: compiles to a join on territory_plan_districts.churn_risk.
      // Requires a plan context. Filter only.
      id: "churn_risk",
      label: "Churn risk",
      column: "",
      type: "text",
      ops: ["is", "is any of"],
      virtual: true,
      requiresPlanContext: true,
    },
    {
      // Virtual: sortable-only. Sort emits the rank CTE inline and joins on
      // leaid. Filtering is not supported in v1.
      id: "customer_rank",
      label: "Customer rank",
      column: "",
      type: "text",
      ops: [],
      virtual: true,
      requiresPlanContext: false,
    },
```

- [ ] **Step 2: Compile the `churn_risk` filter**

In `src/lib/saved-views/sql-compiler.ts`, find `compileVirtualField` (around line 86). Below the existing `if (fieldId === "has_target") { … }` block (still inside the function), add a new branch:

```typescript
  if (fieldId === "churn_risk") {
    if (ctx.source !== "districts") {
      throw new Error(`"churn_risk" is only valid for source "districts".`);
    }
    if (!ctx.planId) {
      // Non-plan list contexts: filter becomes a no-op (matches nothing).
      return "FALSE";
    }
    if (node.op !== "is" && node.op !== "is any of") {
      throw new Error(`"churn_risk" only supports ops "is" / "is any of"; got "${node.op}".`);
    }
    const values = Array.isArray(node.value) ? node.value : [node.value];
    const allowed = new Set(["low", "medium", "high", "churned"]);
    if (!values.every((v) => typeof v === "string" && allowed.has(v))) {
      throw new Error(`"churn_risk" only accepts low | medium | high | churned`);
    }
    const planParam = emitParam(ctx, ctx.planId);
    const valuesParam = emitParam(ctx, values);
    return `EXISTS (
      SELECT 1 FROM territory_plan_districts tpd
      WHERE tpd.plan_id = ${planParam}
        AND tpd.district_leaid = ${ctx.alias}."leaid"
        AND tpd.churn_risk = ANY(${valuesParam}::text[])
    )`;
  }
```

- [ ] **Step 3: Extend `buildOrderBy` to handle virtual sort fields**

In the same file, find `buildOrderBy` (around line 290). Replace its body so virtual fields don't error out and so `customer_rank` and `churn_risk` get their own SQL expressions.

Replace:

```typescript
export function buildOrderBy(
  sort: { id: string; dir: "asc" | "desc" }[],
  source: SavedListSource,
): string {
  if (sort.length === 0) return "";
  const parts = sort.map(({ id, dir }) => {
    const field = lookupField(source, id);
    if (!field) throw new Error(`Unknown sort field "${id}" for source "${source}"`);
    if (!/^[a-z_][a-z0-9_]*$/i.test(field.column)) {
      throw new Error(`Invalid identifier in sort column: ${field.column}`);
    }
    const safeDir = dir === "asc" ? "ASC" : "DESC";
    return `"${field.column}" ${safeDir} NULLS LAST`;
  });
  return `ORDER BY ${parts.join(", ")}`;
```

with:

```typescript
export function buildOrderBy(
  sort: { id: string; dir: "asc" | "desc" }[],
  source: SavedListSource,
  options?: { planId?: string | null; alias?: string },
): string {
  if (sort.length === 0) return "";
  const alias = options?.alias ?? "d"; // default district alias used by the main query
  const parts = sort.map(({ id, dir }) => {
    const field = lookupField(source, id);
    if (!field) throw new Error(`Unknown sort field "${id}" for source "${source}"`);

    const safeDir = dir === "asc" ? "ASC" : "DESC";

    // Virtual sort fields — explicit handlers per id.
    if (field.virtual) {
      if (id === "customer_rank") {
        // Resolved against the inline rank CTE injected by the route.
        // Numbered ranks come first (ascending), then Win Back, then New.
        // The CTE alias `__rank_cte` is contracted with the route layer.
        return `(__rank_cte.label = 'rank') DESC, __rank_cte.rank ${safeDir} NULLS LAST, (__rank_cte.label = 'win_back') DESC`;
      }
      if (id === "churn_risk") {
        if (!options?.planId) return ""; // no-op outside plan context
        // Severity ordering. Higher number = worse risk.
        return `(
          CASE __churn_cte.churn_risk
            WHEN 'churned' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
          END
        ) ${safeDir} NULLS LAST`;
      }
      throw new Error(`No virtual sort handler for field "${id}".`);
    }

    if (!/^[a-z_][a-z0-9_]*$/i.test(field.column)) {
      throw new Error(`Invalid identifier in sort column: ${field.column}`);
    }
    return `"${field.column}" ${safeDir} NULLS LAST`;
  }).filter(Boolean);
  if (parts.length === 0) return "";
  return `ORDER BY ${parts.join(", ")}`;
```

- [ ] **Step 4: Pass options through from the route**

In `src/app/api/views/data/route.ts`, find the `buildOrderBy(sort, typedSource)` call (around line 238). Change it to:

```typescript
    orderBy = buildOrderBy(sort, typedSource, { planId: planId ?? null });
```

- [ ] **Step 5: Inject the rank/churn CTEs into the main query when sorting needs them**

In `src/app/api/views/data/route.ts`, locate the SQL composition block (lines 233-262). The existing block reads:

```typescript
  const whereFragment = whereClauses.join(" AND ");

  // 11. Build ORDER BY.
  let orderBy = "";
  try {
    orderBy = buildOrderBy(sort, typedSource);
  } catch (err) {
    return NextResponse.json(
      { error: `Sort error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    );
  }

  // 12. Append LIMIT/OFFSET params.
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  // 13. Compose final SELECT
  const sql = `
    SELECT ${alias}.*, COUNT(*) OVER() AS __total
    FROM ${quoteIdent(tableInfo.table)} ${alias}
    WHERE ${whereFragment}
    ${orderBy}
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx}
  `.trim();
```

Replace it with:

```typescript
  const whereFragment = whereClauses.join(" AND ");

  // 11. Determine if sorts require sort-only CTEs.
  const needsRankCte = sort.some((s) => s.id === "customer_rank");
  const needsChurnCte = sort.some((s) => s.id === "churn_risk") && planId != null;

  // Build sort CTEs BEFORE buildOrderBy/limit params so the rank CTE's
  // param numbering doesn't collide with limit/offset.
  const cteFragments: string[] = [];
  let cteJoin = "";
  if (needsRankCte) {
    cteFragments.push(`__rank_cte AS (
      WITH rev AS (
        SELECT leaid,
          SUM(total_revenue) FILTER (WHERE fiscal_year = '26') AS fy26,
          SUM(total_revenue) FILTER (WHERE fiscal_year = '25') AS fy25,
          SUM(total_revenue) FILTER (WHERE fiscal_year = '24') AS fy24
        FROM district_financials
        WHERE vendor = 'fullmind'
          AND fiscal_year IN ('24','25','26')
          AND leaid IS NOT NULL
        GROUP BY leaid
      )
      SELECT leaid,
        CASE WHEN COALESCE(fy26, 0) > 0
             THEN RANK() OVER (ORDER BY COALESCE(fy26, 0) DESC)
             ELSE NULL END AS rank,
        CASE WHEN COALESCE(fy26, 0) > 0 THEN 'rank'
             WHEN COALESCE(fy25, 0) > 0 OR COALESCE(fy24, 0) > 0 THEN 'win_back'
             ELSE 'new' END AS label
      FROM rev
    )`);
    cteJoin += ` LEFT JOIN __rank_cte ON __rank_cte.leaid = ${alias}."leaid"`;
  }
  if (needsChurnCte) {
    params.push(planId);
    const planParamIdx = params.length;
    cteFragments.push(`__churn_cte AS (
      SELECT district_leaid, churn_risk
      FROM territory_plan_districts
      WHERE plan_id = $${planParamIdx}
    )`);
    cteJoin += ` LEFT JOIN __churn_cte ON __churn_cte.district_leaid = ${alias}."leaid"`;
  }
  const cteHeader = cteFragments.length > 0 ? `WITH ${cteFragments.join(", ")}` : "";

  // 12. Build ORDER BY (after CTE setup so virtual-sort references compile).
  let orderBy = "";
  try {
    orderBy = buildOrderBy(sort, typedSource, { planId: planId ?? null, alias });
  } catch (err) {
    return NextResponse.json(
      { error: `Sort error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    );
  }

  // 13. Append LIMIT/OFFSET params.
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  // 14. Compose final SELECT — CTE header on top, sort-only LEFT JOINs after FROM.
  const sql = `
    ${cteHeader}
    SELECT ${alias}.*, COUNT(*) OVER() AS __total
    FROM ${quoteIdent(tableInfo.table)} ${alias}
    ${cteJoin}
    WHERE ${whereFragment}
    ${orderBy}
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx}
  `.trim();
```

Notes:
- The `alias` variable (the districts table alias) is already in scope from earlier in the route.
- `buildOrderBy` was extended in Step 3 to take `{ planId, alias }` — those are real params now.
- Param ordering matters: push `planId` for the churn CTE *before* `limit` / `offset` because the existing code references `limitIdx` / `offsetIdx` by position.

- [ ] **Step 6: Type-check + manual sort smoke test**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors mentioning `sql-compiler.ts` or `route.ts`.

Then hit the endpoint with a sort:
```bash
curl -s "http://localhost:3005/api/views/data?source=districts&sort=customer_rank:asc&limit=5" | jq '.rows[] | {leaid, customer_rank}'
```
Expected: 5 rows; if there are customers, top one starts with `#`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/saved-views/source-fields.ts src/lib/saved-views/sql-compiler.ts src/app/api/views/data/route.ts
git commit -m "feat(views): virtual sort+filter for customer rank and churn risk"
```

---

## Task 7: Frontend — add the three ColumnDefs

**Files:**
- Modify: `src/features/views/lib/columns.ts:43-130` (districts array)

- [ ] **Step 1: Append three new entries to the `districts:` array**

In `src/features/views/lib/columns.ts`, find the last entry in the `districts:` array (`has_target`, defaultOrder: 19). Right after it (still inside the `districts:` array's closing `]`), add:

```typescript
    // Global derived label: "#1", "#2", ..., "Win Back", or "New". Read-only.
    // Server emits a single string on the row; cell renderer styles by prefix.
    { id: "customer_rank", header: "Customer rank", kind: "derived", accessor: "customerRank",
      sortable: true,  filterFieldId: null,              filterWidget: null,
      align: "left",   format: "pill",   defaultVisible: false, defaultOrder: 20 },
    // Per-plan churn risk pill. Inline-editable select (low/medium/high/churned).
    // Filter joins to territory_plan_districts; sort orders by severity.
    { id: "churn_risk", header: "Churn risk", kind: "derived", accessor: "churnRisk",
      sortable: true,  filterFieldId: "churn_risk",      filterWidget: { kind: "multiselect", values: ["low","medium","high","churned"] },
      align: "left",   format: "pill",   defaultVisible: false, defaultOrder: 21 },
    // Per-plan free-form notes. Inline-editable contenteditable cell.
    { id: "plan_notes", header: "Notes", kind: "derived", accessor: "planNotes",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "left",   format: "text",   defaultVisible: false, defaultOrder: 22 },
```

- [ ] **Step 2: Verify the file parses**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors mentioning `columns.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/features/views/lib/columns.ts
git commit -m "feat(views): add Customer rank / Churn risk / Notes ColumnDefs"
```

---

## Task 8: Frontend — mutation hooks

**Files:**
- Modify: `src/features/views/lib/queries.ts` (append at bottom)

- [ ] **Step 1: Add the two hooks**

At the bottom of `src/features/views/lib/queries.ts`, append:

```typescript
// ── Plan-district inline edits ──────────────────────────────────────────────

interface UpdatePlanDistrictArgs {
  churnRisk?: string | null;
  notes?: string | null;
}

/**
 * Optimistic per-plan-per-district mutation. Used by ChurnRiskCell and
 * PlanNotesCell. Invalidates the active views/data cache key so the next
 * fetch is fresh; the optimistic update keeps the cell snappy in the
 * meantime.
 */
export function useUpdatePlanDistrict(planId: string, leaid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePlanDistrictArgs) =>
      fetchJson<{ churnRisk: string | null; notes: string | null }>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`,
        { method: "PUT", body: JSON.stringify(data) },
      ),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["views", "data"] });
      // Patch every "views","data" page in the cache for this row.
      const updaters: Array<{ key: readonly unknown[]; previous: unknown }> = [];
      const queries = qc.getQueriesData<{ rows: Record<string, unknown>[] }>({
        queryKey: ["views", "data"],
      });
      for (const [key, data] of queries) {
        if (!data?.rows) continue;
        updaters.push({ key, previous: data });
        qc.setQueryData(key, {
          ...data,
          rows: data.rows.map((r) =>
            r.leaid === leaid
              ? {
                  ...r,
                  ...(vars.churnRisk !== undefined ? { churnRisk: vars.churnRisk } : {}),
                  ...(vars.notes !== undefined ? { planNotes: vars.notes } : {}),
                }
              : r,
          ),
        });
      }
      return { updaters };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back every page we patched.
      for (const u of ctx?.updaters ?? []) {
        qc.setQueryData(u.key, u.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["views", "data"] });
    },
  });
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors mentioning `queries.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/features/views/lib/queries.ts
git commit -m "feat(views): optimistic mutation hook for plan-district churn/notes"
```

---

## Task 9: ChurnRiskCell component

**Files:**
- Create: `src/features/views/components/grid/cells/ChurnRiskCell.tsx`
- Create: `src/features/views/components/grid/cells/__tests__/ChurnRiskCell.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/views/components/grid/cells/__tests__/ChurnRiskCell.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChurnRiskCell } from "../ChurnRiskCell";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("ChurnRiskCell", () => {
  it("shows '—' when value is null and disabled is false", () => {
    render(
      <ChurnRiskCell value={null} planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the pill label when value is set", () => {
    render(
      <ChurnRiskCell value="medium" planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders read-only span when disabled", () => {
    render(
      <ChurnRiskCell value="high" planId="p1" leaid="123" disabled={true} />,
      { wrapper },
    );
    // No select element when disabled — just a styled span.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("fires the mutation when the select value changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ churnRisk: "high", notes: null });
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      fetchMock(url, init);
      return Promise.resolve(
        new Response(JSON.stringify({ churnRisk: "high", notes: null }), { status: 200 }),
      );
    });

    render(
      <ChurnRiskCell value={null} planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );

    // Open the editor.
    fireEvent.click(screen.getByText("—"));
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: "high" } });

    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ churnRisk: "high" });

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:
```bash
npx vitest run src/features/views/components/grid/cells/__tests__/ChurnRiskCell.test.tsx
```
Expected: FAIL — `Cannot find module '../ChurnRiskCell'`.

- [ ] **Step 3: Implement the component**

Create `src/features/views/components/grid/cells/ChurnRiskCell.tsx`:

```typescript
"use client";
import { useState } from "react";
import { useUpdatePlanDistrict } from "../../../lib/queries";

const OPTIONS = ["low", "medium", "high", "churned"] as const;
type Option = (typeof OPTIONS)[number];

const LABEL: Record<Option, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  churned: "Churned",
};

const PILL: Record<Option, string> = {
  // Plum-derived neutrals + status palette per tokens.md. No Tailwind grays.
  low: "bg-[#E5F5EC] text-[#1F7A3F]",
  medium: "bg-[#FFF1D6] text-[#8A5C00]",
  high: "bg-[#FFE0DC] text-[#A8281C]",
  churned: "bg-[#EFEDF5] text-[#4B3A6B]",
};

interface Props {
  value: string | null;
  planId: string | null;
  leaid: string;
  disabled: boolean;
}

export function ChurnRiskCell({ value, planId, leaid, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const mutation = useUpdatePlanDistrict(planId ?? "", leaid);

  const current = isOption(value) ? value : null;

  if (disabled || planId == null) {
    if (current == null) return <span className="text-[#A69DC0]">—</span>;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PILL[current]}`}>
        {LABEL[current]}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="cursor-pointer rounded text-left focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
      >
        {current == null ? (
          <span className="text-[#A69DC0]">—</span>
        ) : (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PILL[current]}`}>
            {LABEL[current]}
          </span>
        )}
      </button>
    );
  }

  return (
    <select
      autoFocus
      value={current ?? ""}
      onChange={(e) => {
        const next = e.target.value === "" ? null : (e.target.value as Option);
        mutation.mutate({ churnRisk: next });
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      className="rounded border border-[#D3CCE0] bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
    >
      <option value="">— (unset)</option>
      {OPTIONS.map((o) => (
        <option key={o} value={o}>{LABEL[o]}</option>
      ))}
    </select>
  );
}

function isOption(v: unknown): v is Option {
  return typeof v === "string" && (OPTIONS as readonly string[]).includes(v);
}
```

- [ ] **Step 4: Run the tests**

Run:
```bash
npx vitest run src/features/views/components/grid/cells/__tests__/ChurnRiskCell.test.tsx
```
Expected: PASS — all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/cells/ChurnRiskCell.tsx src/features/views/components/grid/cells/__tests__/ChurnRiskCell.test.tsx
git commit -m "feat(views): ChurnRiskCell with inline native select"
```

---

## Task 10: PlanNotesCell component

**Files:**
- Create: `src/features/views/components/grid/cells/PlanNotesCell.tsx`
- Create: `src/features/views/components/grid/cells/__tests__/PlanNotesCell.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/views/components/grid/cells/__tests__/PlanNotesCell.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlanNotesCell } from "../PlanNotesCell";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("PlanNotesCell", () => {
  it("shows '—' when value is null", () => {
    render(<PlanNotesCell value={null} planId="p1" leaid="123" disabled={false} />, { wrapper });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the value as truncated text when not editing", () => {
    render(
      <PlanNotesCell value="hello world" planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("enters edit mode on click and saves on blur with mutation call", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ churnRisk: null, notes: "new note" });
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      fetchMock(url, init);
      return Promise.resolve(
        new Response(JSON.stringify({ churnRisk: null, notes: "new note" }), { status: 200 }),
      );
    });

    render(<PlanNotesCell value={null} planId="p1" leaid="123" disabled={false} />, { wrapper });

    fireEvent.click(screen.getByText("—"));
    const editor = await screen.findByRole("textbox");
    fireEvent.change(editor, { target: { value: "new note" } });
    fireEvent.blur(editor);

    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ notes: "new note" });

    vi.unstubAllGlobals();
  });

  it("reverts on Esc and does NOT call mutation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      fetchMock(url, init);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(
      <PlanNotesCell value="original" planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );

    fireEvent.click(screen.getByText("original"));
    const editor = await screen.findByRole("textbox");
    fireEvent.change(editor, { target: { value: "edited" } });
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("original")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:
```bash
npx vitest run src/features/views/components/grid/cells/__tests__/PlanNotesCell.test.tsx
```
Expected: FAIL — `Cannot find module '../PlanNotesCell'`.

- [ ] **Step 3: Implement the component**

Create `src/features/views/components/grid/cells/PlanNotesCell.tsx`:

```typescript
"use client";
import { useEffect, useRef, useState } from "react";
import { useUpdatePlanDistrict } from "../../../lib/queries";

interface Props {
  value: string | null;
  planId: string | null;
  leaid: string;
  disabled: boolean;
}

const DEBOUNCE_MS = 600;

export function PlanNotesCell({ value, planId, leaid, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutation = useUpdatePlanDistrict(planId ?? "", leaid);

  // Keep draft in sync if value changes from upstream while not editing.
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  // Cleanup any in-flight debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const scheduleSave = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ notes: next === "" ? null : next });
    }, DEBOUNCE_MS);
  };

  const commitNow = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next !== (value ?? "")) {
      mutation.mutate({ notes: next === "" ? null : next });
    }
    setEditing(false);
  };

  const cancel = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDraft(value ?? "");
    setEditing(false);
  };

  if (disabled || planId == null) {
    if (!value) return <span className="text-[#A69DC0]">—</span>;
    return (
      <span className="block max-w-[260px] truncate whitespace-nowrap text-sm text-[#1A1430]" title={value}>
        {value}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full max-w-[260px] cursor-text truncate text-left focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
      >
        {value ? (
          <span className="whitespace-nowrap text-sm text-[#1A1430]" title={value}>
            {value}
          </span>
        ) : (
          <span className="text-[#A69DC0]">—</span>
        )}
      </button>
    );
  }

  return (
    <textarea
      autoFocus
      role="textbox"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        scheduleSave(e.target.value);
      }}
      onBlur={() => commitNow(draft)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commitNow(draft);
        }
      }}
      rows={Math.min(6, Math.max(1, draft.split("\n").length))}
      className="w-full min-w-[200px] max-w-[400px] rounded border border-[#6B4D9C] bg-white px-2 py-1 text-sm text-[#1A1430] focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
    />
  );
}
```

- [ ] **Step 4: Run the tests**

Run:
```bash
npx vitest run src/features/views/components/grid/cells/__tests__/PlanNotesCell.test.tsx
```
Expected: PASS — all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/cells/PlanNotesCell.tsx src/features/views/components/grid/cells/__tests__/PlanNotesCell.test.tsx
git commit -m "feat(views): PlanNotesCell with inline contenteditable + debounced save"
```

---

## Task 11: CustomerRankCell (read-only label)

**Files:**
- Create: `src/features/views/components/grid/cells/CustomerRankCell.tsx`

- [ ] **Step 1: Implement the cell**

Create `src/features/views/components/grid/cells/CustomerRankCell.tsx`:

```typescript
"use client";

interface Props {
  value: string | null;
}

/**
 * Renders the customer_rank string from the API.
 * - "#1", "#2", ... → numbered rank pill (plum)
 * - "Win Back" → amber pill
 * - "New" → mint pill
 * - null/empty → em-dash
 */
export function CustomerRankCell({ value }: Props) {
  if (!value) return <span className="text-[#A69DC0]">—</span>;

  let pillClass: string;
  if (value.startsWith("#")) {
    pillClass = "bg-[#EFEDF5] text-[#4B3A6B]"; // plum 50 / 700
  } else if (value === "Win Back") {
    pillClass = "bg-[#FFF1D6] text-[#8A5C00]"; // amber
  } else if (value === "New") {
    pillClass = "bg-[#E5F5EC] text-[#1F7A3F]"; // mint
  } else {
    pillClass = "bg-[#EFEDF5] text-[#4B3A6B]";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${pillClass}`}>
      {value}
    </span>
  );
}
```

No tests — pure presentational, no logic beyond a string switch.

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors mentioning `CustomerRankCell.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/views/components/grid/cells/CustomerRankCell.tsx
git commit -m "feat(views): CustomerRankCell presenter"
```

---

## Task 12: Wire custom cells into `GridView.tsx`

**Files:**
- Modify: `src/features/views/components/grid/GridView.tsx:233-244`

- [ ] **Step 1: Import the new cells**

In `src/features/views/components/grid/GridView.tsx`, add to the imports at the top:

```typescript
import { ChurnRiskCell } from "./cells/ChurnRiskCell";
import { PlanNotesCell } from "./cells/PlanNotesCell";
import { CustomerRankCell } from "./cells/CustomerRankCell";
```

- [ ] **Step 2: Dispatch in the cell renderer by column.id**

Find the `tanCols` builder (around line 233). Replace:

```typescript
  const tanCols: TanColumnDef<Record<string, unknown>>[] = visibleCols.map(
    (c) => ({
      id: c.id,
      header: c.header,
      accessorKey: c.accessor,
      cell: (info) => {
        const v = info.getValue();
        if (v == null) return <span className="text-[#A69DC0]">—</span>;
        return <span>{formatCellValue(v, c.format)}</span>;
      },
    }),
  );
```

with:

```typescript
  const tanCols: TanColumnDef<Record<string, unknown>>[] = visibleCols.map(
    (c) => ({
      id: c.id,
      header: c.header,
      accessorKey: c.accessor,
      cell: (info) => {
        const v = info.getValue();
        const row = info.row.original as Record<string, unknown>;
        const leaid = typeof row.leaid === "string" ? row.leaid : null;

        if (c.id === "customer_rank") {
          return <CustomerRankCell value={typeof v === "string" ? v : null} />;
        }
        if (c.id === "churn_risk" && leaid) {
          return (
            <ChurnRiskCell
              value={typeof v === "string" ? v : null}
              planId={planId}
              leaid={leaid}
              disabled={planId == null}
            />
          );
        }
        if (c.id === "plan_notes" && leaid) {
          return (
            <PlanNotesCell
              value={typeof v === "string" ? v : null}
              planId={planId}
              leaid={leaid}
              disabled={planId == null}
            />
          );
        }
        if (v == null) return <span className="text-[#A69DC0]">—</span>;
        return <span>{formatCellValue(v, c.format)}</span>;
      },
    }),
  );
```

`planId` is already in scope (line 194).

- [ ] **Step 3: Type-check + lint**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors mentioning `GridView.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/views/components/grid/GridView.tsx
git commit -m "feat(views): dispatch custom cell renderers by column.id"
```

---

## Task 13: Smoke test in browser + final commit

**Files:** none (manual verification)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```
Expected: server starts on port 3005 without errors. If port is busy, kill the stale process first.

- [ ] **Step 2: Verify the three columns work end-to-end**

In the browser at `http://localhost:3005`:

1. Open a Plan with at least 5 districts in it.
2. Click the Table tab.
3. Open the column-picker (the `+` or settings icon in the grid toolbar — look in `GridColumnMenu.tsx` if hidden).
4. Toggle on **Customer rank**, **Churn risk**, and **Notes**.
5. Verify Customer rank shows `#N`, `Win Back`, or `New` for each district based on actual financial data.
6. Click a Churn risk cell — select dropdown appears, change it to "Medium". Cell updates immediately; refresh the page; value persists.
7. Click a Notes cell — textarea opens. Type "test note". Wait 700ms (debounced save fires) OR click outside. Refresh; the note persists.
8. Press the column header on Customer rank — rows reorder with `#1` first, then `Win Back`, then `New`.
9. Press the column header on Churn risk — rows reorder with `churned` first, then `high`, `medium`, `low`, then null.

If any step fails, fix the bug — DO NOT mark the task complete on partial success.

- [ ] **Step 3: Mobile spot-check**

Open Safari → Develop → Enter Responsive Design Mode → iPhone 15 Pro.

1. Open the same plan.
2. Scroll the Table tab horizontally to reach the new columns. Verify no horizontal-scroll regression vs. before.
3. Tap a Churn risk cell — the native select sheet should open. Pick a value; it saves.

If the cells render unusably narrow, add a min-width to the offending cell wrapper — but this should not be needed because each cell already has `whitespace-nowrap` and reasonable widths.

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```
Expected: all tests pass. Investigate any new failures.

- [ ] **Step 5: Final commit (if no code changes from smoke test)**

If no code changes were needed, skip this step. Otherwise commit any fixups:

```bash
git add <changed files>
git commit -m "fix(views): post-smoke-test adjustments"
```

---

## Notes for the executor

- **Cache lifetime is process-scoped.** When dev-reloading the API route, the rank cache resets. That's fine — first request rebuilds it in ~10ms.
- **The `customer_rank` column shows the same value for a district whether you're in a plan or a saved list.** That's intentional: rank is global.
- **The `churn_risk` and `plan_notes` columns are empty in non-plan list contexts** (the cell components render disabled state). Don't try to "fix" this — it's the design.
- **Filter for `churn_risk` outside a plan returns no rows** (the compiler emits `FALSE`). The UI hides the filter chip outside a plan via the `requiresPlanContext` flag on the source-field — verify this happens; if not, the filter picker needs a follow-up filter to hide it.
- **The `__rank_cte` and `__churn_cte` alias names are contracts** between the SQL builder in `route.ts` and the sort-builder in `sql-compiler.ts`. Don't rename one without the other.
- **No bulk edit, no rank filter, no audit history** — these are explicit non-goals. If the user asks for them mid-implementation, log the ask in the parking lot at the end of the spec and keep moving.
