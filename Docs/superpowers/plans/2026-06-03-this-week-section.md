# "This week" Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal 3-count `ThisWeekCard` with a full-width "This week" section that lists the caller's actual won / lost / newly-created deals over the last 7 days, each with motion/product tags and a trailing detail.

**Architecture:** Pure aggregation (`buildThisWeek`) lives in the DB-free, TDD'd `pipeline.ts`; the DB-bound `pipeline-source.ts` selects the caller's deal rows for the window and feeds them in. Two new presentational components (`ThisWeekSection` + `ThisWeekColumnCard`) render the three columns. Wired into the Pipeline main column above the Top-opportunities table; the old right-rail card is deleted.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma raw SQL, Vitest + Testing Library, Tailwind 4 (Fullmind plum tokens).

**Spec:** `Docs/superpowers/specs/2026-06-03-this-week-section-design.md`

---

## File Structure

- **Modify** `src/features/home/lib/pipeline.ts` — add `ThisWeekDealRow`, `ThisWeekDeal`, `ThisWeekColumn`, `ThisWeek` types + pure `buildThisWeek()` + a stage-label map. (Pure aggregation belongs here, matching the file's stated convention.)
- **Modify** `src/features/home/lib/pipeline-source.ts` — drop the old `ThisWeek` interface and the `COUNT(*) FILTER` query; select the caller's deal rows for the window; call `buildThisWeek`.
- **Modify** `src/features/home/lib/queries.ts` — import `ThisWeek` from `./pipeline` instead of `./pipeline-source`.
- **Create** `src/features/home/components/dashboard/pipeline/ThisWeekColumnCard.tsx` — one column (header + deal list + Show-more).
- **Create** `src/features/home/components/dashboard/pipeline/ThisWeekSection.tsx` — section shell + 3 columns.
- **Modify** `src/features/home/components/dashboard/pipeline/PipelineSection.tsx` — drop `ThisWeekCard` from the right rail; add `ThisWeekSection` above `TopOpportunitiesTable`.
- **Delete** `src/features/home/components/dashboard/pipeline/ThisWeekCard.tsx` — superseded.
- **Modify** `src/features/home/lib/__tests__/pipeline.test.ts` — tests for `buildThisWeek`.
- **Create** `src/features/home/components/dashboard/pipeline/__tests__/ThisWeekColumnCard.test.tsx` — render test.

---

## Task 1: Pure `buildThisWeek` + types

**Files:**
- Modify: `src/features/home/lib/pipeline.ts`
- Test: `src/features/home/lib/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/home/lib/__tests__/pipeline.test.ts`:

```ts
import { buildThisWeek, type ThisWeekDealRow } from "../pipeline";

describe("buildThisWeek", () => {
  // Fixed clock: 2026-06-03T12:00:00Z. Window start = 7 days earlier.
  const NOW = Date.UTC(2026, 5, 3, 12, 0, 0);
  const day = (n: number) => new Date(NOW + n * 86_400_000);

  const row = (over: Partial<ThisWeekDealRow>): ThisWeekDealRow => ({
    account: "Acct",
    value: 1000,
    category: null,
    contractType: null,
    stagePrefix: 0,
    createdAt: day(-1),
    closeDate: null,
    ...over,
  });

  it("buckets won / lost / created and computes count + total", () => {
    const rows = [
      row({ account: "Won A", value: 50000, stagePrefix: 6, createdAt: day(-30), closeDate: day(-2) }),
      row({ account: "Lost A", value: 40000, stagePrefix: -1, createdAt: day(-20), closeDate: day(-1) }),
      row({ account: "New A", value: 30000, stagePrefix: 1, createdAt: day(-3), closeDate: null }),
    ];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.count).toBe(1);
    expect(w.won.total).toBe(50000);
    expect(w.won.deals[0].account).toBe("Won A");
    expect(w.lost.count).toBe(1);
    expect(w.lost.deals[0].account).toBe("Lost A");
    expect(w.created.count).toBe(1);
    expect(w.created.deals[0].account).toBe("New A");
  });

  it("sorts deals within a column by value desc", () => {
    const rows = [
      row({ account: "Small", value: 10000, stagePrefix: 1, createdAt: day(-1) }),
      row({ account: "Big", value: 90000, stagePrefix: 1, createdAt: day(-1) }),
    ];
    const w = buildThisWeek(rows, NOW);
    expect(w.created.deals.map((d) => d.account)).toEqual(["Big", "Small"]);
  });

  it("places a deal created AND won in the same window in both columns", () => {
    const rows = [row({ account: "Fast", value: 20000, stagePrefix: 6, createdAt: day(-3), closeDate: day(-1) })];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.count).toBe(1);
    expect(w.created.count).toBe(1);
  });

  it("excludes a deal closed before the window", () => {
    const rows = [row({ account: "Old Win", value: 20000, stagePrefix: 6, createdAt: day(-40), closeDate: day(-10) })];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.count).toBe(0);
    expect(w.created.count).toBe(0);
  });

  it("title-cases motion, passes product through, omits nulls", () => {
    const rows = [row({ category: "renewal", contractType: "Tutoring", stagePrefix: 1, createdAt: day(-1) })];
    const w = buildThisWeek(rows, NOW);
    expect(w.created.deals[0].motion).toBe("Renewal");
    expect(w.created.deals[0].product).toBe("Tutoring");

    const rows2 = [row({ category: null, contractType: null, stagePrefix: 1, createdAt: day(-1) })];
    const w2 = buildThisWeek(rows2, NOW);
    expect(w2.created.deals[0].motion).toBeNull();
    expect(w2.created.deals[0].product).toBeNull();
  });

  it("sets daysToClose on won deals and stage label on created deals", () => {
    const rows = [
      row({ account: "Won", value: 1, stagePrefix: 6, createdAt: day(-28), closeDate: day(-1) }),
      row({ account: "New", value: 1, stagePrefix: 0, createdAt: day(-1) }),
    ];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.deals[0].daysToClose).toBe(27);
    expect(w.created.deals[0].stage).toBe("Meeting Booked");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- pipeline.test.ts`
Expected: FAIL — `buildThisWeek` / `ThisWeekDealRow` not exported.

- [ ] **Step 3: Implement the types + function**

Add to `src/features/home/lib/pipeline.ts` (after the existing `PIPELINE_STAGES` / `STAGE_NAME_BY_PREFIX` definitions so it can reuse them):

```ts
const DAY_MS = 86_400_000;

// Stage label by prefix for the "Newly created" column's trailing detail.
// Reuses the open-stage names; closed deals created this week show their closed label.
const STAGE_LABEL_BY_PREFIX = new Map<number, string>([
  ...PIPELINE_STAGES.map((s) => [s.prefix, s.name] as [number, string]),
  [6, "Closed Won"],
  [-1, "Closed Lost"],
]);

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Raw deal row for the last-7-days "This week" section (one rep, window-scoped).
export interface ThisWeekDealRow {
  account: string | null;
  value: number; // net_booking_amount
  category: string | null; // DOA segment category → motion tag
  contractType: string | null; // product tag
  stagePrefix: number | null; // 0-5 open, 6 won, -1 lost
  createdAt: Date | null;
  closeDate: Date | null;
}

export interface ThisWeekDeal {
  account: string;
  value: number; // absolute; the column applies the +/- sign
  motion: string | null;
  product: string | null;
  daysToClose?: number; // Won only
  stage?: string; // Created only
}

export interface ThisWeekColumn {
  count: number;
  total: number;
  deals: ThisWeekDeal[]; // value-desc
}

export interface ThisWeek {
  won: ThisWeekColumn;
  lost: ThisWeekColumn;
  created: ThisWeekColumn;
}

function toColumn(deals: ThisWeekDeal[]): ThisWeekColumn {
  const sorted = [...deals].sort((a, b) => b.value - a.value);
  return { count: sorted.length, total: sorted.reduce((s, d) => s + d.value, 0), deals: sorted };
}

// Classify the caller's window-scoped deal rows into won / lost / created columns.
// A deal created AND closed in the same window lands in both Created and its close
// column — matches the independent-column design.
export function buildThisWeek(rows: ThisWeekDealRow[], nowMs: number): ThisWeek {
  const windowStart = nowMs - 7 * DAY_MS;
  const won: ThisWeekDeal[] = [];
  const lost: ThisWeekDeal[] = [];
  const created: ThisWeekDeal[] = [];

  for (const r of rows) {
    const value = Math.abs(r.value);
    const motion = r.category ? titleCase(r.category) : null;
    const product = r.contractType;
    const account = r.account ?? "Unknown";
    const createdMs = r.createdAt ? r.createdAt.getTime() : null;
    const closeMs = r.closeDate ? r.closeDate.getTime() : null;
    const closedInWindow = closeMs !== null && closeMs >= windowStart;
    const createdInWindow = createdMs !== null && createdMs >= windowStart;

    if (r.stagePrefix !== null && r.stagePrefix >= 6 && closedInWindow) {
      const daysToClose =
        createdMs !== null && closeMs !== null ? Math.max(0, Math.round((closeMs - createdMs) / DAY_MS)) : undefined;
      won.push({ account, value, motion, product, daysToClose });
    }
    if (r.stagePrefix === -1 && closedInWindow) {
      lost.push({ account, value, motion, product });
    }
    if (createdInWindow) {
      const stage = r.stagePrefix !== null ? STAGE_LABEL_BY_PREFIX.get(r.stagePrefix) : undefined;
      created.push({ account, value, motion, product, stage });
    }
  }

  return { won: toColumn(won), lost: toColumn(lost), created: toColumn(created) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- pipeline.test.ts`
Expected: PASS (all `buildThisWeek` tests + existing pipeline tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/pipeline.ts src/features/home/lib/__tests__/pipeline.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): buildThisWeek — pure last-7-days deal bucketing"
```

---

## Task 2: Fetch deal rows in the source layer

**Files:**
- Modify: `src/features/home/lib/pipeline-source.ts`
- Modify: `src/features/home/lib/queries.ts`

This task is DB-bound; verification is the typecheck + the app rendering, not a unit test (matches the file's existing "verified live, not unit-tested" convention).

- [ ] **Step 1: Replace the `ThisWeek` interface with imports**

In `src/features/home/lib/pipeline-source.ts`, delete this block (lines ~13-17):

```ts
export interface ThisWeek {
  won: number; // caller's deals closed-won in the last 7 days
  lost: number; // closed-lost
  created: number; // opps created
}
```

Change the type import line:

```ts
import type { PipelineOpp, TargetRepAgg } from "./pipeline";
```

to:

```ts
import type { PipelineOpp, TargetRepAgg, ThisWeek, ThisWeekDealRow } from "./pipeline";
import { buildThisWeek } from "./pipeline";
```

The `PipelineData` interface already references `ThisWeek` (now imported) — leave it unchanged.

- [ ] **Step 2: Replace the `COUNT(*) FILTER` query with a row select**

In the `Promise.all`, replace the 5th element (the `prisma.$queryRaw<{ won; lost; created }[]>` block, lines ~80-87) with:

```ts
    // Caller's last-7-days movement, as deal rows (won/lost by close_date, created
    // by created_at). Bucketing + sign + totals happen in buildThisWeek. One rep ×
    // 7 days → a handful of rows, so no server-side pagination.
    prisma.$queryRaw<ThisWeekDealRow[]>`
      SELECT o.district_name AS account,
             o.net_booking_amount::float AS value,
             c.category AS category,
             o.contract_type AS "contractType",
             ${stagePrefixSql(Prisma.sql`o.stage`)} AS "stagePrefix",
             o.created_at AS "createdAt",
             o.close_date AS "closeDate"
      FROM opportunities o
      ${categoryJoin(sy)}
      WHERE o.school_yr = ${sy}
        AND o.sales_rep_email = ${callerEmail}
        AND o.net_booking_amount IS NOT NULL
        AND (o.created_at >= now() - interval '7 days'
             OR o.close_date >= now() - interval '7 days')`,
```

- [ ] **Step 3: Update the destructure + return**

The `Promise.all` destructure currently ends `..., week, targetsByRep]`. Rename `week` → `weekRows`:

```ts
  const [openOpps, won, target, weekRows, targetsByRep] = await Promise.all([
```

In the returned object, replace:

```ts
    thisWeek: { won: week[0]?.won ?? 0, lost: week[0]?.lost ?? 0, created: week[0]?.created ?? 0 },
```

with:

```ts
    thisWeek: buildThisWeek(weekRows, Date.now()),
```

- [ ] **Step 4: Repoint the `ThisWeek` import in queries.ts**

In `src/features/home/lib/queries.ts`, change:

```ts
import type { ThisWeek } from "./pipeline-source";
```

to:

```ts
import type { ThisWeek } from "./pipeline";
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors related to `pipeline-source.ts`, `queries.ts`, or `pipeline.ts`. (The old `ThisWeekCard` still imports `ThisWeek` from `pipeline-source` — see Task 4; it is deleted there. Until then tsc may flag that import. If you run tsc before Task 4, that single error is expected.)

- [ ] **Step 6: Commit**

```bash
git add src/features/home/lib/pipeline-source.ts src/features/home/lib/queries.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): fetch This-week deal rows + feed buildThisWeek"
```

---

## Task 3: `ThisWeekColumnCard` + `ThisWeekSection` components

**Files:**
- Create: `src/features/home/components/dashboard/pipeline/ThisWeekColumnCard.tsx`
- Create: `src/features/home/components/dashboard/pipeline/ThisWeekSection.tsx`
- Test: `src/features/home/components/dashboard/pipeline/__tests__/ThisWeekColumnCard.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `src/features/home/components/dashboard/pipeline/__tests__/ThisWeekColumnCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThisWeekColumnCard from "../ThisWeekColumnCard";
import type { ThisWeekColumn } from "@/features/home/lib/pipeline";

function col(n: number): ThisWeekColumn {
  const deals = Array.from({ length: n }, (_, i) => ({
    account: `Acct ${i}`,
    value: (n - i) * 1000,
    motion: i === 0 ? null : "Renewal",
    product: i === 0 ? null : "Tutoring",
    stage: "Discovery" as string | undefined,
  }));
  return { count: n, total: deals.reduce((s, d) => s + d.value, 0), deals };
}

describe("ThisWeekColumnCard", () => {
  it("shows only the top 5 deals and a Show-more affordance for the rest", () => {
    render(<ThisWeekColumnCard title="Newly Created" accent="#403770" sign="+" column={col(7)} />);
    expect(screen.getByText("Acct 0")).toBeInTheDocument();
    expect(screen.getByText("Acct 4")).toBeInTheDocument();
    expect(screen.queryByText("Acct 5")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show 2 more/i }));
    expect(screen.getByText("Acct 5")).toBeInTheDocument();
    expect(screen.getByText("Acct 6")).toBeInTheDocument();
  });

  it("omits null tags without leaving a stray separator", () => {
    render(<ThisWeekColumnCard title="Newly Created" accent="#403770" sign="+" column={col(1)} />);
    // Acct 0 has null motion + null product → only the stage shows, no leading "·".
    const tag = screen.getByText("Discovery");
    expect(tag.textContent).toBe("Discovery");
  });

  it("renders an empty state when there are no deals", () => {
    render(<ThisWeekColumnCard title="Closed Lost" accent="#F37167" sign="−" column={{ count: 0, total: 0, deals: [] }} />);
    expect(screen.getByText(/no deals/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- ThisWeekColumnCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ThisWeekColumnCard.tsx`**

Create `src/features/home/components/dashboard/pipeline/ThisWeekColumnCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { formatCurrency } from "@/features/shared/lib/format";
import type { ThisWeekColumn, ThisWeekDeal } from "@/features/home/lib/pipeline";

const TOP_N = 5;

// The tag line: motion · product · (Nd to close | stage). Nulls drop out so there
// are never stray separators.
function tagLine(d: ThisWeekDeal): string {
  const trailing = d.daysToClose != null ? `${d.daysToClose}d to close` : d.stage;
  return [d.motion, d.product, trailing].filter(Boolean).join(" · ");
}

export default function ThisWeekColumnCard({
  title,
  accent,
  sign,
  column,
}: {
  title: string;
  accent: string;
  sign: string; // "+" or "−"
  column: ThisWeekColumn;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? column.deals : column.deals.slice(0, TOP_N);
  const hidden = column.deals.length - visible.length;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {/* Column header: label + signed-count pill */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: accent }}>
          {title}
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap"
          style={{ color: accent, backgroundColor: `${accent}1A` }}
        >
          {sign}
          {column.count}
        </span>
      </div>

      {/* Count + $ total */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
          {column.count}
        </span>
        <span className="text-sm font-medium text-[#8A80A8] tabular-nums whitespace-nowrap">
          {formatCurrency(column.total, true)}
        </span>
      </div>

      {/* Deals */}
      {column.deals.length === 0 ? (
        <p className="text-xs text-[#8A80A8]">No deals.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((d, i) => (
            <li key={`${d.account}-${i}`} className="rounded-md border border-[#EFEDF5] bg-white px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-[#403770]">{d.account}</span>
                <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: accent }}>
                  {sign}
                  {formatCurrency(d.value, true)}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-[#8A80A8]">{tagLine(d)}</div>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-xs font-medium text-[#F37167] hover:underline"
        >
          Show {hidden} more
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- ThisWeekColumnCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement `ThisWeekSection.tsx`**

Create `src/features/home/components/dashboard/pipeline/ThisWeekSection.tsx`:

```tsx
"use client";

import type { ThisWeek } from "@/features/home/lib/pipeline";
import ThisWeekColumnCard from "./ThisWeekColumnCard";

// "Mar 17 → Mar 23" — the trailing 7-day window ending today (display-only).
function weekRangeLabel(now: Date): string {
  const start = new Date(now.getTime() - 6 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} → ${fmt(now)}`;
}

export default function ThisWeekSection({ thisWeek }: { thisWeek: ThisWeek }) {
  const range = weekRangeLabel(new Date());
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[#D4CFE2] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#403770] whitespace-nowrap">This week</h3>
          <p className="text-xs text-[#8A80A8]">
            Movement in your book over the last 7 days — won, lost, and newly created.
          </p>
        </div>
        <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">{range}</span>
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
        <ThisWeekColumnCard title="Closed Won" accent="#2E7D5B" sign="+" column={thisWeek.won} />
        <ThisWeekColumnCard title="Closed Lost" accent="#F37167" sign="−" column={thisWeek.lost} />
        <ThisWeekColumnCard title="Newly Created" accent="#403770" sign="+" column={thisWeek.created} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/home/components/dashboard/pipeline/ThisWeekColumnCard.tsx \
        src/features/home/components/dashboard/pipeline/ThisWeekSection.tsx \
        src/features/home/components/dashboard/pipeline/__tests__/ThisWeekColumnCard.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): This week section + column card components"
```

---

## Task 4: Wire into Pipeline + delete the old card

**Files:**
- Modify: `src/features/home/components/dashboard/pipeline/PipelineSection.tsx`
- Delete: `src/features/home/components/dashboard/pipeline/ThisWeekCard.tsx`

- [ ] **Step 1: Swap the import**

In `src/features/home/components/dashboard/pipeline/PipelineSection.tsx`, replace:

```ts
import ThisWeekCard from "./ThisWeekCard";
```

with:

```ts
import ThisWeekSection from "./ThisWeekSection";
```

- [ ] **Step 2: Move it into the main column above the top-opportunities table**

In the same file, in the main column, add the section directly above `<TopOpportunitiesTable ... />`:

```tsx
      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <CoverageCard coverage={data.coverage} />
        <StageFunnelCard funnel={data.funnel} opps={data.opps} />
        {data.thisWeek && <ThisWeekSection thisWeek={data.thisWeek} />}
        <TopOpportunitiesTable opps={data.opps} />
        <TopTargetsCard />
      </div>
```

Then remove the old card from the right rail — delete this line:

```tsx
        {data.thisWeek && <ThisWeekCard thisWeek={data.thisWeek} />}
```

so the right rail is just:

```tsx
      {/* Right rail (stacks under the main column when narrow) */}
      <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[320px]">
        <AtRiskCard atRisk={data.atRisk} />
      </div>
```

- [ ] **Step 3: Delete the superseded card**

```bash
git rm src/features/home/components/dashboard/pipeline/ThisWeekCard.tsx
```

- [ ] **Step 4: Typecheck + full test run**

Run: `npx tsc --noEmit && npm test -- pipeline`
Expected: no type errors; pipeline + ThisWeek tests pass.

- [ ] **Step 5: Visual check**

Run `npm run dev` (port 3005), open the dashboard → Pipeline tab. Confirm the "This week" section renders above Top open opportunities with three columns, signed pills, top-5 + "Show more", and the date range. Resize below `sm` to confirm columns stack.

- [ ] **Step 6: Commit**

```bash
git add src/features/home/components/dashboard/pipeline/PipelineSection.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): mount This week section in Pipeline, drop old card"
```

---

## Self-Review Notes

- **Spec coverage:** placement above top-opportunities (Task 4) ✓; full-width 3-column header with count/$total/signed pill (Task 3) ✓; per-deal row with motion·product·trailing, dropped lost reason (Tasks 1+3) ✓; top-5 + Show more (Task 3) ✓; data-layer row select + pure bucketing (Tasks 1+2) ✓; remove old card (Task 4) ✓; tests (Tasks 1+3) ✓.
- **Type consistency:** `ThisWeek`/`ThisWeekColumn`/`ThisWeekDeal`/`ThisWeekDealRow` defined once in `pipeline.ts`; `buildThisWeek(rows, nowMs)` signature consistent across source + tests; `ThisWeekColumnCard` prop names (`title`/`accent`/`sign`/`column`) match the test and `ThisWeekSection`.
- **Deferred (per spec):** WoW pill math, loss-reason capture.
