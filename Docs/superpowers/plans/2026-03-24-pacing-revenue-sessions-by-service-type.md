# Pacing Revenue + Sessions by Service Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine the Revenue and Sessions rows in the YoY Pacing table into a single expandable row with per-service-type breakdown showing full YoY comparison.

**Architecture:** Add 3 new SQL queries joining `sessions` → `opportunities` grouped by `service_type` to the territory plan API. Derive the parent Revenue & Sessions row by summing the children so numbers always reconcile. Refactor `PacingTable` component with an expandable first row and sub-rows.

**Tech Stack:** Next.js App Router API (Prisma raw SQL), TypeScript, React, Tailwind CSS, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-03-24-pacing-revenue-sessions-by-service-type-design.md`
**Backend context:** `docs/superpowers/specs/2026-03-24-pacing-revenue-sessions-backend-context.md`
**Frontend context:** `docs/superpowers/specs/2026-03-24-pacing-revenue-sessions-frontend-context.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/features/shared/types/api-types.ts:339-352` | Add `ServiceTypePacing` interface, extend `DistrictPacing` |
| Modify | `src/app/api/territory-plans/[id]/route.ts:99-224` | Add 3 sessions-table queries, build service-type lookup, restructure pacing response |
| Modify | `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:443-508` | Refactor `PacingTable`: combined expandable row + sub-rows |
| Create | `src/features/map/components/SearchResults/__tests__/PacingTable.test.tsx` | Unit tests for the refactored PacingTable |

---

### Task 1: Add TypeScript Types

**Files:**
- Modify: `src/features/shared/types/api-types.ts:339-352`

- [ ] **Step 1: Add `ServiceTypePacing` interface and extend `DistrictPacing`**

Open `src/features/shared/types/api-types.ts`. After the existing `DistrictPacing` interface (line 352), add the new interface. Then add the optional field to `DistrictPacing`.

```typescript
// Add AFTER DistrictPacing closing brace (after line 352):
export interface ServiceTypePacing {
  serviceType: string;
  currentRevenue: number;
  currentSessions: number;
  priorSameDateRevenue: number;
  priorSameDateSessions: number;
  priorFullRevenue: number;
  priorFullSessions: number;
}

// Add INSIDE DistrictPacing, after priorFullSessions (line 351):
  serviceTypeBreakdown?: ServiceTypePacing[];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing errors may be present but none related to the new types)

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/types/api-types.ts
git commit -m "feat: add ServiceTypePacing type and extend DistrictPacing"
```

---

### Task 2: Add Sessions-Table Queries to API

**Files:**
- Modify: `src/app/api/territory-plans/[id]/route.ts:99-224`

**References:**
- Backend context doc for query patterns and data source analysis
- Existing pacing queries at lines 107-146
- Pacing assembly at lines 205-224

- [ ] **Step 1: Add SessionServiceRow type and 3 new queries**

After the existing `PacingRow` type declaration (line 100) and before the `try` block (line 107), add the new type and variable declarations.

Add after line 105 (after `oneYearAgo.setFullYear(...)`) :
```typescript
type SessionServiceRow = {
  district_lea_id: string;
  service_type: string;
  sessions: number;
  revenue: number;
};
let currentSessionsByService: SessionServiceRow[] = [];
let priorSameDateSessionsByService: SessionServiceRow[] = [];
let priorFullSessionsByService: SessionServiceRow[] = [];
```

Add a **separate** `try/catch` block after the existing one (after line 146 `}`). This keeps sessions queries independent — if the sessions table doesn't exist, pacing pipeline/deals data is unaffected:

```typescript
try {
  [currentSessionsByService, priorSameDateSessionsByService, priorFullSessionsByService] = await Promise.all([
    prisma.$queryRaw<SessionServiceRow[]>`
      SELECT o.district_lea_id,
             COALESCE(NULLIF(s.service_type, ''), 'Other') AS service_type,
             COUNT(*)::int AS sessions,
             COALESCE(SUM(s.session_price), 0) AS revenue
      FROM sessions s
      JOIN opportunities o ON o.id = s.opportunity_id
      WHERE o.district_lea_id = ANY(${allLeaIds})
        AND o.school_yr = ${schoolYr}
      GROUP BY o.district_lea_id, COALESCE(NULLIF(s.service_type, ''), 'Other')
    `,
    prisma.$queryRaw<SessionServiceRow[]>`
      SELECT o.district_lea_id,
             COALESCE(NULLIF(s.service_type, ''), 'Other') AS service_type,
             COUNT(*)::int AS sessions,
             COALESCE(SUM(s.session_price), 0) AS revenue
      FROM sessions s
      JOIN opportunities o ON o.id = s.opportunity_id
      WHERE o.district_lea_id = ANY(${allLeaIds})
        AND o.school_yr = ${priorSchoolYr}
        AND s.start_time <= ${oneYearAgo}
      GROUP BY o.district_lea_id, COALESCE(NULLIF(s.service_type, ''), 'Other')
    `,
    prisma.$queryRaw<SessionServiceRow[]>`
      SELECT o.district_lea_id,
             COALESCE(NULLIF(s.service_type, ''), 'Other') AS service_type,
             COUNT(*)::int AS sessions,
             COALESCE(SUM(s.session_price), 0) AS revenue
      FROM sessions s
      JOIN opportunities o ON o.id = s.opportunity_id
      WHERE o.district_lea_id = ANY(${allLeaIds})
        AND o.school_yr = ${priorSchoolYr}
      GROUP BY o.district_lea_id, COALESCE(NULLIF(s.service_type, ''), 'Other')
    `,
  ]);
} catch {
  // Sessions table may not exist yet — breakdown will be empty
}
```

- [ ] **Step 2: Build service-type lookup maps**

Add after the existing `priorFullByDistrict` Map creation (after line 150), before `return NextResponse.json`:

```typescript
// Build per-district, per-service-type lookup
// Structure: Map<leaid, Map<serviceType, { current, sameDate, full }>>
type ServiceAgg = { revenue: number; sessions: number };
const serviceTypeLookup = new Map<string, Map<string, { current: ServiceAgg; sameDate: ServiceAgg; full: ServiceAgg }>>();

function ensureEntry(leaid: string, st: string) {
  if (!serviceTypeLookup.has(leaid)) serviceTypeLookup.set(leaid, new Map());
  const byType = serviceTypeLookup.get(leaid)!;
  if (!byType.has(st)) byType.set(st, {
    current: { revenue: 0, sessions: 0 },
    sameDate: { revenue: 0, sessions: 0 },
    full: { revenue: 0, sessions: 0 },
  });
  return byType.get(st)!;
}

for (const r of currentSessionsByService) {
  const e = ensureEntry(r.district_lea_id, r.service_type);
  e.current = { revenue: Number(r.revenue), sessions: Number(r.sessions) };
}
for (const r of priorSameDateSessionsByService) {
  const e = ensureEntry(r.district_lea_id, r.service_type);
  e.sameDate = { revenue: Number(r.revenue), sessions: Number(r.sessions) };
}
for (const r of priorFullSessionsByService) {
  const e = ensureEntry(r.district_lea_id, r.service_type);
  e.full = { revenue: Number(r.revenue), sessions: Number(r.sessions) };
}
```

- [ ] **Step 3: Update pacing assembly to include serviceTypeBreakdown and derive revenue/sessions from sessions table**

Replace the pacing IIFE at lines 205-224 with:

```typescript
pacing: (() => {
  const cp = currentPacingByDistrict.get(pd.districtLeaid);
  const psd = priorSameDateByDistrict.get(pd.districtLeaid);
  const pf = priorFullByDistrict.get(pd.districtLeaid);
  const stMap = serviceTypeLookup.get(pd.districtLeaid);

  if (!cp && !psd && !pf && !stMap) return undefined;

  // Build serviceTypeBreakdown array
  const breakdown = stMap
    ? Array.from(stMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([serviceType, agg]) => ({
          serviceType,
          currentRevenue: agg.current.revenue,
          currentSessions: agg.current.sessions,
          priorSameDateRevenue: agg.sameDate.revenue,
          priorSameDateSessions: agg.sameDate.sessions,
          priorFullRevenue: agg.full.revenue,
          priorFullSessions: agg.full.sessions,
        }))
    : [];

  // Derive revenue/sessions totals from breakdown so parent = sum of children
  const sumField = (field: keyof typeof breakdown[0]) =>
    breakdown.reduce((acc, row) => acc + (row[field] as number), 0);

  return {
    currentRevenue: breakdown.length > 0 ? sumField("currentRevenue") : (cp ? Number(cp.revenue) : 0),
    currentPipeline: cp ? Number(cp.pipeline) : 0,
    currentDeals: cp ? Number(cp.deals) : 0,
    currentSessions: breakdown.length > 0 ? sumField("currentSessions") : (cp ? Number(cp.sessions) : 0),
    priorSameDateRevenue: breakdown.length > 0 ? sumField("priorSameDateRevenue") : (psd ? Number(psd.revenue) : 0),
    priorSameDatePipeline: psd ? Number(psd.pipeline) : 0,
    priorSameDateDeals: psd ? Number(psd.deals) : 0,
    priorSameDateSessions: breakdown.length > 0 ? sumField("priorSameDateSessions") : (psd ? Number(psd.sessions) : 0),
    priorFullRevenue: breakdown.length > 0 ? sumField("priorFullRevenue") : (pf ? Number(pf.revenue) : 0),
    priorFullPipeline: pf ? Number(pf.pipeline) : 0,
    priorFullDeals: pf ? Number(pf.deals) : 0,
    priorFullSessions: breakdown.length > 0 ? sumField("priorFullSessions") : (pf ? Number(pf.sessions) : 0),
    serviceTypeBreakdown: breakdown.length > 0 ? breakdown : undefined,
  };
})(),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Smoke test with dev server**

Run: `npm run dev` (port 3005). Open a plan with districts that have session data. Open browser devtools Network tab, find the `/api/territory-plans/[id]` response, and verify:
- `pacing.serviceTypeBreakdown` array appears on districts with sessions
- `pacing.currentRevenue` / `pacing.currentSessions` match the sum of breakdown entries
- Districts without sessions still have `pacing` with pipeline/deals

- [ ] **Step 6: Commit**

```bash
git add src/app/api/territory-plans/[id]/route.ts
git commit -m "feat: add per-service-type session/revenue breakdown to pacing API"
```

---

### Task 3: Write PacingTable Tests

**Files:**
- Create: `src/features/map/components/SearchResults/__tests__/PacingTable.test.tsx`

**Important:** PacingTable is a private function inside `PlanDistrictsTab.tsx`. To test it independently, we need to either export it or test it through the DistrictRow. The simplest approach: extract and export `PacingTable` from PlanDistrictsTab, then import in tests.

- [ ] **Step 1: Export PacingTable from PlanDistrictsTab.tsx**

At line 445, change `function PacingTable` to `export function PacingTable`. This is the only change needed — it's already a standalone function.

```typescript
// Line 445: change from:
function PacingTable({ pacing, fiscalYear }: { pacing?: DistrictPacing; fiscalYear: number }) {
// to:
export function PacingTable({ pacing, fiscalYear }: { pacing?: DistrictPacing; fiscalYear: number }) {
```

- [ ] **Step 2: Write test file with mock data and test cases**

Create `src/features/map/components/SearchResults/__tests__/PacingTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { PacingTable } from "../PlanDistrictsTab";
import type { DistrictPacing } from "@/features/shared/types/api-types";

const basePacing: DistrictPacing = {
  currentRevenue: 100000,
  currentPipeline: 50000,
  currentDeals: 3,
  currentSessions: 160,
  priorSameDateRevenue: 40000,
  priorSameDatePipeline: 30000,
  priorSameDateDeals: 2,
  priorSameDateSessions: 80,
  priorFullRevenue: 180000,
  priorFullPipeline: 60000,
  priorFullDeals: 5,
  priorFullSessions: 820,
};

const pacingWithBreakdown: DistrictPacing = {
  ...basePacing,
  serviceTypeBreakdown: [
    {
      serviceType: "Tutoring",
      currentRevenue: 60000,
      currentSessions: 100,
      priorSameDateRevenue: 25000,
      priorSameDateSessions: 50,
      priorFullRevenue: 120000,
      priorFullSessions: 600,
    },
    {
      serviceType: "Virtual Staffing",
      currentRevenue: 40000,
      currentSessions: 60,
      priorSameDateRevenue: 15000,
      priorSameDateSessions: 30,
      priorFullRevenue: 60000,
      priorFullSessions: 220,
    },
  ],
};

describe("PacingTable", () => {
  it("renders empty state when pacing is undefined", () => {
    render(<PacingTable fiscalYear={27} />);
    expect(screen.getByText("No prior year data")).toBeInTheDocument();
  });

  it("renders combined Revenue & Sessions row in collapsed state", () => {
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    // Should show combined format "$100.0K / 160"
    expect(screen.getByText(/\$100\.0K\s*\/\s*160/)).toBeInTheDocument();
    // Pipeline and Deals rows should still exist
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Deals")).toBeInTheDocument();
    // Should NOT have separate "Revenue" and "Sessions" labels
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
    expect(screen.queryByText("Sessions")).not.toBeInTheDocument();
  });

  it("shows Revenue & Sessions label for combined row", () => {
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    expect(screen.getByText("Revenue & Sessions")).toBeInTheDocument();
  });

  it("does not show service type sub-rows when collapsed", () => {
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
    expect(screen.queryByText("Virtual Staffing")).not.toBeInTheDocument();
  });

  it("expands to show service type sub-rows with values on click", async () => {
    const user = userEvent.setup();
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);

    await user.click(screen.getByText("Revenue & Sessions"));

    // Service type labels appear
    expect(screen.getByText("Tutoring")).toBeInTheDocument();
    expect(screen.getByText("Virtual Staffing")).toBeInTheDocument();
    // Sub-row values show combined format
    expect(screen.getByText(/\$60\.0K\s*\/\s*100/)).toBeInTheDocument();
    expect(screen.getByText(/\$40\.0K\s*\/\s*60/)).toBeInTheDocument();
  });

  it("collapses sub-rows on second click", async () => {
    const user = userEvent.setup();
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);

    await user.click(screen.getByText("Revenue & Sessions"));
    expect(screen.getByText("Tutoring")).toBeInTheDocument();

    await user.click(screen.getByText("Revenue & Sessions"));
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
  });

  it("does not render chevron when no serviceTypeBreakdown", () => {
    render(<PacingTable pacing={basePacing} fiscalYear={27} />);
    // Revenue & Sessions row should exist but without expand capability
    expect(screen.getByText("Revenue & Sessions")).toBeInTheDocument();
    // No sub-rows should appear even if somehow clicked
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
  });

  it("renders Pipeline and Deals as currency and count respectively", () => {
    render(<PacingTable pacing={basePacing} fiscalYear={27} />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Deals")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/map/components/SearchResults/__tests__/PacingTable.test.tsx`
Expected: Tests FAIL because PacingTable still has separate Revenue/Sessions rows and no "Revenue & Sessions" label

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchResults/__tests__/PacingTable.test.tsx src/features/map/components/SearchResults/PlanDistrictsTab.tsx
git commit -m "test: add failing tests for combined Revenue & Sessions pacing row"
```

---

### Task 4: Refactor PacingTable Component

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:443-508`

**References:**
- Frontend context doc for current PacingTable structure, CSS classes, helper functions
- Existing expand/collapse pattern in DistrictRow (same file)

- [ ] **Step 1: Add useState import check**

Verify `useState` is already imported at line 3. It is: `import { useState, useMemo, useCallback, useRef, useEffect } from "react";`. No change needed.

- [ ] **Step 2: Replace PacingTable function body**

Replace the entire `PacingTable` function (lines 445-508) with the refactored version. The function signature stays the same but add `useState` for expand state.

```tsx
export function PacingTable({ pacing, fiscalYear }: { pacing?: DistrictPacing; fiscalYear: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const fyShort = String(fiscalYear).slice(-2);
  const priorFyShort = String(fiscalYear - 1).slice(-2);

  const hasBreakdown = pacing?.serviceTypeBreakdown && pacing.serviceTypeBreakdown.length > 0;

  // Format combined "$revenue / sessions" display
  const fmtCombined = (revenue: number, sessions: number) =>
    `${formatCurrency(revenue)} / ${sessions}`;

  // Pipeline and Deals metrics (unchanged from before)
  const otherMetrics = pacing
    ? [
        { label: "Pipeline", current: pacing.currentPipeline, sameDate: pacing.priorSameDatePipeline, full: pacing.priorFullPipeline, isCurrency: true },
        { label: "Deals", current: pacing.currentDeals, sameDate: pacing.priorSameDateDeals, full: pacing.priorFullDeals, isCurrency: false },
      ]
    : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0]">Year-over-Year Pacing</span>
        <span className="text-[8px] text-[#8A80A8] bg-[#f0edf5] px-1.5 py-0.5 rounded">FY{fyShort} vs FY{priorFyShort}</span>
      </div>
      <div className="bg-white border border-[#E2DEEC] rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] bg-[#FAFAFE] border-b border-[#E2DEEC]">
          <div className="px-2 py-1" />
          <div className="px-2 py-1" />
          <div className="px-2 py-1 text-center border-l border-[#E2DEEC] text-[8px] font-bold text-[#8A80A8]">Same Date PFY</div>
          <div className="px-2 py-1 text-center border-l border-[#E2DEEC] text-[8px] font-bold text-[#8A80A8]">Full PFY</div>
        </div>

        {!pacing ? (
          <div className="px-3 py-4 text-center text-[10px] text-[#C2BBD4] italic">No prior year data</div>
        ) : (
          <>
            {/* Combined Revenue & Sessions row */}
            <div
              className={`grid grid-cols-[1fr_1fr_1fr_1fr] items-center py-1.5 border-b border-[#f0edf5] ${hasBreakdown ? "cursor-pointer hover:bg-[#FAFAFE]" : ""}`}
              onClick={hasBreakdown ? () => setIsExpanded(!isExpanded) : undefined}
            >
              <span className="px-2 text-[10px] text-[#6E6390] font-medium flex items-center gap-1">
                {hasBreakdown && (
                  <svg
                    width="6"
                    height="6"
                    viewBox="0 0 6 6"
                    className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <path d="M1.5 0.5L4.5 3L1.5 5.5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
                  </svg>
                )}
                Revenue &amp; Sessions
              </span>
              <span className="px-2 text-right text-[11px] font-bold text-[#544A78] tabular-nums">
                {fmtCombined(pacing.currentRevenue, pacing.currentSessions)}
              </span>
              <div className="px-2 text-center border-l border-[#f0edf5]">
                <span className="text-[10px] text-[#8A80A8] tabular-nums">
                  {fmtCombined(pacing.priorSameDateRevenue, pacing.priorSameDateSessions)}{" "}
                </span>
                {(() => {
                  const badge = getPaceBadge(pacing.currentRevenue, pacing.priorSameDateRevenue);
                  return badge ? <span className={`text-[7px] px-1 py-0.5 rounded ${badge.bg} ${badge.text} font-semibold`}>{badge.label}</span> : null;
                })()}
              </div>
              <div className="px-2 text-center border-l border-[#f0edf5]">
                <span className="text-[10px] text-[#8A80A8] tabular-nums">
                  {fmtCombined(pacing.priorFullRevenue, pacing.priorFullSessions)}{" "}
                </span>
                {(() => {
                  const badge = getPercentOfBadge(pacing.currentRevenue, pacing.priorFullRevenue);
                  return badge ? <span className={`text-[7px] px-1 py-0.5 rounded ${badge.bg} ${badge.text} font-semibold`}>{badge.label}</span> : null;
                })()}
              </div>
            </div>

            {/* Service type sub-rows (expanded) */}
            {isExpanded && hasBreakdown && pacing.serviceTypeBreakdown!.map((st) => {
              const paceBadge = getPaceBadge(st.currentRevenue, st.priorSameDateRevenue);
              const pctBadge = getPercentOfBadge(st.currentRevenue, st.priorFullRevenue);
              return (
                <div
                  key={st.serviceType}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center py-1 border-b border-[#f0edf5] bg-[#FAFAFE]/50"
                >
                  <span className="px-2 pl-5 text-[9px] text-[#8A80A8]">{st.serviceType}</span>
                  <span className="px-2 text-right text-[10px] text-[#6E6390] tabular-nums">
                    {fmtCombined(st.currentRevenue, st.currentSessions)}
                  </span>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <span className="text-[9px] text-[#A69DC0] tabular-nums">
                      {fmtCombined(st.priorSameDateRevenue, st.priorSameDateSessions)}{" "}
                    </span>
                    {paceBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${paceBadge.bg} ${paceBadge.text} font-semibold`}>{paceBadge.label}</span>}
                  </div>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <span className="text-[9px] text-[#A69DC0] tabular-nums">
                      {fmtCombined(st.priorFullRevenue, st.priorFullSessions)}{" "}
                    </span>
                    {pctBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${pctBadge.bg} ${pctBadge.text} font-semibold`}>{pctBadge.label}</span>}
                  </div>
                </div>
              );
            })}

            {/* Pipeline and Deals rows (unchanged logic) */}
            {otherMetrics!.map((m, i) => {
              const paceBadge = getPaceBadge(m.current, m.sameDate);
              const pctBadge = getPercentOfBadge(m.current, m.full);
              const isLast = i === otherMetrics!.length - 1;
              const fmt = m.isCurrency ? formatCurrency : (v: number) => String(v);
              return (
                <div
                  key={m.label}
                  className={`grid grid-cols-[1fr_1fr_1fr_1fr] items-center py-1.5 ${!isLast ? "border-b border-[#f0edf5]" : ""}`}
                >
                  <span className="px-2 text-[10px] text-[#6E6390] font-medium">{m.label}</span>
                  <span className="px-2 text-right text-[11px] font-bold text-[#544A78] tabular-nums">{fmt(m.current)}</span>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <span className="text-[10px] text-[#8A80A8] tabular-nums">{fmt(m.sameDate)} </span>
                    {paceBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${paceBadge.bg} ${paceBadge.text} font-semibold`}>{paceBadge.label}</span>}
                  </div>
                  <div className="px-2 text-center border-l border-[#f0edf5]">
                    <span className="text-[10px] text-[#8A80A8] tabular-nums">{fmt(m.full)} </span>
                    {pctBadge && <span className={`text-[7px] px-1 py-0.5 rounded ${pctBadge.bg} ${pctBadge.text} font-semibold`}>{pctBadge.label}</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/features/map/components/SearchResults/__tests__/PacingTable.test.tsx`
Expected: All tests PASS

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Visual smoke test**

Run dev server (`npm run dev` on port 3005). Open a plan, expand a district with session data, and verify:
- Combined "Revenue & Sessions" row shows `$X / Y` format
- Chevron appears when breakdown data exists
- Clicking expands to show per-service-type sub-rows
- Sub-rows have both pace badges
- Pipeline and Deals rows render normally below
- Collapsing hides sub-rows

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/SearchResults/PlanDistrictsTab.tsx
git commit -m "feat: refactor PacingTable with combined Revenue & Sessions expandable row"
```

---

### Task 5: Final Verification and Cleanup

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Final commit if any fixes were needed**

Only if changes were required in steps 1-2.
