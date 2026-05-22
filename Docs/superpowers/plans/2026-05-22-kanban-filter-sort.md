# Kanban Filter & Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add filter + within-column sort to the opportunity kanban — reusing the grid's filter/sort chips for SQL opp fields (Bookings, Close, Owner, State, Contract type) plus a derived-Rank filter/sort handled in memory, persisted per-plan.

**Architecture:** The endpoint switches from "agg + windowed-cards SQL" to "one filtered SQL fetch + in-memory group/sort/cap" so the derived rank dimension and per-column counts/totals stay correct under filters. The UI reuses `GridFilterChips`/`GridSortChips` (source `opps`, with a new `excludeFieldIds` prop) for SQL fields and adds dedicated Rank controls. State persists in a new `viewLayouts.kanban` slot via a `useKanbanLayout` hook mirroring `useGridLayout`.

**Tech Stack:** Next.js App Router route, `readonlyPool` (pg) + `compileFilterTree` for SQL, Zod (`grid-layout-schema`), TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-22-kanban-filter-sort-design.md`

**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar/` (branch `worktree-saved-views-sidebar`). All paths below are relative to it.

---

## CONCURRENCY (read before every commit)

Other Claude sessions commit to this same branch/worktree. The git index is shared.
- Stage ONLY the exact files a task lists. NEVER `git add -A` / `git add .`.
- **Chain add+commit in ONE command:** `git add <files> && git commit -m "…"`.
- After committing, run `git log -1 --stat` and confirm YOUR message + YOUR files landed. If your files were swept into a foreign commit, the content is intact — do NOT amend/rebase; report it.
- Before editing a shared file (`GroupCanvas.tsx`, `GridFilterChips.tsx`, `GridSortChips.tsx`, `source-fields.ts`, `columns.ts`, `grid-layout-schema.ts`, `enum-values/route.ts`), re-read it fresh; another session may have changed it. Re-verify the `old_string` for edits.
- Run only the scoped test files named in each task (the full suite has unrelated in-progress churn from another session). Use `npx vitest run <path>`.

---

## File Structure

**Part 1 — SQL-field filter & sort**
- Modify `src/lib/saved-views/source-fields.ts` — add `contract_type` + `sales_rep` to `SOURCE_FIELDS.opps`.
- Modify `src/features/views/lib/columns.ts` — add `contract_type` column to `SOURCE_COLUMNS.opps`; set the `owner` column's `filterFieldId` to `"sales_rep"`.
- Modify `src/features/views/lib/enum-sources.ts` — add `"contract_types"`.
- Modify `src/app/api/views/enum-values/route.ts` — add `contract_types` case.
- Modify `src/lib/saved-views/grid-layout-schema.ts` — add `kanbanLayoutSchema` + `kanban` slot.
- Create `src/features/views/hooks/useKanbanLayout.ts` — kanban layout state + debounced PATCH.
- Modify `src/features/views/components/grid/FilterFieldPicker.tsx`, `SortFieldPicker.tsx` — `excludeFieldIds` prop.
- Modify `src/features/views/components/grid/GridFilterChips.tsx`, `GridSortChips.tsx` — thread `excludeFieldIds`.
- Modify `src/app/api/views/opps-kanban/route.ts` — accept `filters`/`sort`; one-fetch + in-memory group/sort/cap.
- Create `src/features/views/components/views/KanbanToolbar.tsx` — composes the chips.
- Modify `src/features/views/components/views/KanbanView.tsx` — render toolbar, thread layout into the query.
- Modify `src/features/views/components/GroupCanvas.tsx` — pass `savedLayouts` to `KanbanView`.

**Part 2 — Rank filter & sort**
- Modify `grid-layout-schema.ts` (kanban schema: `rankBuckets`, `rankSort`), `opps-kanban/route.ts` (rank params + in-memory rank filter/sort on columns + targeted), `KanbanToolbar.tsx` + new `RankFilterChip.tsx` / `RankSortChip.tsx`, `KanbanView.tsx` (thread rank into query).

Tests are co-located in `__tests__/` next to each file.

---

## Task 1: Registry — contract_type field/column, owner filter field, contract_types enum

**Files:**
- Modify: `src/lib/saved-views/source-fields.ts` (`SOURCE_FIELDS.opps`)
- Modify: `src/features/views/lib/columns.ts` (`SOURCE_COLUMNS.opps`)
- Modify: `src/features/views/lib/enum-sources.ts`
- Modify: `src/app/api/views/enum-values/route.ts`
- Test: `src/app/api/views/enum-values/__tests__/route.test.ts` (existing — add a case)

- [ ] **Step 1: Write the failing test** (append inside the existing `describe` blocks at end of file, before the final close)

```ts
describe("GET /api/views/enum-values?source=contract_types", () => {
  it("runs DISTINCT query on opportunities.contract_type", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValue({
      rows: [{ contract_type: "Hybrid Staffing" }, { contract_type: "Tier 1" }],
    });

    const res = await GET(makeRequest("/api/views/enum-values?source=contract_types"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.values).toEqual([
      { value: "Hybrid Staffing", label: "Hybrid Staffing" },
      { value: "Tier 1", label: "Tier 1" },
    ]);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/opportunities/i);
    expect(sql).toMatch(/contract_type/i);
    expect(sql).toMatch(/distinct/i);
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `npx vitest run src/app/api/views/enum-values/__tests__/route.test.ts`
Expected: FAIL — `contract_types` returns 400 (unknown source).

- [ ] **Step 3: Add the enum source id.** In `src/features/views/lib/enum-sources.ts`, add `"contract_types"` to the `EnumSourceId` union and `contract_types: false,` to `STATIC_ENUM_SOURCES`:

```ts
export type EnumSourceId =
  | "states"
  | "users"
  | "stages"
  | "personas"
  | "seniorities"
  | "feed_sources"
  | "contract_types";

export const STATIC_ENUM_SOURCES: Record<EnumSourceId, boolean> = {
  states: false,
  users: false,
  stages: false,
  personas: false,
  seniorities: false,
  feed_sources: false,
  contract_types: false,
};
```

- [ ] **Step 4: Add the route case.** In `src/app/api/views/enum-values/route.ts`: add `"contract_types"` to `VALID_SOURCES`, and add a case in the `switch` (next to the `stages` case):

```ts
    case "contract_types": {
      const result = await readonlyPool.query<{ contract_type: string }>(
        `SELECT DISTINCT contract_type FROM opportunities WHERE contract_type IS NOT NULL ORDER BY contract_type`,
      );
      return NextResponse.json({
        values: result.rows.map((r) => ({
          value: r.contract_type,
          label: r.contract_type,
        })),
      });
    }
```

- [ ] **Step 5: Add the SQL fields.** In `src/lib/saved-views/source-fields.ts`, inside the `opps:` array (after the `school_yr` entry), add:

```ts
    {
      id: "contract_type",
      label: "Contract type",
      column: "contract_type",
      type: "text",
      ops: ["is", "is not", "is any of", "is not any of"],
    },
    {
      id: "sales_rep",
      label: "Owner",
      column: "sales_rep_id",
      type: "text",
      ops: ["is", "is any of"],
    },
```

- [ ] **Step 6: Add the column + fix owner.** In `src/features/views/lib/columns.ts`, inside `SOURCE_COLUMNS.opps`: change the `owner` column's `filterFieldId: null` to `filterFieldId: "sales_rep"`, and add a `contract_type` column entry:

```ts
    { id: "contract_type", header: "Contract type", kind: "raw", accessor: "contractType",
      sortable: true,  filterFieldId: "contract_type", filterWidget: { kind: "multiselect", enumSource: "contract_types" },
      align: "left",   format: "pill",  defaultVisible: false, defaultOrder: 6 },
```

(Use `defaultOrder: 6` — one past the current last opps column `owner` at 5.)

- [ ] **Step 7: Run tests (pass)**

Run: `npx vitest run src/app/api/views/enum-values/__tests__/route.test.ts`
Expected: PASS. Then sanity-check the registries compile: `npx vitest run src/features/views/lib/__tests__/columns.test.ts`
Expected: PASS (existing column tests still green).

- [ ] **Step 8: Commit**

```bash
git add src/lib/saved-views/source-fields.ts src/features/views/lib/columns.ts src/features/views/lib/enum-sources.ts src/app/api/views/enum-values/route.ts src/app/api/views/enum-values/__tests__/route.test.ts && git commit -m "feat(views): opps contract_type + owner filter fields + contract_types enum"
git log -1 --stat
```
Confirm your message + these 5 files landed (concurrency).

---

## Task 2: Kanban layout schema

**Files:**
- Modify: `src/lib/saved-views/grid-layout-schema.ts`
- Test: `src/lib/saved-views/__tests__/grid-layout-schema.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test.** Create/append `src/lib/saved-views/__tests__/grid-layout-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { kanbanLayoutSchema, viewLayoutsSchema } from "../grid-layout-schema";

describe("kanbanLayoutSchema", () => {
  it("accepts a valid kanban layout", () => {
    const ok = kanbanLayoutSchema().safeParse({
      filters: { kind: "and", children: [] },
      sort: [{ id: "net_booking_amount", dir: "desc" }],
      rankBuckets: ["ranked", "new"],
      rankSort: "asc",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an unknown sort field", () => {
    const bad = kanbanLayoutSchema().safeParse({
      filters: { kind: "and", children: [] },
      sort: [{ id: "not_a_field", dir: "asc" }],
      rankBuckets: [],
      rankSort: null,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a bad rank bucket", () => {
    const bad = kanbanLayoutSchema().safeParse({
      filters: { kind: "and", children: [] },
      sort: [],
      rankBuckets: ["platinum"],
      rankSort: null,
    });
    expect(bad.success).toBe(false);
  });

  it("is exposed as the optional kanban slot on viewLayouts", () => {
    const ok = viewLayoutsSchema().safeParse({
      kanban: { filters: { kind: "and", children: [] }, sort: [], rankBuckets: [], rankSort: null },
    });
    expect(ok.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `npx vitest run src/lib/saved-views/__tests__/grid-layout-schema.test.ts`
Expected: FAIL — `kanbanLayoutSchema` is not exported.

- [ ] **Step 3: Implement.** In `src/lib/saved-views/grid-layout-schema.ts`, add (after `gridLayoutSchema`, before `viewLayoutsSchema`):

```ts
const rankBucketSchema = z.enum(["ranked", "win_back", "new"]);

export function kanbanLayoutSchema() {
  // Kanban sorts/filters use the opps source's SQL fields, minus stage
  // (it's the columns) and school_yr (fixed by the plan).
  const sortableFieldIds = new Set(
    SOURCE_FIELDS.opps
      .map((f) => f.id)
      .filter((id) => id !== "stage" && id !== "school_yr"),
  );
  return z.object({
    filters: filterAndSchema,
    sort: z.array(sortEntrySchema).superRefine((entries, ctx) => {
      for (const e of entries) {
        if (!sortableFieldIds.has(e.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Sort field "${e.id}" is not sortable for the kanban`,
          });
        }
      }
    }),
    rankBuckets: z.array(rankBucketSchema),
    rankSort: z.enum(["asc", "desc"]).nullable(),
  });
}
```

Then add the slot inside `viewLayoutsSchema()`'s object (after `rfps:`):

```ts
      kanban:    kanbanLayoutSchema().optional(),
```

And export the type at the bottom:

```ts
export type KanbanLayout = z.infer<ReturnType<typeof kanbanLayoutSchema>>;
```

- [ ] **Step 4: Run tests (pass)**

Run: `npx vitest run src/lib/saved-views/__tests__/grid-layout-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/saved-views/grid-layout-schema.ts src/lib/saved-views/__tests__/grid-layout-schema.test.ts && git commit -m "feat(views): kanban layout schema + viewLayouts.kanban slot"
git log -1 --stat
```

---

## Task 3: useKanbanLayout hook

**Files:**
- Create: `src/features/views/hooks/useKanbanLayout.ts`
- Test: `src/features/views/hooks/__tests__/useKanbanLayout.test.tsx`

Mirrors `useGridLayout` but for the kanban layout shape (no columns). Reuses `useUpdatePlanLayout`/`useUpdateListLayout`.

- [ ] **Step 1: Write the failing test.** Create `src/features/views/hooks/__tests__/useKanbanLayout.test.tsx`:

```tsx
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

const planMutate = vi.fn();
const listMutate = vi.fn();
vi.mock("@/features/views/lib/queries", () => ({
  useUpdatePlanLayout: () => ({ mutate: planMutate }),
  useUpdateListLayout: () => ({ mutate: listMutate }),
}));

import { useKanbanLayout, DEFAULT_KANBAN_LAYOUT } from "../useKanbanLayout";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

describe("useKanbanLayout", () => {
  it("seeds from savedLayouts.kanban when present, else the default", () => {
    const { result: a } = renderHook(() =>
      useKanbanLayout({ parentKind: "plan", parentId: "p1", savedLayouts: null }),
    );
    expect(a.current.layout).toEqual(DEFAULT_KANBAN_LAYOUT);

    const seeded = { filters: { kind: "and" as const, children: [] }, sort: [{ id: "close_date", dir: "asc" as const }], rankBuckets: [], rankSort: null };
    const { result: b } = renderHook(() =>
      useKanbanLayout({ parentKind: "plan", parentId: "p1", savedLayouts: { kanban: seeded } }),
    );
    expect(b.current.layout.sort).toEqual([{ id: "close_date", dir: "asc" }]);
  });

  it("optimistically updates and debounces a PATCH that merges into the blob", () => {
    const { result } = renderHook(() =>
      useKanbanLayout({
        parentKind: "plan",
        parentId: "p1",
        savedLayouts: { opps: { columns: [], sort: [], filters: { kind: "and", children: [] }, groupBy: null } } as never,
      }),
    );
    const next = { ...DEFAULT_KANBAN_LAYOUT, rankSort: "desc" as const };
    act(() => result.current.setLayout(next));
    expect(result.current.layout.rankSort).toBe("desc"); // optimistic
    expect(planMutate).not.toHaveBeenCalled(); // debounced
    act(() => vi.advanceTimersByTime(500));
    expect(planMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        opps: expect.anything(), // preserved
        kanban: next,            // merged
      }),
    );
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `npx vitest run src/features/views/hooks/__tests__/useKanbanLayout.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.** Create `src/features/views/hooks/useKanbanLayout.ts`:

```ts
/**
 * useKanbanLayout — kanban filter/sort/rank state with debounced (500ms) PATCH
 * to the parent plan/list's viewLayouts.kanban slot. Mirrors useGridLayout but
 * for the kanban layout shape (filters + sort + rankBuckets + rankSort; no
 * columns). Caller feeds the full saved viewLayouts blob.
 */
import { useEffect, useRef, useState } from "react";
import {
  useUpdatePlanLayout,
  useUpdateListLayout,
} from "@/features/views/lib/queries";
import type {
  KanbanLayout,
  ViewLayouts,
} from "@/lib/saved-views/grid-layout-schema";

export const DEFAULT_KANBAN_LAYOUT: KanbanLayout = {
  filters: { kind: "and", children: [] },
  sort: [],
  rankBuckets: [],
  rankSort: null,
};

const DEBOUNCE_MS = 500;

export interface UseKanbanLayoutArgs {
  parentKind: "plan" | "list";
  parentId: string;
  savedLayouts: ViewLayouts;
}

export function useKanbanLayout({
  parentKind,
  parentId,
  savedLayouts,
}: UseKanbanLayoutArgs) {
  const planMutation = useUpdatePlanLayout(parentKind === "plan" ? parentId : "");
  const listMutation = useUpdateListLayout(parentKind === "list" ? parentId : "");

  const initial = savedLayouts?.kanban ?? DEFAULT_KANBAN_LAYOUT;
  const [layout, setLayoutState] = useState<KanbanLayout>(initial);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ViewLayouts>(savedLayouts);
  savedRef.current = savedLayouts;

  const kanbanJson = JSON.stringify(savedLayouts?.kanban);
  useEffect(() => {
    const fromServer = savedLayouts?.kanban;
    if (fromServer) setLayoutState(fromServer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanbanJson]);

  const setLayout = (next: KanbanLayout) => {
    setLayoutState(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const merged: ViewLayouts = { ...(savedRef.current ?? {}), kanban: next };
      if (parentKind === "plan") planMutation.mutate(merged);
      else listMutation.mutate(merged);
    }, DEBOUNCE_MS);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { layout, setLayout };
}
```

- [ ] **Step 4: Run tests (pass)**

Run: `npx vitest run src/features/views/hooks/__tests__/useKanbanLayout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/hooks/useKanbanLayout.ts src/features/views/hooks/__tests__/useKanbanLayout.test.tsx && git commit -m "feat(views): useKanbanLayout hook with debounced PATCH"
git log -1 --stat
```

---

## Task 4: excludeFieldIds on the grid filter/sort chips

**Files:**
- Modify: `src/features/views/components/grid/FilterFieldPicker.tsx`
- Modify: `src/features/views/components/grid/SortFieldPicker.tsx`
- Modify: `src/features/views/components/grid/GridFilterChips.tsx`
- Modify: `src/features/views/components/grid/GridSortChips.tsx`
- Test: `src/features/views/components/grid/__tests__/FilterFieldPicker.test.tsx` (existing — add a case) and `src/features/views/components/grid/__tests__/GridSortChips.test.tsx` (existing — add a case)

- [ ] **Step 1: Write the failing tests.**

In `src/features/views/components/grid/__tests__/FilterFieldPicker.test.tsx`, add:

```tsx
it("hides excluded field ids from the picker", () => {
  render(
    <FilterFieldPicker
      source="opps"
      usedFieldIds={[]}
      excludeFieldIds={["stage", "school_yr"]}
      onPick={() => {}}
      onClose={() => {}}
    />,
  );
  expect(screen.queryByText("Stage")).toBeNull();
  expect(screen.queryByText("School year")).toBeNull();
  expect(screen.getByText("Bookings")).toBeInTheDocument();
});
```

In `src/features/views/components/grid/__tests__/GridSortChips.test.tsx`, add (mirror its existing render harness; `layout` is a GridViewLayout):

```tsx
it("omits excluded fields from the sort picker", () => {
  const layout = { columns: [], sort: [], filters: { kind: "and" as const, children: [] }, groupBy: null };
  render(<GridSortChips source="opps" layout={layout} excludeFieldIds={["stage", "school_yr"]} onChange={() => {}} />);
  fireEvent.click(screen.getByText("Sort"));
  expect(screen.queryByText("Stage")).toBeNull();
  expect(screen.queryByText("School year")).toBeNull();
});
```

- [ ] **Step 2: Run them (fail)**

Run: `npx vitest run src/features/views/components/grid/__tests__/FilterFieldPicker.test.tsx src/features/views/components/grid/__tests__/GridSortChips.test.tsx`
Expected: FAIL — `excludeFieldIds` prop not supported.

- [ ] **Step 3: Implement the pickers.**

`FilterFieldPicker.tsx` — add the prop and filter candidates:

```tsx
interface FilterFieldPickerProps {
  source: SavedListSource;
  usedFieldIds: string[];
  excludeFieldIds?: string[];
  onPick: (column: ColumnDef) => void;
  onClose: () => void;
}

export function FilterFieldPicker({
  source,
  usedFieldIds,
  excludeFieldIds = [],
  onPick,
  onClose,
}: FilterFieldPickerProps) {
  const candidates = SOURCE_COLUMNS[source].filter(
    (c) =>
      c.filterWidget !== null &&
      !excludeFieldIds.includes(c.filterFieldId ?? c.id),
  );
  // ...rest unchanged
```

`SortFieldPicker.tsx` — same shape:

```tsx
interface SortFieldPickerProps {
  source: SavedListSource;
  usedFieldIds: string[];
  excludeFieldIds?: string[];
  onPick: (column: ColumnDef) => void;
  onClose: () => void;
}

export function SortFieldPicker({
  source,
  usedFieldIds,
  excludeFieldIds = [],
  onPick,
}: SortFieldPickerProps) {
  const candidates = SOURCE_COLUMNS[source].filter(
    (c) => c.sortable && !excludeFieldIds.includes(c.id),
  );
  // ...rest unchanged
```

- [ ] **Step 4: Thread through the chip components.**

`GridFilterChips.tsx` — add `excludeFieldIds?: string[]` to `GridFilterChipsProps`, destructure it (default `[]`), pass `excludeFieldIds={excludeFieldIds}` to `<FilterFieldPicker ... />`, and skip rendering chips whose field is excluded:

```tsx
interface GridFilterChipsProps {
  source: SavedListSource;
  layout: GridViewLayout;
  excludeFieldIds?: string[];
  onChange: (next: GridViewLayout) => void;
}
// in component signature: ({ source, layout, excludeFieldIds = [], onChange })
// when building `chips`, filter out excluded:
const chips = layout.filters.children
  .map((child, i) => ({ index: i, node: child }))
  .filter(({ node }) => {
    const fid = chipFieldId(node);
    return fid === null || !excludeFieldIds.includes(fid);
  })
  .map(({ index, node }) => {
    const fid = chipFieldId(node);
    const col = fid
      ? SOURCE_COLUMNS[source].find((c) => (c.filterFieldId ?? c.id) === fid)
      : null;
    return { index, node, column: col ?? null };
  });
// and the picker:
//   <FilterFieldPicker source={source} usedFieldIds={usedFieldIds}
//      excludeFieldIds={excludeFieldIds} onPick={...} onClose={...} />
```

`GridSortChips.tsx` — add `excludeFieldIds?: string[]` to props (default `[]`), pass to `<SortFieldPicker>`, and skip excluded entries when rendering:

```tsx
interface GridSortChipsProps {
  source: SavedListSource;
  layout: GridViewLayout;
  excludeFieldIds?: string[];
  onChange: (next: GridViewLayout) => void;
}
// in component: ({ source, layout, excludeFieldIds = [], onChange })
// render only non-excluded entries (keep original indices for flip/remove):
{layout.sort
  .map((entry, i) => ({ entry, i }))
  .filter(({ entry }) => !excludeFieldIds.includes(entry.id))
  .map(({ entry, i }) => { /* existing chip JSX, using i for flipDirection/removeAt */ })}
// and: <SortFieldPicker source={source} usedFieldIds={usedFieldIds}
//        excludeFieldIds={excludeFieldIds} onPick={addSort} onClose={...} />
```

- [ ] **Step 5: Run tests (pass)**

Run: `npx vitest run src/features/views/components/grid/__tests__/FilterFieldPicker.test.tsx src/features/views/components/grid/__tests__/GridSortChips.test.tsx src/features/views/components/grid/__tests__/GridFilterChips.test.tsx`
Expected: PASS (new cases pass; existing grid tests unaffected since the prop defaults to `[]`).

- [ ] **Step 6: Commit**

```bash
git add src/features/views/components/grid/FilterFieldPicker.tsx src/features/views/components/grid/SortFieldPicker.tsx src/features/views/components/grid/GridFilterChips.tsx src/features/views/components/grid/GridSortChips.tsx src/features/views/components/grid/__tests__/FilterFieldPicker.test.tsx src/features/views/components/grid/__tests__/GridSortChips.test.tsx && git commit -m "feat(grid): excludeFieldIds prop on filter/sort chips + pickers"
git log -1 --stat
```

---

## Task 5: Endpoint — accept filters + sort (one fetch + in-memory group/sort/cap)

**Files:**
- Modify: `src/app/api/views/opps-kanban/route.ts`
- Test: `src/app/api/views/opps-kanban/__tests__/route.test.ts`

Replaces the agg + windowed-cards queries with one filtered fetch + JS aggregation, sorting cards within each column. The targeted query and the rank-label enrichment are unchanged.

- [ ] **Step 1: Write the failing tests.** Append a new describe block:

```ts
describe("GET /api/views/opps-kanban — filter & sort", () => {
  it("compiles a filter into the WHERE, narrowing counts/totals", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    // single fetch query returns already-filtered rows (the WHERE ran in SQL)
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "o1", stage: "1 - Discovery", name: "Big", district_name: "D", district_lea_id: "d1",
          contract_type: "Tier 1", net_booking_amount: "90000", minimum_purchase_amount: null,
          maximum_budget: null, close_date: null, sales_rep_name: null, details_link: null, state: "NY" },
      ],
    });
    const filters = encodeURIComponent(
      JSON.stringify({ kind: "and", children: [{ kind: "rule", fieldId: "net_booking_amount", op: ">=", value: 50000 }] }),
    );
    const res = await GET(
      makeRequest(`/api/views/opps-kanban?leaids=d1&schoolYr=2025-26&filters=${filters}`),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const disc = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(disc.count).toBe(1);
    expect(disc.totalBookings).toBe(90000);
    // the fetch SQL carried a compiled predicate + param
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/net_booking_amount/i);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain(50000);
  });

  it("sorts cards within a column per the sort spec (bookings desc)", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "small", stage: "1 - Discovery", name: "S", district_name: null, district_lea_id: "d1",
          contract_type: null, net_booking_amount: "10000", minimum_purchase_amount: null, maximum_budget: null,
          close_date: null, sales_rep_name: null, details_link: null, state: null },
        { id: "big", stage: "1 - Discovery", name: "B", district_name: null, district_lea_id: "d1",
          contract_type: null, net_booking_amount: "90000", minimum_purchase_amount: null, maximum_budget: null,
          close_date: null, sales_rep_name: null, details_link: null, state: null },
      ],
    });
    const sort = encodeURIComponent(JSON.stringify([{ id: "net_booking_amount", dir: "desc" }]));
    const res = await GET(makeRequest(`/api/views/opps-kanban?leaids=d1&schoolYr=2025-26&sort=${sort}`));
    const data = await res.json();
    const disc = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(disc.cards.map((c: { id: string }) => c.id)).toEqual(["big", "small"]);
  });

  it("rejects a filter referencing an unknown field with 400", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const filters = encodeURIComponent(
      JSON.stringify({ kind: "and", children: [{ kind: "rule", fieldId: "nope", op: "is", value: "x" }] }),
    );
    const res = await GET(makeRequest(`/api/views/opps-kanban?leaids=d1&schoolYr=2025-26&filters=${filters}`));
    expect(res.status).toBe(400);
  });
});
```

Also update the existing grouping test (`mockResolvedValueOnce` for agg + cards) — it now uses a **single** fetch query. Change its mock so the FIRST `mockResolvedValueOnce` returns the card rows (with `state` and `district_lea_id` on each), and drop the separate agg mock; the targeted query (when planId present) is the 2nd call. (Recompute the expected `count`/`totalBookings` from the returned rows, since they're now derived in JS.)

- [ ] **Step 2: Run them (fail)**

Run: `npx vitest run src/app/api/views/opps-kanban/__tests__/route.test.ts`
Expected: FAIL — endpoint ignores `filters`/`sort` and still issues the agg query.

- [ ] **Step 3: Implement.** Edit `src/app/api/views/opps-kanban/route.ts`:

Add imports:
```ts
import { compileFilterTree, validateFilterTree } from "@/lib/saved-views/sql-compiler";
import { filterAndSchema } from "@/lib/saved-views/schema";
import type { FilterNode } from "@/lib/saved-views/filter-tree";
```

Add `state` to `CardRow`:
```ts
  state: string | null;
```

Add a sort type + comparator helper near the top:
```ts
interface SortEntry { id: string; dir: "asc" | "desc" }

/** Compare two card rows by one sort entry. Nulls last; dir flips. */
function cmpRows(a: CardRow, b: CardRow, e: SortEntry): number {
  const get = (r: CardRow): number | string | null => {
    switch (e.id) {
      case "net_booking_amount": return num(r.net_booking_amount);
      case "close_date": return r.close_date ? new Date(r.close_date).getTime() : null;
      case "state": return r.state;
      case "contract_type": return r.contract_type;
      default: return null;
    }
  };
  const av = get(a), bv = get(b);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;       // nulls last
  if (bv == null) return -1;
  let c = av < bv ? -1 : av > bv ? 1 : 0;
  if (e.dir === "desc") c = -c;
  return c;
}
```

Parse + validate params (after `planId`):
```ts
  const filtersRaw = params.get("filters");
  const sortRaw = params.get("sort");

  let filterTree: FilterNode = { kind: "and", children: [] };
  if (filtersRaw) {
    let parsed: unknown;
    try { parsed = JSON.parse(filtersRaw); } catch {
      return NextResponse.json({ error: "Invalid filters JSON" }, { status: 400 });
    }
    const ok = filterAndSchema.safeParse(parsed);
    if (!ok.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
    filterTree = ok.data as FilterNode;
    const fieldErr = validateFilterTree("opps", filterTree);
    if (fieldErr) return NextResponse.json({ error: fieldErr }, { status: 400 });
  }

  let sort: SortEntry[] = [];
  if (sortRaw) {
    try {
      const arr = JSON.parse(sortRaw);
      if (Array.isArray(arr)) {
        sort = arr.filter(
          (e): e is SortEntry =>
            e && typeof e.id === "string" && (e.dir === "asc" || e.dir === "desc"),
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid sort JSON" }, { status: 400 });
    }
  }
```

Compile the filter (base params are `$1` leaids, `$2` schoolYr, `$3` stages → offset 3):
```ts
  const stages = [...OPP_KANBAN_STAGES];
  const baseParams: unknown[] = [leaids, schoolYr, stages];
  const compiled = compileFilterTree("opps", filterTree, "o", baseParams.length);
  if (!compiled.ok) {
    return NextResponse.json({ error: compiled.error }, { status: 400 });
  }
  const filterWhere = compiled.whereSql && compiled.whereSql !== "TRUE"
    ? ` AND ${compiled.whereSql}`
    : "";
  const fetchParams = [...baseParams, ...compiled.params];
```

Replace the agg + windowed-cards Promise.all entries with a **single** fetch query (keep the targeted query + `getGlobalCustomerLabels()` entries):
```ts
  const [cardResult, targetedResult, labels] = await Promise.all([
    readonlyPool.query<CardRow>(
      `SELECT o.id, o.stage, o.name, o.district_name, o.contract_type,
              o.net_booking_amount, o.minimum_purchase_amount, o.maximum_budget,
              o.close_date, o.sales_rep_name, o.details_link, o.district_lea_id, o.state
         FROM opportunities o
        WHERE o.district_lea_id = ANY($1)
          AND o.school_yr = $2
          AND o.stage = ANY($3)${filterWhere}
        LIMIT 5000`,
      fetchParams,
    ),
    planId
      ? readonlyPool.query<TargetedRow>(/* unchanged targeted SQL */ `…`, [planId, schoolYr])
      : Promise.resolve({ rows: [] as TargetedRow[] }),
    getGlobalCustomerLabels(),
  ]);
```
(Keep the existing targeted SQL string verbatim in that slot.)

Replace the `aggByStage`/`cardsByStage` block + column build with JS grouping that derives counts/totals and sorts within column:
```ts
  // Group rows by stage column.
  const rowsByStage = new Map<string, CardRow[]>();
  for (const r of cardResult.rows) {
    const list = rowsByStage.get(r.stage) ?? [];
    list.push(r);
    rowsByStage.set(r.stage, list);
  }

  const toCard = (r: CardRow): KanbanCard => ({
    id: r.id,
    name: r.name,
    districtName: r.district_name,
    contractType: r.contract_type,
    netBookingAmount: num(r.net_booking_amount),
    minimumPurchaseAmount: num(r.minimum_purchase_amount),
    maximumBudget: num(r.maximum_budget),
    closeDate: toISO(r.close_date),
    salesRepName: r.sales_rep_name,
    detailsLink: r.details_link,
    rankLabel: rankLabelString(labels.get(r.district_lea_id ?? "")),
  });

  const columns: KanbanColumn[] = OPP_STAGE_COLUMNS.map((c) => {
    const rows = rowsByStage.get(c.stage) ?? [];
    const total = rows.reduce((s, r) => s + (num(r.net_booking_amount) ?? 0), 0);
    const sorted = sort.length > 0
      ? [...rows].sort((a, b) => {
          for (const e of sort) { const d = cmpRows(a, b, e); if (d !== 0) return d; }
          return 0;
        })
      : [...rows].sort((a, b) => {
          // default: close_date ASC NULLS LAST, then net_booking_amount DESC
          const ca = cmpRows(a, b, { id: "close_date", dir: "asc" });
          if (ca !== 0) return ca;
          return cmpRows(a, b, { id: "net_booking_amount", dir: "desc" });
        });
    return {
      id: c.id,
      label: c.label,
      count: rows.length,
      totalBookings: total,
      cards: sorted.slice(0, limit).map(toCard),
      hasMore: rows.length > limit,
    };
  });
```

Leave the targeted-card mapping + `return NextResponse.json({ schoolYr, columns, targeted })` as-is.

- [ ] **Step 4: Run tests (pass)**

Run: `npx vitest run src/app/api/views/opps-kanban/__tests__/route.test.ts`
Expected: PASS (filter narrows counts; sort orders within column; unknown field → 400; existing grouping/targeted/rank-label tests pass with the single-fetch mock).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/views/opps-kanban/route.ts src/app/api/views/opps-kanban/__tests__/route.test.ts && git commit -m "feat(views): opps-kanban accepts filters + within-column sort"
git log -1 --stat
```

---

## Task 6: KanbanToolbar + KanbanView wiring + GroupCanvas savedLayouts

**Files:**
- Create: `src/features/views/components/views/KanbanToolbar.tsx`
- Modify: `src/features/views/components/views/KanbanView.tsx`
- Modify: `src/features/views/components/GroupCanvas.tsx`
- Test: `src/features/views/components/views/__tests__/KanbanView.test.tsx`

- [ ] **Step 1: Write the failing test.** Add to the existing KanbanView test (it mocks `fetchJson`). Add a mock for the layout mutations so `useKanbanLayout` works, and a test that the toolbar renders and a filter request is issued:

```tsx
// at top with other vi.mock calls:
vi.mock("@/features/views/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/views/lib/queries")>();
  return { ...actual, useUpdatePlanLayout: () => ({ mutate: vi.fn() }), useUpdateListLayout: () => ({ mutate: vi.fn() }) };
});

it("renders the filter/sort toolbar above the board", async () => {
  (fetchJson as Mock).mockResolvedValue(fixture);
  render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} planId="plan-1" savedLayouts={null} />));
  await screen.findByText("Acme Renewal");
  expect(screen.getByText("Filter")).toBeInTheDocument();
  expect(screen.getByText("Sort")).toBeInTheDocument();
});

it("seeds the request from a saved filter layout", async () => {
  (fetchJson as Mock).mockResolvedValue(fixture);
  const savedLayouts = {
    kanban: {
      filters: { kind: "and" as const, children: [{ kind: "rule" as const, fieldId: "net_booking_amount", op: ">=" as const, value: 50000 }] },
      sort: [], rankBuckets: [], rankSort: null,
    },
  };
  render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} planId="plan-1" savedLayouts={savedLayouts} />));
  await screen.findByText("Acme Renewal");
  const url = (fetchJson as Mock).mock.calls.at(-1)?.[0] as string;
  expect(url).toContain("filters=");
});
```

Update the other existing KanbanView renders to pass `savedLayouts={null}` (new required prop).

- [ ] **Step 2: Run it (fails)**

Run: `npx vitest run src/features/views/components/views/__tests__/KanbanView.test.tsx`
Expected: FAIL — `KanbanView` has no `savedLayouts` prop / no toolbar.

- [ ] **Step 3: Create the toolbar.** `src/features/views/components/views/KanbanToolbar.tsx`:

```tsx
"use client";

/**
 * KanbanToolbar — filter + within-column sort controls for the opp kanban.
 * Reuses the grid's chips for the SQL opp fields (Stage + School year excluded).
 * Rank controls are added in Part 2.
 */
import { GridFilterChips } from "../grid/GridFilterChips";
import { GridSortChips } from "../grid/GridSortChips";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";
import type { KanbanLayout } from "@/lib/saved-views/grid-layout-schema";

const EXCLUDE = ["stage", "school_yr"];

export function KanbanToolbar({
  layout,
  onChange,
}: {
  layout: KanbanLayout;
  onChange: (next: KanbanLayout) => void;
}) {
  // Shim: the grid chips expect a GridViewLayout; we only use filters + sort.
  const shim: GridViewLayout = {
    columns: [],
    sort: layout.sort,
    filters: layout.filters,
    groupBy: null,
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#EFEDF5] bg-white px-4 py-2">
      <GridFilterChips
        source="opps"
        layout={shim}
        excludeFieldIds={EXCLUDE}
        onChange={(next) => onChange({ ...layout, filters: next.filters })}
      />
      <GridSortChips
        source="opps"
        layout={shim}
        excludeFieldIds={EXCLUDE}
        onChange={(next) => onChange({ ...layout, sort: next.sort })}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire KanbanView.** Edit `src/features/views/components/views/KanbanView.tsx`:

Add `savedLayouts` to props + import the hook, toolbar, and types:
```tsx
import { useKanbanLayout } from "@/features/views/hooks/useKanbanLayout";
import { KanbanToolbar } from "./KanbanToolbar";
import type { ViewLayouts } from "@/lib/saved-views/grid-layout-schema";

interface KanbanViewProps {
  leaids: string[] | null;
  fiscalYear: number | null;
  planId: string | null;
  savedLayouts: ViewLayouts;
}
```

In the component, before the query, derive layout + serialized params:
```tsx
export default function KanbanView({ leaids, fiscalYear, planId, savedLayouts }: KanbanViewProps) {
  const { layout, setLayout } = useKanbanLayout({
    parentKind: "plan",
    parentId: planId ?? "",
    savedLayouts,
  });
  const keyTag = leaidsKey(leaids);
  const schoolYr = fiscalYear != null ? fiscalYearToSchoolYear(fiscalYear) : "";
  const filtersJson = JSON.stringify(layout.filters);
  const sortJson = JSON.stringify(layout.sort);

  const q = useQuery({
    queryKey: ["views", "opps-kanban", keyTag, schoolYr, planId ?? "", PAGE_SIZE, filtersJson, sortJson] as const,
    queryFn: () => {
      const csv = leaidsCsv(leaids);
      const planParam = planId ? `&planId=${encodeURIComponent(planId)}` : "";
      const hasFilters = layout.filters.children.length > 0;
      const filterParam = hasFilters ? `&filters=${encodeURIComponent(filtersJson)}` : "";
      const sortParam = layout.sort.length > 0 ? `&sort=${encodeURIComponent(sortJson)}` : "";
      return fetchJson<KanbanResponse>(
        `${API_BASE}/views/opps-kanban?leaids=${encodeURIComponent(csv)}` +
          `&schoolYr=${encodeURIComponent(schoolYr)}&limit=${PAGE_SIZE}${planParam}${filterParam}${sortParam}`,
      );
    },
    enabled: leaids !== null && schoolYr !== "",
    staleTime: 60 * 1000,
  });
```

Then render the toolbar above the board. Change the success `return (...)` so the scroll container is wrapped with the toolbar on top:
```tsx
  return (
    <div className="flex h-full flex-col">
      <KanbanToolbar layout={layout} onChange={setLayout} />
      <div className="flex-1 overflow-auto bg-[#FFFCFA] p-4" style={{ touchAction: "pan-y" }}>
        <div className="flex gap-3 min-w-max h-full">
          {targeted.count > 0 && (
            <TargetedColumn targeted={targeted} accent={TARGETED_ACCENT} />
          )}
          {columns.map((col) => (
            <Column key={col.id} col={col} accent={ACCENT_BY_ID[col.id] ?? "#A69DC0"} />
          ))}
        </div>
      </div>
    </div>
  );
```
(The `leaids === null`, loading, error, and empty-state early returns stay as they are — the toolbar only renders alongside a populated board.)

- [ ] **Step 5: Pass savedLayouts from GroupCanvas.** Re-read `src/features/views/components/GroupCanvas.tsx` fresh. In the `case "kanban":` branch, add `savedLayouts={savedLayouts}` (the `savedLayouts` const is already computed in `ViewBody`):
```tsx
    case "kanban":
      return (
        <KanbanView
          leaids={leaids}
          fiscalYear={plan?.fiscalYear ?? null}
          planId={plan?.id ?? null}
          savedLayouts={savedLayouts}
        />
      );
```

- [ ] **Step 6: Run tests (pass)**

Run: `npx vitest run src/features/views/components/views/__tests__/KanbanView.test.tsx`
Expected: PASS. Then typecheck the touched files:
Run: `npx tsc --noEmit 2>&1 | grep -E "KanbanView|KanbanToolbar|GroupCanvas|useKanbanLayout" || echo clean`
Expected: `clean`.

- [ ] **Step 7: Commit**

```bash
git add src/features/views/components/views/KanbanToolbar.tsx src/features/views/components/views/KanbanView.tsx src/features/views/components/GroupCanvas.tsx src/features/views/components/views/__tests__/KanbanView.test.tsx && git commit -m "feat(views): kanban filter/sort toolbar wired to persisted layout"
git log -1 --stat
```

**Part 1 ships here** — the five SQL fields filter + within-column sort, persisted per plan.

---

## Task 7: Endpoint — rank filter (buckets) + rank sort

**Files:**
- Modify: `src/app/api/views/opps-kanban/route.ts`
- Test: `src/app/api/views/opps-kanban/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests.** Append:

```ts
describe("GET /api/views/opps-kanban — rank filter & sort", () => {
  it("keeps only cards whose district is in the selected rank buckets", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockGetLabels.mockResolvedValue(new Map([
      ["d1", { rank: 2, label: "rank" }],   // ranked
      ["d2", { rank: null, label: "new" }], // new
    ]));
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "ranked", stage: "1 - Discovery", name: "R", district_name: null, district_lea_id: "d1",
          contract_type: null, net_booking_amount: "100", minimum_purchase_amount: null, maximum_budget: null,
          close_date: null, sales_rep_name: null, details_link: null, state: null },
        { id: "newone", stage: "1 - Discovery", name: "N", district_name: null, district_lea_id: "d2",
          contract_type: null, net_booking_amount: "100", minimum_purchase_amount: null, maximum_budget: null,
          close_date: null, sales_rep_name: null, details_link: null, state: null },
      ],
    });
    const res = await GET(makeRequest("/api/views/opps-kanban?leaids=d1,d2&schoolYr=2025-26&rankBuckets=ranked"));
    const data = await res.json();
    const disc = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(disc.count).toBe(1);
    expect(disc.cards[0].id).toBe("ranked");
  });

  it("sorts cards by rank when rankSort=asc (ranked before new)", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockGetLabels.mockResolvedValue(new Map([
      ["d1", { rank: 5, label: "rank" }],
      ["d2", { rank: null, label: "new" }],
    ]));
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "newone", stage: "1 - Discovery", name: "N", district_name: null, district_lea_id: "d2",
          contract_type: null, net_booking_amount: "100", minimum_purchase_amount: null, maximum_budget: null,
          close_date: null, sales_rep_name: null, details_link: null, state: null },
        { id: "ranked", stage: "1 - Discovery", name: "R", district_name: null, district_lea_id: "d1",
          contract_type: null, net_booking_amount: "100", minimum_purchase_amount: null, maximum_budget: null,
          close_date: null, sales_rep_name: null, details_link: null, state: null },
      ],
    });
    const res = await GET(makeRequest("/api/views/opps-kanban?leaids=d1,d2&schoolYr=2025-26&rankSort=asc"));
    const data = await res.json();
    const disc = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(disc.cards.map((c: { id: string }) => c.id)).toEqual(["ranked", "newone"]);
  });
});
```

- [ ] **Step 2: Run them (fail)**

Run: `npx vitest run src/app/api/views/opps-kanban/__tests__/route.test.ts`
Expected: FAIL — rank params ignored.

- [ ] **Step 3: Implement.** In `route.ts`:

Add a rank-bucket helper + sort key near `rankLabelString` usage:
```ts
type RankBucket = "ranked" | "win_back" | "new";

function rankBucketOf(g: { label: string } | undefined): RankBucket {
  if (g?.label === "rank") return "ranked";
  if (g?.label === "win_back") return "win_back";
  return "new";
}
/** Lower sorts first: ranked by rank number, then win_back, then new. */
function rankSortKey(g: { rank: number | null; label: string } | undefined): number {
  if (g?.label === "rank" && g.rank != null) return g.rank;       // 1,2,3,…
  if (g?.label === "win_back") return 1_000_000;
  return 2_000_000;
}
```

Parse params:
```ts
  const rankBuckets = (params.get("rankBuckets") ?? "")
    .split(",").map((s) => s.trim())
    .filter((s): s is RankBucket => s === "ranked" || s === "win_back" || s === "new");
  const rankSortRaw = params.get("rankSort");
  const rankSort: "asc" | "desc" | null =
    rankSortRaw === "asc" || rankSortRaw === "desc" ? rankSortRaw : null;
```

Apply the bucket filter to the fetched rows right after the fetch (before grouping):
```ts
  const inBucket = (r: CardRow) =>
    rankBuckets.length === 0 ||
    rankBuckets.includes(rankBucketOf(labels.get(r.district_lea_id ?? "")));
  const visibleRows = cardResult.rows.filter(inBucket);
```
Group `visibleRows` (not `cardResult.rows`).

Make rank the primary sort key when set. In the per-column sort, prepend rank:
```ts
    const byRank = (a: CardRow, b: CardRow) => {
      const ka = rankSortKey(labels.get(a.district_lea_id ?? ""));
      const kb = rankSortKey(labels.get(b.district_lea_id ?? ""));
      const d = ka === kb ? 0 : ka < kb ? -1 : 1;
      return rankSort === "desc" ? -d : d;
    };
    const sorted = [...rows].sort((a, b) => {
      if (rankSort) { const d = byRank(a, b); if (d !== 0) return d; }
      for (const e of sort) { const d = cmpRows(a, b, e); if (d !== 0) return d; }
      if (sort.length === 0 && !rankSort) {
        const ca = cmpRows(a, b, { id: "close_date", dir: "asc" });
        if (ca !== 0) return ca;
        return cmpRows(a, b, { id: "net_booking_amount", dir: "desc" });
      }
      return 0;
    });
```

Apply the same rank bucket filter + rank sort to the **targeted** cards (they have `district_lea_id`/`leaid`):
```ts
  const targetedFiltered = targetedAll.filter(
    (t) => rankBuckets.length === 0 || rankBuckets.includes(rankBucketOf(labels.get(t.leaid))),
  );
  if (rankSort) {
    targetedFiltered.sort((a, b) => {
      const ka = rankSortKey(labels.get(a.leaid));
      const kb = rankSortKey(labels.get(b.leaid));
      const d = ka === kb ? 0 : ka < kb ? -1 : 1;
      return rankSort === "desc" ? -d : d;
    });
  }
  // build `targeted` from targetedFiltered (count/total/cards/hasMore)
```
(Replace the existing `targetedAll`-based `targeted` build to use `targetedFiltered`.)

- [ ] **Step 4: Run tests (pass)**

Run: `npx vitest run src/app/api/views/opps-kanban/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/views/opps-kanban/route.ts src/app/api/views/opps-kanban/__tests__/route.test.ts && git commit -m "feat(views): opps-kanban rank bucket filter + rank sort"
git log -1 --stat
```

---

## Task 8: Rank chips + toolbar + KanbanView wiring

**Files:**
- Create: `src/features/views/components/views/RankFilterChip.tsx`
- Create: `src/features/views/components/views/RankSortChip.tsx`
- Modify: `src/features/views/components/views/KanbanToolbar.tsx`
- Modify: `src/features/views/components/views/KanbanView.tsx`
- Test: `src/features/views/components/views/__tests__/KanbanToolbar.test.tsx` (create)

- [ ] **Step 1: Write the failing test.** Create `src/features/views/components/views/__tests__/KanbanToolbar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KanbanToolbar } from "../KanbanToolbar";
import { DEFAULT_KANBAN_LAYOUT } from "@/features/views/hooks/useKanbanLayout";

beforeEach(() => vi.clearAllMocks());

describe("KanbanToolbar rank controls", () => {
  it("cycles rank sort none → asc → desc via the Rank chip", () => {
    const onChange = vi.fn();
    render(<KanbanToolbar layout={DEFAULT_KANBAN_LAYOUT} onChange={onChange} />);
    fireEvent.click(screen.getByText("Rank"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rankSort: "asc" }));
  });

  it("opens the rank bucket filter", () => {
    const onChange = vi.fn();
    render(<KanbanToolbar layout={DEFAULT_KANBAN_LAYOUT} onChange={onChange} />);
    fireEvent.click(screen.getByText("Rank bucket"));
    expect(screen.getByText("Ranked")).toBeInTheDocument();
    expect(screen.getByText("Win Back")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `npx vitest run src/features/views/components/views/__tests__/KanbanToolbar.test.tsx`
Expected: FAIL — no Rank controls.

- [ ] **Step 3: Implement the rank chips.**

`RankSortChip.tsx`:
```tsx
"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function RankSortChip({
  value,
  onChange,
}: {
  value: "asc" | "desc" | null;
  onChange: (next: "asc" | "desc" | null) => void;
}) {
  const next = value === null ? "asc" : value === "asc" ? "desc" : null;
  const Icon = value === "desc" ? ArrowDown : value === "asc" ? ArrowUp : ArrowUpDown;
  const active = value !== null;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] whitespace-nowrap ${
        active
          ? "border-[#E2DEEC] bg-[#F7F5FA] text-[#403770]"
          : "border-dashed border-[#E2DEEC] text-[#544A78] hover:bg-[#F7F5FA]"
      }`}
    >
      <Icon className="h-3 w-3" />
      <span>Rank</span>
    </button>
  );
}
```

`RankFilterChip.tsx`:
```tsx
"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";

type Bucket = "ranked" | "win_back" | "new";
const OPTIONS: { value: Bucket; label: string }[] = [
  { value: "ranked", label: "Ranked" },
  { value: "win_back", label: "Win Back" },
  { value: "new", label: "New" },
];

export function RankFilterChip({
  value,
  onChange,
}: {
  value: Bucket[];
  onChange: (next: Bucket[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (b: Bucket) =>
    onChange(value.includes(b) ? value.filter((x) => x !== b) : [...value, b]);
  const label =
    value.length === 0
      ? "Rank bucket"
      : OPTIONS.filter((o) => value.includes(o.value)).map((o) => o.label).join(", ");
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] whitespace-nowrap ${
          value.length
            ? "border-[#E2DEEC] bg-[#F7F5FA] text-[#403770]"
            : "border-dashed border-[#E2DEEC] text-[#544A78] hover:bg-[#F7F5FA]"
        }`}
      >
        {value.length === 0 && <Plus className="h-3 w-3" />}
        <span>{label}</span>
        {value.length > 0 && (
          <X
            className="h-3 w-3 text-[#8A80A8] hover:text-[#403770]"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
          />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-40 rounded-lg border border-[#E2DEEC] bg-white p-1 shadow-md">
          {OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-2 py-1 text-[13px] hover:bg-[#F7F5FA]">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
              <span className="whitespace-nowrap">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add them to the toolbar.** In `KanbanToolbar.tsx`, import the two chips and render them after the filter chips / sort chips respectively:
```tsx
import { RankFilterChip } from "./RankFilterChip";
import { RankSortChip } from "./RankSortChip";
// after GridFilterChips:
<RankFilterChip value={layout.rankBuckets} onChange={(rankBuckets) => onChange({ ...layout, rankBuckets })} />
// after GridSortChips:
<RankSortChip value={layout.rankSort} onChange={(rankSort) => onChange({ ...layout, rankSort })} />
```

- [ ] **Step 5: Thread rank into the request.** In `KanbanView.tsx`, add to the query key + URL:
```tsx
  const rankBucketsParam = layout.rankBuckets.length > 0 ? `&rankBuckets=${layout.rankBuckets.join(",")}` : "";
  const rankSortParam = layout.rankSort ? `&rankSort=${layout.rankSort}` : "";
```
Add `layout.rankBuckets.join(",")` and `layout.rankSort ?? ""` to the query key array, and append `${rankBucketsParam}${rankSortParam}` to the fetch URL.

- [ ] **Step 6: Run tests (pass)**

Run: `npx vitest run src/features/views/components/views/__tests__/KanbanToolbar.test.tsx src/features/views/components/views/__tests__/KanbanView.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/views/components/views/RankFilterChip.tsx src/features/views/components/views/RankSortChip.tsx src/features/views/components/views/KanbanToolbar.tsx src/features/views/components/views/KanbanView.tsx src/features/views/components/views/__tests__/KanbanToolbar.test.tsx && git commit -m "feat(views): kanban rank bucket filter + rank sort chips"
git log -1 --stat
```

---

## Task 9: Verification

**Files:** none.

- [ ] **Step 1: Scoped suite green.** Run all touched test files together:
```bash
npx vitest run \
  src/app/api/views/enum-values/__tests__/route.test.ts \
  src/lib/saved-views/__tests__/grid-layout-schema.test.ts \
  src/features/views/hooks/__tests__/useKanbanLayout.test.tsx \
  src/features/views/components/grid/__tests__/FilterFieldPicker.test.tsx \
  src/features/views/components/grid/__tests__/GridSortChips.test.tsx \
  src/features/views/components/grid/__tests__/GridFilterChips.test.tsx \
  src/app/api/views/opps-kanban/__tests__/route.test.ts \
  src/features/views/components/views/__tests__/KanbanView.test.tsx \
  src/features/views/components/views/__tests__/KanbanToolbar.test.tsx
```
Expected: all pass.

- [ ] **Step 2: Typecheck touched files.**
```bash
npx tsc --noEmit 2>&1 | grep -E "opps-kanban|KanbanView|KanbanToolbar|RankFilterChip|RankSortChip|useKanbanLayout|grid-layout-schema|FilterFieldPicker|SortFieldPicker|GridFilterChips|GridSortChips|source-fields|columns.ts|enum-" || echo clean
```
Expected: `clean`.

- [ ] **Step 3: Manual smoke (dev server on :3005 in this worktree).**
  - Open a plan → Kanban. Confirm the toolbar shows Filter / Rank bucket / Sort / Rank.
  - Add a Bookings ≥ $50k filter → columns narrow; counts + summed bookings drop accordingly.
  - Add a Close date sort → cards reorder within each column.
  - Pick rank buckets (e.g. Ranked only) → only ranked-district cards remain, in opp columns AND the Targeted column; counts update.
  - Toggle Rank sort → cards order ranked-first.
  - Reload → filters/sort restored (persisted).
  - Clear all → board returns to the default ordering.

- [ ] **Step 4: Mobile scroll check** — toolbar chips wrap/scroll on a narrow viewport; the board still scrolls horizontally + vertically; Map tab still pinch-zooms after visiting kanban.

---

## Self-Review Notes (author)

- **Spec coverage:** field set + registry → Task 1; layout schema → Task 2; persistence hook → Task 3; `excludeFieldIds` reuse → Task 4; endpoint filter+sort (one-fetch + JS) → Task 5; toolbar + wiring + GroupCanvas savedLayouts → Task 6; rank filter/sort endpoint → Task 7; rank chips → Task 8; testing/mobile → Task 9. Targeted-column rank behavior → Task 7. Phasing (Part 1 = Tasks 1–6, Part 2 = Tasks 7–8) matches the spec.
- **Type consistency:** `KanbanLayout` (filters/sort/rankBuckets/rankSort) is defined in Task 2 and consumed identically in Tasks 3/6/8; `DEFAULT_KANBAN_LAYOUT` from Task 3 used in Task 8 test; `CardRow` gains `state` in Task 5 and rank helpers added in Task 7 reuse it; `excludeFieldIds` prop name consistent across Tasks 4/6.
- **No placeholders:** every code step has real code. The one "keep the existing targeted SQL string verbatim" reference in Task 5 points at code already present in the file (not a TODO).
