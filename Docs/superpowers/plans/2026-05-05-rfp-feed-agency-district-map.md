# RFP Feed Phase 2 — Agency District Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual mapping layer for HigherGov RFP agencies that can't be resolved automatically by Phase 1's name-match resolver, mirrored from the existing `unmatched-opportunities` admin pattern and extended with three resolution outcomes (district / state-only / non-LEA) and bulk multi-select.

**Architecture:** New `AgencyDistrictMap` table keyed on `agency_key` with a `kind` discriminator. Resolver checks the override first, then falls through to existing 3-tier name match. Admin page mirrors `unmatched-opportunities/page.tsx` 1:1, reusing the existing `DataGrid` (selection API already exists), `AdminFilterBar`, `AdminColumnPicker`, and `/api/admin/districts/{search,suggestions}` endpoints.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + PostgreSQL, TanStack Query, Tailwind 4, Vitest.

**Spec:** `Docs/superpowers/specs/2026-05-04-rfp-feed-agency-district-map-design.md`

---

## Task 1: Setup + baseline

**Files:** none modified.

- [ ] **Step 1: Verify worktree state**

Run:
```bash
pwd
git status
git log --oneline -3
```
Expected: in `/Users/sierraarcega/territory-plan/.claude/worktrees/feat-rfp-feed-agency-district-map`, branch `feat/rfp-feed-agency-district-map`, HEAD = the spec commit (`Spec: RFP Feed Phase 2 — Agency District Map (manual match UI)`), working tree clean.

- [ ] **Step 2: Install + baseline tests**

Run:
```bash
npm install
npm test -- --run
```
Expected: install succeeds; tests all pass (the post-Phase-1 baseline).

- [ ] **Step 3: Verify Prisma client generates**

Run:
```bash
npx prisma generate
```
Expected: `Generated Prisma Client` printed.

---

## Task 2: Add `AgencyDistrictMap` schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260505_add_agency_district_maps/migration.sql`

- [ ] **Step 1: Add Prisma model**

Append to `prisma/schema.prisma` (above the closing of the schema block; place near the existing `Rfp` model):

```prisma
model AgencyDistrictMap {
  agencyKey   Int       @id @map("agency_key")
  kind        String                                       // "district" | "state" | "non_lea"
  leaid       String?   @db.VarChar(7)
  stateFips   String?   @db.VarChar(2) @map("state_fips")
  source      String    @default("highergov")
  notes       String?   @db.Text
  resolvedBy  String?   @map("resolved_by")
  resolvedAt  DateTime  @default(now()) @map("resolved_at")
  district    District? @relation(fields: [leaid], references: [leaid])

  @@map("agency_district_maps")
  @@index([kind])
  @@index([leaid])
}
```

Add inverse relation on `District` model (find the `model District {` block, add inside):
```prisma
agencyMaps AgencyDistrictMap[]
```

- [ ] **Step 2: Write migration SQL**

Create `prisma/migrations/20260505_add_agency_district_maps/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "agency_district_maps" (
    "agency_key"   INTEGER PRIMARY KEY,
    "kind"         TEXT NOT NULL,
    "leaid"        VARCHAR(7),
    "state_fips"   VARCHAR(2),
    "source"       TEXT NOT NULL DEFAULT 'highergov',
    "notes"        TEXT,
    "resolved_by"  TEXT,
    "resolved_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "agency_district_maps_kind_check" CHECK (kind IN ('district', 'state', 'non_lea')),
    CONSTRAINT "agency_district_maps_kind_consistency_check" CHECK (
        (kind = 'district' AND leaid IS NOT NULL AND state_fips IS NULL) OR
        (kind = 'state'    AND leaid IS NULL     AND state_fips IS NOT NULL) OR
        (kind = 'non_lea'  AND leaid IS NULL     AND state_fips IS NULL)
    ),
    CONSTRAINT "agency_district_maps_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "agency_district_maps_kind_idx"  ON "agency_district_maps" ("kind");
CREATE INDEX "agency_district_maps_leaid_idx" ON "agency_district_maps" ("leaid");
```

- [ ] **Step 3: Generate Prisma client**

Run:
```bash
npx prisma generate
```
Expected: client regenerates with `AgencyDistrictMap` model available.

- [ ] **Step 4: Apply migration to local dev DB**

Run:
```bash
npx prisma db execute --file prisma/migrations/20260505_add_agency_district_maps/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260505_add_agency_district_maps
```
Expected: migration applied, resolved as applied. (Per Phase 1 deployment learning: never use `prisma migrate dev`.)

- [ ] **Step 5: Verify schema in DB**

Run:
```bash
npx prisma db execute --stdin --schema prisma/schema.prisma <<'SQL'
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agency_district_maps' ORDER BY ordinal_position;
SQL
```
Expected: 8 columns matching the model.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260505_add_agency_district_maps/
git commit -m "feat(rfps): add AgencyDistrictMap schema + migration"
```

---

## Task 3: Resolver tests (TDD red)

**Files:**
- Modify: `src/features/rfps/lib/__tests__/district-resolver.test.ts`

- [ ] **Step 1: Add the override mock + new test cases**

At the top of the test file, extend the existing `vi.mock("@/lib/prisma")` block to include `agencyDistrictMap.findUnique`:

```ts
const findMany = vi.fn();
const agencyMapFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    district: { findMany: (...a: unknown[]) => findMany(...a) },
    agencyDistrictMap: { findUnique: (...a: unknown[]) => agencyMapFindUnique(...a) },
  },
  prisma: {
    district: { findMany: (...a: unknown[]) => findMany(...a) },
    agencyDistrictMap: { findUnique: (...a: unknown[]) => agencyMapFindUnique(...a) },
  },
}));

import { resolveAgency } from "../district-resolver";
```

(Note: the import changes from `resolveDistrict` to `resolveAgency`. The old function is removed in Task 4.)

In `beforeEach`, add `agencyMapFindUnique.mockReset();`. Default to no override row found:
```ts
beforeEach(() => {
  findMany.mockReset();
  agencyMapFindUnique.mockReset();
  agencyMapFindUnique.mockResolvedValue(null); // default: no override
});
```

Update every existing call site from `resolveDistrict("Name", "TX")` to `resolveAgency({ agencyKey: 12345, agencyName: "Name", stateAbbrev: "TX" })`. The existing assertions expecting a string return value need to change — `resolveAgency` returns `{ leaid, kind }`. Update them to assert on `result.leaid`. Example:

```ts
// before
expect(await resolveDistrict("united independent school district", "TX")).toBe("4849530");
// after
expect(await resolveAgency({ agencyKey: 12345, agencyName: "united independent school district", stateAbbrev: "TX" }))
  .toEqual({ leaid: "4849530", kind: "name_match" });
```

Add a new `describe` block at the bottom:

```ts
describe("resolveAgency — override branches", () => {
  it("kind=district: returns map.leaid with kind=override_district", async () => {
    agencyMapFindUnique.mockResolvedValue({ kind: "district", leaid: "4900000", stateFips: null });
    const result = await resolveAgency({ agencyKey: 999, agencyName: "Anything", stateAbbrev: "TX" });
    expect(result).toEqual({ leaid: "4900000", kind: "override_district" });
    expect(findMany).not.toHaveBeenCalled(); // override short-circuits name match
  });

  it("kind=state: returns null leaid with kind=override_state", async () => {
    agencyMapFindUnique.mockResolvedValue({ kind: "state", leaid: null, stateFips: "36" });
    const result = await resolveAgency({ agencyKey: 999, agencyName: "Anything", stateAbbrev: "NY" });
    expect(result).toEqual({ leaid: null, kind: "override_state" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("kind=non_lea: returns null leaid with kind=override_non_lea", async () => {
    agencyMapFindUnique.mockResolvedValue({ kind: "non_lea", leaid: null, stateFips: null });
    const result = await resolveAgency({ agencyKey: 999, agencyName: "Anything", stateAbbrev: "VA" });
    expect(result).toEqual({ leaid: null, kind: "override_non_lea" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("no override row: falls through to name match (regression)", async () => {
    agencyMapFindUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([{ leaid: "4849530", name: "United Independent School District" }]);
    const result = await resolveAgency({ agencyKey: 12345, agencyName: "United ISD", stateAbbrev: "TX" });
    expect(result).toEqual({ leaid: "4849530", kind: "name_match" });
  });

  it("no override + no match: returns null with kind=unresolved", async () => {
    agencyMapFindUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    const result = await resolveAgency({ agencyKey: 12345, agencyName: "Mystery", stateAbbrev: "WY" });
    expect(result).toEqual({ leaid: null, kind: "unresolved" });
  });

  it("queries override by agencyKey", async () => {
    agencyMapFindUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    await resolveAgency({ agencyKey: 29140, agencyName: "X", stateAbbrev: "TX" });
    expect(agencyMapFindUnique).toHaveBeenCalledWith({ where: { agencyKey: 29140 } });
  });
});
```

- [ ] **Step 2: Run tests — should fail (red)**

Run:
```bash
npm test -- --run src/features/rfps/lib/__tests__/district-resolver.test.ts
```
Expected: FAIL — `resolveAgency` is not exported (it doesn't exist yet).

- [ ] **Step 3: Commit (red state)**

```bash
git add src/features/rfps/lib/__tests__/district-resolver.test.ts
git commit -m "test(rfps): override branches for resolveAgency (red)"
```

---

## Task 4: Resolver implementation — `resolveAgency` with override branch

**Files:**
- Modify: `src/features/rfps/lib/district-resolver.ts`

- [ ] **Step 1: Replace `resolveDistrict` with `resolveAgency`**

Edit the bottom of `src/features/rfps/lib/district-resolver.ts`. Keep all helper functions (`STOP_WORDS`, `normalizeName`, `bigrams`, `diceCoefficient`) as-is. Replace the exported `resolveDistrict` function with:

```ts
export type ResolveResultKind =
  | "override_district"
  | "override_state"
  | "override_non_lea"
  | "name_match"
  | "unresolved";

export interface ResolveResult {
  leaid: string | null;
  kind: ResolveResultKind;
}

export interface ResolveAgencyArgs {
  agencyKey: number;
  agencyName: string;
  stateAbbrev: string;
}

export async function resolveAgency({
  agencyKey,
  agencyName,
  stateAbbrev,
}: ResolveAgencyArgs): Promise<ResolveResult> {
  // 1. Check manual override first.
  const override = await prisma.agencyDistrictMap.findUnique({ where: { agencyKey } });
  if (override) {
    if (override.kind === "district") {
      return { leaid: override.leaid, kind: "override_district" };
    }
    if (override.kind === "state") {
      return { leaid: null, kind: "override_state" };
    }
    return { leaid: null, kind: "override_non_lea" };
  }

  // 2. Fall through to existing 3-tier name match.
  const fips = abbrevToFips(stateAbbrev);
  if (!fips) return { leaid: null, kind: "unresolved" };

  const districts = await prisma.district.findMany({
    where: { stateFips: fips },
    select: { leaid: true, name: true },
  });
  if (districts.length === 0) return { leaid: null, kind: "unresolved" };

  const lcAgency = agencyName.toLowerCase().trim();
  const tier1 = districts.filter((d) => d.name.toLowerCase().trim() === lcAgency);
  if (tier1.length === 1) return { leaid: tier1[0].leaid, kind: "name_match" };

  const normAgency = normalizeName(agencyName);
  if (!normAgency) return { leaid: null, kind: "unresolved" };
  const tier2 = districts.filter((d) => normalizeName(d.name) === normAgency);
  if (tier2.length === 1) return { leaid: tier2[0].leaid, kind: "name_match" };
  if (tier2.length > 1) return { leaid: null, kind: "unresolved" };

  const scored = districts
    .map((d) => ({
      leaid: d.leaid,
      score: diceCoefficient(lcAgency, d.name.toLowerCase().trim()),
    }))
    .filter((s) => s.score >= 0.85)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { leaid: null, kind: "unresolved" };
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { leaid: null, kind: "unresolved" };
  }
  return { leaid: scored[0].leaid, kind: "name_match" };
}
```

Make sure `prisma` is the default-imported instance (`import prisma from "@/lib/prisma";` already at the top of the file).

Delete the old `resolveDistrict` export.

- [ ] **Step 2: Run tests — should pass (green)**

Run:
```bash
npm test -- --run src/features/rfps/lib/__tests__/district-resolver.test.ts
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/rfps/lib/district-resolver.ts
git commit -m "feat(rfps): resolveAgency checks AgencyDistrictMap override before name match"
```

---

## Task 5: Sync orchestrator — pass agencyKey + split counters

**Files:**
- Modify: `src/features/rfps/lib/sync.ts`
- Modify: `src/features/rfps/lib/__tests__/sync.test.ts`
- Modify: `prisma/schema.prisma` (add two columns to `RfpIngestRun`)
- Create: `prisma/migrations/20260505_split_rfp_resolved_counters/migration.sql`

- [ ] **Step 1: Add counters to schema**

In `prisma/schema.prisma`, find `model RfpIngestRun {` and add two fields after `recordsResolved`:

```prisma
recordsResolvedByOverride Int @default(0) @map("records_resolved_by_override")
recordsResolvedByName     Int @default(0) @map("records_resolved_by_name")
```

(Keep `recordsResolved` — it'll equal `byOverride + byName` after this change. The legacy column lets existing dashboards keep working.)

- [ ] **Step 2: Write the counter migration**

Create `prisma/migrations/20260505_split_rfp_resolved_counters/migration.sql`:

```sql
ALTER TABLE "rfp_ingest_runs"
  ADD COLUMN "records_resolved_by_override" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "records_resolved_by_name"     INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Generate + apply**

Run:
```bash
npx prisma generate
npx prisma db execute --file prisma/migrations/20260505_split_rfp_resolved_counters/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260505_split_rfp_resolved_counters
```

- [ ] **Step 4: Update sync.ts to use `resolveAgency`**

In `src/features/rfps/lib/sync.ts`:

Change the import:
```ts
import { resolveAgency, type ResolveResult } from "./district-resolver";
```

Change the cache type:
```ts
const agencyCache = new Map<number, ResolveResult>();
```

Replace the cache-build loop:
```ts
for (const [key, { name, state }] of uniqueAgencies) {
  agencyCache.set(key, await resolveAgency({ agencyKey: key, agencyName: name, stateAbbrev: state }));
}
```

Add the new counters to the local `counters` object:
```ts
const counters = {
  recordsSeen: 0, recordsNew: 0, recordsUpdated: 0,
  recordsResolved: 0, recordsUnresolved: 0,
  recordsResolvedByOverride: 0, recordsResolvedByName: 0,
};
```

Replace the upsert-loop's leaid extraction + counter increments:
```ts
for (const raw of buffer) {
  counters.recordsSeen++;
  try {
    const normalized = normalizeOpportunity(raw);
    const resolution = agencyCache.get(raw.agency.agency_key) ?? { leaid: null, kind: "unresolved" };
    const result = await prisma.rfp.upsert(rfpUpsertArgs(normalized, resolution.leaid));
    if (result.firstSeenAt && result.lastSeenAt &&
        result.firstSeenAt.getTime() === result.lastSeenAt.getTime()) {
      counters.recordsNew++;
    } else {
      counters.recordsUpdated++;
    }
    if (resolution.leaid) {
      counters.recordsResolved++;
      if (resolution.kind === "override_district") counters.recordsResolvedByOverride++;
      else if (resolution.kind === "name_match")  counters.recordsResolvedByName++;
    } else {
      counters.recordsUnresolved++;
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "rfp_record_error", opp_key: raw.opp_key, error: String(err).slice(0, 500),
    }));
  }
}
```

The `prisma.rfpIngestRun.update` calls already spread `...counters` so the two new fields land automatically.

- [ ] **Step 5: Update sync test**

In `src/features/rfps/lib/__tests__/sync.test.ts`:
- The existing mock for `resolveDistrict` becomes `resolveAgency`. Update the import and the mocked function name.
- Add a new test:

```ts
it("splits resolved counter into byOverride / byName", async () => {
  // ...mock fetchOpportunities to return 3 records from 3 different agencies...
  // ...mock resolveAgency to return:
  //   agency 1 → { leaid: "X", kind: "override_district" }
  //   agency 2 → { leaid: "Y", kind: "name_match" }
  //   agency 3 → { leaid: null, kind: "unresolved" }
  const summary = await syncRfps();
  expect(summary.recordsResolved).toBe(2);
  expect(summary.recordsResolvedByOverride).toBe(1);
  expect(summary.recordsResolvedByName).toBe(1);
  expect(summary.recordsUnresolved).toBe(1);
});
```

(Mirror the closure-deferred mock pattern at the top of the existing test file. Use `vi.mock("../district-resolver", () => ({ resolveAgency: (...a: unknown[]) => resolveAgencyMock(...a) }))` and add `const resolveAgencyMock = vi.fn();` near the top.)

Update existing tests in this file to use the new `resolveAgency` signature and result shape. Search for `resolveDistrict` or any single-string `leaid` returns from the mock and convert to `{ leaid, kind }` objects.

Update the `SyncSummary` type assertion expectations in tests that check the summary shape — add the two new counter fields.

In `sync.ts`, also update the `SyncSummary` interface:
```ts
export interface SyncSummary {
  runId: number;
  status: "ok" | "error";
  recordsSeen: number;
  recordsNew: number;
  recordsUpdated: number;
  recordsResolved: number;
  recordsUnresolved: number;
  recordsResolvedByOverride: number;
  recordsResolvedByName: number;
  watermark: Date;
  error?: string;
}
```

- [ ] **Step 6: Run tests**

Run:
```bash
npm test -- --run src/features/rfps/lib/__tests__/sync.test.ts src/features/rfps/lib/__tests__/district-resolver.test.ts
```
Expected: all pass.

- [ ] **Step 7: Run the cron route test (regression)**

Run:
```bash
npm test -- --run src/app/api/cron/ingest-rfps/__tests__/route.test.ts
```
Expected: still passes (it should consume the new sync summary shape transparently).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260505_split_rfp_resolved_counters/ src/features/rfps/lib/sync.ts src/features/rfps/lib/__tests__/sync.test.ts
git commit -m "feat(rfps): sync uses resolveAgency, splits resolved counter into override/name"
```

---

## Task 6: GET `/api/admin/agency-district-maps`

**Files:**
- Create: `src/app/api/admin/agency-district-maps/route.ts`
- Create: `src/app/api/admin/agency-district-maps/__tests__/route.test.ts`

- [ ] **Step 1: Write tests (red)**

Create `src/app/api/admin/agency-district-maps/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const queryRaw = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: (...a: unknown[]) => queryRaw(...a), $queryRawUnsafe: (...a: unknown[]) => queryRaw(...a) },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => getUser(...a),
}));

import { GET } from "../route";

beforeEach(() => {
  queryRaw.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ id: "user-1", email: "rep@example.com" });
});

function makeReq(qs: string) {
  return new NextRequest(new URL(`http://x/api/admin/agency-district-maps?${qs}`));
}

describe("GET /api/admin/agency-district-maps", () => {
  it("returns 401 when unauthenticated", async () => {
    getUser.mockResolvedValue(null);
    const res = await GET(makeReq(""));
    expect(res.status).toBe(401);
  });

  it("default status=untriaged filters to map.kind IS NULL", async () => {
    queryRaw.mockResolvedValue([]);
    queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]); // count query
    queryRaw.mockResolvedValueOnce([]);                    // rows query
    await GET(makeReq(""));
    const lastCall = queryRaw.mock.calls.at(-1)!;
    const sqlText = String(lastCall[0]).toLowerCase();
    expect(sqlText).toContain("m.kind is null");
  });

  it("status=district filters to m.kind = 'district'", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);
    queryRaw.mockResolvedValueOnce([]);
    await GET(makeReq("status=district"));
    const sqlText = String(queryRaw.mock.calls.at(-1)![0]).toLowerCase();
    expect(sqlText).toContain("m.kind = 'district'");
  });

  it("returns shaped items with mapping=null for untriaged rows", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(1) }]);
    queryRaw.mockResolvedValueOnce([{
      agency_key: 29140,
      agency_name: "United ISD",
      agency_path: "https://...",
      state_abbrev: "TX",
      unresolved_rfp_count: BigInt(3),
      total_rfp_count: BigInt(7),
      latest_captured: new Date("2026-05-03"),
      soonest_open_due: new Date("2026-06-15"),
      total_value_low: "100000.00",
      total_value_high: "500000.00",
      kind: null,
      leaid: null,
      state_fips: null,
      notes: null,
      resolved_at: null,
      resolved_by: null,
      resolved_district_name: null,
    }]);
    const res = await GET(makeReq(""));
    const body = await res.json();
    expect(body.items[0]).toMatchObject({
      agencyKey: 29140,
      agencyName: "United ISD",
      stateAbbrev: "TX",
      unresolvedRfpCount: 3,
      totalRfpCount: 7,
      mapping: null,
    });
    expect(body.pagination).toEqual({ page: 1, pageSize: 50, total: 1 });
  });

  it("returns mapping object when row has a map", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(1) }]);
    queryRaw.mockResolvedValueOnce([{
      agency_key: 29140,
      agency_name: "United ISD",
      agency_path: null,
      state_abbrev: "TX",
      unresolved_rfp_count: BigInt(0),
      total_rfp_count: BigInt(7),
      latest_captured: null,
      soonest_open_due: null,
      total_value_low: "0",
      total_value_high: "0",
      kind: "district",
      leaid: "4849530",
      state_fips: null,
      notes: null,
      resolved_at: new Date("2026-05-04"),
      resolved_by: "user-1",
      resolved_district_name: "United Independent School District",
    }]);
    const res = await GET(makeReq("status=district"));
    const body = await res.json();
    expect(body.items[0].mapping).toMatchObject({
      kind: "district",
      leaid: "4849530",
      districtName: "United Independent School District",
      resolvedBy: "user-1",
    });
  });

  it("page_size capped at 50", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);
    queryRaw.mockResolvedValueOnce([]);
    const res = await GET(makeReq("page_size=999"));
    const body = await res.json();
    expect(body.pagination.pageSize).toBe(50);
  });
});
```

Run:
```bash
npm test -- --run src/app/api/admin/agency-district-maps/__tests__/route.test.ts
```
Expected: FAIL — `route.ts` not found.

- [ ] **Step 2: Implement the GET route**

Create `src/app/api/admin/agency-district-maps/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { normalizeState } from "@/lib/states";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["untriaged", "district", "state", "non_lea", "all"]);
const SORTABLE = new Set([
  "unresolved_rfp_count",
  "total_rfp_count",
  "latest_captured",
  "soonest_open_due",
  "total_value_low",
  "agency_name",
]);

interface AgencyRow {
  agency_key: number;
  agency_name: string;
  agency_path: string | null;
  state_abbrev: string | null;
  unresolved_rfp_count: bigint;
  total_rfp_count: bigint;
  latest_captured: Date | null;
  soonest_open_due: Date | null;
  total_value_low: string | null;
  total_value_high: string | null;
  kind: string | null;
  leaid: string | null;
  state_fips: string | null;
  notes: string | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolved_district_name: string | null;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const status = (sp.get("status") ?? "untriaged").toLowerCase();
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status (must be one of: ${[...VALID_STATUSES].join(", ")})` }, { status: 400 });
  }
  const stateRaw = sp.get("state");
  const stateFilter = stateRaw ? normalizeState(stateRaw) : null;
  const q = sp.get("q")?.trim() || null;
  const sortBy = SORTABLE.has(sp.get("sort_by") ?? "") ? sp.get("sort_by")! : "unresolved_rfp_count";
  const sortDir = sp.get("sort_dir") === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(sp.get("page_size") ?? "50", 10)));
  const offset = (page - 1) * pageSize;

  // Build the status WHERE clause as Prisma.Sql so we can interpolate safely.
  const statusWhere: Prisma.Sql =
    status === "untriaged" ? Prisma.sql`m.kind IS NULL` :
    status === "all"       ? Prisma.sql`TRUE` :
                             Prisma.sql`m.kind = ${status}`;

  const stateWhere = stateFilter
    ? Prisma.sql`AND agg.state_abbrev = ${stateFilter}`
    : Prisma.empty;
  const qWhere = q
    ? Prisma.sql`AND agg.agency_name ILIKE ${"%" + q + "%"}`
    : Prisma.empty;

  // sortBy/sortDir come from a whitelist, so direct interpolation is safe.
  const orderBy = Prisma.raw(`${sortBy} ${sortDir} NULLS LAST, agg.agency_key`);

  const baseCte = Prisma.sql`
    WITH agg AS (
      SELECT
        r.agency_key,
        MAX(r.agency_name)  AS agency_name,
        MAX(r.agency_path)  AS agency_path,
        MAX(r.state_abbrev) AS state_abbrev,
        COUNT(*) FILTER (WHERE r.leaid IS NULL)            AS unresolved_rfp_count,
        COUNT(*)                                           AS total_rfp_count,
        MAX(r.captured_date)                               AS latest_captured,
        MAX(r.due_date) FILTER (WHERE r.due_date >= now()) AS soonest_open_due,
        SUM(COALESCE(r.value_low,  0))                     AS total_value_low,
        SUM(COALESCE(r.value_high, 0))                     AS total_value_high
      FROM rfps r
      GROUP BY r.agency_key
    )
  `;

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    ${baseCte}
    SELECT COUNT(*)::bigint AS count
    FROM agg
    LEFT JOIN agency_district_maps m ON m.agency_key = agg.agency_key
    WHERE ${statusWhere}
      ${stateWhere}
      ${qWhere}
  `);
  const total = Number(countRows[0]?.count ?? 0);

  const rows = await prisma.$queryRaw<AgencyRow[]>(Prisma.sql`
    ${baseCte}
    SELECT
      agg.*,
      m.kind, m.leaid, m.state_fips, m.notes, m.resolved_at, m.resolved_by,
      d.name AS resolved_district_name
    FROM agg
    LEFT JOIN agency_district_maps m ON m.agency_key = agg.agency_key
    LEFT JOIN districts d            ON d.leaid     = m.leaid
    WHERE ${statusWhere}
      ${stateWhere}
      ${qWhere}
    ORDER BY ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const items = rows.map((r) => ({
    agencyKey: r.agency_key,
    agencyName: r.agency_name,
    agencyPath: r.agency_path,
    stateAbbrev: r.state_abbrev,
    unresolvedRfpCount: Number(r.unresolved_rfp_count),
    totalRfpCount: Number(r.total_rfp_count),
    latestCaptured: r.latest_captured?.toISOString() ?? null,
    soonestOpenDue: r.soonest_open_due?.toISOString() ?? null,
    totalValueLow: r.total_value_low,
    totalValueHigh: r.total_value_high,
    mapping: r.kind
      ? {
          kind: r.kind,
          leaid: r.leaid,
          stateFips: r.state_fips,
          districtName: r.resolved_district_name,
          notes: r.notes,
          resolvedBy: r.resolved_by,
          resolvedAt: r.resolved_at?.toISOString() ?? null,
        }
      : null,
  }));

  return NextResponse.json({ items, pagination: { page, pageSize, total } });
}
```

- [ ] **Step 3: Run tests — green**

Run:
```bash
npm test -- --run src/app/api/admin/agency-district-maps/__tests__/route.test.ts
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/agency-district-maps/
git commit -m "feat(rfps): GET /api/admin/agency-district-maps — paginated agency triage list"
```

---

## Task 7: POST `/api/admin/agency-district-maps` (bulk write + cascade)

**Files:**
- Modify: `src/app/api/admin/agency-district-maps/route.ts` (add POST handler)
- Modify: `src/app/api/admin/agency-district-maps/__tests__/route.test.ts` (add POST tests)

- [ ] **Step 1: Write tests (red)**

Append to the existing test file:

```ts
import { POST } from "../route";

const upsertMany = vi.fn();
const updateRfp = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    $queryRawUnsafe: (...a: unknown[]) => queryRaw(...a),
    $transaction: (...a: unknown[]) => transaction(...a),
    agencyDistrictMap: { upsert: (...a: unknown[]) => upsertMany(...a) },
    rfp: { updateMany: (...a: unknown[]) => updateRfp(...a) },
  },
}));

function makePost(body: unknown) {
  return new NextRequest(new URL("http://x/api/admin/agency-district-maps"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/admin/agency-district-maps", () => {
  beforeEach(() => {
    upsertMany.mockReset();
    updateRfp.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        agencyDistrictMap: { upsert: upsertMany },
        rfp: { updateMany: updateRfp },
      })
    );
    upsertMany.mockResolvedValue({});
    updateRfp.mockResolvedValue({ count: 0 });
  });

  it("returns 401 unauthenticated", async () => {
    getUser.mockResolvedValue(null);
    const res = await POST(makePost({ agencyKeys: [1], kind: "non_lea" }));
    expect(res.status).toBe(401);
  });

  it("kind=district: writes one upsert per agencyKey + one cascade update", async () => {
    updateRfp.mockResolvedValue({ count: 5 });
    const res = await POST(makePost({ agencyKeys: [29140, 29141], kind: "district", leaid: "4849530" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ mappedAgencyCount: 2, cascadedRfpCount: 5 });
    expect(upsertMany).toHaveBeenCalledTimes(2);
    expect(updateRfp).toHaveBeenCalledWith({
      where: { agencyKey: { in: [29140, 29141] } },
      data: { leaid: "4849530" },
    });
  });

  it("kind=state: no cascade leaid update (leaid stays null)", async () => {
    const res = await POST(makePost({ agencyKeys: [99], kind: "state", stateFips: "36" }));
    expect(res.status).toBe(200);
    expect(upsertMany).toHaveBeenCalledTimes(1);
    // For state: clears any prior leaid back to null (handles district→state switch).
    expect(updateRfp).toHaveBeenCalledWith({
      where: { agencyKey: { in: [99] } },
      data: { leaid: null },
    });
  });

  it("kind=non_lea: clears leaid", async () => {
    const res = await POST(makePost({ agencyKeys: [99], kind: "non_lea" }));
    expect(res.status).toBe(200);
    expect(updateRfp).toHaveBeenCalledWith({
      where: { agencyKey: { in: [99] } },
      data: { leaid: null },
    });
  });

  it("400 when kind=district missing leaid", async () => {
    const res = await POST(makePost({ agencyKeys: [1], kind: "district" }));
    expect(res.status).toBe(400);
  });

  it("400 when kind=state missing stateFips (single-agency case)", async () => {
    const res = await POST(makePost({ agencyKeys: [1], kind: "state" }));
    // Single-agency means UI must supply stateFips.
    expect(res.status).toBe(400);
  });

  it("kind=state, multi-agency: server derives stateFips per row from rfps.state_fips", async () => {
    queryRaw.mockResolvedValueOnce([
      { agency_key: 1, state_fips: "36" },
      { agency_key: 2, state_fips: "06" },
    ]);
    const res = await POST(makePost({ agencyKeys: [1, 2], kind: "state" }));
    expect(res.status).toBe(200);
    expect(upsertMany).toHaveBeenCalledTimes(2);
    // Per-row stateFips derived from each agency's RFPs.
    const upsertArgs = upsertMany.mock.calls.map((c) => c[0].create);
    expect(upsertArgs).toContainEqual(expect.objectContaining({ agencyKey: 1, stateFips: "36" }));
    expect(upsertArgs).toContainEqual(expect.objectContaining({ agencyKey: 2, stateFips: "06" }));
  });

  it("400 when leaid set on kind=state", async () => {
    const res = await POST(makePost({ agencyKeys: [1], kind: "state", stateFips: "36", leaid: "4849530" }));
    expect(res.status).toBe(400);
  });

  it("400 when agencyKeys empty", async () => {
    const res = await POST(makePost({ agencyKeys: [], kind: "non_lea" }));
    expect(res.status).toBe(400);
  });

  it("populates resolvedBy from session", async () => {
    await POST(makePost({ agencyKeys: [1], kind: "non_lea" }));
    expect(upsertMany.mock.calls[0][0].create.resolvedBy).toBe("user-1");
  });
});
```

Run:
```bash
npm test -- --run src/app/api/admin/agency-district-maps/__tests__/route.test.ts
```
Expected: new POST tests fail.

- [ ] **Step 2: Implement POST**

Append to `src/app/api/admin/agency-district-maps/route.ts`:

```ts
interface PostBody {
  agencyKeys: number[];
  kind: "district" | "state" | "non_lea";
  leaid?: string;
  stateFips?: string;
  notes?: string;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { agencyKeys, kind, leaid, stateFips, notes } = body;

  if (!Array.isArray(agencyKeys) || agencyKeys.length === 0) {
    return badRequest("agencyKeys must be a non-empty array");
  }
  if (!agencyKeys.every((k) => Number.isInteger(k) && k > 0)) {
    return badRequest("agencyKeys must contain positive integers");
  }
  if (!["district", "state", "non_lea"].includes(kind)) {
    return badRequest("kind must be one of: district, state, non_lea");
  }

  // Per-kind invariant validation.
  if (kind === "district") {
    if (!leaid || !/^\d{7}$/.test(leaid)) return badRequest("kind=district requires a 7-digit leaid");
    if (stateFips) return badRequest("kind=district must not set stateFips");
  } else if (kind === "state") {
    if (leaid) return badRequest("kind=state must not set leaid");
    if (agencyKeys.length === 1 && !stateFips) {
      return badRequest("kind=state with a single agency requires stateFips");
    }
    if (stateFips && !/^\d{2}$/.test(stateFips)) {
      return badRequest("stateFips must be a 2-digit FIPS code");
    }
  } else {
    if (leaid || stateFips) return badRequest("kind=non_lea must not set leaid or stateFips");
  }

  // For multi-agency state-only, derive stateFips per row from rfps.
  let perAgencyStateFips: Map<number, string> = new Map();
  if (kind === "state" && !stateFips) {
    const rows = await prisma.$queryRaw<{ agency_key: number; state_fips: string | null }[]>(
      Prisma.sql`
        SELECT agency_key, MAX(state_fips) AS state_fips
        FROM rfps
        WHERE agency_key = ANY(${agencyKeys}::int[])
        GROUP BY agency_key
      `
    );
    for (const r of rows) {
      if (!r.state_fips) {
        return badRequest(`Agency ${r.agency_key} has no state — cannot derive stateFips`);
      }
      perAgencyStateFips.set(r.agency_key, r.state_fips);
    }
    if (perAgencyStateFips.size !== agencyKeys.length) {
      return badRequest("Some agencyKeys have no RFPs in the database");
    }
  }

  // Run all writes in a single transaction.
  const cascadedRfpCount = await prisma.$transaction(async (tx) => {
    for (const agencyKey of agencyKeys) {
      const rowStateFips =
        kind === "state"
          ? (stateFips ?? perAgencyStateFips.get(agencyKey)!)
          : null;
      const data = {
        kind,
        leaid: kind === "district" ? leaid! : null,
        stateFips: rowStateFips,
        notes: notes ?? null,
        resolvedBy: user.id,
        resolvedAt: new Date(),
      };
      await tx.agencyDistrictMap.upsert({
        where: { agencyKey },
        create: { agencyKey, ...data },
        update: data,
      });
    }
    if (kind === "district") {
      const r = await tx.rfp.updateMany({
        where: { agencyKey: { in: agencyKeys } },
        data: { leaid: leaid! },
      });
      return r.count;
    } else {
      const r = await tx.rfp.updateMany({
        where: { agencyKey: { in: agencyKeys } },
        data: { leaid: null },
      });
      return r.count;
    }
  });

  return NextResponse.json({ mappedAgencyCount: agencyKeys.length, cascadedRfpCount });
}
```

(Note: `Prisma` is already imported at the top of the file from Task 6. If not, add `import { Prisma } from "@prisma/client";`.)

- [ ] **Step 3: Run tests — green**

Run:
```bash
npm test -- --run src/app/api/admin/agency-district-maps/__tests__/route.test.ts
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/agency-district-maps/
git commit -m "feat(rfps): POST /api/admin/agency-district-maps — bulk write + cascade"
```

---

## Task 8: DELETE `/api/admin/agency-district-maps/[agencyKey]` (undo)

**Files:**
- Create: `src/app/api/admin/agency-district-maps/[agencyKey]/route.ts`
- Create: `src/app/api/admin/agency-district-maps/[agencyKey]/__tests__/route.test.ts`

- [ ] **Step 1: Write tests (red)**

Create `src/app/api/admin/agency-district-maps/[agencyKey]/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const transaction = vi.fn();
const deleteMap = vi.fn();
const updateRfp = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: (...a: unknown[]) => transaction(...a),
    agencyDistrictMap: { delete: (...a: unknown[]) => deleteMap(...a) },
    rfp: { updateMany: (...a: unknown[]) => updateRfp(...a) },
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => getUser(...a),
}));

import { DELETE } from "../route";

beforeEach(() => {
  transaction.mockReset();
  deleteMap.mockReset();
  updateRfp.mockReset();
  getUser.mockResolvedValue({ id: "user-1" });
  transaction.mockImplementation(async (fn) => fn({
    agencyDistrictMap: { delete: deleteMap },
    rfp: { updateMany: updateRfp },
  }));
});

function makeReq() {
  return new NextRequest(new URL("http://x/api/admin/agency-district-maps/29140"), { method: "DELETE" });
}

describe("DELETE /api/admin/agency-district-maps/[agencyKey]", () => {
  it("401 unauthenticated", async () => {
    getUser.mockResolvedValue(null);
    const res = await DELETE(makeReq(), { params: Promise.resolve({ agencyKey: "29140" }) });
    expect(res.status).toBe(401);
  });

  it("400 when agencyKey not numeric", async () => {
    const res = await DELETE(makeReq(), { params: Promise.resolve({ agencyKey: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("removes map row + nulls Rfp.leaid for that agency_key", async () => {
    deleteMap.mockResolvedValue({});
    updateRfp.mockResolvedValue({ count: 4 });
    const res = await DELETE(makeReq(), { params: Promise.resolve({ agencyKey: "29140" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ removedRfpLeaidCount: 4 });
    expect(deleteMap).toHaveBeenCalledWith({ where: { agencyKey: 29140 } });
    expect(updateRfp).toHaveBeenCalledWith({
      where: { agencyKey: 29140 },
      data: { leaid: null },
    });
  });
});
```

Run:
```bash
npm test -- --run src/app/api/admin/agency-district-maps/[agencyKey]/__tests__/route.test.ts
```
Expected: FAIL — route not found.

- [ ] **Step 2: Implement DELETE**

Create `src/app/api/admin/agency-district-maps/[agencyKey]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ agencyKey: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { agencyKey: agencyKeyStr } = await params;
  const agencyKey = Number(agencyKeyStr);
  if (!Number.isInteger(agencyKey) || agencyKey <= 0) {
    return NextResponse.json({ error: "agencyKey must be a positive integer" }, { status: 400 });
  }

  const cascadedCount = await prisma.$transaction(async (tx) => {
    await tx.agencyDistrictMap.delete({ where: { agencyKey } }).catch(() => null);
    const r = await tx.rfp.updateMany({
      where: { agencyKey },
      data: { leaid: null },
    });
    return r.count;
  });

  return NextResponse.json({ removedRfpLeaidCount: cascadedCount });
}
```

(`.catch(() => null)` handles the case where the user calls DELETE on an agency that has no map row — still want the cascade to run as a safety net.)

- [ ] **Step 3: Run tests — green**

Run:
```bash
npm test -- --run src/app/api/admin/agency-district-maps/[agencyKey]/__tests__/route.test.ts
```
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/agency-district-maps/\[agencyKey\]/
git commit -m "feat(rfps): DELETE /api/admin/agency-district-maps/[agencyKey] — undo mapping"
```

---

## Task 9: Admin page scaffolding — clone unmatched-opps file structure

**Files:**
- Create: `src/app/admin/agency-district-maps/page.tsx`
- Create: `src/app/admin/agency-district-maps/AdminFilterBar.tsx`
- Create: `src/app/admin/agency-district-maps/AdminColumnPicker.tsx`
- Create: `src/app/admin/agency-district-maps/columns.ts`

- [ ] **Step 1: Copy AdminFilterBar + AdminColumnPicker**

These two files are entity-agnostic. Copy them straight from `src/app/admin/unmatched-opportunities/`:

```bash
cp src/app/admin/unmatched-opportunities/AdminFilterBar.tsx src/app/admin/agency-district-maps/AdminFilterBar.tsx
cp src/app/admin/unmatched-opportunities/AdminColumnPicker.tsx src/app/admin/agency-district-maps/AdminColumnPicker.tsx
```

(Read each one once after copying to confirm there are no entity-specific assumptions; if any reference `unmatchedOpportunityColumns` literally, rename to a generic name and fix the page imports later.)

- [ ] **Step 2: Write columns definition**

Create `src/app/admin/agency-district-maps/columns.ts`:

```ts
import type { ColumnDef } from "@/features/shared/components/DataGrid/types";
import { US_STATES } from "@/lib/states";

export const STATUS_VALUES = [
  { value: "untriaged", label: "Untriaged" },
  { value: "district",  label: "Mapped to district" },
  { value: "state",     label: "Mapped to state-only" },
  { value: "non_lea",   label: "Dismissed (non-LEA)" },
  { value: "all",       label: "All" },
] as const;

export const agencyDistrictMapColumns: ColumnDef[] = [
  // status is filter-only — drives the API status param, isn't a row cell.
  { key: "status",             label: "Status",       group: "filters",  isDefault: false, filterType: "enum",   enumValues: [...STATUS_VALUES], isFilterOnly: true, sortable: false },
  { key: "agencyName",         label: "Agency",       group: "core",     isDefault: true,  filterType: "text",                                                       sortable: true  },
  { key: "stateAbbrev",        label: "State",        group: "core",     isDefault: true,  filterType: "enum",   enumValues: US_STATES.map((s) => ({ value: s, label: s })),                              sortable: false },
  { key: "totalRfpCount",      label: "RFPs",         group: "metrics",  isDefault: true,  filterType: "number",                                                                                          sortable: true  },
  { key: "unresolvedRfpCount", label: "Unresolved",   group: "metrics",  isDefault: true,  filterType: "number",                                                                                          sortable: true  },
  { key: "totalValue",         label: "Total value",  group: "metrics",  isDefault: true,  filterType: "number",                                                                                          sortable: true  },
  { key: "latestCaptured",     label: "Latest seen",  group: "dates",    isDefault: true,  filterType: "date",                                                                                            sortable: true  },
  { key: "soonestOpenDue",     label: "Soonest due",  group: "dates",    isDefault: false, filterType: "date",                                                                                            sortable: true  },
  { key: "mappingStatus",      label: "Resolution",   group: "core",     isDefault: false, filterType: "text",                                                                                            sortable: false },
  { key: "resolvedBy",         label: "Resolved by",  group: "audit",    isDefault: false, filterType: "text",                                                                                            sortable: false },
  { key: "resolvedAt",         label: "Resolved at",  group: "audit",    isDefault: false, filterType: "date",                                                                                            sortable: false },
  { key: "agencyPath",         label: "HigherGov",    group: "audit",    isDefault: false, filterType: "text",                                                                                            sortable: false },
];
```

- [ ] **Step 3: Write the page shell (minimal — wired but no mutations yet)**

Create `src/app/admin/agency-district-maps/page.tsx`:

```tsx
"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { agencyDistrictMapColumns } from "./columns";
import { DataGrid } from "@/features/shared/components/DataGrid/DataGrid";
import type { SortRule, FilterRule, CellRendererFn } from "@/features/shared/components/DataGrid/types";
import AdminFilterBar from "./AdminFilterBar";
import AdminColumnPicker from "./AdminColumnPicker";

interface AgencyMapping {
  kind: "district" | "state" | "non_lea";
  leaid: string | null;
  stateFips: string | null;
  districtName: string | null;
  notes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

interface AgencyRow {
  agencyKey: number;
  agencyName: string;
  agencyPath: string | null;
  stateAbbrev: string | null;
  unresolvedRfpCount: number;
  totalRfpCount: number;
  latestCaptured: string | null;
  soonestOpenDue: string | null;
  totalValueLow: string | null;
  totalValueHigh: string | null;
  mapping: AgencyMapping | null;
}

interface PaginationInfo { page: number; pageSize: number; total: number; }

async function fetchAgencies(params: {
  status?: string;
  state?: string;
  q?: string;
  sort_by?: string;
  sort_dir?: string;
  page: number;
  page_size: number;
}): Promise<{ items: AgencyRow[]; pagination: PaginationInfo }> {
  const qs = new URLSearchParams();
  if (params.status)   qs.set("status",  params.status);
  if (params.state)    qs.set("state",   params.state);
  if (params.q)        qs.set("q",       params.q);
  if (params.sort_by)  qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  qs.set("page", String(params.page));
  qs.set("page_size", String(params.page_size));
  const res = await fetch(`/api/admin/agency-district-maps?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function formatCompactCurrencyRange(low: string | null, high: string | null): string {
  const l = parseFloat(low ?? "0");
  const h = parseFloat(high ?? "0");
  if (l === 0 && h === 0) return "—";
  const fmt = (n: number) => {
    if (n >= 1_000_000) { const m = n / 1_000_000; return "$" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M"; }
    if (n >= 1_000)     { const k = n / 1_000;     return "$" + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + "K"; }
    return "$" + Math.round(n).toLocaleString();
  };
  return l === h ? fmt(l) : `${fmt(l)} – ${fmt(h)}`;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function MappingBadge({ mapping }: { mapping: AgencyMapping | null }) {
  if (!mapping) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fef1f0] text-[#F37167] border border-[#f58d85]/30">Untriaged</span>;
  }
  if (mapping.kind === "district") {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7FFF2] text-[#69B34A] border border-[#8AC670]/30">→ {mapping.districtName ?? mapping.leaid}</span>;
  }
  if (mapping.kind === "state") {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7F5FA] text-[#403770] border border-[#C2BBD4]">→ State-only</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F4F7] text-[#8A80A8] border border-[#A69DC0]/30">Non-LEA</span>;
}

function AgencyDistrictMapsContent() {
  const [filters, setFilters] = useState<FilterRule[]>([
    { column: "status", operator: "eq", value: "untriaged" },
  ]);
  const [sorts, setSorts] = useState<SortRule[]>([{ column: "unresolvedRfpCount", direction: "desc" }]);
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    agencyDistrictMapColumns.filter((c) => c.isDefault && !c.isFilterOnly).map((c) => c.key)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const statusFilter = filters.find((f) => f.column === "status" && f.operator === "eq");
  const stateFilter  = filters.find((f) => f.column === "stateAbbrev" && f.operator === "eq");
  const qFilter      = filters.find((f) => f.column === "agencyName" && f.operator === "contains");
  const sort = sorts[0];
  const sortByMap: Record<string, string> = {
    unresolvedRfpCount: "unresolved_rfp_count",
    totalRfpCount: "total_rfp_count",
    totalValue: "total_value_low",
    latestCaptured: "latest_captured",
    soonestOpenDue: "soonest_open_due",
    agencyName: "agency_name",
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["agency-district-maps", filters, sorts, page],
    queryFn: () => fetchAgencies({
      status:   statusFilter ? String(statusFilter.value) : "untriaged",
      state:    stateFilter  ? String(stateFilter.value)  : undefined,
      q:        qFilter      ? String(qFilter.value)      : undefined,
      sort_by:  sort ? sortByMap[sort.column]             : undefined,
      sort_dir: sort?.direction,
      page,
      page_size: 50,
    }),
  });

  const handleSort = useCallback((column: string) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.column === column);
      if (!existing) return [{ column, direction: "asc" as const }];
      if (existing.direction === "asc") return [{ column, direction: "desc" as const }];
      return [];
    });
    setPage(1);
  }, []);

  const cellRenderers = useMemo<Record<string, CellRendererFn>>(() => ({
    agencyName: ({ value, row }) => (
      <div>
        <div className="font-medium text-[#403770]">{String(value ?? "—")}</div>
        {row.agencyPath ? (
          <a href={String(row.agencyPath)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#A69DC0] hover:text-[#403770]" onClick={(e) => e.stopPropagation()}>HigherGov ↗</a>
        ) : null}
      </div>
    ),
    totalValue: ({ row }) => (
      <span className="tabular-nums">
        {formatCompactCurrencyRange(row.totalValueLow as string | null, row.totalValueHigh as string | null)}
      </span>
    ),
    totalRfpCount: ({ value }) => <span className="tabular-nums">{Number(value ?? 0).toLocaleString()}</span>,
    unresolvedRfpCount: ({ value }) => <span className="tabular-nums font-medium">{Number(value ?? 0).toLocaleString()}</span>,
    latestCaptured: ({ value }) => <span className="text-[#8A80A8]">{relTime(value as string | null)}</span>,
    soonestOpenDue: ({ value }) => <span className="text-[#8A80A8]">{relTime(value as string | null)}</span>,
    mappingStatus: ({ row }) => <MappingBadge mapping={row.mapping as AgencyMapping | null} />,
    resolvedAt: ({ value }) => <span className="text-[#8A80A8]">{relTime(value as string | null)}</span>,
  }), []);

  const rowsForGrid = (data?.items ?? []).map((r) => ({ ...r, id: String(r.agencyKey) }));

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="mb-3 shrink-0">
        <h1 className="text-xl font-bold text-[#403770]">RFP Agency Mappings</h1>
        <p className="text-sm text-[#8A80A8] mt-0.5">
          Manually map HigherGov agencies to districts when the automatic name match can't.
          {data?.pagination ? <span className="ml-1 font-medium text-[#6E6390]">{data.pagination.total} agencies showing</span> : null}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap shrink-0">
        <AdminFilterBar
          columnDefs={agencyDistrictMapColumns}
          filters={filters}
          onAddFilter={(f) => { setFilters((prev) => [...prev, f]); setPage(1); }}
          onRemoveFilter={(i) => { setFilters((prev) => prev.filter((_, idx) => idx !== i)); setPage(1); }}
          onUpdateFilter={(i, f) => { setFilters((prev) => prev.map((x, idx) => idx === i ? f : x)); setPage(1); }}
        />
        <div className="ml-auto">
          <AdminColumnPicker
            columnDefs={agencyDistrictMapColumns}
            visibleColumns={visibleColumns}
            onColumnsChange={setVisibleColumns}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <DataGrid
          data={rowsForGrid as unknown as Record<string, unknown>[]}
          columnDefs={agencyDistrictMapColumns}
          entityType="agency-district-maps"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          visibleColumns={visibleColumns}
          onColumnsChange={setVisibleColumns}
          sorts={sorts}
          onSort={handleSort}
          hasActiveFilters={filters.length > 0}
          onClearFilters={() => { setFilters([]); setPage(1); }}
          pagination={data?.pagination}
          onPageChange={setPage}
          cellRenderers={cellRenderers}
          rowIdAccessor="id"
          selectedIds={selectedIds}
          onToggleSelect={(id) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          }}
          onSelectPage={(ids) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              const allSelected = ids.every((i) => next.has(i));
              if (allSelected) ids.forEach((i) => next.delete(i));
              else ids.forEach((i) => next.add(i));
              return next;
            });
          }}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      </div>
    </div>
  );
}

export default function AgencyDistrictMapsPage() {
  return (
    <Suspense fallback={null}>
      <AgencyDistrictMapsContent />
    </Suspense>
  );
}
```

- [ ] **Step 4: Smoke test the page**

Run:
```bash
npm run dev -- --port 3005
```
Open `http://localhost:3005/admin/agency-district-maps`. Expected: page loads with the untriaged-status filter applied; rows render; filter bar + column picker work; sort + pagination work; row checkboxes appear (DataGrid renders them when `selectedIds`/`onToggleSelect` are wired).

Stop the dev server (Ctrl-C).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/agency-district-maps/
git commit -m "feat(rfps): admin page scaffold for agency district maps"
```

---

## Task 10: Resolution modal — Flow A (map to district) + A.5 (create new district)

**Files:**
- Modify: `src/app/admin/agency-district-maps/page.tsx`

- [ ] **Step 1: Lift the DistrictSearchModal + CreateAccountForm from unmatched-opportunities**

The unmatched-opportunities page already has:
- `DistrictSearchModal` (lines ~961–1179)
- `CreateAccountForm` (~727–959)
- `searchDistricts`, `searchSchools`, `fetchSuggestions`, `createDistrict`, `createAccount` API helpers

Don't copy-paste 600 lines into this new page. Instead, **extract them once** into shared modules:

```bash
mkdir -p src/features/shared/components/DistrictSearch
```

Create `src/features/shared/components/DistrictSearch/DistrictSearchModal.tsx` by copying the relevant sections from `src/app/admin/unmatched-opportunities/page.tsx`:
- The interfaces `DistrictResult`, `SchoolResult`, `NominatimSuggestion`
- The API helpers (`searchDistricts`, `searchSchools`, `fetchSuggestions`, `searchAddresses`, `createDistrict`, `createAccount`)
- The components `DistrictRow`, `SchoolRow`, `AddressSearchInput`, `CreateAccountForm`, `DistrictSearchModal`

Make `DistrictSearchModal`'s props a generic `subjectName` + `subjectState` instead of the opportunity-specific shape:

```ts
export interface DistrictSearchModalProps {
  subjectName: string;       // shown in header — e.g., agency name or opportunity name
  subjectState: string | null;
  subjectSubtitle?: string;  // optional second line — e.g., "3 agencies selected"
  onSelect: (district: DistrictResult) => void;
  onClose: () => void;
  // Optional override of header text (defaults to "Resolve to District")
  headerTitle?: string;
}
```

Update the existing import in `src/app/admin/unmatched-opportunities/page.tsx` to use the extracted module (and pass `subjectName={opportunity.accountName}`, `subjectState={opportunity.state}`). This is a refactor commit — verify the unmatched-opps page still works.

- [ ] **Step 2: Run the existing unmatched-opps tests as regression check**

Run:
```bash
npm test -- --run src/app/admin/unmatched-opportunities/
npm test -- --run src/app/api/admin/unmatched-opportunities/
```
Expected: all pass.

- [ ] **Step 3: Manual smoke on unmatched-opps**

Run `npm run dev`. Open `/admin/unmatched-opportunities`, click any unresolved row's Resolve button. Modal should open and behave identically. Stop dev server.

- [ ] **Step 4: Commit the refactor**

```bash
git add src/features/shared/components/DistrictSearch/ src/app/admin/unmatched-opportunities/page.tsx
git commit -m "refactor: extract DistrictSearchModal to shared component"
```

- [ ] **Step 5: Wire Flow A into the agency-district-maps page**

In `src/app/admin/agency-district-maps/page.tsx`:

Add imports:
```tsx
import { DistrictSearchModal, type DistrictResult } from "@/features/shared/components/DistrictSearch/DistrictSearchModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
```

Add inside `AgencyDistrictMapsContent`:
```tsx
const queryClient = useQueryClient();
const [resolvingAgency, setResolvingAgency] = useState<AgencyRow | null>(null);
const [toast, setToast] = useState<string | null>(null);

const mapMutation = useMutation({
  mutationFn: async (input: {
    agencyKeys: number[];
    kind: "district" | "state" | "non_lea";
    leaid?: string;
    stateFips?: string;
    notes?: string;
  }) => {
    const res = await fetch("/api/admin/agency-district-maps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to map agencies");
    }
    return res.json() as Promise<{ mappedAgencyCount: number; cascadedRfpCount: number }>;
  },
  onSuccess: (data, vars) => {
    queryClient.invalidateQueries({ queryKey: ["agency-district-maps"] });
    setSelectedIds(new Set());
    setResolvingAgency(null);
    setToast(`Mapped ${data.mappedAgencyCount} agenc${data.mappedAgencyCount === 1 ? "y" : "ies"} — updated ${data.cascadedRfpCount} RFPs.`);
  },
  onError: (err: Error) => setToast(err.message),
});

useEffect(() => {
  if (!toast) return;
  const t = setTimeout(() => setToast(null), 4000);
  return () => clearTimeout(t);
}, [toast]);
```

(Add `useEffect` to the existing imports.)

Add a `renderRowAction` to the `DataGrid` props:
```tsx
renderRowAction={(row) => {
  const r = row as unknown as AgencyRow & { id: string };
  const isMapped = r.mapping !== null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setResolvingAgency(r); }}
      className="px-2.5 py-1 text-xs font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg"
    >
      {isMapped ? "Edit mapping" : "Resolve"}
    </button>
  );
}}
```

Below the `</div>` that closes the table area, before the page wrapper close, add:

```tsx
{resolvingAgency && (
  <DistrictSearchModal
    subjectName={resolvingAgency.agencyName}
    subjectState={resolvingAgency.stateAbbrev}
    onSelect={(district) => {
      mapMutation.mutate({
        agencyKeys: [resolvingAgency.agencyKey],
        kind: "district",
        leaid: district.leaid,
      });
    }}
    onClose={() => setResolvingAgency(null)}
  />
)}

{toast && (
  <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg border bg-[#F7FFF2] border-[#8AC670] shadow-lg">
    <span className="text-sm font-medium text-[#5f665b]">{toast}</span>
  </div>
)}
```

- [ ] **Step 6: Smoke test Flow A**

Run `npm run dev`, open `/admin/agency-district-maps`. Click Resolve on any untriaged row, search for a district, click it. Confirm:
- Toast shows mapping success.
- Row should disappear from the untriaged list (status filter hides it).
- Switch the status filter to `district` to confirm the row appears with the new mapping.
- Run a quick DB check: `SELECT * FROM agency_district_maps;` — one row exists. `SELECT COUNT(*) FROM rfps WHERE agency_key = X AND leaid = Y;` — RFPs cascaded.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/agency-district-maps/page.tsx
git commit -m "feat(rfps): admin page Flow A — map agency to district"
```

---

## Task 11: Resolution Flows B (state-only) + C (dismiss as non-LEA)

**Files:**
- Modify: `src/app/admin/agency-district-maps/page.tsx`

- [ ] **Step 1: Add a kind-picker step before the search modal**

Replace the simple `setResolvingAgency` flow with a small "kind picker" preliminary modal: the user clicks Resolve, picks one of three kinds (district / state-only / non-LEA), then routes to the appropriate sub-flow.

Add state:
```tsx
type ResolutionStep = "pick" | "district" | "state" | "non_lea";
const [resolutionStep, setResolutionStep] = useState<ResolutionStep>("pick");
```

When opening: `setResolvingAgency(r); setResolutionStep("pick");`. When closing: reset both.

Add a small `KindPickerModal` component inline in the page file (~50 lines, plain JSX with 3 big buttons):

```tsx
function KindPickerModal({
  agency,
  onPick,
  onClose,
}: {
  agency: AgencyRow;
  onPick: (kind: "district" | "state" | "non_lea") => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-[#403770]">Resolve {agency.agencyName}</h3>
        <p className="text-sm text-[#8A80A8] mt-1 mb-4">
          {agency.totalRfpCount} RFP{agency.totalRfpCount === 1 ? "" : "s"} from this agency
          {agency.stateAbbrev ? ` (${agency.stateAbbrev})` : ""}
        </p>

        <div className="space-y-2">
          <button
            onClick={() => onPick("district")}
            className="w-full text-left px-4 py-3 rounded-lg border border-[#D4CFE2] hover:border-[#403770] hover:bg-[#F7F5FA]"
          >
            <div className="font-medium text-[#403770]">Map to a district</div>
            <div className="text-xs text-[#8A80A8] mt-0.5">Search for the LEA this agency belongs to</div>
          </button>
          <button
            onClick={() => onPick("state")}
            className="w-full text-left px-4 py-3 rounded-lg border border-[#D4CFE2] hover:border-[#403770] hover:bg-[#F7F5FA]"
          >
            <div className="font-medium text-[#403770]">State-level only</div>
            <div className="text-xs text-[#8A80A8] mt-0.5">Real state agency / charter network — no specific LEA</div>
          </button>
          <button
            onClick={() => onPick("non_lea")}
            className="w-full text-left px-4 py-3 rounded-lg border border-[#D4CFE2] hover:border-[#403770] hover:bg-[#F7F5FA]"
          >
            <div className="font-medium text-[#403770]">Dismiss as non-LEA</div>
            <div className="text-xs text-[#8A80A8] mt-0.5">Vendor / federal entity / mis-classified — suppress from triage</div>
          </button>
        </div>

        <button onClick={onClose} className="mt-4 px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the StateOnlyModal**

```tsx
import { US_STATES } from "@/lib/states";
import { abbrevToFips } from "@/lib/states";

function StateOnlyModal({
  agency,
  onConfirm,
  onClose,
}: {
  agency: AgencyRow;
  onConfirm: (stateFips: string, notes: string) => void;
  onClose: () => void;
}) {
  const [stateAbbrev, setStateAbbrev] = useState(agency.stateAbbrev ?? "");
  const [notes, setNotes] = useState("");
  const fips = abbrevToFips(stateAbbrev);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#403770]">State-only mapping</h3>
          <p className="text-sm text-[#8A80A8] mt-1">{agency.agencyName}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#544A78] mb-1">State</label>
          <select
            value={stateAbbrev}
            onChange={(e) => setStateAbbrev(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg"
          >
            <option value="">—</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#544A78] mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg" placeholder="Why state-only?" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">Cancel</button>
          <button
            onClick={() => fips && onConfirm(fips, notes)}
            disabled={!fips}
            className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-40 rounded-lg"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the DismissConfirmDialog**

```tsx
function DismissConfirmDialog({
  agency,
  onConfirm,
  onClose,
}: {
  agency: AgencyRow;
  onConfirm: (notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[#403770]">Dismiss as non-LEA?</h3>
        <p className="text-sm text-[#6E6390]">
          <span className="font-semibold">{agency.agencyName}</span> ({agency.totalRfpCount} RFP{agency.totalRfpCount === 1 ? "" : "s"}) will be hidden from the untriaged view.
        </p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg" placeholder="Notes (optional)" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">Cancel</button>
          <button onClick={() => onConfirm(notes)} className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#e0615a] rounded-lg">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire all three flows in the main render**

Replace the single `<DistrictSearchModal>` block from Task 10 with:

```tsx
{resolvingAgency && resolutionStep === "pick" && (
  <KindPickerModal
    agency={resolvingAgency}
    onPick={(k) => setResolutionStep(k)}
    onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
  />
)}

{resolvingAgency && resolutionStep === "district" && (
  <DistrictSearchModal
    subjectName={resolvingAgency.agencyName}
    subjectState={resolvingAgency.stateAbbrev}
    onSelect={(district) => {
      mapMutation.mutate({
        agencyKeys: [resolvingAgency.agencyKey],
        kind: "district",
        leaid: district.leaid,
      });
    }}
    onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
  />
)}

{resolvingAgency && resolutionStep === "state" && (
  <StateOnlyModal
    agency={resolvingAgency}
    onConfirm={(stateFips, notes) => {
      mapMutation.mutate({
        agencyKeys: [resolvingAgency.agencyKey],
        kind: "state",
        stateFips,
        notes: notes || undefined,
      });
    }}
    onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
  />
)}

{resolvingAgency && resolutionStep === "non_lea" && (
  <DismissConfirmDialog
    agency={resolvingAgency}
    onConfirm={(notes) => {
      mapMutation.mutate({
        agencyKeys: [resolvingAgency.agencyKey],
        kind: "non_lea",
        notes: notes || undefined,
      });
    }}
    onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
  />
)}
```

- [ ] **Step 5: Smoke each flow**

Run `npm run dev`. Test all three:
1. Resolve → district picker → confirm → row vanishes from untriaged.
2. Resolve → state-only picker → confirm → row vanishes; switch to status=state filter, row appears.
3. Resolve → dismiss → confirm → row vanishes; status=non_lea shows it.

Verify in DB:
```sql
SELECT agency_key, kind, leaid, state_fips, notes FROM agency_district_maps;
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/agency-district-maps/page.tsx
git commit -m "feat(rfps): admin page Flows B + C — state-only + dismiss as non-LEA"
```

---

## Task 12: Flow D — edit existing mapping + remove (DELETE)

**Files:**
- Modify: `src/app/admin/agency-district-maps/page.tsx`

- [ ] **Step 1: Pre-populate the kind-picker for already-mapped rows**

When `resolvingAgency.mapping !== null`, skip the kind picker if the user wants to edit the same kind, and show a "Remove mapping" option in each modal's footer.

Update `KindPickerModal` to also include a "Remove mapping" button when the agency has an existing mapping:

```tsx
function KindPickerModal({ agency, onPick, onRemove, onClose }: {
  agency: AgencyRow;
  onPick: (kind: "district" | "state" | "non_lea") => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  // ...existing buttons...
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* ...existing header + 3 buttons... */}

        {onRemove ? (
          <button
            onClick={onRemove}
            className="mt-3 w-full text-left px-4 py-3 rounded-lg border border-dashed border-[#C2BBD4] hover:border-[#F37167] hover:bg-[#fef1f0] text-[#F37167]"
          >
            <div className="font-medium">Remove mapping</div>
            <div className="text-xs text-[#A69DC0] mt-0.5">Revert to untriaged — next sync will re-run name match</div>
          </button>
        ) : null}

        <button onClick={onClose} className="mt-4 px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the DELETE mutation**

In `AgencyDistrictMapsContent`:

```tsx
const deleteMutation = useMutation({
  mutationFn: async (agencyKey: number) => {
    const res = await fetch(`/api/admin/agency-district-maps/${agencyKey}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to remove mapping");
    }
    return res.json() as Promise<{ removedRfpLeaidCount: number }>;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ["agency-district-maps"] });
    setSelectedIds(new Set());
    setResolvingAgency(null);
    setResolutionStep("pick");
    setToast(`Mapping removed. ${data.removedRfpLeaidCount} RFPs reverted to untriaged.`);
  },
  onError: (err: Error) => setToast(err.message),
});
```

Wire `onRemove` on the `KindPickerModal`:

```tsx
{resolvingAgency && resolutionStep === "pick" && (
  <KindPickerModal
    agency={resolvingAgency}
    onPick={(k) => setResolutionStep(k)}
    onRemove={resolvingAgency.mapping ? () => deleteMutation.mutate(resolvingAgency.agencyKey) : undefined}
    onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
  />
)}
```

- [ ] **Step 3: Smoke**

Run `npm run dev`. Map an agency to a district. Switch the status filter to `district`, click "Edit mapping" → kind picker shows + "Remove mapping" button at bottom. Click Remove. Confirm:
- Toast shows revert count.
- Status filter set back to `untriaged` and the agency shows up there.
- DB: `SELECT * FROM agency_district_maps;` — row gone. `SELECT leaid FROM rfps WHERE agency_key = X;` — all null.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/agency-district-maps/page.tsx
git commit -m "feat(rfps): admin page Flow D — edit mapping + remove with cascade"
```

---

## Task 13: Bulk action bar — multi-select N agencies

**Files:**
- Modify: `src/app/admin/agency-district-maps/page.tsx`

- [ ] **Step 1: Add the bulk-action bar**

Just above the closing `</div>` of `AgencyDistrictMapsContent`'s root, before the modals:

```tsx
{selectedIds.size > 0 && (
  <BulkActionBar
    count={selectedIds.size}
    onMapDistrict={() => setBulkStep("district")}
    onMapState={()    => setBulkStep("state")}
    onDismiss={()     => setBulkStep("non_lea")}
    onClear={()       => setSelectedIds(new Set())}
  />
)}
```

State + handlers:
```tsx
type BulkStep = null | "district" | "state" | "non_lea";
const [bulkStep, setBulkStep] = useState<BulkStep>(null);
const selectedAgencyKeys = useMemo(() => Array.from(selectedIds).map(Number), [selectedIds]);
```

`BulkActionBar` component (inline above `AgencyDistrictMapsContent`):

```tsx
function BulkActionBar({
  count, onMapDistrict, onMapState, onDismiss, onClear,
}: {
  count: number; onMapDistrict: () => void; onMapState: () => void; onDismiss: () => void; onClear: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D4CFE2] bg-white shadow-[0_-4px_12px_rgba(64,55,112,0.08)]">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <span className="text-sm font-medium text-[#403770]">{count} selected</span>
        <div className="flex-1" />
        <button onClick={onMapDistrict} className="px-3 py-1.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg">
          Map → district…
        </button>
        <button onClick={onMapState} className="px-3 py-1.5 text-sm font-medium text-[#403770] bg-[#F7F5FA] hover:bg-[#EFEDF5] border border-[#D4CFE2] rounded-lg">
          Mark → state-only…
        </button>
        <button onClick={onDismiss} className="px-3 py-1.5 text-sm font-medium text-[#F37167] bg-[#fef1f0] hover:bg-[#fbdfdc] border border-[#f58d85]/30 rounded-lg">
          Dismiss as non-LEA…
        </button>
        <button onClick={onClear} className="px-3 py-1.5 text-sm text-[#8A80A8] hover:text-[#403770]">
          Clear selection
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Bulk modals — district picker + state-only confirmation + dismiss confirm**

Reuse `DistrictSearchModal` for bulk district. The modal's subject becomes "{N} agencies selected":

```tsx
{bulkStep === "district" && (
  <DistrictSearchModal
    subjectName={`${selectedAgencyKeys.length} agencies selected`}
    subjectState={null}
    onSelect={(district) => {
      mapMutation.mutate({
        agencyKeys: selectedAgencyKeys,
        kind: "district",
        leaid: district.leaid,
      });
      setBulkStep(null);
    }}
    onClose={() => setBulkStep(null)}
  />
)}
```

For bulk state-only — server derives stateFips per agency, so no state picker:
```tsx
{bulkStep === "state" && (
  <BulkConfirm
    title={`Mark ${selectedAgencyKeys.length} agencies as state-only`}
    description="Each agency will be tagged with its own RFP-derived state."
    onConfirm={(notes) => {
      mapMutation.mutate({ agencyKeys: selectedAgencyKeys, kind: "state", notes: notes || undefined });
      setBulkStep(null);
    }}
    onClose={() => setBulkStep(null)}
  />
)}

{bulkStep === "non_lea" && (
  <BulkConfirm
    title={`Dismiss ${selectedAgencyKeys.length} agencies as non-LEA`}
    description="They will be hidden from the untriaged view."
    danger
    onConfirm={(notes) => {
      mapMutation.mutate({ agencyKeys: selectedAgencyKeys, kind: "non_lea", notes: notes || undefined });
      setBulkStep(null);
    }}
    onClose={() => setBulkStep(null)}
  />
)}
```

`BulkConfirm` component:
```tsx
function BulkConfirm({ title, description, danger, onConfirm, onClose }: {
  title: string; description: string; danger?: boolean;
  onConfirm: (notes: string) => void; onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[#403770]">{title}</h3>
        <p className="text-sm text-[#6E6390]">{description}</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg" placeholder="Notes (optional)" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">Cancel</button>
          <button
            onClick={() => onConfirm(notes)}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${danger ? "bg-[#F37167] hover:bg-[#e0615a]" : "bg-[#403770] hover:bg-[#322a5a]"}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Selection clears on page change (per spec — v1)**

Add to the page-change handler in the DataGrid props:

```tsx
onPageChange={(p) => { setPage(p); setSelectedIds(new Set()); }}
```

- [ ] **Step 4: Smoke bulk**

Run `npm run dev`. Check 3-5 agencies. Bulk-action bar appears. Try each of the three bulk actions in turn (Map, State-only, Dismiss). Verify all selected rows update, toast shows correct counts, selection clears.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/agency-district-maps/page.tsx
git commit -m "feat(rfps): admin page bulk action bar — multi-select N agencies"
```

---

## Task 14: Cascade-size confirmation for >100 RFP mappings

**Files:**
- Modify: `src/app/admin/agency-district-maps/page.tsx`

- [ ] **Step 1: Add a confirmation step when total cascade > 100 RFPs**

Per the spec, single mappings whose cascade exceeds 100 RFPs should warn the user. Sum `totalRfpCount` across the rows being mapped:

```tsx
const totalRfpsInScope = useMemo(() => {
  const map = new Map((data?.items ?? []).map((r) => [String(r.agencyKey), r.totalRfpCount]));
  if (resolvingAgency) return resolvingAgency.totalRfpCount;
  return Array.from(selectedIds).reduce((s, id) => s + (map.get(id) ?? 0), 0);
}, [data, resolvingAgency, selectedIds]);

const [confirmingLargeCascade, setConfirmingLargeCascade] = useState<null | (() => void)>(null);

function guardLargeCascade(submit: () => void) {
  if (totalRfpsInScope > 100) {
    setConfirmingLargeCascade(() => submit);
  } else {
    submit();
  }
}
```

Wrap each `mapMutation.mutate({...})` call site (in the four modal `onSelect`/`onConfirm`) with `guardLargeCascade(() => mapMutation.mutate({...}))`.

Add the confirmation dialog:

```tsx
{confirmingLargeCascade && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmingLargeCascade(null)}>
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-semibold text-[#403770]">Cascade {totalRfpsInScope} RFPs?</h3>
      <p className="text-sm text-[#6E6390]">
        This action will update {totalRfpsInScope} RFP records. Bulk undo isn't available — be sure before confirming.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setConfirmingLargeCascade(null)} className="px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">Cancel</button>
        <button
          onClick={() => { confirmingLargeCascade(); setConfirmingLargeCascade(null); }}
          className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg"
        >
          Confirm cascade
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/agency-district-maps/page.tsx
git commit -m "feat(rfps): warn before cascading large mappings (>100 RFPs)"
```

---

## Task 15: Smoke + push + open PR

**Files:** none modified.

- [ ] **Step 1: Run all tests**

Run:
```bash
npm test -- --run
npm run typecheck 2>&1 | tail -10
```
Expected: all green.

- [ ] **Step 2: Manual end-to-end smoke**

Run `npm run dev`. Walk the full happy path:
1. Open `/admin/agency-district-maps`. Confirm page loads with untriaged status filter.
2. Filter by state (e.g., NY). Confirm rows narrow.
3. Sort by `Unresolved` desc. Confirm sort works.
4. Search by agency name. Confirm filter chip works.
5. Resolve a single agency to a district. Toast appears, row leaves untriaged view.
6. Switch to `district` filter. Confirm row appears with mapping. Edit mapping → Remove. Toast appears, row returns to untriaged.
7. Resolve another agency as state-only. Switch to `state` filter; confirm.
8. Resolve another as non-LEA. Switch to `non_lea`; confirm.
9. Multi-select 3 untriaged agencies. Bulk Map → district → confirm. Toast shows N=3. All three move out.
10. Multi-select 5 untriaged. Bulk Dismiss as non-LEA. All five move to non_lea filter.

Stop dev server.

- [ ] **Step 3: Verify resolver + sync still work end-to-end**

Run a manual sync (against staging or via the test runner):
```bash
npm test -- --run src/features/rfps/ src/app/api/cron/ingest-rfps/ src/app/api/rfps/
```
Expected: all pass.

- [ ] **Step 4: Push branch + open PR**

```bash
git push -u origin feat/rfp-feed-agency-district-map
gh pr create --title "feat(rfps): Phase 2 — Agency District Map (manual match UI)" --body "$(cat <<'EOF'
## Summary

Phase 2 of the RFP Feed feature. Adds a manual mapping layer for HigherGov agencies that Phase 1's name-match resolver can't handle on its own (~1,029 unresolved RFPs in production as of 2026-05-04, concentrated in NY/CT/charter networks).

- New `AgencyDistrictMap` table keyed on `agency_key` with `kind` discriminator (`district` / `state` / `non_lea`).
- Resolver checks override first, falls through to existing 3-tier name match.
- Sync split `recordsResolved` counter into `byOverride` + `byName` for telemetry.
- Admin page mirrors `unmatched-opportunities` 1:1, adds three resolution flows + bulk multi-select via the existing DataGrid selection API.
- `DistrictSearchModal` extracted to a shared component (refactor — unmatched-opps still passes its tests).

## Spec & plan

- Spec: `Docs/superpowers/specs/2026-05-04-rfp-feed-agency-district-map-design.md`
- Plan: `Docs/superpowers/plans/2026-05-05-rfp-feed-agency-district-map.md`

## Test plan

- [ ] Resolver override branches (district / state / non-LEA) tested
- [ ] POST endpoint validation + cascade tested
- [ ] DELETE endpoint cascade tested
- [ ] Page renders + filter chips + sort + pagination work
- [ ] Single-agency resolve flow (district / state / non-LEA / edit / remove) walked manually
- [ ] Bulk-select flow walked manually
- [ ] Existing unmatched-opportunities tests still pass after `DistrictSearchModal` refactor
- [ ] All Vitest pass; `npm run typecheck` clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Manual production verification (post-merge, separate session)**

After merge, run the production sanity checks from `Docs/superpowers/notes/2026-05-04-rfp-feed-resume-prompt.md`:

```sql
SELECT kind, COUNT(*) FROM agency_district_maps GROUP BY kind;
SELECT id, status, started_at, finished_at, records_resolved, records_resolved_by_override, records_resolved_by_name
FROM rfp_ingest_runs ORDER BY started_at DESC LIMIT 5;
```

Expected (after a few days of use): `agency_district_maps` has rows for the top unresolved agencies, and `records_resolved_by_override` is climbing in daily runs as overrides apply to new RFPs.
