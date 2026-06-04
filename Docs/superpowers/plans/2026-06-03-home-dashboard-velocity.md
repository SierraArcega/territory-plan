# Velocity Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Velocity card to the top of the Pipeline tab — four ranked metrics (close rate, avg deal size, gross margin, deals won), each with the caller's value, a delta vs prior FY, the team median, and the caller's rank.

**Architecture:** A pure builder (`velocity.ts`) derives per-rep metric values from raw aggregates, ranks them with the existing `rankReps`, and computes medians + caller deltas. A SQL source (`velocity-source.ts`) fetches per-rep current-FY aggregates + the caller's prior-FY aggregate. A cookie-authed route serves it; a `useVelocity` hook + `VelocityCard`/`VelocityCell` render it at the top of the Pipeline tab.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4, Prisma raw SQL, Vitest + Testing Library, Fullmind tokens (plum `#403770`, neutrals `#5C5378`/`#8A80A8`/`#A69DC0`/`#EFEDF5`/`#D4CFE2`).

**Spec:** `Docs/superpowers/specs/2026-06-03-home-dashboard-velocity-design.md`

**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/home-dashboard` (branch `worktree-home-dashboard`). Commit with `-c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com"`, plain messages, no model-id trailer. Run tests with `npx vitest run <path>` from the worktree root.

---

## File structure

- Create `src/features/home/lib/velocity.ts` — types, `median`, `buildVelocity` (pure).
- Create `src/features/home/lib/__tests__/velocity.test.ts`.
- Create `src/features/home/lib/velocity-source.ts` — `fetchVelocity` (raw SQL).
- Create `src/app/api/home/dashboard/velocity/route.ts` — the endpoint.
- Create `src/app/api/home/dashboard/velocity/__tests__/route.test.ts`.
- Modify `src/features/home/lib/queries.ts` — `useVelocity` hook + `VelocityResponse`.
- Create `src/features/home/components/dashboard/pipeline/VelocityCell.tsx` + test.
- Create `src/features/home/components/dashboard/pipeline/VelocityCard.tsx` + test.
- Modify `src/features/home/components/dashboard/DashboardTab.tsx` — render `VelocityCard` above `PipelineSection`.

Shared deps already present: `rankReps`/`rankForRep` (`lib/ranking.ts`), `stagePrefixSql` (`lib/trajectory-source.ts`), `deltaColor` (`lib/delta.ts`), `schoolYearForFY`/`getCurrentFY` (`@/lib/fiscal-year`), `getActiveReps` (`@/lib/reps`), `getUser` (`@/lib/supabase/server`), `formatCurrency`/`formatPercent`/`formatNumber` (`@/features/shared/lib/format`), `fetchJson`/`API_BASE` (`@/features/shared/lib/api-client`).

---

## Task 1: types + `median` helper

**Files:**
- Create: `src/features/home/lib/velocity.ts`
- Test: `src/features/home/lib/__tests__/velocity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { median } from "../velocity";

describe("median", () => {
  it("returns the middle value for odd-length input", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middle values for even-length input", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("returns 0 for empty input", () => {
    expect(median([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/lib/__tests__/velocity.test.ts`
Expected: FAIL — `median` is not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/home/lib/velocity.ts`:

```ts
// Velocity metrics for the Pipeline tab: close rate, avg deal size, gross margin,
// deals won — each ranked vs the team with a prior-FY delta. Pure; the SQL that
// feeds it lives in velocity-source.ts. All four metrics are higher-is-better.

export type VelocityMetricKey = "closeRate" | "avgDealSize" | "grossMargin" | "dealsWon";
export type DeltaUnit = "pts" | "pct" | "count";

// Per-rep raw aggregate for one fiscal year (from velocity-source).
export interface RepVelocityAgg {
  wonCount: number;     // closed-won opps
  closedCount: number;  // closed-won + closed-lost
  wonBookingSum: number; // Σ net_booking_amount over won
  takeSum: number;      // Σ completed_take + scheduled_take (DOA)
  revSum: number;       // Σ completed_revenue + scheduled_revenue (DOA)
}

export interface VelocityCell {
  metricKey: VelocityMetricKey;
  label: string;
  format: "percent" | "currency" | "count";
  value: number;        // percent metrics as a fraction (0-1); deal size in $; deals won count
  delta: number | null; // in deltaUnit; null when not in roster or no prior value
  deltaUnit: DeltaUnit;
  teamMedian: number;   // same scale as value
  rank: number;
  totalReps: number;
  inRoster: boolean;
}

// Median of a numeric list; 0 for empty.
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/lib/__tests__/velocity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/velocity.ts src/features/home/lib/__tests__/velocity.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add velocity types + median helper"
```

---

## Task 2: `buildVelocity` builder

**Files:**
- Modify: `src/features/home/lib/velocity.ts`
- Modify: `src/features/home/lib/__tests__/velocity.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/features/home/lib/__tests__/velocity.test.ts`:

```ts
import { buildVelocity, type RepVelocityAgg } from "../velocity";

const reps = [
  { id: "me", email: "me@x" },
  { id: "u2", email: "u2@x" },
  { id: "u3", email: "u3@x" },
];

function agg(p: Partial<RepVelocityAgg>): RepVelocityAgg {
  return { wonCount: 0, closedCount: 0, wonBookingSum: 0, takeSum: 0, revSum: 0, ...p };
}

describe("buildVelocity", () => {
  it("derives the four metrics, ranks them, and computes medians", () => {
    const current = new Map<string, RepVelocityAgg>([
      // me: 6 won / 10 closed = 60% close rate; $600k/6 = $100k deal; 50% margin; 6 deals
      ["me@x", agg({ wonCount: 6, closedCount: 10, wonBookingSum: 600000, takeSum: 50000, revSum: 100000 })],
      ["u2@x", agg({ wonCount: 9, closedCount: 10, wonBookingSum: 450000, takeSum: 30000, revSum: 100000 })],
      ["u3@x", agg({ wonCount: 3, closedCount: 10, wonBookingSum: 150000, takeSum: 90000, revSum: 100000 })],
    ]);
    const cells = buildVelocity(reps, current, null, "me");
    const byKey = Object.fromEntries(cells.map((c) => [c.metricKey, c]));

    expect(cells.map((c) => c.metricKey)).toEqual(["closeRate", "avgDealSize", "grossMargin", "dealsWon"]);
    // close rate: u2 90% > me 60% > u3 30% → me #2
    expect(byKey.closeRate).toMatchObject({ value: 0.6, rank: 2, totalReps: 3, inRoster: true, deltaUnit: "pts" });
    expect(byKey.closeRate.teamMedian).toBe(0.6); // median(0.9,0.6,0.3)
    // avg deal size: me $100k > u2 $50k > u3 $50k → me #1
    expect(byKey.avgDealSize).toMatchObject({ value: 100000, rank: 1, deltaUnit: "pct", format: "currency" });
    // gross margin: u3 0.9 > me 0.5 > u2 0.3 → me #2
    expect(byKey.grossMargin).toMatchObject({ value: 0.5, rank: 2, deltaUnit: "pts" });
    // deals won: u2 9 > me 6 > u3 3 → me #2
    expect(byKey.dealsWon).toMatchObject({ value: 6, rank: 2, deltaUnit: "count", format: "count" });
  });

  it("computes prior-FY deltas in each unit (pts / pct / count)", () => {
    const current = new Map<string, RepVelocityAgg>([
      ["me@x", agg({ wonCount: 6, closedCount: 10, wonBookingSum: 600000, takeSum: 60000, revSum: 100000 })],
    ]);
    // prior: 50% close, $80k deal (5 won/$400k), 40% margin, 5 won
    const prior = agg({ wonCount: 5, closedCount: 10, wonBookingSum: 400000, takeSum: 40000, revSum: 100000 });
    const byKey = Object.fromEntries(buildVelocity(reps, current, prior, "me").map((c) => [c.metricKey, c]));
    expect(byKey.closeRate.delta).toBe(10);   // 60% - 50% = +10 pts
    expect(byKey.avgDealSize.delta).toBe(25);  // (100k-80k)/80k = +25%
    expect(byKey.grossMargin.delta).toBe(20);  // 60% - 40% = +20 pts
    expect(byKey.dealsWon.delta).toBe(1);      // 6 - 5
  });

  it("marks a caller not in the roster as not-ranked with null delta", () => {
    const cells = buildVelocity(reps, new Map(), agg({ wonCount: 5, closedCount: 5 }), "ghost");
    for (const c of cells) {
      expect(c.inRoster).toBe(false);
      expect(c.delta).toBeNull();
    }
  });

  it("returns a null avg-deal-size delta when the prior value is zero", () => {
    const current = new Map<string, RepVelocityAgg>([["me@x", agg({ wonCount: 2, wonBookingSum: 100000 })]]);
    const byKey = Object.fromEntries(buildVelocity(reps, current, agg({}), "me").map((c) => [c.metricKey, c]));
    expect(byKey.avgDealSize.delta).toBeNull(); // prior avg deal = 0 → no % change
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/lib/__tests__/velocity.test.ts`
Expected: FAIL — `buildVelocity` is not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `src/features/home/lib/velocity.ts`:

```ts
import { rankReps, rankForRep } from "./ranking";

const ZERO: RepVelocityAgg = { wonCount: 0, closedCount: 0, wonBookingSum: 0, takeSum: 0, revSum: 0 };

const METRICS: {
  key: VelocityMetricKey;
  label: string;
  format: "percent" | "currency" | "count";
  deltaUnit: DeltaUnit;
  value: (a: RepVelocityAgg) => number;
}[] = [
  { key: "closeRate", label: "Close rate", format: "percent", deltaUnit: "pts", value: (a) => (a.closedCount > 0 ? a.wonCount / a.closedCount : 0) },
  { key: "avgDealSize", label: "Avg deal size", format: "currency", deltaUnit: "pct", value: (a) => (a.wonCount > 0 ? a.wonBookingSum / a.wonCount : 0) },
  { key: "grossMargin", label: "Gross margin", format: "percent", deltaUnit: "pts", value: (a) => (a.revSum > 0 ? a.takeSum / a.revSum : 0) },
  { key: "dealsWon", label: "Deals won", format: "count", deltaUnit: "count", value: (a) => a.wonCount },
];

// pts: percentage-point change (×100). pct: relative % change (null if prior 0).
// count: absolute difference. All rounded to whole numbers.
function computeDelta(unit: DeltaUnit, current: number, prior: number): number | null {
  if (unit === "pts") return Math.round((current - prior) * 100);
  if (unit === "count") return Math.round(current - prior);
  return prior > 0 ? Math.round(((current - prior) / prior) * 100) : null;
}

// Build the four velocity cells: per-rep metric value → rank (higher is better) +
// team median; the caller's standing and prior-FY delta. `priorCallerAgg` is the
// caller's same-metric aggregate for fy-1 (null when unavailable).
export function buildVelocity(
  reps: { id: string; email: string }[],
  currentByEmail: Map<string, RepVelocityAgg>,
  priorCallerAgg: RepVelocityAgg | null,
  callerId: string,
): VelocityCell[] {
  return METRICS.map(({ key, label, format, deltaUnit, value }) => {
    const values = reps.map((r) => ({ id: r.id, email: r.email, value: value(currentByEmail.get(r.email) ?? ZERO) }));
    const ranking = rankReps(values);
    const standing = rankForRep(ranking, callerId);
    const teamMedian = median(values.map((v) => v.value));
    const delta =
      standing.inRoster && priorCallerAgg ? computeDelta(deltaUnit, standing.value, value(priorCallerAgg)) : null;
    return {
      metricKey: key,
      label,
      format,
      value: standing.value,
      delta,
      deltaUnit,
      teamMedian,
      rank: standing.rank,
      totalReps: ranking.totalReps,
      inRoster: standing.inRoster,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/lib/__tests__/velocity.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/velocity.ts src/features/home/lib/__tests__/velocity.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add buildVelocity metric/rank/delta builder"
```

---

## Task 3: `velocity-source.ts` (raw SQL)

SQL-bound; verified live (temp diagnostic) rather than unit-tested — same convention as `pipeline-source.ts`. Returns merged per-rep current-FY aggregates (opportunities won/lost/booking FULL-OUTER-JOINed with DOA take/rev) plus the caller's prior-FY aggregate.

**Files:**
- Create: `src/features/home/lib/velocity-source.ts`

- [ ] **Step 1: Write the implementation**

```ts
// Source-row fetching for the Velocity card. Per-rep current-FY aggregates
// (won/lost counts + won booking sum from opportunities, joined to DOA take/rev)
// for every rep, plus the caller's prior-FY aggregate for the deltas. SQL-bound, so
// verified live (temp diagnostic + :3020); the pure builder it feeds is unit-tested.
// Reuses stagePrefixSql so closed-won (6) / closed-lost (-1) bucketing matches the
// rest of the dashboard.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { stagePrefixSql } from "./trajectory-source";
import type { RepVelocityAgg } from "./velocity";

export interface RepVelocityRow extends RepVelocityAgg {
  email: string;
}

// Merged per-(rep,FY) aggregate. opportunities give won/closed counts + won
// booking sum; DOA gives take/rev. FULL OUTER JOIN so a rep present in only one
// source still appears. `emailFilter` scopes to one rep (prior-FY caller) or all.
function aggSql(sy: string, emailFilter: Prisma.Sql) {
  return Prisma.sql`
    SELECT COALESCE(o.email, d.email) AS email,
           COALESCE(o."wonCount", 0)::int AS "wonCount",
           COALESCE(o."closedCount", 0)::int AS "closedCount",
           COALESCE(o."wonBookingSum", 0)::float AS "wonBookingSum",
           COALESCE(d."takeSum", 0)::float AS "takeSum",
           COALESCE(d."revSum", 0)::float AS "revSum"
    FROM (
      SELECT sales_rep_email AS email,
             COUNT(*) FILTER (WHERE sp = 6) AS "wonCount",
             COUNT(*) FILTER (WHERE sp IN (6, -1)) AS "closedCount",
             COALESCE(SUM(net_booking_amount) FILTER (WHERE sp = 6), 0) AS "wonBookingSum"
      FROM (
        SELECT sales_rep_email, net_booking_amount,
               ${stagePrefixSql(Prisma.sql`stage`)} AS sp
        FROM opportunities
        WHERE school_yr = ${sy} ${emailFilter}
      ) x
      GROUP BY sales_rep_email
    ) o
    FULL OUTER JOIN (
      SELECT sales_rep_email AS email,
             SUM(completed_take + scheduled_take) AS "takeSum",
             SUM(completed_revenue + scheduled_revenue) AS "revSum"
      FROM district_opportunity_actuals
      WHERE school_yr = ${sy} ${emailFilter}
      GROUP BY sales_rep_email
    ) d ON d.email = o.email`;
}

export interface VelocityData {
  current: RepVelocityRow[];
  priorCaller: RepVelocityRow | null;
}

export async function fetchVelocity(
  sy: string,
  priorSy: string,
  callerEmail: string | null,
): Promise<VelocityData> {
  const current = await prisma.$queryRaw<RepVelocityRow[]>(aggSql(sy, Prisma.empty));
  const priorRows = callerEmail
    ? await prisma.$queryRaw<RepVelocityRow[]>(aggSql(priorSy, Prisma.sql`AND sales_rep_email = ${callerEmail}`))
    : [];
  return { current, priorCaller: priorRows[0] ?? null };
}
```

- [ ] **Step 2: Verify it compiles + runs against the live DB**

Create a temp diagnostic `scripts/_tmp-velocity-src.mjs` that inlines the same SQL for `sy='2025-26'`, run `node scripts/_tmp-velocity-src.mjs`, confirm it returns per-rep rows with sane `wonCount`/`closedCount`/`wonBookingSum`/`takeSum`/`revSum` (e.g. a rep with ~90 won, close rate < 1, deal size in the tens of thousands), then delete the script. Also run `npx tsc --noEmit 2>&1 | grep velocity-source || echo "tsc clean"`.
Expected: sane rows; tsc clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/lib/velocity-source.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add velocity-source SQL (per-rep FY aggregates)"
```

---

## Task 4: `velocity` route

**Files:**
- Create: `src/app/api/home/dashboard/velocity/route.ts`
- Test: `src/app/api/home/dashboard/velocity/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));
vi.mock("@/features/home/lib/velocity-source", () => ({ fetchVelocity: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { fetchVelocity } from "@/features/home/lib/velocity-source";

const mockGetUser = vi.mocked(getUser);
const mockGetActiveReps = vi.mocked(getActiveReps);
const mockFetch = vi.mocked(fetchVelocity);

function req(fy?: string): Request {
  return new Request(`http://localhost/api/home/dashboard/velocity${fy != null ? `?fy=${fy}` : ""}`);
}

describe("GET /api/home/dashboard/velocity", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req("2026"))).status).toBe(401);
  });

  it("rejects a non-numeric fy", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    expect((await GET(req("abc"))).status).toBe(400);
  });

  it("returns the four velocity cells for the caller", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    mockGetActiveReps.mockResolvedValue([
      { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
      { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
    ]);
    mockFetch.mockResolvedValue({
      current: [
        { email: "me@x", wonCount: 6, closedCount: 10, wonBookingSum: 600000, takeSum: 50000, revSum: 100000 },
        { email: "u2@x", wonCount: 9, closedCount: 10, wonBookingSum: 450000, takeSum: 30000, revSum: 100000 },
      ],
      priorCaller: { email: "me@x", wonCount: 5, closedCount: 10, wonBookingSum: 400000, takeSum: 40000, revSum: 100000 },
    });

    const res = await GET(req("2026"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.fy).toBe(2026);
    expect(body.cells.map((c: { metricKey: string }) => c.metricKey)).toEqual([
      "closeRate", "avgDealSize", "grossMargin", "dealsWon",
    ]);
    const closeRate = body.cells.find((c: { metricKey: string }) => c.metricKey === "closeRate");
    expect(closeRate.value).toBe(0.6);
    expect(closeRate.rank).toBe(2);
    expect(closeRate.delta).toBe(10); // 60% - 50%
    // fetchVelocity called with current + prior school years and the caller email
    expect(mockFetch).toHaveBeenCalledWith("2025-26", "2024-25", "me@x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/home/dashboard/velocity/__tests__/route.test.ts`
Expected: FAIL — cannot find module `../route`.

- [ ] **Step 3: Write the route**

```ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { buildVelocity, type RepVelocityAgg } from "@/features/home/lib/velocity";
import { fetchVelocity } from "@/features/home/lib/velocity-source";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/velocity?fy=2026
// The Velocity card: four ranked metrics (close rate, avg deal size, gross margin,
// deals won) for the calling rep, with prior-FY deltas + team median. One batched
// all-reps fetch; ranks/medians computed in JS.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fyParam = searchParams.get("fy");
  const fy = fyParam == null ? getCurrentFY() : Number(fyParam);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    return NextResponse.json({ error: "fy must be a fiscal-year number like 2026" }, { status: 400 });
  }

  const schoolYr = schoolYearForFY(fy);
  const priorSchoolYr = schoolYearForFY(fy - 1);
  const reps = await getActiveReps();
  const callerEmail = reps.find((r) => r.id === user.id)?.email ?? null;

  const { current, priorCaller } = await fetchVelocity(schoolYr, priorSchoolYr, callerEmail);
  const currentByEmail = new Map<string, RepVelocityAgg>(
    current.map((r) => [r.email, { wonCount: r.wonCount, closedCount: r.closedCount, wonBookingSum: r.wonBookingSum, takeSum: r.takeSum, revSum: r.revSum }]),
  );
  const priorCallerAgg: RepVelocityAgg | null = priorCaller
    ? { wonCount: priorCaller.wonCount, closedCount: priorCaller.closedCount, wonBookingSum: priorCaller.wonBookingSum, takeSum: priorCaller.takeSum, revSum: priorCaller.revSum }
    : null;

  const cells = buildVelocity(reps, currentByEmail, priorCallerAgg, user.id);
  return NextResponse.json({ fy, schoolYr, cells });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/home/dashboard/velocity/__tests__/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/home/dashboard/velocity/route.ts src/app/api/home/dashboard/velocity/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add velocity route"
```

---

## Task 5: `useVelocity` hook

**Files:**
- Modify: `src/features/home/lib/queries.ts`

- [ ] **Step 1: Add the type import and hook**

Add to the import block at the top of `queries.ts` (alongside the other `import type` lines):

```ts
import type { VelocityCell } from "./velocity";
```

Add at the end of the "Dashboard" section of `queries.ts` (after the `usePipeline` hook):

```ts
export interface VelocityResponse {
  fy: number;
  schoolYr: string;
  cells: VelocityCell[];
}

export function useVelocity(fy: number) {
  return useQuery({
    queryKey: ["dashboard", "velocity", fy],
    queryFn: () => fetchJson<VelocityResponse>(`${API_BASE}/home/dashboard/velocity?fy=${fy}`),
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "lib/queries" || echo "tsc clean"`
Expected: tsc clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/lib/queries.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add useVelocity query hook"
```

---

## Task 6: `VelocityCell` component

**Files:**
- Create: `src/features/home/components/dashboard/pipeline/VelocityCell.tsx`
- Test: `src/features/home/components/dashboard/pipeline/__tests__/VelocityCell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VelocityCell from "../VelocityCell";
import type { VelocityCell as Cell } from "@/features/home/lib/velocity";

const base: Cell = {
  metricKey: "closeRate", label: "Close rate", format: "percent",
  value: 0.24, delta: 5, deltaUnit: "pts", teamMedian: 0.19, rank: 4, totalReps: 12, inRoster: true,
};

describe("VelocityCell", () => {
  it("renders label, percent value, pts delta, and median/rank foot", () => {
    render(<VelocityCell cell={base} />);
    expect(screen.getByText("Close rate")).toBeInTheDocument();
    expect(screen.getByText("24%")).toBeInTheDocument();
    expect(screen.getByText("+5 pts")).toBeInTheDocument();
    expect(screen.getByText(/team median 19%/)).toBeInTheDocument();
    expect(screen.getByText(/#4\/12/)).toBeInTheDocument();
  });

  it("formats currency + percent-change delta", () => {
    render(<VelocityCell cell={{ ...base, metricKey: "avgDealSize", label: "Avg deal size", format: "currency", value: 48000, delta: 14, deltaUnit: "pct", teamMedian: 42000 }} />);
    expect(screen.getByText("$48K")).toBeInTheDocument();
    expect(screen.getByText("+14%")).toBeInTheDocument();
    expect(screen.getByText(/team median \$42K/)).toBeInTheDocument();
  });

  it("shows a dash and Not ranked when out of roster", () => {
    render(<VelocityCell cell={{ ...base, value: 0, delta: null, rank: 13, inRoster: false }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Not ranked")).toBeInTheDocument();
  });

  it("omits the delta chip when delta is null but the rep is ranked", () => {
    render(<VelocityCell cell={{ ...base, delta: null }} />);
    expect(screen.queryByText(/pts/)).toBeNull();
    expect(screen.getByText(/team median/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/components/dashboard/pipeline/__tests__/VelocityCell.test.tsx`
Expected: FAIL — cannot find module `../VelocityCell`.

- [ ] **Step 3: Write the component**

```tsx
"use client";

import { formatCurrency, formatNumber, formatPercent } from "@/features/shared/lib/format";
import { deltaColor } from "@/features/home/lib/delta";
import type { VelocityCell as Cell } from "@/features/home/lib/velocity";

const TOOLTIPS: Record<Cell["metricKey"], string> = {
  closeRate: "Share of your closed opportunities that were won (won ÷ won + lost) this year.",
  avgDealSize: "Average booking value of the deals you won this year.",
  grossMargin: "Your margin contribution — take divided by revenue on scheduled + delivered work.",
  dealsWon: "How many opportunities you closed-won this year.",
};

// Format a metric value in its own units. Percent metrics carry a fraction (0-1);
// gross margin shows one decimal, close rate none.
function fmt(cell: Pick<Cell, "format" | "metricKey">, v: number): string {
  if (cell.format === "currency") return formatCurrency(v, true);
  if (cell.format === "count") return formatNumber(v);
  return formatPercent(v, cell.metricKey === "grossMargin" ? 1 : 0);
}

function deltaText(delta: number, unit: Cell["deltaUnit"]): string {
  const sign = delta > 0 ? "+" : "";
  if (unit === "pts") return `${sign}${delta} pts`;
  if (unit === "pct") return `${sign}${delta}%`;
  return `${sign}${delta}`;
}

// One velocity metric: label + (i) tooltip, value, prior-FY delta chip, and a
// team-median + rank foot. Out-of-roster (admin) → "—" value + "Not ranked".
export default function VelocityCell({ cell }: { cell: Cell }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap"
        title={TOOLTIPS[cell.metricKey]}
      >
        <span>{cell.label}</span> <span aria-hidden="true" className="text-[#C2BBD4]">ⓘ</span>
      </span>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#403770] tabular-nums whitespace-nowrap">
          {cell.inRoster ? fmt(cell, cell.value) : "—"}
        </span>
        {cell.inRoster && cell.delta != null && (
          <span className="text-[11px] font-semibold tabular-nums whitespace-nowrap" style={{ color: deltaColor(cell.delta) }}>
            {deltaText(cell.delta, cell.deltaUnit)}
          </span>
        )}
      </div>

      <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">
        {cell.inRoster ? (
          <>team median {fmt(cell, cell.teamMedian)} · <span className="font-semibold text-[#5C5378]">#{cell.rank}/{cell.totalReps}</span></>
        ) : (
          "Not ranked"
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/components/dashboard/pipeline/__tests__/VelocityCell.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/pipeline/VelocityCell.tsx src/features/home/components/dashboard/pipeline/__tests__/VelocityCell.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add VelocityCell component"
```

---

## Task 7: `VelocityCard` + wire into the Pipeline tab

**Files:**
- Create: `src/features/home/components/dashboard/pipeline/VelocityCard.tsx`
- Test: `src/features/home/components/dashboard/pipeline/__tests__/VelocityCard.test.tsx`
- Modify: `src/features/home/components/dashboard/DashboardTab.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseVelocity = vi.fn();
vi.mock("@/features/home/lib/queries", () => ({ useVelocity: (fy: number) => mockUseVelocity(fy) }));

import VelocityCard from "../VelocityCard";

const cell = (over: Record<string, unknown>) => ({
  metricKey: "closeRate", label: "Close rate", format: "percent",
  value: 0.24, delta: 5, deltaUnit: "pts", teamMedian: 0.19, rank: 4, totalReps: 12, inRoster: true, ...over,
});

describe("VelocityCard", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders the header and one cell per metric", () => {
    mockUseVelocity.mockReturnValue({
      data: { fy: 2026, schoolYr: "2025-26", cells: [
        cell({ metricKey: "closeRate", label: "Close rate" }),
        cell({ metricKey: "avgDealSize", label: "Avg deal size", format: "currency", value: 48000, deltaUnit: "pct" }),
        cell({ metricKey: "grossMargin", label: "Gross margin", value: 0.345 }),
        cell({ metricKey: "dealsWon", label: "Deals won", format: "count", value: 90, deltaUnit: "count" }),
      ] },
      isLoading: false, isError: false,
    });
    render(<VelocityCard fy={2026} />);
    expect(screen.getByText("Velocity")).toBeInTheDocument();
    expect(screen.getByText("Close rate")).toBeInTheDocument();
    expect(screen.getByText("Avg deal size")).toBeInTheDocument();
    expect(screen.getByText("Gross margin")).toBeInTheDocument();
    expect(screen.getByText("Deals won")).toBeInTheDocument();
  });

  it("shows a loading skeleton", () => {
    mockUseVelocity.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<VelocityCard fy={2026} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows an error state with retry", () => {
    const refetch = vi.fn();
    mockUseVelocity.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<VelocityCard fy={2026} />);
    expect(screen.getByText(/Couldn't load/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/components/dashboard/pipeline/__tests__/VelocityCard.test.tsx`
Expected: FAIL — cannot find module `../VelocityCard`.

- [ ] **Step 3: Write the component**

```tsx
"use client";

import { useVelocity } from "@/features/home/lib/queries";
import VelocityCell from "./VelocityCell";

interface VelocityCardProps {
  fy: number;
}

// Velocity card at the top of the Pipeline tab: four ranked "how fast and how
// cleanly you're closing" metrics. Owns its own query so it mounts/unmounts with
// the tab.
export default function VelocityCard({ fy }: VelocityCardProps) {
  const { data, isLoading, isError, refetch } = useVelocity(fy);

  return (
    <div className="rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-[#403770] whitespace-nowrap">Velocity</h3>
        <p className="text-sm text-[#8A80A8]">How fast and how cleanly you&apos;re closing.</p>
      </div>

      {isError ? (
        <div className="text-center py-4">
          <p className="text-sm text-[#5C5378]">Couldn&apos;t load velocity metrics.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-[#F37167] hover:underline">
            Retry
          </button>
        </div>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-lg bg-[#F7F5FA] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
          {data.cells.map((c) => (
            <VelocityCell key={c.metricKey} cell={c} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/components/dashboard/pipeline/__tests__/VelocityCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into the Pipeline tab**

In `src/features/home/components/dashboard/DashboardTab.tsx`, add the import near the other component imports:

```tsx
import VelocityCard from "./pipeline/VelocityCard";
```

Then change the pipeline section so the card sits above `PipelineSection`. Replace:

```tsx
      {tab === "pipeline" && (
        <section aria-label="Pipeline">
          <PipelineSection fy={fy} />
        </section>
      )}
```

with:

```tsx
      {tab === "pipeline" && (
        <section aria-label="Pipeline" className="flex flex-col gap-8">
          <VelocityCard fy={fy} />
          <PipelineSection fy={fy} />
        </section>
      )}
```

- [ ] **Step 6: Full gate, then commit**

Run: `npx vitest run src/features/home src/app/api/home`
Expected: all green.
Run: `npx tsc --noEmit 2>&1 | grep -E "features/home|api/home/dashboard/velocity" || echo "tsc clean"`
Expected: tsc clean.

```bash
git add src/features/home/components/dashboard/pipeline/VelocityCard.tsx src/features/home/components/dashboard/pipeline/__tests__/VelocityCard.test.tsx src/features/home/components/dashboard/DashboardTab.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add VelocityCard to the top of the Pipeline tab"
```

---

## Done-check

- All `src/features/home` + `src/app/api/home` Vitest green; `tsc` clean on touched files.
- On :3020 (Home → Dashboard → Pipeline tab, FY26 for rich data; impersonate a rep since the admin is not ranked): the Velocity card shows four metrics with values, delta chips, and "team median · #rank". FY27 will look thin (few closes) — expected.
- Verify narrow-width: the 4-up grid drops to 2-up / 1-up; metric values + foot lines stay `whitespace-nowrap`.
