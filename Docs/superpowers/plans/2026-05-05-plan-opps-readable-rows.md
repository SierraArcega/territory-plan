# Plan Opportunities Tab — Readable Rows + LMS Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Name column readability, stop Stage pill from wrapping, and turn the Name into a clickable link to the source LMS opportunity in `PlanOpportunitiesTab`.

**Architecture:** Single component (`PlanOpportunitiesTab.tsx`) gets a fixed-width grid with `min-width: max-content`, wrapped in `overflow-x-auto` on the outer container so header/body/footer scroll horizontally in sync. Name cell becomes a sticky-left CSS-grid item that hover-tints with its row via Tailwind `group`/`group-hover`. The API route gains one extra field (`detailsLink`) that the type already declares.

**Tech Stack:** Next.js App Router API route, Prisma (no schema change), React 19, Tailwind 4 utility classes (`sticky`, `group`, `min-w-max`), `lucide-react` `ExternalLink` icon, Vitest + Testing Library + jsdom for tests.

**Spec:** `Docs/superpowers/specs/2026-05-05-plan-opps-readable-rows-design.md`

---

## Task 0: Worktree baseline

**Files:**
- (none — environment-only)

- [ ] **Step 1: Install dependencies in the worktree**

Run: `npm install`
Expected: completes without errors. node_modules populated.

- [ ] **Step 2: Verify baseline test suite passes**

Run: `npm test -- --run src/features/map/components/SearchResults src/app/api/territory-plans`
Expected: all existing tests pass. If any pre-existing failure, stop and ask the user before proceeding.

- [ ] **Step 3: Confirm we're on the feature branch**

Run: `git status && git rev-parse --abbrev-ref HEAD`
Expected: branch is `feat/plan-opps-readable-rows`, working tree clean.

---

## Task 1: API — surface `detailsLink` in plan opportunities response

**Files:**
- Modify: `src/app/api/territory-plans/[id]/opportunities/route.ts`
- Create: `src/app/api/territory-plans/[id]/opportunities/__tests__/route.test.ts`

The Prisma model already has `detailsLink` and the `PlanOpportunityRow` TypeScript type already declares the field (`src/features/shared/types/api-types.ts:975`). The route just needs to select and map it.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/territory-plans/[id]/opportunities/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findUnique: vi.fn(),
    },
    opportunity: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

describe("GET /api/territory-plans/[id]/opportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes detailsLink in each row", async () => {
    vi.mocked(prisma.territoryPlan.findUnique).mockResolvedValue({
      fiscalYear: 2026,
      districts: [{ districtLeaid: "0123456" }],
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([
      {
        id: "opp-1",
        name: "Test Opp",
        districtName: "Test District",
        districtLeaId: "0123456",
        stage: "1 - Discovery",
        contractType: "New Business",
        netBookingAmount: 100,
        totalRevenue: 100,
        totalTake: 50,
        completedRevenue: 0,
        scheduledRevenue: 100,
        closeDate: new Date("2026-06-01"),
        detailsLink: "https://lms.example.com/opps/opp-1",
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/territory-plans/plan-1/opportunities");
    const res = await GET(req, { params: Promise.resolve({ id: "plan-1" }) });
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].detailsLink).toBe("https://lms.example.com/opps/opp-1");
  });

  it("passes detailsLink through as null when source is null", async () => {
    vi.mocked(prisma.territoryPlan.findUnique).mockResolvedValue({
      fiscalYear: 2026,
      districts: [{ districtLeaid: "0123456" }],
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([
      {
        id: "opp-2",
        name: "No-link Opp",
        districtName: "Test District",
        districtLeaId: "0123456",
        stage: "1 - Discovery",
        contractType: "New Business",
        netBookingAmount: 0,
        totalRevenue: 0,
        totalTake: 0,
        completedRevenue: 0,
        scheduledRevenue: 0,
        closeDate: null,
        detailsLink: null,
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/territory-plans/plan-1/opportunities");
    const res = await GET(req, { params: Promise.resolve({ id: "plan-1" }) });
    const body = await res.json();

    expect(body[0].detailsLink).toBeNull();
  });

  it("requests detailsLink in the Prisma select", async () => {
    vi.mocked(prisma.territoryPlan.findUnique).mockResolvedValue({
      fiscalYear: 2026,
      districts: [{ districtLeaid: "0123456" }],
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([] as never);

    const req = new NextRequest("http://localhost/api/territory-plans/plan-1/opportunities");
    await GET(req, { params: Promise.resolve({ id: "plan-1" }) });

    const findManyCall = vi.mocked(prisma.opportunity.findMany).mock.calls[0]![0];
    expect(findManyCall!.select).toMatchObject({ detailsLink: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/app/api/territory-plans/\[id\]/opportunities/__tests__/route.test.ts`
Expected: 3 failures — `detailsLink` is undefined on response rows and not present in select.

- [ ] **Step 3: Implement — add `detailsLink` to the route's select and map**

Modify `src/app/api/territory-plans/[id]/opportunities/route.ts`:

```typescript
const rows = await prisma.opportunity.findMany({
  where: {
    districtLeaId: { in: leaIds },
    schoolYr,
  },
  select: {
    id: true,
    name: true,
    districtName: true,
    districtLeaId: true,
    stage: true,
    contractType: true,
    netBookingAmount: true,
    totalRevenue: true,
    totalTake: true,
    completedRevenue: true,
    scheduledRevenue: true,
    closeDate: true,
    detailsLink: true,
  },
  orderBy: { netBookingAmount: "desc" },
});

const opportunities = rows.map((r) => ({
  id: r.id,
  name: r.name,
  districtName: r.districtName,
  districtLeaId: r.districtLeaId,
  stage: r.stage,
  contractType: r.contractType,
  netBookingAmount: r.netBookingAmount ? Number(r.netBookingAmount) : 0,
  totalRevenue: r.totalRevenue ? Number(r.totalRevenue) : 0,
  totalTake: r.totalTake ? Number(r.totalTake) : 0,
  completedRevenue: r.completedRevenue ? Number(r.completedRevenue) : 0,
  scheduledRevenue: r.scheduledRevenue ? Number(r.scheduledRevenue) : 0,
  closeDate: r.closeDate?.toISOString() ?? null,
  detailsLink: r.detailsLink,
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/app/api/territory-plans/\[id\]/opportunities/__tests__/route.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/territory-plans/\[id\]/opportunities/route.ts \
        src/app/api/territory-plans/\[id\]/opportunities/__tests__/route.test.ts
git commit -m "feat(plan-opps): include detailsLink in plan opportunities API response"
```

---

## Task 2: Component — extract `COLUMNS` constant (pure refactor)

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx`

This task only consolidates the three duplicated grid-template strings (header, body row, footer) into a single constant so subsequent tasks can change widths in one place. No behavior change.

- [ ] **Step 1: Add the constant and replace the three Tailwind grid-cols classes**

Modify `src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx`:

At the top of the file (just below imports, above `formatCurrency`):

```typescript
const GRID_TEMPLATE = "1.5fr 1fr 90px 90px 90px 90px 90px 90px";
```

Header (currently line ~125): replace
```tsx
<div className="grid grid-cols-[1.5fr_1fr_90px_90px_90px_90px_90px_90px] items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]">
```
with
```tsx
<div
  className="grid items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]"
  style={{ gridTemplateColumns: GRID_TEMPLATE }}
>
```

`OppRow` (currently line ~177): replace
```tsx
<div className="grid grid-cols-[1.5fr_1fr_90px_90px_90px_90px_90px_90px] items-center px-5 py-2.5 border-b border-[#f0edf5] last:border-b-0 hover:bg-[#FAFAFE] transition-colors">
```
with
```tsx
<div
  className="grid items-center px-5 py-2.5 border-b border-[#f0edf5] last:border-b-0 hover:bg-[#FAFAFE] transition-colors"
  style={{ gridTemplateColumns: GRID_TEMPLATE }}
>
```

Footer (currently line ~147): replace
```tsx
<div className="grid grid-cols-[1.5fr_1fr_90px_90px_90px_90px_90px_90px] items-center px-5 py-2.5 text-[11px]">
```
with
```tsx
<div
  className="grid items-center px-5 py-2.5 text-[11px]"
  style={{ gridTemplateColumns: GRID_TEMPLATE }}
>
```

- [ ] **Step 2: Run existing tests to confirm no regression**

Run: `npm test -- --run src/features/map/components/SearchResults`
Expected: all existing SearchResults tests still pass. (No tests exist for `PlanOpportunitiesTab` itself yet — that's intentional; we'll add them in Task 6.)

- [ ] **Step 3: Type-check the change**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx
git commit -m "refactor(plan-opps): extract grid template into shared constant"
```

---

## Task 3: Layout — widen columns + horizontal scroll on outer container

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx`

This is the load-bearing layout fix. Widths change, the outer container becomes `overflow-x-auto`, and every grid row asserts `minWidth: "max-content"` so all three regions (header, body, footer) participate in the same horizontal scroll context and stay column-aligned.

- [ ] **Step 1: Update the column template**

In `PlanOpportunitiesTab.tsx`, replace:
```typescript
const GRID_TEMPLATE = "1.5fr 1fr 90px 90px 90px 90px 90px 90px";
```
with:
```typescript
const GRID_TEMPLATE = "minmax(200px,1.5fr) 140px 120px 110px 90px 90px 90px 100px";
```

Widths: Name `minmax(200px,1.5fr)`, District 140, Stage 120, Type 110, Bookings 90, Revenue 90, Take 90, Scheduled 100. Total minimum ~920px (intentionally wider than the side panel so horizontal scroll engages).

- [ ] **Step 2: Make outer container horizontally scrollable**

Find the outer return wrapper (currently `<div className="flex flex-col h-full">`) and change to:

```tsx
<div className="flex flex-col h-full overflow-x-auto">
```

The existing inner `<div className="flex-1 overflow-y-auto">` (vertical scroll for the row band) stays as-is.

- [ ] **Step 3: Add `minWidth: "max-content"` to header, row, footer grids**

For each of the three grid `<div>`s (header, `OppRow`, footer), update the `style` prop to include `minWidth`:

```tsx
style={{ gridTemplateColumns: GRID_TEMPLATE, minWidth: "max-content" }}
```

This forces each row to be at least as wide as the sum of fixed columns, letting the outer container's `overflow-x-auto` engage and scrolling all three regions in lockstep.

- [ ] **Step 4: Type-check + run existing tests**

Run: `npx tsc --noEmit && npm test -- --run src/features/map/components/SearchResults`
Expected: clean type-check, existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx
git commit -m "feat(plan-opps): widen columns + horizontal scroll on outer container"
```

---

## Task 4: Stage column — stop the pill from wrapping

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx`

The Stage cell wraps because the inline-block pill has nothing forcing a single line. Fix at both the cell level and the pill level (defense in depth).

- [ ] **Step 1: Add `whitespace-nowrap` to the Stage cell and pill**

Find the Stage cell in `OppRow` (currently `<span>` wrapping the pill at line ~184). Replace:

```tsx
<span>
  {opp.stage ? (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${stageStyle.bg} ${stageStyle.text}`}>
      {opp.stage}
    </span>
  ) : (
    <span className="text-[11px] text-[#C2BBD4]">—</span>
  )}
</span>
```

with:

```tsx
<span className="whitespace-nowrap">
  {opp.stage ? (
    <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold ${stageStyle.bg} ${stageStyle.text}`}>
      {opp.stage}
    </span>
  ) : (
    <span className="text-[11px] text-[#C2BBD4]">—</span>
  )}
</span>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx
git commit -m "fix(plan-opps): keep Stage pill on a single line"
```

---

## Task 5: Sticky-left Name cell with hover sync

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx`

Pin the Name cell to the left edge so it stays visible during horizontal scroll. **Critical:** the row wrapper must carry `group` and the Name cell must carry `group-hover:bg-[#FAFAFE]` — without this, the sticky cell stays white while the rest of the row tints on hover.

- [ ] **Step 1: Add `group` to body row wrapper**

In `OppRow`, the row `<div>` already has `hover:bg-[#FAFAFE]`. Add `group` to its className:

```tsx
<div
  className="group grid items-center px-5 py-2.5 border-b border-[#f0edf5] last:border-b-0 hover:bg-[#FAFAFE] transition-colors"
  style={{ gridTemplateColumns: GRID_TEMPLATE, minWidth: "max-content" }}
>
```

- [ ] **Step 2: Wrap the Name cell content in a sticky `<div>`**

Find the current first `<span>` in `OppRow` (the one rendering `opp.name`):

```tsx
<span className="text-xs font-medium text-[#544A78] truncate pr-2" title={opp.name ?? undefined}>
  {opp.name ?? "Untitled"}
</span>
```

Replace with a sticky wrapper that owns the background + border, leaving the `<span>` (or future `<a>` from Task 6) inside:

```tsx
<div className="sticky left-0 z-[1] bg-white group-hover:bg-[#FAFAFE] border-r border-[#E2DEEC] pr-2 transition-colors flex items-center min-w-0">
  <span className="text-xs font-medium text-[#544A78] truncate" title={opp.name ?? undefined}>
    {opp.name ?? "Untitled"}
  </span>
</div>
```

Note: the inner `<span>` no longer needs `pr-2` (it's on the sticky wrapper now) and gets `min-w-0` on the wrapper to let `truncate` actually engage inside a flex/grid item.

- [ ] **Step 3: Apply matching sticky styles to the Name cell in the header**

Find the header's `ColHeader` for `"Name"` (the first one in the header `<div>`). Wrap its rendered button in a sticky div with the header's tint:

```tsx
<div className="sticky left-0 z-[1] bg-[#FAFAFE] border-r border-[#E2DEEC]">
  <ColHeader label="Name" col="name" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
</div>
```

- [ ] **Step 4: Apply matching sticky styles to the Name cell in the footer**

Find the footer's first child (currently the `<span>` rendering opportunity count):

```tsx
<span className="font-medium text-[#6E6390]">
  {opportunities.length} opportunit{opportunities.length !== 1 ? "ies" : "y"}
</span>
```

Wrap it in a sticky div matching the footer tint:

```tsx
<div className="sticky left-0 z-[1] bg-[#FAFAFE] border-r border-[#E2DEEC]">
  <span className="font-medium text-[#6E6390]">
    {opportunities.length} opportunit{opportunities.length !== 1 ? "ies" : "y"}
  </span>
</div>
```

- [ ] **Step 5: Type-check + run existing tests**

Run: `npx tsc --noEmit && npm test -- --run src/features/map/components/SearchResults`
Expected: clean type-check, existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx
git commit -m "feat(plan-opps): sticky-left Name cell with hover sync"
```

---

## Task 6: Name as link to LMS opportunity

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx`
- Create: `src/features/map/components/SearchResults/__tests__/PlanOpportunitiesTab.test.tsx`

When `detailsLink` exists, the Name renders as an external link with a trailing `ExternalLink` icon. When null, it falls back to plain text (no orphan icon).

- [ ] **Step 1: Write failing component tests**

Create `src/features/map/components/SearchResults/__tests__/PlanOpportunitiesTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlanOpportunitiesTab from "../PlanOpportunitiesTab";
import type { PlanOpportunityRow } from "@/features/shared/types/api-types";

vi.mock("@/lib/api", () => ({
  usePlanOpportunities: vi.fn(),
}));

import { usePlanOpportunities } from "@/lib/api";

function makeOpp(overrides: Partial<PlanOpportunityRow> = {}): PlanOpportunityRow {
  return {
    id: "opp-1",
    name: "Linked Opp",
    districtName: "Some District",
    districtLeaId: "0123456",
    stage: "2 - Presentation",
    contractType: "New Business",
    netBookingAmount: 1000,
    totalRevenue: 1000,
    totalTake: 500,
    completedRevenue: 0,
    scheduledRevenue: 1000,
    closeDate: null,
    minimumPurchaseAmount: null,
    maximumBudget: null,
    detailsLink: null,
    stageHistory: [],
    startDate: null,
    expiration: null,
    ...overrides,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PlanOpportunitiesTab", () => {
  it("renders Name as an external link when detailsLink is present", () => {
    vi.mocked(usePlanOpportunities).mockReturnValue({
      data: [makeOpp({ name: "Linked Opp", detailsLink: "https://lms.example.com/opps/1" })],
      isLoading: false,
      error: null,
    } as never);

    renderWithQuery(<PlanOpportunitiesTab planId="plan-1" />);
    const link = screen.getByRole("link", { name: /Linked Opp/ });
    expect(link).toHaveAttribute("href", "https://lms.example.com/opps/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Name as plain text when detailsLink is null", () => {
    vi.mocked(usePlanOpportunities).mockReturnValue({
      data: [makeOpp({ name: "Plain Opp", detailsLink: null })],
      isLoading: false,
      error: null,
    } as never);

    renderWithQuery(<PlanOpportunitiesTab planId="plan-1" />);
    expect(screen.getByText("Plain Opp")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Plain Opp/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/features/map/components/SearchResults/__tests__/PlanOpportunitiesTab.test.tsx`
Expected: 1 failure (Name renders as `<span>`, not `<a>`).

- [ ] **Step 3: Implement the conditional link**

In `PlanOpportunitiesTab.tsx`, add `ExternalLink` to imports:

```tsx
import { ExternalLink } from "lucide-react";
```

Inside `OppRow`, replace the Name `<span>` (now nested inside the sticky wrapper from Task 5):

```tsx
<span className="text-xs font-medium text-[#544A78] truncate" title={opp.name ?? undefined}>
  {opp.name ?? "Untitled"}
</span>
```

with:

```tsx
{opp.detailsLink ? (
  <a
    href={opp.detailsLink}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 min-w-0 text-xs font-medium text-[#544A78] hover:underline fm-focus-ring"
    title={opp.name ?? undefined}
  >
    <span className="truncate">{opp.name ?? "Untitled"}</span>
    <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden />
  </a>
) : (
  <span
    className="text-xs font-medium text-[#544A78] truncate"
    title={opp.name ?? undefined}
  >
    {opp.name ?? "Untitled"}
  </span>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/features/map/components/SearchResults/__tests__/PlanOpportunitiesTab.test.tsx`
Expected: both tests pass.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx \
        src/features/map/components/SearchResults/__tests__/PlanOpportunitiesTab.test.tsx
git commit -m "feat(plan-opps): make Name a link to LMS opportunity when detailsLink present"
```

---

## Task 7: Manual acceptance verification

**Files:**
- (none — manual browser verification + lint sweep)

These are the acceptance checks from the spec. Each must pass before opening the PR.

- [ ] **Step 1: Lint the changed files only**

Per project memory (full-tree eslint OOMs at 8GB), only lint what changed:

```bash
npx eslint \
  src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx \
  src/features/map/components/SearchResults/__tests__/PlanOpportunitiesTab.test.tsx \
  src/app/api/territory-plans/\[id\]/opportunities/route.ts \
  src/app/api/territory-plans/\[id\]/opportunities/__tests__/route.test.ts
```
Expected: no errors. Fix any that appear.

- [ ] **Step 2: Run the full test focus + types one more time**

Run: `npm test -- --run src/features/map/components/SearchResults src/app/api/territory-plans/\[id\]/opportunities && npx tsc --noEmit`
Expected: green tests, clean types.

- [ ] **Step 3: Start the dev server and open a plan**

Run (background): `npm run dev` (port 3005)
Navigate to: `http://localhost:3005/?tab=plans&plan=2554daf9-fc11-4933-96e0-eb6c0dab1970` (or any plan with multiple opportunities).
Click the **Opportunities** tab.

- [ ] **Step 4: Acceptance check #1 — Name column always readable**

Verify: at default panel width, Name column shows at least ~200px of name text, never collapsed to one or two characters.

- [ ] **Step 5: Acceptance check #2 — Stage pill stays on one line**

Verify: stage labels like "2 - Presentation" render single-line. No wrapping.

- [ ] **Step 6: Acceptance check #3 — Horizontal scroll syncs across header/body/footer**

Scroll the row band right. Verify: column headers stay aligned with their data columns, and footer totals stay aligned with money columns. If any region falls out of sync, `overflow-x-auto` is on the wrong element — move it to the outermost `PlanOpportunitiesTab` container so all three regions scroll together.

- [ ] **Step 7: Acceptance check #4 — Sticky Name cell hover-tints with its row**

Hover any row. Verify: the sticky Name cell tints in lockstep with the rest of the row. If the Name cell stays white while the rest of the row tints plum, the `group` / `group-hover` pairing is broken — re-check Task 5 Step 1 and Step 2.

- [ ] **Step 8: Acceptance check #5 — Name link opens LMS opp in new tab**

Click a Name on a row whose opportunity has a non-null `detailsLink`. Verify: opens in new tab with the correct URL.

- [ ] **Step 9: Acceptance check #6 — Null `detailsLink` falls back gracefully**

Identify (or temporarily force in DevTools) an opp with `detailsLink: null`. Verify: Name renders as plain text, no orphan ExternalLink icon, no broken hover state.

- [ ] **Step 10: Push and open PR**

```bash
git push -u origin feat/plan-opps-readable-rows
gh pr create --title "feat(plan-opps): readable rows + LMS link" --body "$(cat <<'EOF'
## Summary
- Restore Name column readability in the Plan detail Opportunities tab (was collapsing to one character in side-panel widths)
- Stop Stage pill from wrapping onto two lines
- Make Name clickable to the source LMS opportunity (Opportunity.detailsLink)

Spec: Docs/superpowers/specs/2026-05-05-plan-opps-readable-rows-design.md
Plan: Docs/superpowers/plans/2026-05-05-plan-opps-readable-rows.md

## Test plan
- [x] Vitest passes for `src/features/map/components/SearchResults` and `src/app/api/territory-plans/[id]/opportunities`
- [x] tsc clean
- [x] Manually verified all 6 acceptance checks in spec

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
