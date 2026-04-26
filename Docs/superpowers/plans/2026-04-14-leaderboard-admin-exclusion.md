# Leaderboard Admin Exclusion & Team Totals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter `UserProfile.role === 'admin'` users out of every leaderboard roster (Revenue Overview tab, Initiative tab, self card) and out of combined-score normalization, while exposing their revenue via a new `teamTotals` field surfaced in a "Team Total" footer row on the Revenue Overview table.

**Architecture:** Pure query-layer filtering in three Next.js App Router API routes, plus one new optional response field (`teamTotals`) and one new `<tfoot>` element on `RevenueTable`. No schema changes, no migrations, no new endpoints.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 5, Vitest + Testing Library + jsdom, Tailwind 4. The change touches `src/app/api/leaderboard/{route,details,me}.ts` and `src/features/leaderboard/{lib/types,components/RevenueTable,components/RevenueOverviewTab}.ts(x)` plus one Vitest file.

**Branch context:** All work happens on `feat/leaderboard-combined`, which already contains Aston's Revenue Overview redesign and the EK12 matview fix. The spec lives at `Docs/superpowers/specs/2026-04-13-leaderboard-admin-exclusion-design.md`.

**Background reading:**
- `Docs/superpowers/specs/2026-04-13-leaderboard-admin-exclusion-design.md` — the design spec this plan implements.
- `prisma/schema.prisma` lines ~720–745 — `UserRole` enum (`admin | manager | rep`) and `UserProfile.role` field.
- `src/app/api/leaderboard/route.ts` — current Revenue Overview API; the largest change.
- `src/features/leaderboard/components/RevenueTable.tsx` — current table; will gain a `<tfoot>`.
- `src/features/leaderboard/components/RevenueOverviewTab.tsx` — current FY-projection logic that the team-totals projection mirrors.

---

## Task 1: Add `teamTotals` field to `LeaderboardResponse` type

**Files:**
- Modify: `src/features/leaderboard/lib/types.ts`

This is a type-only change so no test. Verification is `npx tsc --noEmit`, which both confirms the type compiles and that no consumer is broken (the field is optional, so consumers that don't read it are unaffected).

- [ ] **Step 1: Read the current type to find where to insert**

Run: `grep -n "LeaderboardResponse" src/features/leaderboard/lib/types.ts`

Find the `LeaderboardResponse` interface declaration — note its closing `}` line number. The new field will be added at the end, before the closing brace.

- [ ] **Step 2: Add the `teamTotals` field**

Edit `src/features/leaderboard/lib/types.ts`. Inside the `LeaderboardResponse` interface, add the following block as the last member (before the closing `}`):

```ts
  /**
   * Team-wide totals across all users including admins (which are filtered
   * from `entries`). Single-FY columns are scalars; pipeline and targeted
   * are shipped per-FY so the client can match its FY selectors.
   * Optional so older clients during deploy don't crash.
   */
  teamTotals?: {
    revenue: number;
    priorYearRevenue: number;
    unassignedRevenue: number;
    unassignedPriorYearRevenue: number;

    pipelineCurrentFY: number;
    pipelineNextFY: number;
    unassignedPipelineCurrentFY: number;
    unassignedPipelineNextFY: number;

    targetedCurrentFY: number;
    targetedNextFY: number;
    unassignedTargetedCurrentFY: number;
    unassignedTargetedNextFY: number;
  };
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0, no output.

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/lib/types.ts
git commit -m "feat(leaderboard): add teamTotals field to LeaderboardResponse type"
```

---

## Task 2: Backend — `/api/leaderboard` filter admins + return `teamTotals`

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`

This is the largest change in the plan. The diff has four logical pieces, all in the same file:

1. Add `role: true` to the `scores` user select.
2. Partition `repActuals` into roster-only after the existing fetch loop.
3. Recompute `maxInitiativePoints / maxTake / maxPipeline / maxRevenue / maxRevenueTargeted` from the roster-only slice.
4. Build the `teamTotals` object from the *full* (admin-inclusive) data and add it to the JSON response, then drop admin entries from the `entries.map(...)` build.

The `userIds` array (used to filter plan/activity queries) stays as the FULL score list — admin-attributed plans must contribute to `targetedCurrentFYByUser` so admin targeted totals end up in `teamTotals`.

- [ ] **Step 1: Add `role` to the scores user select**

Edit `src/app/api/leaderboard/route.ts`. Find the `scores` query (around line 31). Inside `include.user.select`, add `role: true` after the existing fields:

```ts
    const scores = await prisma.initiativeScore.findMany({
      where: { initiativeId: initiative.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { totalPoints: "desc" },
    });
```

- [ ] **Step 2: Partition the actuals + scores after the existing fetch loop**

Find the line `const actualsMap = new Map(repActuals.map((a) => [a.userId, a]));` (around line 90). **Immediately after** that line, insert:

```ts
    // Partition by role: admins are excluded from the visible roster
    // and from max-value normalization, but their actuals still feed
    // the team-wide totals.
    const adminUserIds = new Set(
      scores.filter((s) => s.user.role === "admin").map((s) => s.userId)
    );
    const rosterScores = scores.filter((s) => !adminUserIds.has(s.userId));
    const rosterActuals = repActuals.filter((a) => !adminUserIds.has(a.userId));
```

- [ ] **Step 3: Recompute maxes from the roster slice**

Find the four `Math.max(...)` lines (around lines 93–96):

```ts
    const maxInitiativePoints = Math.max(...scores.map((s) => s.totalPoints), 0);
    const maxTake = Math.max(...repActuals.map((a) => a.take), 0);
    const maxPipeline = Math.max(...repActuals.map((a) => a.pipeline), 0);
    const maxRevenue = Math.max(...repActuals.map((a) => a.revenue), 0);
```

Replace with:

```ts
    const maxInitiativePoints = Math.max(...rosterScores.map((s) => s.totalPoints), 0);
    const maxTake = Math.max(...rosterActuals.map((a) => a.take), 0);
    const maxPipeline = Math.max(...rosterActuals.map((a) => a.pipeline), 0);
    const maxRevenue = Math.max(...rosterActuals.map((a) => a.revenue), 0);
```

Then find `const maxRevenueTargeted = Math.max(...[...revenueTargetedByUser.values()], 0);` (around line 208) and replace with:

```ts
    const maxRevenueTargeted = Math.max(
      ...rosterScores.map((s) => revenueTargetedByUser.get(s.userId) ?? 0),
      0
    );
```

- [ ] **Step 4: Switch the entries build to use `rosterScores`**

Find `const entries = scores.map((score, index) => {` (around line 218) and replace `scores.map` with `rosterScores.map`:

```ts
    const entries = rosterScores.map((score, index) => {
```

The rest of the `.map` body is unchanged.

- [ ] **Step 5: Compute the `teamTotals` object**

Find the `return NextResponse.json({` block (around line 278). Immediately *before* that return, insert the totals computation:

```ts
    // Sum across the FULL repActuals + targeted maps (admin-inclusive).
    // The `unassigned*` fields capture the admin-only subtotal so the UI
    // can show an inline "incl. $X unassigned" annotation.
    const sumActuals = (
      pool: typeof repActuals,
      key: "revenue" | "priorYearRevenue" | "pipelineCurrentFY" | "pipelineNextFY",
    ): number => pool.reduce((acc, a) => acc + (a[key] ?? 0), 0);

    const sumTargetedMap = (pool: Map<string, number>, ids: Iterable<string>): number => {
      let total = 0;
      for (const id of ids) total += pool.get(id) ?? 0;
      return total;
    };

    const adminActuals = repActuals.filter((a) => adminUserIds.has(a.userId));

    const teamTotals = {
      revenue: sumActuals(repActuals, "revenue"),
      priorYearRevenue: sumActuals(repActuals, "priorYearRevenue"),
      unassignedRevenue: sumActuals(adminActuals, "revenue"),
      unassignedPriorYearRevenue: sumActuals(adminActuals, "priorYearRevenue"),

      pipelineCurrentFY: sumActuals(repActuals, "pipelineCurrentFY"),
      pipelineNextFY: sumActuals(repActuals, "pipelineNextFY"),
      unassignedPipelineCurrentFY: sumActuals(adminActuals, "pipelineCurrentFY"),
      unassignedPipelineNextFY: sumActuals(adminActuals, "pipelineNextFY"),

      // userIds (declared earlier, full score list) → all-users sum.
      // adminUserIds → admin-only sum.
      targetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, userIds),
      targetedNextFY: sumTargetedMap(targetedNextFYByUser, userIds),
      unassignedTargetedCurrentFY: sumTargetedMap(targetedCurrentFYByUser, adminUserIds),
      unassignedTargetedNextFY: sumTargetedMap(targetedNextFYByUser, adminUserIds),
    };
```

- [ ] **Step 6: Add `teamTotals` to the JSON response**

In the `return NextResponse.json({...})` block, add `teamTotals,` as a new top-level field. Place it immediately after `entries,` for readability:

```ts
    return NextResponse.json({
      initiative: { ... },
      fiscalYears: { ... },
      entries,
      teamTotals,
      metrics: ...,
      thresholds: ...,
    });
```

- [ ] **Step 7: Type-check + verify the dev server still compiles**

Run: `npx tsc --noEmit`
Expected: exit code 0.

If a dev server is already running on `feat/leaderboard-combined`, save the file and watch the terminal — Next.js should recompile cleanly with no errors. If no server is running, start one with `npm run dev` and confirm `Ready in <time>`.

- [ ] **Step 8: Spot-check the API response shape in the browser**

Open http://localhost:3005/?tab=leaderboard in the browser (must be authenticated). Open DevTools → Network → reload → click on the `leaderboard` request → Response. Confirm:
- `entries` is present and does NOT contain Anurag.
- `teamTotals` is present with all 12 fields (4 single-FY + 8 per-FY).
- `teamTotals.unassignedRevenue` is nonzero (matches Anurag's revenue from the matview).

- [ ] **Step 9: Commit**

```bash
git add src/app/api/leaderboard/route.ts
git commit -m "feat(leaderboard): exclude admins from /api/leaderboard roster + add teamTotals"
```

---

## Task 3: Backend — `/api/leaderboard/details` filter admins

**Files:**
- Modify: `src/app/api/leaderboard/details/route.ts`

The Initiative tab pulls scores via `prisma.initiative.findFirst({ include: { scores: { include: { user: ... } } } })`. We add `role` to the user select and filter admins out of the scores list before everything downstream.

This endpoint does NOT compute or return `teamTotals` — the Initiative tab columns are point-based (plans created, activities logged, etc.), not revenue-based, and showing team totals there would be a different feature.

- [ ] **Step 1: Add `role` to the user select**

Edit `src/app/api/leaderboard/details/route.ts`. Find the `scores` include block (around line 22):

```ts
        scores: {
          orderBy: { totalPoints: "desc" },
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
```

Replace with:

```ts
        scores: {
          orderBy: { totalPoints: "desc" },
          include: { user: { select: { id: true, fullName: true, avatarUrl: true, role: true } } },
        },
```

- [ ] **Step 2: Filter admin scores after the fetch**

Find the line `const userIds = initiative.scores.map((s) => s.userId);` (around line 32). **Immediately above** that line, insert:

```ts
    // Admins are excluded from the Initiative tab roster.
    initiative.scores = initiative.scores.filter((s) => s.user.role !== "admin");
```

The downstream `userIds`, plan/activity queries, and `entries` build all derive from `initiative.scores`, so this single filter cascades.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

If TypeScript complains that you can't reassign `initiative.scores` (because Prisma includes are read-only), use a local variable instead:

```ts
    const rosterScores = initiative.scores.filter((s) => s.user.role !== "admin");
```

…and then in the `.map((score, index) => {...})` build below, replace `initiative.scores.map(...)` with `rosterScores.map(...)`. Apply the same to any other reference.

Re-run `npx tsc --noEmit` to confirm.

- [ ] **Step 4: Spot-check the API response in the browser**

Open http://localhost:3005/?tab=leaderboard, switch to the **Initiative** tab. Confirm Anurag is absent from the table. Open DevTools → Network → click the `details` request → Response. Confirm `entries` does not contain Anurag.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leaderboard/details/route.ts
git commit -m "feat(leaderboard): exclude admins from /api/leaderboard/details"
```

---

## Task 4: Backend — `/api/leaderboard/me` filter admins

**Files:**
- Modify: `src/app/api/leaderboard/me/route.ts`

This endpoint computes the current user's rank, neighbors (above/below), and `totalReps` against `allScores`. We filter admins out so that ranks reflect only the rep-vs-rep competition. If the current user is themselves an admin, the existing `myIndex === -1` fallback at line 37 will fire — no new code path needed.

- [ ] **Step 1: Add `role` to the user select**

Edit `src/app/api/leaderboard/me/route.ts`. Find the `allScores` query (around line 25):

```ts
    const allScores = await prisma.initiativeScore.findMany({
      where: { initiativeId: initiative.id },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { totalPoints: "desc" },
    });
```

Replace with:

```ts
    const allScores = await prisma.initiativeScore.findMany({
      where: { initiativeId: initiative.id },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true, role: true },
        },
      },
      orderBy: { totalPoints: "desc" },
    });
```

- [ ] **Step 2: Filter admins out of the score list used for ranking**

Find the `const myIndex = allScores.findIndex((s) => s.userId === user.id);` line (around line 35). **Immediately above** that line, insert:

```ts
    // Admins are excluded from the visible roster; rank/neighbors/total
    // are computed against reps only. If the current user is themselves
    // an admin, myIndex will be -1 and the existing not-on-leaderboard
    // fallback kicks in.
    const rosterScores = allScores.filter((s) => s.user.role !== "admin");
```

Then replace EVERY subsequent reference to `allScores` in the function with `rosterScores`. Specifically:

- Line ~35: `const myIndex = rosterScores.findIndex((s) => s.userId === user.id);`
- Line ~41 (in the not-found branch): `rank: rosterScores.length + 1, totalReps: rosterScores.length + 1,`
- Line ~56: `const myScore = rosterScores[myIndex];`
- Line ~57: `const above = myIndex > 0 ? rosterScores[myIndex - 1] : null;`
- Line ~58: `const below = myIndex < rosterScores.length - 1 ? rosterScores[myIndex + 1] : null;`
- Line ~133 (inside `formatNeighbor`): `rank: rosterScores.indexOf(score) + 1,`
- Line ~141: `totalReps: rosterScores.length,`

Be thorough — `grep -n "allScores" src/app/api/leaderboard/me/route.ts` should return zero hits after this step except the one declaration line.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 4: Spot-check the self card in the browser**

Reload http://localhost:3005/?tab=leaderboard and find the self card (current user's rank widget). Confirm it shows a sensible rank like "Rank 4 of 12" (with `totalReps` no longer counting Anurag). DevTools → Network → `me` request → Response: confirm `rank`, `totalReps`, and any `above`/`below` neighbor are non-admin users.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leaderboard/me/route.ts
git commit -m "feat(leaderboard): exclude admins from /api/leaderboard/me ranking"
```

---

## Task 5: Frontend test — `RevenueTable` footer (TDD)

**Files:**
- Modify: `src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`

This is strict TDD: write the failing tests *first*, run them to confirm they fail, then implement in Task 6. Vitest is the runner, Testing Library + jsdom is the env (per `CLAUDE.md`).

- [ ] **Step 1: Read the existing test file to find the import block and the existing test pattern**

Run: `cat src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`

Note the existing imports, the fixture-builder pattern, and any helpers. We'll mirror them.

- [ ] **Step 2: Add the four new test cases**

At the bottom of the existing `describe(...)` block (or below the existing test file content), add:

```tsx
describe("RevenueTable team totals footer", () => {
  const baseEntry = {
    userId: "u1",
    fullName: "Alex Rep",
    avatarUrl: null,
    totalPoints: 100,
    tier: "varsity" as const,
    rank: 1,
    take: 0,
    pipeline: 1_000_000,
    pipelineCurrentFY: 600_000,
    pipelineNextFY: 400_000,
    revenue: 5_000_000,
    priorYearRevenue: 3_000_000,
    revenueTargeted: 2_000_000,
    targetedCurrentFY: 1_200_000,
    targetedNextFY: 800_000,
    combinedScore: 80,
    initiativeScore: 80,
    pointBreakdown: [],
  };

  const baseTotals = {
    revenue: 50_000_000,
    priorYearRevenue: 40_000_000,
    pipeline: 10_000_000,
    revenueTargeted: 20_000_000,
    unassignedRevenue: 0,
    unassignedPriorYearRevenue: 0,
    unassignedPipeline: 0,
    unassignedRevenueTargeted: 0,
  };

  const noopSort = () => {};

  it("hides the footer when teamTotals prop is undefined", () => {
    const { container } = render(
      <RevenueTable
        entries={[baseEntry]}
        sortColumn="revenue"
        sortDirection="desc"
        onSort={noopSort}
      />
    );
    expect(container.querySelector("tfoot")).toBeNull();
  });

  it("hides the footer when entries is empty even if teamTotals is provided", () => {
    const { container } = render(
      <RevenueTable
        entries={[]}
        sortColumn="revenue"
        sortDirection="desc"
        onSort={noopSort}
        teamTotals={baseTotals}
      />
    );
    expect(container.querySelector("tfoot")).toBeNull();
  });

  it("renders a Team Total row with the provided per-column totals", () => {
    render(
      <RevenueTable
        entries={[baseEntry]}
        sortColumn="revenue"
        sortDirection="desc"
        onSort={noopSort}
        teamTotals={baseTotals}
      />
    );
    expect(screen.getByText(/Team Total/i)).toBeInTheDocument();
    // formatRevenue($50M) → "$50.0M" — adjust expected literals if the
    // format helper uses a different precision/style
    expect(screen.getByText("$50.0M")).toBeInTheDocument();
    expect(screen.getByText("$40.0M")).toBeInTheDocument();
    expect(screen.getByText("$10.0M")).toBeInTheDocument();
    expect(screen.getByText("$20.0M")).toBeInTheDocument();
    expect(screen.queryByText(/unassigned/i)).toBeNull();
  });

  it("shows 'incl. $X unassigned' annotation only on columns where unassigned > 0", () => {
    render(
      <RevenueTable
        entries={[baseEntry]}
        sortColumn="revenue"
        sortDirection="desc"
        onSort={noopSort}
        teamTotals={{
          ...baseTotals,
          unassignedRevenue: 13_800_000,
          unassignedPipeline: 2_500_000,
          // priorYearRevenue + revenueTargeted intentionally unassigned=0
        }}
      />
    );
    const annotations = screen.getAllByText(/incl\. .* unassigned/i);
    expect(annotations).toHaveLength(2); // revenue + pipeline only
    expect(screen.getByText(/incl\. \$13\.8M unassigned/i)).toBeInTheDocument();
    expect(screen.getByText(/incl\. \$2\.5M unassigned/i)).toBeInTheDocument();
  });
});
```

If the existing test file uses different fixture builders or already has `baseEntry` defined, adapt — DRY is the goal; don't duplicate fixtures that already exist.

If the existing imports don't include `screen`, add it: `import { render, screen } from "@testing-library/react";`.

- [ ] **Step 3: Run the new tests and confirm they fail**

Run: `npm test -- src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`
Expected: 4 failing tests in the new `describe` block. Failures should be along the lines of "no such prop `teamTotals`" or "Team Total text not found" — that confirms the tests are exercising new behavior that doesn't exist yet.

Do **not** commit yet. Continue to Task 6.

---

## Task 6: Frontend impl — `RevenueTable` footer

**Files:**
- Modify: `src/features/leaderboard/components/RevenueTable.tsx`

Implement the new prop and `<tfoot>` so the Task-5 tests pass.

- [ ] **Step 1: Define the `RevenueTableTotals` type and add it to the props interface**

Edit `src/features/leaderboard/components/RevenueTable.tsx`. Just below the `RevenueSortColumn` export (around line 7), add:

```ts
export type RevenueTableTotals = {
  revenue: number;
  priorYearRevenue: number;
  pipeline: number;
  revenueTargeted: number;
  unassignedRevenue: number;
  unassignedPriorYearRevenue: number;
  unassignedPipeline: number;
  unassignedRevenueTargeted: number;
};
```

Then extend the `RevenueTableProps` interface with the new optional prop:

```ts
interface RevenueTableProps {
  entries: LeaderboardEntry[];
  sortColumn: RevenueSortColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: RevenueSortColumn) => void;
  teamTotals?: RevenueTableTotals;
}
```

And destructure it in the function signature:

```ts
export default function RevenueTable({
  entries,
  sortColumn,
  sortDirection,
  onSort,
  teamTotals,
}: RevenueTableProps) {
```

- [ ] **Step 2: Render the `<tfoot>` row**

Find the closing `</tbody>` near the end of the JSX (around line 106). Immediately AFTER `</tbody>` and BEFORE `</table>`, insert:

```tsx
        {teamTotals && entries.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-[#EFEDF5] bg-[#F7F5FA]">
              <td />
              <td className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A849A]">
                Team Total
              </td>
              {COLUMNS.map((col) => {
                const total = teamTotals[col.key];
                const unassignedKey = (
                  "unassigned" + col.key[0].toUpperCase() + col.key.slice(1)
                ) as keyof RevenueTableTotals;
                const unassigned = teamTotals[unassignedKey];
                return (
                  <td
                    key={col.key}
                    className="px-3 py-3 text-right text-sm tabular-nums font-semibold text-[#2D2440]"
                  >
                    {formatRevenue(total)}
                    {unassigned > 0 && (
                      <div className="text-[10px] text-[#8A849A] font-normal mt-0.5">
                        incl. {formatRevenue(unassigned)} unassigned
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
```

The `unassignedKey` cast works because `RevenueTableTotals` defines exactly the four `unassigned*` siblings to the four primary keys. TypeScript can't statically prove the cast is sound from the string concatenation, hence the `as`.

- [ ] **Step 3: Run the new tests and confirm they pass**

Run: `npm test -- src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`
Expected: all 4 new tests pass, plus any pre-existing tests in the file still pass.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/RevenueTable.tsx \
        src/features/leaderboard/components/__tests__/RevenueTable.test.tsx
git commit -m "feat(leaderboard): add Team Total footer to RevenueTable"
```

---

## Task 7: Frontend wiring — `RevenueOverviewTab` projects per-FY totals

**Files:**
- Modify: `src/features/leaderboard/components/RevenueOverviewTab.tsx`

`RevenueOverviewTab` already projects each entry's `pipeline` and `revenueTargeted` based on the FY selectors via `getPipelineValue` / `getTargetedValue`. We mirror that pattern for `teamTotals`.

- [ ] **Step 1: Import `RevenueTableTotals`**

Edit `src/features/leaderboard/components/RevenueOverviewTab.tsx`. Find the existing import line for `RevenueTable`:

```ts
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn } from "./RevenueTable";
```

Add `RevenueTableTotals` to the type import:

```ts
import type { RevenueSortColumn, RevenueTableTotals } from "./RevenueTable";
```

- [ ] **Step 2: Project `teamTotals` per the current FY selectors**

Find the existing `useMemo` for `projectedEntries` (around line 42). Just below that block, add a second `useMemo` for the team totals:

```ts
  const projectedTotals = useMemo<RevenueTableTotals | undefined>(() => {
    const t = leaderboard?.teamTotals;
    if (!t) return undefined;

    const projectFY = <
      Cur extends number,
      Next extends number,
    >(
      cur: Cur,
      next: Next,
      fy: FYSelection
    ): number => {
      if (fy === "current") return cur;
      if (fy === "next") return next;
      return cur + next;
    };

    return {
      revenue: t.revenue,
      priorYearRevenue: t.priorYearRevenue,
      pipeline: projectFY(t.pipelineCurrentFY, t.pipelineNextFY, pipelineFY),
      revenueTargeted: projectFY(t.targetedCurrentFY, t.targetedNextFY, targetedFY),
      unassignedRevenue: t.unassignedRevenue,
      unassignedPriorYearRevenue: t.unassignedPriorYearRevenue,
      unassignedPipeline: projectFY(
        t.unassignedPipelineCurrentFY,
        t.unassignedPipelineNextFY,
        pipelineFY
      ),
      unassignedRevenueTargeted: projectFY(
        t.unassignedTargetedCurrentFY,
        t.unassignedTargetedNextFY,
        targetedFY
      ),
    };
  }, [leaderboard?.teamTotals, pipelineFY, targetedFY]);
```

- [ ] **Step 3: Pass `teamTotals` into `<RevenueTable>`**

Find the existing `<RevenueTable ... />` JSX (around line 105). Add the new prop:

```tsx
      <RevenueTable
        entries={sortedEntries}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        teamTotals={projectedTotals}
      />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 5: Verify in the browser — full end-to-end smoke test**

The dev server should be running (or start it: `npm run dev`). Open http://localhost:3005/?tab=leaderboard.

Confirm the following with your eyes:

1. The Revenue Overview table now has a "Team Total" footer row.
2. The Current Revenue total includes Anurag's revenue (i.e., it's bigger than the sum of visible reps).
3. Below the Current Revenue total, the annotation reads `incl. $X.XM unassigned` where X is Anurag's revenue.
4. Toggle the Pipeline FY selector between Current / Next / Both — the Pipeline footer total updates accordingly. The unassigned annotation (if Anurag has pipeline) also updates.
5. Toggle the Targeted FY selector — same behavior.
6. Switch to the Initiative tab — confirm Anurag is absent there too.

If any of those fail, debug before committing.

- [ ] **Step 6: Commit**

```bash
git add src/features/leaderboard/components/RevenueOverviewTab.tsx
git commit -m "feat(leaderboard): wire teamTotals through RevenueOverviewTab with FY projection"
```

---

## Task 8: Final manual verification + push

**Files:** none (verification + push only)

Run through the full manual verification checklist from the spec. This is the gate before pushing.

- [ ] **Step 1: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: all tests pass. If any pre-existing tests are flaky, note it but don't ignore failures in the leaderboard area.

- [ ] **Step 2: Run a final type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Walk through the spec's manual verification checklist**

Open http://localhost:3005/?tab=leaderboard and verify each of the 6 items from the spec's "Manual verification" section:

1. Anurag is absent from Revenue Overview podium, Revenue Overview table, AND Initiative tab.
2. Team Total Current Revenue equals sum of visible reps' revenue + Anurag's current-year revenue.
3. "incl. $X unassigned" annotation matches Anurag's current-year revenue exactly.
4. Combined scores for visible reps are higher than they were before this branch (or unchanged where Anurag wasn't the max for that metric).
5. Signed in as a regular rep, the self card shows correct rank and neighbors with no admin in above/below.
6. Sign in as an admin user → self card falls through to the "not on leaderboard" state.

- [ ] **Step 4: Confirm the branch state with the user before pushing**

Show the user the commit log: `git log --oneline origin/main..HEAD` — this should list 14 (Aston) + 1 (matview) + 1 (spec) + 6 (this plan's commits) = 22 commits ahead of main.

Then ASK the user: "Verification complete. Want me to push `feat/leaderboard-combined` to origin and open a PR?" Do not push without explicit confirmation — the branch contains Aston's authored commits and the user may want to coordinate timing or notify Aston first.

- [ ] **Step 5: (only after user approval) push and open PR**

```bash
git push -u origin feat/leaderboard-combined
gh pr create --title "feat(leaderboard): exclude admins from roster + show team totals" --body "..."
```

Use the spec + this plan's "Goal" section as the PR body.

---

## Files Touched Summary

| File | Change | Task |
|------|--------|------|
| `src/features/leaderboard/lib/types.ts` | Add `teamTotals` to `LeaderboardResponse` | 1 |
| `src/app/api/leaderboard/route.ts` | Filter admins, recompute maxes, build `teamTotals` | 2 |
| `src/app/api/leaderboard/details/route.ts` | Filter admins from initiative scores | 3 |
| `src/app/api/leaderboard/me/route.ts` | Filter admins from rank computation | 4 |
| `src/features/leaderboard/components/__tests__/RevenueTable.test.tsx` | 4 new test cases | 5 |
| `src/features/leaderboard/components/RevenueTable.tsx` | New `teamTotals` prop + `<tfoot>` row | 6 |
| `src/features/leaderboard/components/RevenueOverviewTab.tsx` | Project per-FY totals, pass to table | 7 |

7 files, 6 commits (Tasks 5+6 share a commit), no schema changes, no migrations.
