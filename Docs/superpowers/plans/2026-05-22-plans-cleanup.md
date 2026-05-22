# Plans Feature Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix team plans showing 0, give no-plans users an escape hatch to team plans, fix the progress ring coral-dot artifact, and add view-count badges to the sidebar plan rows.

**Architecture:** Four independent changes — one API extension (`recentNewsCount`), one query-layer parameterisation (`mine` flag), two component fixes (`MyViewsSection` link, `GroupRow` ring guard), and one prop-threading chain (`PlansSubsection` → `GroupRow` → `GroupViewList`). Items can be committed separately; they share no runtime dependencies on each other.

**Tech Stack:** Next.js App Router API routes, Prisma + raw pg Pool (readonly), TanStack Query, React, TypeScript, Tailwind, Vitest.

---

## File map

| File | Change |
|------|--------|
| `src/app/api/territory-plans/route.ts` | Add `recentNewsCount` to `PlanStats`, add news SQL query, wire into aggregation loop and GET response |
| `src/app/api/territory-plans/__tests__/route.test.ts` | Add third `mockResolvedValueOnce` to existing `?stats=1` test; add dedicated `recentNewsCount` test |
| `src/features/views/lib/queries.ts` | Add `mine` param to `usePlansWithStats`; add `recentNewsCount` to `PlanWithStats` |
| `src/features/views/components/PortfolioView.tsx` | Call `usePlansWithStats(false, false)` |
| `src/features/views/components/MyViewsSection.tsx` | Move "All plans" link outside `showEmptyState` conditional |
| `src/features/views/components/GroupRow.tsx` | Guard ring on `progress !== null`; add `viewCounts` prop; pass to `GroupViewList` |
| `src/features/views/components/PlansSubsection.tsx` | Build `viewCounts` per plan; pass to `GroupRow` |
| `src/features/views/components/GroupViewList.tsx` | Accept `viewCounts` prop; render count badge per view item |

---

## Task 1: Add `recentNewsCount` to the territory-plans API

**Files:**
- Modify: `src/app/api/territory-plans/route.ts`
- Modify: `src/app/api/territory-plans/__tests__/route.test.ts`

### Background

`computeAllPlanStats` currently fires two queries in `Promise.all` — opportunities and contacts. The result is aggregated per-plan in a JS loop and spread into the GET response under `?stats=1`. We add a third query: distinct news article count per leaid from the last 30 days, joining `news_articles` → `news_article_districts`.

The DB table names: `news_article_districts` (explicit `@@map`), `news_articles` (Prisma default pluralisation of `NewsArticle`).

- [ ] **Step 1: Write the failing test**

Open `src/app/api/territory-plans/__tests__/route.test.ts`. The existing `"includes stats fields when ?stats=1"` test mocks `mockReadonlyQuery` with two `mockResolvedValueOnce` calls (opps, then contacts). We need to:
1. Add a third `mockResolvedValueOnce` for the news query.
2. Add a dedicated test asserting `recentNewsCount` is correct.

Add this test inside the `describe("GET /api/territory-plans")` block, after the existing `?stats=1` test:

```typescript
it("includes recentNewsCount in ?stats=1 response", async () => {
  const mockPlans = [
    {
      id: "plan-news",
      name: "News Plan",
      description: null,
      color: "#403770",
      status: "working",
      fiscalYear: 2026,
      startDate: null,
      endDate: null,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-15"),
      _count: { districts: 1 },
      districts: [
        {
          districtLeaid: "1234567",
          renewalTarget: null,
          winbackTarget: null,
          expansionTarget: null,
          newBusinessTarget: null,
          district: { enrollment: 100, stateAbbrev: "MN", districtFinancials: [] },
        },
      ],
      taskLinks: [],
      ownerUser: null,
      states: [],
      collaborators: [],
      hidden: [],
    },
  ];

  mockPrisma.territoryPlan.findMany.mockResolvedValue(mockPlans as never);
  // opps query
  mockReadonlyQuery.mockResolvedValueOnce({ rows: [] });
  // contacts query
  mockReadonlyQuery.mockResolvedValueOnce({ rows: [] });
  // news query — 3 recent articles for this district
  mockReadonlyQuery.mockResolvedValueOnce({
    rows: [{ leaid: "1234567", count: "3" }],
  });

  const response = await listPlans(makeListReq("?stats=1"));
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data[0].recentNewsCount).toBe(3);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan"
npx vitest run src/app/api/territory-plans/__tests__/route.test.ts --reporter=verbose 2>&1 | tail -30
```

Expected: the new test fails because `recentNewsCount` does not exist yet. The existing `?stats=1` test may also fail if it asserts the absence of unexpected fields — check output.

- [ ] **Step 3: Update the existing `?stats=1` test to add the third mock**

In the existing `"includes stats fields when ?stats=1"` test, find the two `mockResolvedValueOnce` calls and add a third one after the contacts mock:

```typescript
// After the contacts mockResolvedValueOnce — add:
// news query — no recent articles for this district
mockReadonlyQuery.mockResolvedValueOnce({ rows: [] });
```

Also add to that test's assertions:
```typescript
expect(data[0].recentNewsCount).toBe(0);
```

- [ ] **Step 4: Implement `recentNewsCount` in `route.ts`**

In `src/app/api/territory-plans/route.ts`:

**4a.** Extend `PlanStats` (around line 26):
```typescript
interface PlanStats {
  progress: number | null;
  pipelineValue: number;
  contactsCount: number;
  oppsCount: number;
  closedWonMinCommit: number;
  recentNewsCount: number;  // ← add
}
```

**4b.** Inside `computeAllPlanStats`, after the `contactsRowsP` declaration (around line 113) and before the `Promise.all`, add the news query:

```typescript
const newsRowsP = readonlyPool.query<{ leaid: string; count: string }>(
  `SELECT nad.leaid, COUNT(DISTINCT na.id) AS count
   FROM news_article_districts nad
   JOIN news_articles na ON na.id = nad.article_id
   WHERE nad.leaid = ANY($1::text[])
     AND na.published_at >= NOW() - INTERVAL '30 days'
   GROUP BY nad.leaid`,
  [leaids],
);
```

**4c.** Add `newsRowsP` to the `Promise.all` destructure (around line 121):
```typescript
const [oppsRows, contactsRows, newsRows] = await Promise.all([oppsRowsP, contactsRowsP, newsRowsP]);
```

**4d.** After the `contactsByLeaid` map construction, build a `newsByLeaid` map:
```typescript
const newsByLeaid = new Map<string, number>();
for (const r of newsRows.rows) {
  newsByLeaid.set(r.leaid, Number(r.count));
}
```

**4e.** In the per-plan aggregation loop (inside `for (const plan of plans)`), after the existing `contactsCount` accumulation, add:
```typescript
let recentNewsCount = 0;
// ... existing loop over districts ...
for (const d of plan.districts) {
  // existing opps and contacts accumulation ...
  recentNewsCount += newsByLeaid.get(d.districtLeaid) ?? 0;
}
```

Wait — there's already a `for (const d of plan.districts)` loop. Add `recentNewsCount` accumulation inside that existing loop:

In the existing loop body (around line 165):
```typescript
for (const d of plan.districts) {
  const o = oppsByKey.get(`${d.districtLeaid}|${schoolYr}`);
  if (o) {
    pipelineValue += o.openPipeline;
    oppsCount += o.openCount;
    bookings += o.bookings;
    closedWonMinCommit += o.closedWonMinCommit;
  }
  contactsCount += contactsByLeaid.get(d.districtLeaid) ?? 0;
  recentNewsCount += newsByLeaid.get(d.districtLeaid) ?? 0;  // ← add
}
```

Also declare `recentNewsCount` at the top of the plan loop alongside the other accumulators:
```typescript
let recentNewsCount = 0;
```

**4f.** Add `recentNewsCount` to the `result.set` call:
```typescript
result.set(plan.id, {
  progress,
  pipelineValue,
  contactsCount,
  oppsCount,
  closedWonMinCommit,
  recentNewsCount,  // ← add
});
```

Also update the zero-district early-return object (around line 151):
```typescript
result.set(plan.id, {
  progress: null,
  pipelineValue: 0,
  contactsCount: 0,
  oppsCount: 0,
  closedWonMinCommit: 0,
  recentNewsCount: 0,  // ← add
});
```

**4g.** Add `recentNewsCount` to the GET response spread (around line 370):
```typescript
...(stats
  ? {
      progress: stats.progress,
      pipelineValue: stats.pipelineValue,
      contactsCount: stats.contactsCount,
      oppsCount: stats.oppsCount,
      closedWonMinCommit: stats.closedWonMinCommit,
      recentNewsCount: stats.recentNewsCount,  // ← add
    }
  : {}),
```

- [ ] **Step 5: Run tests to verify both pass**

```bash
npx vitest run src/app/api/territory-plans/__tests__/route.test.ts --reporter=verbose 2>&1 | tail -30
```

Expected: all tests in this file PASS, including the new `recentNewsCount` test.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/territory-plans/route.ts src/app/api/territory-plans/__tests__/route.test.ts
git commit -m "feat(api): add recentNewsCount to territory-plans ?stats=1 response"
```

---

## Task 2: Parameterise `usePlansWithStats` and update `PlanWithStats` type

**Files:**
- Modify: `src/features/views/lib/queries.ts`

- [ ] **Step 1: Update `PlanWithStats` to include `recentNewsCount`**

In `src/features/views/lib/queries.ts`, find the `PlanWithStats` interface (around line 40) and add the new field after `closedWonMinCommit`:

```typescript
export interface PlanWithStats {
  id: string;
  name: string;
  color: string | null;
  status: string;
  fiscalYear: number;
  districtCount: number;
  districtLeaids: string[];
  owner: { id: string; fullName: string | null; avatarUrl: string | null } | null;
  collaborators: { id: string; fullName: string | null; avatarUrl: string | null }[];
  hidden: boolean;
  renewalRollup: number;
  expansionRollup: number;
  winbackRollup: number;
  newBusinessRollup: number;
  pipelineTotal: number;
  progress: number | null;
  pipelineValue: number;
  contactsCount: number;
  oppsCount: number;
  closedWonMinCommit: number;
  recentNewsCount: number;  // ← add
  viewLayouts?: ViewLayouts;
}
```

- [ ] **Step 2: Add `mine` parameter to `usePlansWithStats`**

Replace the existing `usePlansWithStats` function (around line 108):

```typescript
export function usePlansWithStats(showHidden = false, mine = true) {
  const mineParam = mine ? "&mine=1" : "";
  const hiddenParam = showHidden ? "&showHidden=1" : "";
  const url = `${API_BASE}/territory-plans?stats=1${mineParam}${hiddenParam}`;
  return useQuery({
    queryKey: ["views", "plans", "stats", showHidden, mine] as const,
    queryFn: () => fetchJson<PlanWithStats[]>(url),
    staleTime: 60 * 1000,
  });
}
```

- [ ] **Step 3: Run the full test suite to check for type errors**

```bash
npx vitest run --reporter=verbose 2>&1 | grep -E "FAIL|PASS|error" | head -30
```

Expected: all tests PASS. TypeScript compilation errors would surface here if any callers pass wrong arg counts.

- [ ] **Step 4: Commit**

```bash
git add src/features/views/lib/queries.ts
git commit -m "feat(views): parameterise usePlansWithStats with mine flag; add recentNewsCount type"
```

---

## Task 3: Fix team plans showing 0 in PortfolioView

**Files:**
- Modify: `src/features/views/components/PortfolioView.tsx`

- [ ] **Step 1: Update the `usePlansWithStats` call in `PortfolioView`**

In `src/features/views/components/PortfolioView.tsx`, find the `usePlansWithStats()` call (around line 53) and change it to:

```typescript
const plansQ = usePlansWithStats(false, false);
```

This passes `showHidden=false` (default) and `mine=false` (fetch all plans, not just the current user's). The three-way split (`mine` / `team` / `archived`) is performed client-side and now has the full plan set to work with.

- [ ] **Step 2: Verify no other changes needed**

The `isOnPlan` helper, the `useMemo` split, and the tab labels all use `mine`, `team`, `archived` arrays derived from the full `allPlans` list — no other changes required.

- [ ] **Step 3: Commit**

```bash
git add src/features/views/components/PortfolioView.tsx
git commit -m "fix(views): fetch all plans in PortfolioView so team tab populates correctly"
```

---

## Task 4: Fix empty-state escape hatch in MyViewsSection

**Files:**
- Modify: `src/features/views/components/MyViewsSection.tsx`

### Background

Currently the "All plans" `<Link>` is inside the `else` branch of `{showEmptyState ? <EmptyState> : <AllPlansLink + subsections>}`. Users with zero own plans never see the link and cannot navigate to the portfolio.

- [ ] **Step 1: Restructure the conditional**

In `src/features/views/components/MyViewsSection.tsx`, replace the block starting at the `{showEmptyState ? (` conditional (around line 66) with:

```tsx
{/* "All plans" row — always visible so users with zero plans can reach the portfolio */}
<Link
  href="/views"
  className="mt-1 group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] transition-colors duration-100"
>
  <Grid3x3
    className="w-4 h-4 flex-shrink-0 text-[#544A78]"
    aria-hidden
  />
  <span className="flex-1 min-w-0 truncate whitespace-nowrap">
    All plans
  </span>
  <span className="text-[10px] font-medium text-[#8A80A8] tabular-nums whitespace-nowrap">
    {plansQ.isLoading ? "…" : plans.length}
  </span>
</Link>

{showEmptyState ? (
  <div className="mt-2 mx-2 p-3 rounded-md border border-dashed border-[#D4CFE2] bg-[#FFFCFA]">
    <p className="text-[12px] text-[#544A78] font-medium whitespace-nowrap">
      No views yet
    </p>
    {LISTS_ENABLED ? (
      <>
        <p className="text-[11px] text-[#8A80A8] mt-1 mb-2">
          Start with a saved list to scope your work.
        </p>
        <button
          type="button"
          onClick={() => openBuilder()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#403770] text-white text-[12px] font-semibold hover:bg-[#322a5a] transition-colors duration-100"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden />
          <span className="whitespace-nowrap">Create your first list</span>
        </button>
      </>
    ) : (
      <p className="text-[11px] text-[#8A80A8] mt-1">
        Plans you build from the map will show up here.
      </p>
    )}
  </div>
) : (
  <>
    <PlansSubsection />
    {LISTS_ENABLED && <ListsSubsection />}
  </>
)}
```

Note: the "All plans" count badge still shows `plans.length` which reflects the sidebar's `mine=true` fetch — this is intentional (shows how many of _your_ plans exist in the sidebar count; the portfolio page itself shows the full all-plans list when navigated to).

- [ ] **Step 2: Commit**

```bash
git add src/features/views/components/MyViewsSection.tsx
git commit -m "fix(views): always show All plans link so no-plans users can reach team plans"
```

---

## Task 5: Fix progress ring coral-dot artifact

**Files:**
- Modify: `src/features/views/components/GroupRow.tsx`

### Background

`GroupRow` currently renders `<ProgressRing pct={progress ?? 0} />` unconditionally when `!showDotsButton && isPlan`. When `progress` is `null` (plan has no targets configured), the fallback `0` causes `strokeLinecap="round"` + `strokeDasharray="0 100"` to render as a coral dot rather than nothing. The fix: don't render the ring when `progress` is `null`.

- [ ] **Step 1: Guard the ring render**

In `src/features/views/components/GroupRow.tsx`, find the progress ring render (around line 197–200):

```tsx
{!showDotsButton &&
  (isPlan ? (
    <ProgressRing pct={progress ?? 0} />
  ) : (
```

Replace with:

```tsx
{!showDotsButton &&
  (isPlan ? (
    progress !== null && <ProgressRing pct={progress} />
  ) : (
```

The `pct={progress}` (without `?? 0`) is safe because `ProgressRing` only receives a value when `progress !== null`, which means it's always a `number` at that point. The `ProgressRing` component already clamps its input to `[0, 100]`.

- [ ] **Step 2: Commit**

```bash
git add src/features/views/components/GroupRow.tsx
git commit -m "fix(views): hide progress ring when plan has no targets configured"
```

---

## Task 6: Add view-count badges to sidebar plan rows

**Files:**
- Modify: `src/features/views/components/PlansSubsection.tsx`
- Modify: `src/features/views/components/GroupRow.tsx`
- Modify: `src/features/views/components/GroupViewList.tsx`

### Background

When a plan is expanded in the sidebar, each view-type row (Map, Table, Kanban, Contacts, Opps, Signals) shows a muted right-aligned count. The counts come from `PlanWithStats` fields already in cache — no new fetches.

Count mapping:
- `map` / `table` → `plan.districtLeaids.length`
- `kanban` / `opps` → `plan.oppsCount`
- `contacts` → `plan.contactsCount`
- `signals` → `plan.recentNewsCount`

- [ ] **Step 1: Build `viewCounts` in `PlansSubsection` and pass to `GroupRow`**

In `src/features/views/components/PlansSubsection.tsx`:

No new imports needed — TypeScript will check the object literal keys against `GroupRow`'s `viewCounts` prop type automatically.

In the `Body` component's `plans.map` call (inside the `<ul>`), replace:
```tsx
<GroupRow
  kind="plan"
  id={p.id}
  label={p.name}
  progress={p.progress ?? null}
  target={formatTarget(readTarget(p))}
  fiscal={readFiscalLabel(p)}
  hidden={p.hidden}
/>
```

With:
```tsx
<GroupRow
  kind="plan"
  id={p.id}
  label={p.name}
  progress={p.progress ?? null}
  target={formatTarget(readTarget(p))}
  fiscal={readFiscalLabel(p)}
  hidden={p.hidden}
  viewCounts={{
    map:      p.districtLeaids.length,
    table:    p.districtLeaids.length,
    kanban:   p.oppsCount,
    contacts: p.contactsCount,
    opps:     p.oppsCount,
    signals:  p.recentNewsCount,
  }}
/>
```

- [ ] **Step 2: Add `viewCounts` prop to `GroupRow` and thread it to `GroupViewList`**

In `src/features/views/components/GroupRow.tsx`:

`ViewId` is already imported via `import { VIEW_SPECS, type ViewId } from "../lib/view-types"` — no import change needed.

Add `viewCounts` to the `GroupRowProps` interface (around line 54):
```typescript
interface GroupRowProps {
  kind: GroupKind;
  id: string;
  label: string;
  progress?: number | null;
  target?: string | null;
  fiscal?: string | null;
  filterCount?: number;
  defaultViewId?: ViewId;
  hidden?: boolean;
  viewCounts?: Partial<Record<ViewId, number>>;  // ← add
}
```

Destructure it in the function signature (around line 76):
```typescript
export default function GroupRow({
  kind,
  id,
  label,
  progress,
  target,
  fiscal,
  filterCount,
  defaultViewId,
  hidden = false,
  viewCounts,  // ← add
}: GroupRowProps) {
```

Pass it to `GroupViewList` in the expanded section (around line 275):
```tsx
{isExpanded && (
  <GroupViewList
    kind={kind}
    groupId={id}
    activeViewId={isActive ? router.viewId : null}
    defaultViewId={defaultViewId ?? VIEW_SPECS[0].id}
    viewCounts={viewCounts}
  />
)}
```

- [ ] **Step 3: Render count badges in `GroupViewList`**

In `src/features/views/components/GroupViewList.tsx`:

`ViewId` is already imported via `import { VIEW_SPECS, type ViewId } from "../lib/view-types"` — no import change needed.

Add `viewCounts` to `GroupViewListProps` (around line 18):
```typescript
interface GroupViewListProps {
  kind: GroupKind;
  groupId: string;
  activeViewId: ViewId | null;
  defaultViewId?: ViewId;
  viewCounts?: Partial<Record<ViewId, number>>;  // ← add
}
```

Destructure in the function signature (around line 67):
```typescript
export default function GroupViewList({
  kind,
  groupId,
  activeViewId,
  viewCounts,  // ← add
}: GroupViewListProps) {
```

Inside the `VIEW_SPECS.map` render, add the count badge after the label span:
```tsx
<button
  type="button"
  onClick={() => {
    rememberLastView(kind, groupId, spec.id);
    router.goToGroup(kind, groupId, spec.id);
  }}
  className={`w-full flex items-center gap-2 pl-[30px] pr-2 py-1 rounded-md text-left text-[12.5px] transition-colors duration-100 ${
    isActive
      ? "bg-[#EFEDF5] text-[#403770] font-semibold"
      : "text-[#5C5277] font-medium hover:bg-[#F7F5FA]"
  }`}
  aria-current={isActive ? "page" : undefined}
>
  <Icon
    className="w-3.5 h-3.5 flex-shrink-0"
    style={{ color: isActive ? "#F37167" : "#8A80A8" }}
    aria-hidden
    strokeWidth={2}
  />
  <span className="flex-1 min-w-0 truncate whitespace-nowrap">
    {spec.label}
  </span>
  {viewCounts?.[spec.id] !== undefined && (
    <span className="ml-auto text-[10px] font-medium tabular-nums text-[#A69DC0] whitespace-nowrap">
      {viewCounts[spec.id]}
    </span>
  )}
</button>
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run --reporter=verbose 2>&1 | grep -E "FAIL|PASS|Tests" | head -20
```

Expected: all tests PASS. (Component changes have no unit tests; verify visually in the next step.)

- [ ] **Step 5: Smoke-test in the browser**

```bash
npm run dev -- --port 3005
```

Navigate to `http://localhost:3005`. Log in. In the sidebar, expand a plan that has districts, contacts, and opps. Confirm:
- Each view-type row shows a count to the right of the label
- Map and Table show the same district count
- Kanban and Opps show the same opps count
- Contacts shows the contacts count
- Signals shows the recent-news count (may be 0 for plans with no recent news)
- The count is absent on list rows (lists don't pass `viewCounts`)

Also verify:
- Team plans tab on `/views?bucket=team` now shows plans
- A user with no plans still sees the "All plans" link in the sidebar
- Plans without targets show no progress ring (no coral dot)
- Plans with targets and 0 bookings still show the ring

- [ ] **Step 6: Commit**

```bash
git add src/features/views/components/PlansSubsection.tsx \
        src/features/views/components/GroupRow.tsx \
        src/features/views/components/GroupViewList.tsx
git commit -m "feat(views): add view-count badges to expanded plan rows in sidebar"
```

---

## Task 7: Open PR

- [ ] **Step 1: Sync with main and verify clean state**

```bash
git log --oneline origin/main..HEAD
```

Expected: 6 commits ahead of main (one per task above).

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin HEAD
gh pr create \
  --title "fix(views): team plans, empty-state escape hatch, progress ring, view count badges" \
  --body "$(cat <<'EOF'
## Summary

- **Team plans = 0**: `PortfolioView` was fetching only the current user's plans (`mine=1`); now fetches all plans so the three-way mine/team/archived split works correctly.
- **No-plans empty state**: "All plans" link now always visible in the sidebar so users with zero own plans can navigate to the portfolio and see team plans.
- **Progress ring artifact**: Ring was rendering as a coral dot for plans with no targets (`progress=null`). Now hidden entirely when no targets are configured.
- **View count badges**: Map/Table/Kanban/Contacts/Opps/Signals rows in expanded sidebar plan items now show counts sourced from the already-loaded `?stats=1` payload. Signals shows news article count from the last 30 days (new `recentNewsCount` field added to the API).

## Test plan

- [ ] Team plans tab on `/views?bucket=team` shows teammates' plans
- [ ] User with no own plans sees "All plans" link in sidebar above the empty-state box
- [ ] Plans without targets show no progress ring in sidebar rows
- [ ] Plans with targets and 0 bookings still show the 0% ring
- [ ] Expanded plan rows show counts next to each view type
- [ ] Signals count reflects recent news (last 30 days) for the plan's districts
- [ ] All existing tests pass (`npx vitest run`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
