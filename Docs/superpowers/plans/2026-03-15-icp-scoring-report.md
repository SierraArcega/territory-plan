# ICP Scoring Interactive Report — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the table-only ICP scoring page with a 7-section interactive report that explains the scoring methodology, visualizes the portfolio, highlights insights, and provides a searchable explorer.

**Architecture:** Single client-rendered page at `/admin/icp-scoring` loading pre-scored district data from a static JSON file. 7 section components + shared utilities, using Recharts for charts and Tailwind with Fullmind design tokens for styling.

**Tech Stack:** Next.js 16 (App Router), React 19, Recharts 3, Tailwind CSS 4, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-15-icp-scoring-report-design.md`
**Tokens:** `Documentation/UI Framework/tokens.md`
**Tables:** `Documentation/UI Framework/Components/Tables/_foundations.md`

---

## Chunk 1: Foundation (types, hooks, shared, page shell)

### Task 1: Types and Constants

**Files:**
- Create: `src/app/admin/icp-scoring/types.ts`
- Create: `src/app/admin/icp-scoring/components/shared.tsx`

- [ ] **Step 1: Create types.ts**

The `District` interface shared by all components. Extract from the existing `page.tsx` lines 6-46.

```ts
// src/app/admin/icp-scoring/types.ts
export interface District {
  leaid: string;
  name: string;
  state: string;
  city: string | null;
  enrollment: number | null;
  frpl_rate: number | null;
  ell_pct: number | null;
  swd_pct: number | null;
  white_pct: number | null;
  math_proficiency: number | null;
  read_proficiency: number | null;
  chronic_absenteeism: number | null;
  graduation_rate: number | null;
  expenditure_per_pupil: number | null;
  student_teacher_ratio: number | null;
  number_of_schools: number | null;
  locale_code: number | null;
  enrollment_trend_3yr: number | null;
  staffing_trend_3yr: number | null;
  ell_trend_3yr: number | null;
  charter_payments: number | null;
  private_payments: number | null;
  charter_enrollment: number | null;
  debt_outstanding: number | null;
  lifetime_vendor_rev: number;
  vendor_count: number;
  is_customer: boolean;
  has_open_pipeline: boolean;
  owner: string | null;
  fit_score: number;
  value_score: number;
  readiness_score: number;
  state_score: number;
  composite_score: number;
  tier: string;
  fit_details: string;
  value_details: string;
  readiness_details: string;
  state_details: string;
}
```

- [ ] **Step 2: Create shared.tsx**

Shared constants (tier colors, score colors, locale map), helpers (`fmtNum`, `ScoreBar`, `SortArrow`), and the Recharts custom tooltip component. Extract from the existing `page.tsx` and add Recharts tooltip.

Key exports:
- `TIER_COLORS`, `TIER_FILLS`, `SCORE_COLORS`, `LOCALE_MAP` — color/label constants
- `fmtNum(v, opts)` — number formatter (pct, dollar, compact)
- `ScoreBar({ value, color })` — horizontal progress bar with numeric label
- `SortArrow({ direction, active })` — dual-arrow sort indicator SVG
- `ChartTooltip` — styled Recharts tooltip component matching brand tokens
- `SectionCard({ title, description, children })` — wrapper for each report section

All colors must use the hex values from the spec's Token Compliance table. Reference `Documentation/UI Framework/tokens.md` for every value.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit src/app/admin/icp-scoring/types.ts`

---

### Task 2: Data Hook and Page Shell

**Files:**
- Create: `src/app/admin/icp-scoring/hooks.ts`
- Modify: `src/app/admin/icp-scoring/page.tsx` (full rewrite)

- [ ] **Step 1: Create hooks.ts**

```ts
// src/app/admin/icp-scoring/hooks.ts
"use client";
import { useState, useEffect, useCallback } from "react";
import type { District } from "./types";

export function useDistrictScores() {
  const [data, setData] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch("/district_scores.json")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: District[]) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, retry: fetchData };
}
```

- [ ] **Step 2: Rewrite page.tsx as shell**

The page becomes a thin shell that:
1. Calls `useDistrictScores()`
2. Renders sticky header (title + Export CSV button)
3. Shows loading skeleton, error state, or the 7 sections
4. Sections are rendered in a `flex flex-col gap-6` container inside `max-w-[1600px] mx-auto px-6 py-6`

The loading state: 4 rounded placeholder cards (`bg-[#F7F5FA] rounded-lg h-48 animate-pulse`) stacked vertically.

The error state: centered alert icon + "Something went wrong" + retry button (matching DataGrid pattern from `src/features/shared/components/DataGrid/DataGrid.tsx` lines 393-427).

Each section component is imported and rendered with `data={data}`:
```tsx
{!loading && !error && data.length > 0 && (
  <div className="flex flex-col gap-6">
    <HeroSection data={data} />
    <TierDistribution data={data} />
    <ScoreDistribution data={data} />
    <StateLandscape data={data} />
    <WildCardSignals data={data} />
    <TopProspects data={data} />
    <DistrictExplorer data={data} />
  </div>
)}
```

For now, create placeholder components that just render `<SectionCard title="..."><p>TODO</p></SectionCard>`. We'll implement each in subsequent tasks.

- [ ] **Step 3: Verify page builds and renders**

Run: `npx next build 2>&1 | grep -E "(icp-scoring|Error|✓ Compiled)"`
Expected: `✓ Compiled` + `├ ƒ /admin/icp-scoring`

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/icp-scoring/
git commit -m "feat(icp-scoring): foundation — types, hooks, shared components, page shell"
```

---

## Chunk 2: Sections 1-3 (Hero, Tier Distribution, Score Distribution)

### Task 3: HeroSection

**Files:**
- Create: `src/app/admin/icp-scoring/components/HeroSection.tsx`

- [ ] **Step 1: Implement HeroSection**

Two-column layout (`grid grid-cols-5 gap-8` — left 3 cols, right 2 cols).

**Left column:**
- Title: `text-2xl font-bold text-[#403770]`
- Subtitle: `text-sm text-[#8A80A8] mt-1`
- Methodology blocks: 4 rows, each with a colored bar (width proportional to weight — 30%, 25%, 25%, 20%), label, and description
- Bar container: `h-3 rounded-full` with the sub-score color
- Label: `text-sm font-semibold` in the sub-score color
- Description: `text-xs text-[#8A80A8]`

**Right column:**
- 2x4 grid of stat cards
- Compute stats via `useMemo`: total, t1Count, t2Count, customers, prospects, totalRev, avgScore
- 8th card: "Data Freshness" with value "Mar 15, 2026"
- Use stat card styles from spec (bg-[#F7F5FA], etc.)

- [ ] **Step 2: Wire into page.tsx**

Replace the HeroSection placeholder import with the real component.

- [ ] **Step 3: Verify renders**

Start dev server, navigate to page, confirm hero section appears with methodology blocks and stat cards.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/icp-scoring/components/HeroSection.tsx src/app/admin/icp-scoring/page.tsx
git commit -m "feat(icp-scoring): hero section with methodology + stats"
```

---

### Task 4: TierDistribution

**Files:**
- Create: `src/app/admin/icp-scoring/components/TierDistribution.tsx`

- [ ] **Step 1: Implement TierDistribution**

Compute tier stats via `useMemo`:
```ts
const tiers = useMemo(() => {
  const tierNames = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"] as const;
  return tierNames.map(name => {
    const districts = data.filter(d => d.tier === name);
    return {
      name,
      count: districts.length,
      pct: (districts.length / data.length * 100),
      customers: districts.filter(d => d.is_customer).length,
      prospects: districts.filter(d => !d.is_customer).length,
      revenue: districts.reduce((s, d) => s + d.lifetime_vendor_rev, 0),
      avgEnrollment: districts.length ? districts.reduce((s, d) => s + (d.enrollment || 0), 0) / districts.length : 0,
    };
  });
}, [data]);
```

**Stacked bar:** A flex row of 4 divs, each with `flex-grow` set to the tier's percentage. First segment gets `rounded-l-lg`, last gets `rounded-r-lg`. Height `h-8`. Percentage label centered inside (white text if segment wide enough, else positioned above in the tier's text color).

**Tier cards:** 4-column grid below. Each card: `bg-white rounded-lg border border-[#D4CFE2] p-4` with `border-l-3` in tier color. Show: tier name + color dot, count + %, customers/prospects, revenue, avg enrollment.

- [ ] **Step 2: Wire into page.tsx, verify, commit**

```bash
git add src/app/admin/icp-scoring/components/TierDistribution.tsx src/app/admin/icp-scoring/page.tsx
git commit -m "feat(icp-scoring): tier distribution stacked bar + detail cards"
```

---

### Task 5: ScoreDistribution

**Files:**
- Create: `src/app/admin/icp-scoring/components/ScoreDistribution.tsx`

- [ ] **Step 1: Implement ScoreDistribution**

Compute histogram buckets via `useMemo`:
```ts
const buckets = useMemo(() => {
  const bins = Array.from({ length: 20 }, (_, i) => ({
    range: `${i * 5}-${i * 5 + 4}`,
    min: i * 5,
    count: 0,
    customers: 0,
  }));
  data.forEach(d => {
    const idx = Math.min(19, Math.floor(d.composite_score / 5));
    bins[idx].count++;
    if (d.is_customer) bins[idx].customers++;
  });
  return bins;
}, [data]);
```

**Recharts BarChart:**
- `<ResponsiveContainer width="100%" height={200}>`
- `<BarChart data={buckets}>`
- `<Bar dataKey="count">` with `<Cell>` elements colored by score range (≥60 coral, 40-59 gold, 20-39 secondary, <20 border-default)
- `<XAxis dataKey="range" tick={{ fill: "#8A80A8", fontSize: 11 }} />`
- `<YAxis tick={{ fill: "#8A80A8", fontSize: 11 }} />`
- Custom `<Tooltip>` using `ChartTooltip` from shared.tsx
- `<CartesianGrid horizontal strokeDasharray="3 3" stroke="#E2DEEC" />`
- Bar `radius={[4, 4, 0, 0]}`

**Sub-score averages table:**
Compute 5 score ranges (80-100, 60-79, 40-59, 20-39, 0-19), for each compute: count, customers, avgFit, avgValue, avgReadiness, avgState.

Compact table: `px-3 py-2`, header `bg-[#F7F5FA]`, `text-[11px]` headers.

- [ ] **Step 2: Wire into page.tsx, verify, commit**

```bash
git add src/app/admin/icp-scoring/components/ScoreDistribution.tsx src/app/admin/icp-scoring/page.tsx
git commit -m "feat(icp-scoring): score distribution histogram + sub-score averages"
```

---

## Chunk 3: Sections 4-6 (State, Wild Cards, Prospects)

### Task 6: StateLandscape

**Files:**
- Create: `src/app/admin/icp-scoring/components/StateLandscape.tsx`

- [ ] **Step 1: Implement StateLandscape**

Compute per-state aggregation via `useMemo`:
```ts
const stateStats = useMemo(() => {
  const map = new Map<string, { total: number; t1: number; t2: number; customers: number; revenue: number; scoreSum: number; tierCounts: number[] }>();
  data.forEach(d => {
    const s = map.get(d.state) || { total: 0, t1: 0, t2: 0, customers: 0, revenue: 0, scoreSum: 0, tierCounts: [0, 0, 0, 0] };
    s.total++;
    if (d.tier === "Tier 1") { s.t1++; s.tierCounts[0]++; }
    else if (d.tier === "Tier 2") { s.t2++; s.tierCounts[1]++; }
    else if (d.tier === "Tier 3") s.tierCounts[2]++;
    else s.tierCounts[3]++;
    if (d.is_customer) s.customers++;
    s.revenue += d.lifetime_vendor_rev;
    s.scoreSum += d.composite_score;
    map.set(d.state, s);
  });
  return Array.from(map.entries()).map(([state, s]) => ({
    state, ...s,
    penetration: s.total > 0 ? (s.customers / s.total * 100) : 0,
    avgScore: s.total > 0 ? s.scoreSum / s.total : 0,
  }));
}, [data]);
```

Sortable table with local sort state. Default sort: `t1 + t2` descending. Columns per spec. Each row has a mini tier bar (80px wide flex row with 4 colored segments proportional to tierCounts).

Show top 30 by default with "Show all states" button.

- [ ] **Step 2: Wire into page.tsx, verify, commit**

```bash
git add src/app/admin/icp-scoring/components/StateLandscape.tsx src/app/admin/icp-scoring/page.tsx
git commit -m "feat(icp-scoring): state landscape sortable table with tier bars"
```

---

### Task 7: WildCardSignals

**Files:**
- Create: `src/app/admin/icp-scoring/components/WildCardSignals.tsx`

- [ ] **Step 1: Implement WildCardSignals**

3-column grid. Each card is a `SectionCard`-like container with title, insight text, and a horizontal Recharts `BarChart`.

**Card 1 — Outsourcing:**
Bucket districts by `charter_payments + private_payments`: No payments, <$1M, $1-5M, $5-20M, $20M+. For each bucket: total districts, customers. Penetration = customers/total * 100.

**Card 2 — Enrollment Trend:**
Bucket by `enrollment_trend_3yr`: <-5 (Sharp Decline), -5 to -2 (Moderate), -2 to 0 (Slight), 0 to 2 (Stable), >2 (Growing). Same penetration calc.

**Card 3 — Multi-Vendor:**
Bucket by `vendor_count`: 0, 1, 2, 3, 4+. Metric: avg `lifetime_vendor_rev` per bucket.

Recharts horizontal `BarChart`:
- `layout="vertical"`
- `<XAxis type="number">` (penetration % or avg revenue)
- `<YAxis type="category" dataKey="label">` (bucket names)
- Bar fill: `#403770` (Plum)
- Height: ~160px per chart
- Custom tooltip

- [ ] **Step 2: Wire into page.tsx, verify, commit**

```bash
git add src/app/admin/icp-scoring/components/WildCardSignals.tsx src/app/admin/icp-scoring/page.tsx
git commit -m "feat(icp-scoring): wild card signal insight cards with charts"
```

---

### Task 8: TopProspects

**Files:**
- Create: `src/app/admin/icp-scoring/components/TopProspects.tsx`

- [ ] **Step 1: Implement TopProspects**

Compute prospects via `useMemo`:
```ts
const prospects = useMemo(() =>
  data.filter(d => !d.is_customer)
    .sort((a, b) => b.composite_score - a.composite_score),
[data]);
```

State: `showCount` starting at 30, incremented by 30 on "Show more" click.

2-column grid of prospect cards. Each card layout:
- `flex items-start gap-4 p-4`
- Left: composite score (`text-2xl font-bold text-[#544A78] tabular-nums`) + tier badge below
- Center (`flex-1`): district name (`text-sm font-medium text-[#403770]`), city + state (`text-xs text-[#8A80A8]`), enrollment
- Right: 4 `ScoreBar` components (Fit/Value/Readiness/State), compact (`min-w-[100px]`)
- Bottom: fact pills — FRPL%, enrollment (compact), enrollment trend, vendor count. Each pill: `bg-[#F7F5FA] text-[#6E6390] text-xs px-2 py-0.5 rounded-full`

"Show more" button: `text-sm font-medium text-[#403770] border border-[#D4CFE2] rounded-lg px-4 py-2 hover:bg-[#EFEDF5]`

- [ ] **Step 2: Wire into page.tsx, verify, commit**

```bash
git add src/app/admin/icp-scoring/components/TopProspects.tsx src/app/admin/icp-scoring/page.tsx
git commit -m "feat(icp-scoring): top prospects cards with score bars + fact pills"
```

---

## Chunk 4: Section 7 (Full Explorer) + Final Polish

### Task 9: DistrictExplorer

**Files:**
- Create: `src/app/admin/icp-scoring/components/DistrictExplorer.tsx`

- [ ] **Step 1: Implement DistrictExplorer**

This is the existing table from the current `page.tsx`, extracted into its own component. It manages its own filter/sort/pagination state internally.

Key elements (already built, extract and refine):
- Search input, tier/state/status selects, clear filters button
- Sortable table with sticky `<th>` headers (`sticky top-0 z-10 bg-[#F7F5FA]`)
- `SortArrow` component on each header
- Data rows with score bars, tier badges, status badges
- Click to expand → 4-column detail panel (`ExpandedDetail`)
- Footer summary bar inside the card
- Pagination below the card (Previous/Next + rows-per-page)
- Empty filtered state with clear-filters CTA

Follow DataGrid patterns from `src/features/shared/components/DataGrid/DataGrid.tsx`:
- `role="grid"` + `aria-rowcount` + `aria-colcount` on table
- `aria-sort` on column headers
- `aria-live="polite"` on footer
- Cell padding: `px-4 py-3`
- Header text: `text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider`
- Row hover: `hover:bg-[#EFEDF5]`
- Expanded: `bg-[#C4E7E6]/15`
- Disabled buttons: `opacity-50 cursor-not-allowed`

- [ ] **Step 2: Wire into page.tsx, verify, commit**

```bash
git add src/app/admin/icp-scoring/components/DistrictExplorer.tsx src/app/admin/icp-scoring/page.tsx
git commit -m "feat(icp-scoring): full district explorer with filters, sort, expand, pagination"
```

---

### Task 10: Final Polish + Build Verification

**Files:**
- Modify: `src/app/admin/icp-scoring/page.tsx` (remove any remaining placeholder code)

- [ ] **Step 1: Remove old page code**

Ensure `page.tsx` is just the shell — imports, hook, loading/error states, and 7 section components. Delete any leftover inline table/component code from the old implementation.

- [ ] **Step 2: Full build**

Run: `npx next build 2>&1 | grep -E "(Error|error|✓ Compiled|icp-scoring)"`
Expected: Clean compile with `/admin/icp-scoring` listed.

- [ ] **Step 3: Visual check**

Start dev server on port 5214: `npx next dev -p 5214`
Navigate to `http://localhost:5214/admin/icp-scoring`
Verify:
- Loading skeleton appears briefly, then all 7 sections render
- Hero section: methodology blocks + 8 stat cards
- Tier distribution: stacked bar + 4 detail cards
- Score distribution: histogram + sub-score table
- State landscape: sortable table with mini tier bars
- Wild card signals: 3 insight cards with horizontal bar charts
- Top prospects: 30 cards with score bars and fact pills, "Show more" works
- District explorer: search, filter, sort, expand, paginate all work
- Horizontal scroll works on the explorer table
- All colors are brand tokens (no slate/gray/indigo)

- [ ] **Step 4: Commit final polish**

```bash
git add src/app/admin/icp-scoring/
git commit -m "feat(icp-scoring): final polish and cleanup"
```

---

## Task Dependencies

```
Task 1 (types + shared) ──┬──> Task 3 (Hero)
                          ├──> Task 4 (Tier Distribution)
Task 2 (hooks + shell) ───┤──> Task 5 (Score Distribution)
                          ├──> Task 6 (State Landscape)
                          ├──> Task 7 (Wild Cards)
                          ├──> Task 8 (Top Prospects)
                          └──> Task 9 (District Explorer)
                                    │
                                    └──> Task 10 (Polish)
```

Tasks 1-2 must complete first (foundation). Tasks 3-9 can be built in any order but must be wired into `page.tsx` sequentially. Task 10 is the final pass.

For subagent execution: Tasks 1-2 run sequentially first, then Tasks 3-9 can be dispatched in parallel (each in its own worktree), then Task 10 runs last.
