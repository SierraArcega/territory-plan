# Dashboard Rep Filter + Whole-Team View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any logged-in user point the Home → Dashboard tab at any rep, or at a whole-team aggregate, instead of always seeing only their own numbers.

**Architecture:** Introduce one shared `resolveScope()` helper that turns a `?rep=<id>` / `?rep=team` param into a `{ mode, rep?, emails }` value. Every dashboard route resolves scope identically and passes the scoped email-set to its source query; in rep mode the *subject* is the selected rep (which may not be the caller), in team mode the per-rep figures are summed and rank is dropped. A new `/api/reps` endpoint + `useActiveReps()` hook feed a names-only dropdown beside the FY pills; `DashboardTab` owns the selected scope and threads it into every card's query key.

**Tech Stack:** Next.js 16 App Router routes, Prisma + raw SQL, Vitest, TanStack Query, React 19.

**Spec:** `Docs/superpowers/specs/2026-06-03-dashboard-rep-filter-team-view-design.md`

**Working directory:** the `home-dashboard` worktree (`.claude/worktrees/home-dashboard`), branch `worktree-home-dashboard`.

**Commit identity (repo has none configured):** prefix every commit with
`git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit ...`. Plain messages — no Co-Authored-By / generated-with trailers.

**Staging discipline (shared worktree):** `git add` only the exact files each task lists. Never `git add -A`.

---

## Conventions used by every route below

- Auth gate unchanged: `const user = await getUser(); if (!user) return 401`.
- `fy` parsing unchanged.
- New: read `const repParam = searchParams.get("rep")`, then
  `const scope = resolveScope(repParam, reps, { id: user.id, email: user.email ?? "" });`
  `if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });`
- Responses gain a top-level `mode: scope.mode` so the client can switch rank UI off.

---

## File Structure

**Create:**
- `src/features/home/lib/scope.ts` — `DashboardScope` type + `resolveScope()`.
- `src/features/home/lib/__tests__/scope.test.ts` — unit tests.
- `src/app/api/reps/route.ts` — roster endpoint (`role='rep'`, names only).
- `src/app/api/reps/__tests__/route.test.ts` — endpoint test.
- `src/features/home/components/dashboard/RepScopeSelect.tsx` — the dropdown.
- `src/features/home/components/dashboard/__tests__/RepScopeSelect.test.tsx` — component test.

**Modify (backend):**
- `src/features/home/lib/topline.ts` — `buildToplineCards` team branch; `rank: number | null`.
- `src/features/home/lib/velocity.ts` — `buildVelocity` team branch; `rank: number | null`.
- `src/features/home/lib/velocity-source.ts` — `fetchVelocity` prior over an email-set.
- `src/features/home/lib/sparkline.ts` — `buildSparklines` team columns.
- `src/features/home/lib/pipeline.ts` — `buildCoverage`/`buildFunnel`/`buildTargetsRow` team handling.
- `src/features/home/lib/pipeline-source.ts` — `fetchPipelineData` scoped email-set.
- `src/features/home/lib/targets.ts` — team rollup helper.
- All six `src/app/api/home/dashboard/*/route.ts` + their `__tests__/route.test.ts`.

**Modify (frontend):**
- `src/features/home/lib/queries.ts` — six hooks gain a `repScope` arg; add `useActiveReps`.
- `src/features/home/components/dashboard/DashboardTab.tsx` — own `repScope`, render select, hide RankTrajectory in team mode.
- `src/features/home/components/dashboard/RankPill.tsx` (+ any rank-rendering card) — handle `rank === null` / team mode.

---

# Phase 0 — Foundation

## Task 0.1: `resolveScope` helper

**Files:**
- Create: `src/features/home/lib/scope.ts`
- Test: `src/features/home/lib/__tests__/scope.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/home/lib/__tests__/scope.test.ts
import { describe, it, expect } from "vitest";
import { resolveScope } from "../scope";

const reps = [
  { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
  { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
];
const caller = { id: "me", email: "me@x" };

describe("resolveScope", () => {
  it("defaults to the caller when rep param is absent", () => {
    expect(resolveScope(null, reps, caller)).toEqual({
      mode: "rep",
      rep: { id: "me", email: "me@x" },
      emails: ["me@x"],
    });
  });

  it("scopes to a specific other rep", () => {
    expect(resolveScope("u2", reps, caller)).toEqual({
      mode: "rep",
      rep: { id: "u2", email: "u2@x" },
      emails: ["u2@x"],
    });
  });

  it("returns team mode with every rep email", () => {
    expect(resolveScope("team", reps, caller)).toEqual({
      mode: "team",
      emails: ["me@x", "u2@x"],
    });
  });

  it("resolves the caller even when they are not in the rep roster (admin viewing self)", () => {
    const admin = { id: "boss", email: "boss@x" };
    expect(resolveScope(null, reps, admin)).toEqual({
      mode: "rep",
      rep: { id: "boss", email: "boss@x" },
      emails: ["boss@x"],
    });
  });

  it("returns null for an unknown rep id", () => {
    expect(resolveScope("ghost", reps, caller)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/home/lib/__tests__/scope.test.ts`
Expected: FAIL — `Cannot find module '../scope'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/home/lib/scope.ts
import type { ActiveRep } from "@/lib/reps";

// Resolved subject of a dashboard request: one rep (the caller by default, or any
// selected rep) or the whole-team aggregate. `emails` is the SQL filter set —
// a single email in rep mode, every active rep's in team mode.
export type DashboardScope =
  | { mode: "rep"; rep: { id: string; email: string }; emails: string[] }
  | { mode: "team"; emails: string[] };

// Maps `?rep=` to a scope. Absent → the caller (even if the caller is not in the
// rep roster, e.g. an admin viewing their own dashboard). "team" → every rep,
// summed. A non-caller id must be in the active roster; an unknown id → null
// (route returns 400).
export function resolveScope(
  repParam: string | null,
  reps: ActiveRep[],
  caller: { id: string; email: string },
): DashboardScope | null {
  if (repParam === "team") {
    return { mode: "team", emails: reps.map((r) => r.email) };
  }
  const targetId = repParam ?? caller.id;
  if (targetId === caller.id) {
    const email = reps.find((r) => r.id === caller.id)?.email ?? caller.email;
    return { mode: "rep", rep: { id: caller.id, email }, emails: [email] };
  }
  const found = reps.find((r) => r.id === targetId);
  if (!found) return null;
  return { mode: "rep", rep: { id: found.id, email: found.email }, emails: [found.email] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/home/lib/__tests__/scope.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/scope.ts src/features/home/lib/__tests__/scope.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): resolveScope helper for dashboard rep/team scoping"
```

---

## Task 0.2: `/api/reps` endpoint + `useActiveReps` hook

**Files:**
- Create: `src/app/api/reps/route.ts`
- Test: `src/app/api/reps/__tests__/route.test.ts`
- Modify: `src/features/home/lib/queries.ts`

- [ ] **Step 1: Write the failing endpoint test**

```ts
// src/app/api/reps/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";

const mockGetUser = vi.mocked(getUser);
const mockGetActiveReps = vi.mocked(getActiveReps);

describe("GET /api/reps", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns the active rep roster without emails", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    mockGetActiveReps.mockResolvedValue([
      { id: "u2", email: "u2@x", fullName: "Bob", avatarUrl: "a.png" },
      { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([
      { id: "u2", fullName: "Bob", avatarUrl: "a.png" },
      { id: "me", fullName: "Me", avatarUrl: null },
    ]);
    // emails must not leak to the client
    expect(JSON.stringify(body)).not.toContain("@x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/reps/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write the endpoint**

```ts
// src/app/api/reps/route.ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";

export const dynamic = "force-dynamic";

// GET /api/reps — the active rep roster (role='rep') the dashboard ranks against,
// for the rep-scope dropdown. Names + avatars only; never emails/PII (the client
// passes back the opaque id as `?rep=`).
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reps = await getActiveReps();
  return NextResponse.json(
    reps.map((r) => ({ id: r.id, fullName: r.fullName, avatarUrl: r.avatarUrl })),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/reps/__tests__/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the `useActiveReps` hook**

In `src/features/home/lib/queries.ts`, add near the other dashboard hooks:

```ts
export interface RepOption {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export function useActiveReps() {
  return useQuery({
    queryKey: ["reps"],
    queryFn: () => fetchJson<RepOption[]>(`${API_BASE}/reps`),
    staleTime: 60 * 60 * 1000, // roster rarely changes
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/reps/route.ts src/app/api/reps/__tests__/route.test.ts src/features/home/lib/queries.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): /api/reps roster endpoint + useActiveReps hook"
```

---

# Phase 1 — Backend scoping (per route)

Each route task: (a) teach the builder/source a team path, (b) wire the route through `resolveScope`, (c) extend the route test for the three cases (specific rep, team, default).

## Task 1.1: Topline route

**Files:**
- Modify: `src/features/home/lib/topline.ts`
- Modify: `src/app/api/home/dashboard/topline/route.ts`
- Test: `src/features/home/lib/__tests__/topline.test.ts` (create if absent), `src/app/api/home/dashboard/topline/__tests__/route.test.ts`

- [ ] **Step 1: Failing builder test — team mode sums values and drops rank**

Add to `src/features/home/lib/__tests__/topline.test.ts` (create the file with this if it doesn't exist; mirror the existing import of `buildToplineCards`):

```ts
import { describe, it, expect } from "vitest";
import { buildToplineCards } from "../topline";

const reps = [
  { id: "me", email: "me@x" },
  { id: "u2", email: "u2@x" },
];
const actuals = new Map([
  ["me@x", new Map([["2025-26", { totalRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0, weightedPipeline: 0, openPipeline: 100, bookings: 0, minPurchaseBookings: 0, invoiced: 0 }]])],
  ["u2@x", new Map([["2025-26", { totalRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0, weightedPipeline: 0, openPipeline: 300, bookings: 0, minPurchaseBookings: 0, invoiced: 0 }]])],
]);

describe("buildToplineCards team mode", () => {
  it("sums all reps and reports null rank", () => {
    const cards = buildToplineCards(reps, actuals as never, "2025-26", "me", [], null, "team");
    const openPipe = cards.find((c) => c.metricKey === "openPipeline")!;
    expect(openPipe.value).toBe(400); // 100 + 300
    expect(openPipe.rank).toBeNull();
    expect(openPipe.inRoster).toBe(true);
    expect(openPipe.totalReps).toBe(2);
  });

  it("rep mode is unchanged (caller value + rank)", () => {
    const cards = buildToplineCards(reps, actuals as never, "2025-26", "me", [], null, "rep");
    const openPipe = cards.find((c) => c.metricKey === "openPipeline")!;
    expect(openPipe.value).toBe(100);
    expect(openPipe.rank).toBe(2); // 300 > 100
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/features/home/lib/__tests__/topline.test.ts`
Expected: FAIL — `buildToplineCards` doesn't accept a 7th arg / `rank` not null.

- [ ] **Step 3: Add the team branch to `buildToplineCards`**

In `src/features/home/lib/topline.ts`: change `ToplineCard.rank` to `number | null`, and add a `mode` param.

```ts
export interface ToplineCard {
  metricKey: ToplineMetricKey;
  label: string;
  value: number;
  rank: number | null; // null in team mode
  totalReps: number;
  inRoster: boolean;
  segments: ToplineSegment[];
  pipelineDetail?: OpenPipelineDetail;
}

export function buildToplineCards(
  reps: { id: string; email: string }[],
  actualsByEmail: Map<string, Map<string, RepActuals>>,
  schoolYr: string,
  subjectId: string,
  subjectCategories: CategoryActuals[],
  openPipelineDetail: OpenPipelineDetail | null = null,
  mode: "rep" | "team" = "rep",
): ToplineCard[] {
  return METRICS.map(({ key, label, value, categoryValue }) => {
    const values = reps.map((r) => ({
      id: r.id,
      email: r.email,
      value: value(actualsByEmail.get(r.email)?.get(schoolYr) ?? ZERO),
    }));
    const ranking = rankReps(values);
    const headlineValue =
      mode === "team"
        ? values.reduce((s, v) => s + v.value, 0)
        : rankForRep(ranking, subjectId).value;
    const standing = rankForRep(ranking, subjectId);
    return {
      metricKey: key,
      label,
      value: headlineValue,
      rank: mode === "team" ? null : standing.rank,
      totalReps: ranking.totalReps,
      inRoster: mode === "team" ? true : standing.inRoster,
      segments: segmentsFor(subjectCategories, categoryValue),
      ...(key === "openPipeline" && openPipelineDetail ? { pipelineDetail: openPipelineDetail } : {}),
    };
  });
}
```

(Rename the `callerId`/`callerCategories` params to `subjectId`/`subjectCategories` for clarity — they are the selected rep in rep mode.)

- [ ] **Step 4: Run to verify builder tests pass**

Run: `npm test -- src/features/home/lib/__tests__/topline.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the route through `resolveScope`**

In `src/app/api/home/dashboard/topline/route.ts`:
- Add `import { resolveScope } from "@/features/home/lib/scope";`
- Replace the `callerEmail` block (lines ~29-30) and the two caller-scoped raw queries' `sales_rep_email = ${callerEmail}` / `o.sales_rep_email = ${callerEmail}` with the scope email-set, and pass `scope.mode` into the builder.

```ts
  const reps = await getActiveReps();
  const repParam = searchParams.get("rep");
  const scope = resolveScope(repParam, reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });
  const subjectId = scope.mode === "rep" ? scope.rep.id : user.id;

  const actualsByEmail = await getRepActualsBatch(reps.map((r) => r.email), [schoolYr]);

  // Subject-scoped per-category breakdown (one rep, or all reps in team mode).
  const subjectCategories: CategoryActuals[] = await prisma.$queryRaw<CategoryActuals[]>`
        SELECT category,
          COALESCE(SUM(open_pipeline), 0)::float AS "openPipeline",
          COALESCE(SUM(bookings), 0)::float AS "bookings",
          COALESCE(SUM(completed_take + scheduled_take), 0)::float AS "take",
          COALESCE(SUM(completed_revenue + scheduled_revenue), 0)::float AS "revenue"
        FROM district_opportunity_actuals
        WHERE sales_rep_email = ANY(${scope.emails}) AND school_yr = ${schoolYr}
        GROUP BY category
      `;

  const detailRows = await prisma.$queryRaw<{ minCommit: number; maxBudget: number; oppCount: number; accountCount: number }[]>`
        SELECT
          COALESCE(SUM(COALESCE(o.minimum_purchase_amount, 0)), 0)::float AS "minCommit",
          COALESCE(SUM(COALESCE(o.maximum_budget, 0)), 0)::float AS "maxBudget",
          COUNT(*)::int AS "oppCount",
          COUNT(DISTINCT o.district_name)::int AS "accountCount"
        FROM opportunities o
        WHERE o.sales_rep_email = ANY(${scope.emails})
          AND o.school_yr = ${schoolYr}
          AND o.net_booking_amount IS NOT NULL
          AND ${stagePrefixSql(Prisma.sql`o.stage`)} BETWEEN 0 AND 5
      `;
  const openPipelineDetail: OpenPipelineDetail | null = detailRows[0] ?? null;

  const cards = buildToplineCards(reps, actualsByEmail, schoolYr, subjectId, subjectCategories, openPipelineDetail, scope.mode);

  return NextResponse.json({ fy, schoolYr, mode: scope.mode, cards });
```

(The old `callerEmail ? … : []` guards are gone — `ANY(${scope.emails})` with a single-element array is identical to the old single-email filter, and team mode just widens it.)

- [ ] **Step 6: Extend the route test**

Add to `src/app/api/home/dashboard/topline/__tests__/route.test.ts` (mirror existing mocks; the route uses `prisma.$queryRaw`, so ensure the existing mock for `@/lib/prisma` returns `[]` for the raw queries — reuse whatever the current test already mocks). Add cases:

```ts
  it("rep=team sums and returns mode 'team' with null rank", async () => {
    // …existing happy-path mock setup for getUser/getActiveReps/getRepActualsBatch…
    const res = await GET(new Request("http://localhost/api/home/dashboard/topline?fy=2026&rep=team"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mode).toBe("team");
    expect(body.cards.every((c: { rank: number | null }) => c.rank === null)).toBe(true);
  });

  it("rejects an unknown rep id", async () => {
    // …getUser + getActiveReps mocked with a roster that excludes "ghost"…
    const res = await GET(new Request("http://localhost/api/home/dashboard/topline?fy=2026&rep=ghost"));
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 7: Run all topline tests**

Run: `npm test -- topline`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/home/lib/topline.ts src/features/home/lib/__tests__/topline.test.ts src/app/api/home/dashboard/topline/route.ts src/app/api/home/dashboard/topline/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): topline route honors rep/team scope"
```

---

## Task 1.2: Velocity route

**Files:**
- Modify: `src/features/home/lib/velocity.ts`, `src/features/home/lib/velocity-source.ts`
- Modify: `src/app/api/home/dashboard/velocity/route.ts`
- Test: `src/features/home/lib/__tests__/velocity.test.ts`, `src/app/api/home/dashboard/velocity/__tests__/route.test.ts`

- [ ] **Step 1: Failing builder test — team mode pools aggregates, drops rank**

Add to `src/features/home/lib/__tests__/velocity.test.ts`:

```ts
import { buildVelocityTeam } from "../velocity";

describe("buildVelocityTeam", () => {
  it("pools raw aggregates and recomputes rates with null rank", () => {
    const pooled = { wonCount: 15, closedCount: 20, wonBookingSum: 1_050_000, takeSum: 80_000, revSum: 200_000 };
    const cells = buildVelocityTeam(pooled, null);
    const closeRate = cells.find((c) => c.metricKey === "closeRate")!;
    expect(closeRate.value).toBe(0.75); // 15/20 over the pool, NOT an average of rates
    expect(closeRate.rank).toBeNull();
    const avg = cells.find((c) => c.metricKey === "avgDealSize")!;
    expect(avg.value).toBe(70_000); // 1,050,000 / 15
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/features/home/lib/__tests__/velocity.test.ts`
Expected: FAIL — `buildVelocityTeam` is not exported.

- [ ] **Step 3: Add `buildVelocityTeam` + `rank: number | null`**

In `src/features/home/lib/velocity.ts`: change `VelocityCell.rank` to `number | null`, and add:

```ts
// Team-aggregate velocity: pool the roster's raw aggregates (already summed by the
// route) and recompute each metric over the pool — never average per-rep rates.
// No rank/median (team has no peers). `priorTeamAgg` is the same pool for fy-1.
export function buildVelocityTeam(
  pooled: RepVelocityAgg,
  priorTeamAgg: RepVelocityAgg | null,
): VelocityCell[] {
  return METRICS.map(({ key, label, format, deltaUnit, value }) => ({
    metricKey: key,
    label,
    format,
    value: value(pooled),
    delta: priorTeamAgg ? computeDelta(deltaUnit, value(pooled), value(priorTeamAgg)) : null,
    deltaUnit,
    teamMedian: 0,
    rank: null,
    totalReps: 0,
    inRoster: true,
  }));
}
```

- [ ] **Step 4: Run to verify builder tests pass**

Run: `npm test -- src/features/home/lib/__tests__/velocity.test.ts`
Expected: PASS.

- [ ] **Step 5: Teach `fetchVelocity` to fetch the prior over an email-set**

In `src/features/home/lib/velocity-source.ts`, change the caller-only prior fetch to scope over `priorEmails: string[]` (rep mode = `[email]`, team mode = all):

```ts
export async function fetchVelocity(
  sy: string,
  priorSy: string,
  priorEmails: string[],
): Promise<VelocityData> {
  const current = await prisma.$queryRaw<RepVelocityRow[]>(aggSql(sy, Prisma.empty));
  const priorRows =
    priorEmails.length > 0
      ? await prisma.$queryRaw<RepVelocityRow[]>(aggSql(priorSy, Prisma.sql`AND sales_rep_email = ANY(${priorEmails})`))
      : [];
  return { current, priorCaller: priorRows[0] ?? null, priorRows };
}
```

Add `priorRows: RepVelocityRow[]` to the `VelocityData` interface (the route sums it in team mode).

- [ ] **Step 6: Wire the route**

In `src/app/api/home/dashboard/velocity/route.ts`:

```ts
  import { resolveScope } from "@/features/home/lib/scope";
  import { buildVelocity, buildVelocityTeam, type RepVelocityAgg } from "@/features/home/lib/velocity";
  // …
  const reps = await getActiveReps();
  const repParam = searchParams.get("rep");
  const scope = resolveScope(repParam, reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });

  const { current, priorCaller, priorRows } = await fetchVelocity(schoolYr, priorSchoolYr, scope.emails);
  const currentByEmail = new Map<string, RepVelocityAgg>(
    current.map((r) => [r.email, { wonCount: r.wonCount, closedCount: r.closedCount, wonBookingSum: r.wonBookingSum, takeSum: r.takeSum, revSum: r.revSum }]),
  );

  let cells;
  if (scope.mode === "team") {
    const sum = (pick: (a: RepVelocityAgg) => number) => current.reduce((s, r) => s + pick(r), 0);
    const pooled: RepVelocityAgg = {
      wonCount: sum((a) => a.wonCount), closedCount: sum((a) => a.closedCount),
      wonBookingSum: sum((a) => a.wonBookingSum), takeSum: sum((a) => a.takeSum), revSum: sum((a) => a.revSum),
    };
    const priorPooled: RepVelocityAgg | null = priorRows.length
      ? {
          wonCount: priorRows.reduce((s, r) => s + r.wonCount, 0),
          closedCount: priorRows.reduce((s, r) => s + r.closedCount, 0),
          wonBookingSum: priorRows.reduce((s, r) => s + r.wonBookingSum, 0),
          takeSum: priorRows.reduce((s, r) => s + r.takeSum, 0),
          revSum: priorRows.reduce((s, r) => s + r.revSum, 0),
        }
      : null;
    cells = buildVelocityTeam(pooled, priorPooled);
  } else {
    const priorAgg: RepVelocityAgg | null = priorCaller
      ? { wonCount: priorCaller.wonCount, closedCount: priorCaller.closedCount, wonBookingSum: priorCaller.wonBookingSum, takeSum: priorCaller.takeSum, revSum: priorCaller.revSum }
      : null;
    cells = buildVelocity(reps, currentByEmail, priorAgg, scope.rep.id);
  }
  return NextResponse.json({ fy, schoolYr, mode: scope.mode, cells });
```

- [ ] **Step 7: Update the existing route test**

The existing test asserts `mockFetch).toHaveBeenCalledWith("2025-26", "2024-25", "me@x")`. Change to `["me@x"]` and add team + unknown-rep cases:

```ts
    expect(mockFetch).toHaveBeenCalledWith("2025-26", "2024-25", ["me@x"]);
```

```ts
  it("rep=team pools and returns null ranks", async () => {
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
      priorCaller: null,
      priorRows: [],
    });
    const res = await GET(new Request("http://localhost/api/home/dashboard/velocity?fy=2026&rep=team"));
    const body = await res.json();
    expect(body.mode).toBe("team");
    const closeRate = body.cells.find((c: { metricKey: string }) => c.metricKey === "closeRate");
    expect(closeRate.value).toBe(0.75); // 15 won / 20 closed pooled
    expect(closeRate.rank).toBeNull();
  });
```

(Update the existing happy-path mock's `mockResolvedValue` to include `priorRows: []` so the shape matches the new `VelocityData`.)

- [ ] **Step 8: Run all velocity tests**

Run: `npm test -- velocity`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/home/lib/velocity.ts src/features/home/lib/velocity-source.ts src/features/home/lib/__tests__/velocity.test.ts src/app/api/home/dashboard/velocity/route.ts src/app/api/home/dashboard/velocity/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): velocity route honors rep/team scope"
```

---

## Task 1.3: Targets route

**Files:**
- Modify: `src/app/api/home/dashboard/targets/route.ts`
- Test: `src/app/api/home/dashboard/targets/__tests__/route.test.ts`

The targets route already builds a per-rep `rollups` map and a `targetsByRep`-style ranking. The team aggregate = sum every rep's rollup; the sub-counts (`convertedToPipeline`, `pipelineOnAccounts`, `active90`) come from caller-scoped queries that we widen to `ANY(scope.emails)`.

- [ ] **Step 1: Failing route test — team sums worked counts, null rank**

Add to `src/app/api/home/dashboard/targets/__tests__/route.test.ts` (mirror existing mocks for `getUser`, `getActiveReps`, `prisma`). Assert that with two reps each working districts, `rep=team` returns `card.value` = the summed worked count, `card.rank === null`, and `body.mode === "team"`. (Use the same prisma `territoryPlanDistrict.findMany` fixture the current happy-path test uses, extended with a second owner.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/app/api/home/dashboard/targets/__tests__/route.test.ts`
Expected: FAIL — route has no `rep`/`mode` handling yet.

- [ ] **Step 3: Wire the route**

In `src/app/api/home/dashboard/targets/route.ts`:
- Add `import { resolveScope } from "@/features/home/lib/scope";`.
- After `const reps = await getActiveReps();` resolve scope:

```ts
  const repParam = searchParams.get("rep");
  const scope = resolveScope(repParam, reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });
  const subjectId = scope.mode === "rep" ? scope.rep.id : user.id;
```

- Keep `ownerIds`/`planDistrictRows`/`rollups` as-is (still need every rep's plans for ranking + team sum), but **include all scope reps' plans** (already covered since `ownerIds` includes the full roster).
- Replace the headline/rank block:

```ts
  const ranking = rankReps(
    reps.map((r) => ({ id: r.id, email: r.email, value: rollups.get(r.id)?.targetDollars ?? 0 })),
  );

  let workedCount: number, segments: { new: number; winback: number; expansion: number };
  let untargeted: number, targetTotal: number, workedLeaids: string[];
  let rank: number | null, inRoster: boolean;

  if (scope.mode === "team") {
    const all = [...rollups.values()];
    workedCount = all.reduce((s, r) => s + r.workedCount, 0);
    untargeted = all.reduce((s, r) => s + r.untargetedCount, 0);
    targetTotal = all.reduce((s, r) => s + r.targetDollarsAll, 0);
    segments = {
      new: all.reduce((s, r) => s + r.segments.new, 0),
      winback: all.reduce((s, r) => s + r.segments.winback, 0),
      expansion: all.reduce((s, r) => s + r.segments.expansion, 0),
    };
    workedLeaids = rows.map((r) => r.leaid); // every worked district across the roster
    rank = null;
    inRoster = true;
  } else {
    const subjectRollup = rollups.get(subjectId) ?? {
      workedCount: 0, untargetedCount: 0, targetDollars: 0, targetDollarsAll: 0,
      segments: { new: 0, winback: 0, expansion: 0 },
    };
    const standing = rankForRep(ranking, subjectId);
    workedCount = subjectRollup.workedCount;
    untargeted = subjectRollup.untargetedCount;
    targetTotal = subjectRollup.targetDollarsAll;
    segments = subjectRollup.segments;
    workedLeaids = workedLeaidsForRep(rows, subjectId);
    rank = standing.rank;
    inRoster = standing.inRoster;
  }
```

- Change the two caller-scoped sub-count queries from `sales_rep_email = ${callerEmail}` to `sales_rep_email = ANY(${scope.emails})`, and the `active90` activity filter from `createdByUserId: user.id` to `createdByUserId: { in: scope.mode === "team" ? reps.map((r) => r.id).concat(user.id) : [subjectId] }`. (Distinct-by-district still de-dupes.)
- Build the response card from the resolved locals, adding `mode: scope.mode`, `rank`, `inRoster`, `totalReps: ranking.totalReps`, `stale: workedCount - active90`.

- [ ] **Step 4: Run all targets tests**

Run: `npm test -- targets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/home/dashboard/targets/route.ts src/app/api/home/dashboard/targets/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): targets route honors rep/team scope"
```

> Note: `TargetsCardData.rank` (in `queries.ts`) becomes `number | null` — handled in Phase 2 Task 2.4.

---

## Task 1.4: Sparklines route

**Files:**
- Modify: `src/features/home/lib/sparkline.ts`
- Modify: `src/app/api/home/dashboard/sparklines/route.ts`
- Test: `src/features/home/lib/__tests__/sparkline.test.ts`, `src/app/api/home/dashboard/sparklines/__tests__/route.test.ts`

`buildSparklines` reads one email's columns via `callerColumns`. Team mode sums every rep's columns element-wise.

- [ ] **Step 1: Failing builder test — team columns sum element-wise**

Add to `src/features/home/lib/__tests__/sparkline.test.ts` a test that calls `buildSparklines` with `scope: "team"` over two reps' `DatedValueRow[]` and asserts the resulting `current` array equals the element-wise sum. (Construct minimal rows for one metric, e.g. `openPipeline`, using the existing `DatedValueRow` shape the file already imports.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/features/home/lib/__tests__/sparkline.test.ts`
Expected: FAIL — `buildSparklines` has no team/scope path.

- [ ] **Step 3: Add a team column path**

In `src/features/home/lib/sparkline.ts`, add a team summer and a `scope` param:

```ts
function teamColumns(rows: DatedValueRow[], fy: number): number[] {
  const byEmail = cumulativeColumns(rows, fy);
  const out = new Array(COLUMN_COUNT).fill(0);
  for (const cols of byEmail.values()) for (let i = 0; i < COLUMN_COUNT; i++) out[i] += cols[i] ?? 0;
  return out;
}

export function buildSparklines(params: {
  currentRows: Record<string, DatedValueRow[]>;
  priorRows: Record<string, DatedValueRow[]>;
  email: string;
  fy: number;
  now?: Date;
  scope?: "rep" | "team"; // default "rep"
}): Record<SparklineMetricKey, Sparkline> {
  const { currentRows, priorRows, email, fy, now, scope = "rep" } = params;
  const pick = (rows: DatedValueRow[], forFy: number) =>
    scope === "team" ? teamColumns(rows, forFy) : callerColumns(rows, forFy, email);
  // …unchanged todayIdx / isFuture…
  for (const { metricKey } of SPARKLINE_METRICS) {
    const current = pick(currentRows[metricKey] ?? [], fy);
    const prior = pick(priorRows[metricKey] ?? [], fy - 1);
    // …unchanged out[...] assignment…
  }
  return out;
}
```

(Import `COLUMN_COUNT` and `cumulativeColumns` — they're already imported for `callerColumns`.)

- [ ] **Step 4: Run to verify builder tests pass**

Run: `npm test -- src/features/home/lib/__tests__/sparkline.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the route**

In `src/app/api/home/dashboard/sparklines/route.ts`:
- Resolve scope (needs `getActiveReps`, which this route doesn't import yet — add it).
- In team mode, fetch trajectory rows for **all reps** (omit the email arg → `fetchTrajectoryRows(sy, fy)`); in rep mode pass `scope.rep.email`.
- WoW: team mode sums every rep's snapshot; rep mode uses `subject`'s snapshots. `fetchWowSnapshots(salesRepId, sy)` takes a single id — for team, loop the roster and concat, or widen the helper. Minimal: in team mode call `fetchWowSnapshots` per rep and concat (roster is ~tens). For rep mode pass `scope.rep.id`.

```ts
  import { getActiveReps } from "@/lib/reps";
  import { resolveScope } from "@/features/home/lib/scope";
  // …
  const reps = await getActiveReps();
  const scope = resolveScope(searchParams.get("rep"), reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });
  const subjectEmail = scope.mode === "rep" ? scope.rep.email : undefined;

  const [currentRows, priorRows] = await Promise.all([
    fetchTrajectoryRows(schoolYr, fy, subjectEmail),
    fetchTrajectoryRows(schoolYearForFY(fy - 1), fy - 1, subjectEmail),
  ]);
  const sparklines = buildSparklines({ currentRows, priorRows, email: subjectEmail ?? "", fy, scope: scope.mode });

  let wow: WowDeltas = { openPipeline: null, bookings: null };
  if (fy === getCurrentFY()) {
    if (scope.mode === "team") {
      const snaps = (await Promise.all(reps.map((r) => fetchWowSnapshots(r.id, schoolYr)))).flat();
      wow = buildWowDeltas(snaps);
    } else {
      wow = buildWowDeltas(await fetchWowSnapshots(scope.rep.id, schoolYr));
    }
  }
  return NextResponse.json({ fy, schoolYr, mode: scope.mode, sparklines, wow });
```

> Verify `buildWowDeltas` sums correctly when given multiple reps' snapshot rows for the same metric/week. Read `wow.ts` (`buildWowDeltas`, ~line 20): if it assumes one row per metric, add a pre-sum-by-metric step in the team branch instead of concatenating raw rows. Adjust the team branch to match.

- [ ] **Step 6: Extend the route test**

Add team + unknown-rep + default cases mirroring Task 1.1 Step 6 (the route now imports `getActiveReps`, so add `vi.mock("@/lib/reps", …)`).

- [ ] **Step 7: Run all sparklines tests**

Run: `npm test -- sparkline`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/home/lib/sparkline.ts src/features/home/lib/__tests__/sparkline.test.ts src/app/api/home/dashboard/sparklines/route.ts src/app/api/home/dashboard/sparklines/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): sparklines route honors rep/team scope"
```

---

## Task 1.5: Pipeline route

**Files:**
- Modify: `src/features/home/lib/pipeline.ts`, `src/features/home/lib/pipeline-source.ts`
- Modify: `src/app/api/home/dashboard/pipeline/route.ts`
- Test: `src/features/home/lib/__tests__/pipeline.test.ts`, `src/app/api/home/dashboard/pipeline/__tests__/route.test.ts`

`fetchPipelineData` scopes `wonBookings`/`fyTarget`/`thisWeek` to `callerEmail`; `openOpps` + `targetsByRep` are already all-rep. The route filters `callerOpps` by `callerEmail`. Team mode: scope those to `ANY(emails)`, and make coverage/funnel/targets-row aggregate the whole set.

- [ ] **Step 1: Failing builder tests**

Add to `src/features/home/lib/__tests__/pipeline.test.ts`:
- `buildCoverage` already sums whatever opps it's handed — in team mode the route passes **all** reps' opps, so no builder change needed; add a test asserting `buildCoverage(allOpps, teamWon, teamTarget)` sums across reps (documents the contract).
- `buildFunnel` ranks the caller vs team via `callerId`. Add a `buildFunnelTeam(teamOpps, source)` that reports the team totals as the headline (count/min/max = team totals, `sharePct` = 100, `rank` = null). Test it returns team-summed stage mins and `rank: null`.

```ts
import { buildFunnelTeam } from "../pipeline";
// …construct two reps' OpenOppRow[]…
it("buildFunnelTeam reports team totals with null rank", () => {
  const data = buildFunnelTeam(opps, "all");
  expect(data.rank).toBeNull();
  // headline min == team min for each stage
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/features/home/lib/__tests__/pipeline.test.ts`
Expected: FAIL — `buildFunnelTeam` not exported / `FunnelData.rank` not nullable.

- [ ] **Step 3: Add `buildFunnelTeam` + nullable rank + team targets row**

In `src/features/home/lib/pipeline.ts`:
- Change `FunnelData.rank` (and any `FunnelStage.sharePct` consumer) to allow the team case: make `rank: number | null`.
- Add:

```ts
// Whole-team funnel: the team IS the subject, so each stage's headline = the team
// total and share is trivially 100%. No rank. Source scoping matches buildFunnel.
export function buildFunnelTeam(teamOpps: OpenOppRow[], source: SegmentKey | "all"): Omit<FunnelData, "targets"> {
  const scoped = source === "all" ? teamOpps : teamOpps.filter((o) => sourceOf(o) === source);
  const stages: FunnelStage[] = PIPELINE_STAGES.map(({ prefix, name }) => {
    const inStage = scoped.filter((o) => o.stagePrefix === prefix);
    const min = inStage.reduce((s, o) => s + o.minPurchase, 0);
    return { prefix, name, count: inStage.length, min, max: inStage.reduce((s, o) => s + o.maxBudget, 0), teamMin: min, sharePct: 100 };
  });
  const sources: SourceShare[] = SEGMENT_DEFS.map((d) => {
    const team = scoped.filter((o) => sourceOf(o) === d.key).reduce((s, o) => s + o.minPurchase, 0);
    return { key: d.key, label: d.label, color: d.color, you: team, team, pct: team > 0 ? 100 : 0 };
  });
  return {
    stages,
    totalMin: stages.reduce((s, x) => s + x.min, 0),
    totalMax: stages.reduce((s, x) => s + x.max, 0),
    teamMinTotal: stages.reduce((s, x) => s + x.teamMin, 0),
    rank: null,
    sources,
  };
}
```

(Match the exact `FunnelData` field names returned by the existing `buildFunnel` — read its `return { … }` block at the tail of the function and replicate every key.)

- Add a team targets row:

```ts
export function buildTargetsRowTeam(byRep: TargetRepAgg[]): TargetsRow {
  const teamValue = byRep.reduce((s, r) => s + r.value, 0);
  return { count: byRep.reduce((s, r) => s + r.count, 0), value: teamValue, teamValue, sharePct: teamValue > 0 ? 100 : 0 };
}
```

- [ ] **Step 4: Scope `fetchPipelineData` to an email-set**

In `src/features/home/lib/pipeline-source.ts`, change the signature to `fetchPipelineData(sy, fy, scopeEmails: string[])` and replace the three `o.sales_rep_email = ${callerEmail}` / `u.email = ${callerEmail}` filters with `= ANY(${scopeEmails})`. `openOpps` and `targetsByRep` stay all-rep (no change). Update the doc comment.

- [ ] **Step 5: Wire the route**

In `src/app/api/home/dashboard/pipeline/route.ts`:

```ts
  import { resolveScope } from "@/features/home/lib/scope";
  import { buildFunnel, buildFunnelTeam, buildTargetsRow, buildTargetsRowTeam, buildCoverage, buildOppViews } from "@/features/home/lib/pipeline";
  // …
  const reps = await getActiveReps();
  const scope = resolveScope(searchParams.get("rep"), reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });

  const { openOpps, wonBookings, fyTarget, thisWeek, targetsByRep } = await fetchPipelineData(schoolYr, fy, scope.emails);

  const inScope = (o: { email: string }) => scope.emails.includes(o.email);
  const subjectOpps = openOpps.filter(inScope);

  const funnel =
    scope.mode === "team"
      ? { ...buildFunnelTeam(openOpps, "all"), targets: buildTargetsRowTeam(targetsByRep) }
      : { ...buildFunnel(openOpps, reps, scope.rep.id, "all"), targets: buildTargetsRow(targetsByRep, scope.rep.email) };

  const coverage = buildCoverage(subjectOpps, wonBookings, fyTarget);
  const views = buildOppViews(subjectOpps);
  const opps = views.slice(0, 50);
  const atRisk = views.filter((o) => o.health !== "on");
  const inRoster = scope.mode === "team" ? true : reps.some((r) => r.id === scope.rep.id);

  return NextResponse.json({
    fy, schoolYr, mode: scope.mode, inRoster,
    coverage: { ...coverage, wonBookings, fyTarget },
    funnel, opps, atRisk,
    thisWeek: fy === getCurrentFY() ? thisWeek : null,
  });
```

- [ ] **Step 6: Extend the route test**

Add team + unknown-rep cases. The existing test mocks `fetchPipelineData`; assert it is now called with an **array** (`["me@x"]` for default, the full roster for team) and that `body.mode` / null-rank funnel are correct.

- [ ] **Step 7: Run all pipeline tests**

Run: `npm test -- pipeline`
Expected: PASS. (Note the two uncommitted staleness-related edits to `pipeline.ts`/`pipeline-source.ts`/`AtRiskCard`/`TopOpportunitiesTable` already in the tree — leave them; do not stage them in this task.)

- [ ] **Step 8: Commit**

```bash
git add src/features/home/lib/pipeline.ts src/features/home/lib/pipeline-source.ts src/features/home/lib/__tests__/pipeline.test.ts src/app/api/home/dashboard/pipeline/route.ts src/app/api/home/dashboard/pipeline/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): pipeline route honors rep/team scope"
```

> ⚠️ `pipeline.ts` and `pipeline-source.ts` have unrelated uncommitted edits. Stage them with `git add -p` if needed to avoid committing the staleness WIP, OR coordinate with whoever owns that change. Do not bundle unrelated hunks.

---

## Task 1.6: Rank-trajectory route (rep-scoped; no team)

**Files:**
- Modify: `src/app/api/home/dashboard/rank-trajectory/route.ts`
- Test: `src/app/api/home/dashboard/rank-trajectory/__tests__/route.test.ts`

Rank trajectory is per-rep (rank over time). Selecting a specific rep shows **their** trajectory; team mode hides the card (the client disables the query), so the route only needs the `rep=<id>` path and a harmless `team` short-circuit.

- [ ] **Step 1: Failing route test — rep param drives the subject; team returns mode:'team'**

Add to the existing test: with `rep=u2`, assert `buildRankTrajectoryPayload` is invoked with `callerId: "u2"` (spy/mocked) or that the returned payload's subject series matches u2. Add a `rep=team` case asserting `res.status === 200` and `body.mode === "team"`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- rank-trajectory`
Expected: FAIL.

- [ ] **Step 3: Wire the route**

```ts
  import { resolveScope } from "@/features/home/lib/scope";
  // …
  const reps = await getActiveReps();
  const scope = resolveScope(searchParams.get("rep"), reps, { id: user.id, email: user.email ?? "" });
  if (!scope) return NextResponse.json({ error: "unknown rep" }, { status: 400 });
  if (scope.mode === "team") {
    return NextResponse.json({ mode: "team", series: [] }); // card hidden client-side in team mode
  }

  const rowsByMetric = await fetchTrajectoryRows(schoolYr, fy);
  const payload = buildRankTrajectoryPayload({ rowsByMetric, fy, reps, callerId: scope.rep.id });
  return NextResponse.json({ ...payload, mode: "rep" });
```

(Confirm `RankTrajectoryPayload` shape — spread is safe; adding `mode` is additive.)

- [ ] **Step 4: Run all rank-trajectory tests**

Run: `npm test -- rank-trajectory`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/home/dashboard/rank-trajectory/route.ts src/app/api/home/dashboard/rank-trajectory/__tests__/route.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): rank-trajectory route honors rep scope (team hides card)"
```

---

# Phase 2 — Frontend

## Task 2.1: Query hooks accept `repScope`

**Files:**
- Modify: `src/features/home/lib/queries.ts`

- [ ] **Step 1: Thread `repScope` into the six hooks**

For each of `useTopline`, `useTargets`, `useRankTrajectory`, `useSparklines`, `usePipeline`, `useVelocity`: add a `repScope: string` param (a rep id or `"team"`), append `&rep=${repScope}` to the URL, add `repScope` to the query key, and add `mode?: "rep" | "team"` to the response interfaces. Make `rank` nullable where present. `useRankTrajectory` additionally gets `enabled: repScope !== "team"`.

```ts
export function useTopline(fy: number, repScope: string) {
  return useQuery({
    queryKey: ["dashboard", "topline", fy, repScope],
    queryFn: () => fetchJson<ToplineResponse>(`${API_BASE}/home/dashboard/topline?fy=${fy}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
  });
}
// …same shape for useTargets/useSparklines/usePipeline/useVelocity…

export function useRankTrajectory(fy: number, repScope: string) {
  return useQuery({
    queryKey: ["dashboard", "rankTrajectory", fy, repScope],
    queryFn: () => fetchJson<RankTrajectoryPayload>(`${API_BASE}/home/dashboard/rank-trajectory?fy=${fy}&rep=${repScope}`),
    staleTime: 5 * 60 * 1000,
    enabled: repScope !== "team",
  });
}
```

Add `mode?: "rep" | "team";` to `ToplineResponse`, `TargetsResponse`, `PipelineResponse`, `VelocityResponse`, `SparklinesResponse`; change `TargetsCardData.rank` to `number | null`.

- [ ] **Step 2: Verify it compiles (consumers updated in 2.3)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in the card components that call these hooks without the new arg — fixed in Task 2.3. Note them; don't fix here.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/lib/queries.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): dashboard query hooks accept repScope"
```

---

## Task 2.2: `RepScopeSelect` component

**Files:**
- Create: `src/features/home/components/dashboard/RepScopeSelect.tsx`
- Test: `src/features/home/components/dashboard/__tests__/RepScopeSelect.test.tsx`

Controlled dropdown: `value` / `onChange` owned by `DashboardTab`. Options = **Whole team** + roster (names only), with the current user ensured present (admins aren't in the rep roster). Default-to-self handled by the parent's initial state (Task 2.3), but the select renders a disabled placeholder while the roster loads.

- [ ] **Step 1: Failing component test**

```tsx
// src/features/home/components/dashboard/__tests__/RepScopeSelect.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RepScopeSelect from "../RepScopeSelect";

vi.mock("@/features/home/lib/queries", () => ({
  useActiveReps: () => ({
    data: [
      { id: "me", fullName: "Me", avatarUrl: null },
      { id: "u2", fullName: "Bob", avatarUrl: null },
    ],
    isLoading: false,
  }),
}));

describe("RepScopeSelect", () => {
  it("renders Whole team + each rep, value controlled", () => {
    render(<RepScopeSelect value="me" onChange={() => {}} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["Whole team", "Me", "Bob"]);
    expect(select.value).toBe("me");
  });
});
```

Add a second test (separate `vi.mock` override, or a second describe block) asserting that when `useActiveReps` returns `{ data: undefined, isLoading: true }`, the combobox is disabled (`expect(screen.getByRole("combobox")).toBeDisabled()`).

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- RepScopeSelect`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/features/home/components/dashboard/RepScopeSelect.tsx
"use client";

import { useActiveReps } from "@/features/home/lib/queries";

interface Props {
  value: string; // rep id or "team"
  onChange: (next: string) => void;
}

// Scope picker for the dashboard: "Whole team" + every active rep (names only).
// Controlled by DashboardTab. Renders disabled while the roster loads (no layout
// shift). Brand-styled to match the FY pills.
export default function RepScopeSelect({ value, onChange }: Props) {
  const { data: reps, isLoading } = useActiveReps();

  return (
    <select
      aria-label="Rep"
      value={value}
      disabled={isLoading}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-[#D4CFE2] bg-white px-3 py-1 text-sm font-medium text-[#5C5378] whitespace-nowrap hover:bg-[#EFEDF5] disabled:opacity-60"
    >
      <option value="team">Whole team</option>
      {(reps ?? []).map((r) => (
        <option key={r.id} value={r.id}>
          {r.fullName ?? "Unnamed rep"}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- RepScopeSelect`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/RepScopeSelect.tsx src/features/home/components/dashboard/__tests__/RepScopeSelect.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): RepScopeSelect dropdown (Whole team + reps, names only)"
```

---

## Task 2.3: `DashboardTab` owns `repScope` and threads it

**Files:**
- Modify: `src/features/home/components/dashboard/DashboardTab.tsx`
- Modify: the card components that call the six hooks — `ToplineStatStrip.tsx`, `RankTrajectoryCard.tsx`, `TargetsCard.tsx`, `pipeline/VelocityCard.tsx`, `pipeline/PipelineSection.tsx`, and any child reading these hooks (grep `useTopline|useTargets|useVelocity|usePipeline|useSparklines|useRankTrajectory`).

- [ ] **Step 1: Add scope state + default-to-self ref guard**

In `DashboardTab.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import { useProfile } from "@/features/shared/lib/queries";
import RepScopeSelect from "./RepScopeSelect";
// …
  const { data: profile } = useProfile();
  const [repScope, setRepScope] = useState<string>("team"); // provisional until profile loads
  const defaultedRef = useRef(false);
  useEffect(() => {
    if (!defaultedRef.current && profile?.id) {
      defaultedRef.current = true;
      setRepScope(profile.id); // default to the current user, once
    }
  }, [profile?.id]);
```

(The ref guard sets the default exactly once and never overwrites a user choice — per the "filter bars default to current user" convention.)

- [ ] **Step 2: Render the select beside the FY pills**

Wrap the FY pill row + the select in a flex row so they sit together (keep `whitespace-nowrap`, add `flex-wrap` for narrow widths):

```tsx
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Fiscal year">
            {/* …existing pills… */}
          </div>
          <RepScopeSelect value={repScope} onChange={setRepScope} />
        </div>
```

- [ ] **Step 3: Thread `repScope` into every card + hide RankTrajectory in team mode**

```tsx
        <ToplineStatStrip fy={fy} repScope={repScope} />
        {repScope !== "team" && <RankTrajectoryCard fy={fy} repScope={repScope} />}
        {/* …in the pipeline section… */}
          <VelocityCard fy={fy} repScope={repScope} />
          <PipelineSection fy={fy} repScope={repScope} />
```

Add a `repScope: string` prop to each of those components and pass it into their hook call (e.g. `useTopline(fy, repScope)`). For `ToplineStatStrip`, also pass `repScope` down to whatever child calls `useTargets`/`useSparklines`.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS (all hook-call sites now pass `repScope`).

- [ ] **Step 5: Run the home test suite**

Run: `npm test -- src/features/home`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/home/components/dashboard/DashboardTab.tsx src/features/home/components/dashboard/ToplineStatStrip.tsx src/features/home/components/dashboard/RankTrajectoryCard.tsx src/features/home/components/dashboard/TargetsCard.tsx src/features/home/components/dashboard/pipeline/VelocityCard.tsx src/features/home/components/dashboard/pipeline/PipelineSection.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): DashboardTab rep-scope selector threads scope to all cards"
```

---

## Task 2.4: Conditional rank UI in team mode

**Files:**
- Modify: `src/features/home/components/dashboard/RankPill.tsx`
- Modify: any card that renders a rank/median (`StatCard.tsx`, `TargetsCard.tsx`, velocity/funnel cards) — grep `rank` / `RankPill` under `src/features/home/components/dashboard`.

- [ ] **Step 1: Failing test — RankPill renders nothing (or a Team chip) when rank is null**

Add to `src/features/home/components/dashboard/__tests__/` a RankPill test: `render(<RankPill rank={null} totalReps={0} />)` asserts it shows the team treatment (a "Team" chip) and NOT "of N".

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- RankPill`
Expected: FAIL.

- [ ] **Step 3: Handle `rank === null`**

In `RankPill.tsx`, accept `rank: number | null`; when null, render a neutral "Team" chip (or `return null`, per how the card reads in context — prefer a small "Team" label so the slot isn't empty). Update each card so that in `mode === "team"` (or `rank == null`) it hides the "vs team median"/share decorations and shows the team value plainly.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- RankPill`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test -- src/features/home && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/home/components/dashboard/RankPill.tsx src/features/home/components/dashboard/StatCard.tsx src/features/home/components/dashboard/TargetsCard.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): rank UI shows Team treatment when scope is whole-team"
```

---

# Phase 3 — Verification

## Task 3.1: Manual verification

- [ ] **Step 1: Run the full home suite + typecheck**

Run: `npm test -- src/features/home && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 2: Run the dev server and exercise the dashboard**

Run: `npm run dev` (port 3005). Log in, open Home → Dashboard:
- Default shows **your** name selected; numbers match the pre-change dashboard.
- Pick another rep → all cards (topline, velocity, pipeline, rank trajectory) repopulate with that rep's data; Rank Trajectory shows **their** trajectory.
- Pick **Whole team** → topline/velocity/pipeline show summed team figures, rank pills become "Team", Rank Trajectory card disappears.
- Switch FY → scope persists; switch rep → FY persists.
- Narrow the window (sidebar open) → the FY pills + rep select wrap, no overflow.

- [ ] **Step 3: Mobile smoke (per CLAUDE.md)**

Verify the select + pills row on Safari Responsive Design Mode at <640px (wraps, scrolls, tappable).

- [ ] **Step 4: Final commit if any verification fixes were needed**

```bash
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -am "fix(home): verification fixes for rep/team scope"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** rep filter (selector + `?rep=`), team view (sum, hide rank), selector by FY pills, default-to-self, RankTrajectory hidden in team, names-only dropdown, `/api/reps` no emails, velocity pools-then-recomputes — all have tasks.
- **`rank` nullability ripples:** `ToplineCard.rank`, `VelocityCell.rank`, `FunnelData.rank`, `TargetsCardData.rank` all become `number | null`. The client (`RankPill` + cards) must handle null (Task 2.4). Run `npx tsc --noEmit` after Phase 1 to catch any missed consumer.
- **Don't bundle the staleness WIP:** `pipeline.ts`, `pipeline-source.ts`, `AtRiskCard.tsx`, `TopOpportunitiesTable.tsx`, `pipeline.test.ts` have uncommitted edits unrelated to this work. Stage hunks precisely.
- **`buildWowDeltas` team-sum:** confirm it tolerates multiple reps' rows before shipping the sparklines team branch (Task 1.4 Step 5 note).
