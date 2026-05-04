# Unmatched Opportunities Rep Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the leaderboard's `?rep=<UserProfile.id>` deep-link to actually filter `/admin/unmatched-opportunities`, and surface a Rep filter in the existing filter bar so admins can scope by rep on this page directly.

**Architecture:** Three-layer in-place fix. (1) API route translates `rep` UUID → email via `UserProfile.findUnique`, sub-selects opportunity ids matching that `sales_rep_email`, then constrains the existing Prisma `where` with `id: { in: ids }`. (2) `ColumnDef` gains `isFilterOnly?: boolean` and `enumValues` is widened to accept `{value, label}` objects so the chip can show "Monica Sherwood" instead of a UUID. (3) Page reads `?rep=` via `useSearchParams()`, seeds filter state, hydrates a virtual Rep column from `useUsers()`, and `router.replace()`'s the URL when the chip is cleared.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, TanStack Query, Vitest + Testing Library + jsdom, Tailwind 4.

**Spec:** `Docs/superpowers/specs/2026-05-04-unmatched-opps-rep-filter-design.md`

---

## File Map

| Path | Action | Purpose |
|------|--------|---------|
| `src/features/shared/components/DataGrid/types.ts` | Modify | Widen `enumValues` to support `{value,label}` form; add `isFilterOnly?: boolean` to `ColumnDef`. |
| `src/app/admin/unmatched-opportunities/AdminFilterBar.tsx` | Modify | Normalize `enumValues` consumption; render label (not raw value) in chips when label exists. |
| `src/app/admin/unmatched-opportunities/AdminColumnPicker.tsx` | Modify | Skip `isFilterOnly` columns in the toggle list. |
| `src/features/shared/components/DataGrid/DataGrid.tsx` | Modify | Skip `isFilterOnly` columns when building TanStack Table column defs. |
| `src/app/admin/unmatched-opportunities/columns.ts` | Modify | Add virtual "rep" column entry (`isFilterOnly: true`, `filterType: "enum"`). |
| `src/app/api/admin/unmatched-opportunities/route.ts` | Modify | Accept `rep` query param; translate UUID → email → ids → `where.id`. |
| `src/app/api/admin/unmatched-opportunities/__tests__/route.test.ts` | Create | TDD coverage of rep filter API behavior. |
| `src/app/admin/unmatched-opportunities/page.tsx` | Modify | `useSearchParams` + `useRouter`; seed filters with rep on mount; hydrate rep column from `useUsers()`; forward `rep` to API; clear URL on chip removal. |

---

## Task 1: Extend `ColumnDef` type

**Files:**
- Modify: `src/features/shared/components/DataGrid/types.ts:4-15`

- [ ] **Step 1: Modify the `ColumnDef` interface**

Replace the interface body:

```ts
export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags" | "relation";
  enumValues?: Array<string | { value: string; label: string }>;
  relationSource?: string; // intentionally wide per spec (existing districtColumns uses "tags" | "plans")
  width?: number;    // explicit column width in px (applied as min-width + max-width)
  editable?: boolean;
  sortable?: boolean; // defaults to true; set false to disable sorting
  isFilterOnly?: boolean; // virtual column — appears in filter picker but never rendered as a row cell
}
```

The only changes vs. current: `enumValues` widened to `Array<string | { value: string; label: string }>`, and a new `isFilterOnly?: boolean` line.

- [ ] **Step 2: Verify typecheck passes for the changed file only**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "DataGrid/types\.ts|columns\.ts|AdminFilterBar\.tsx|AdminColumnPicker\.tsx|DataGrid\.tsx" | head -20`

Expected: no errors mentioning these files. (If unrelated repo errors exist, ignore them — we're only verifying our change is type-clean.)

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/components/DataGrid/types.ts
git commit -m "feat(datagrid): widen ColumnDef enumValues + add isFilterOnly"
```

---

## Task 2: Make `AdminFilterBar` use object-form `enumValues`

The bar today builds dropdown options at line 353 with `colDef.enumValues.map((v) => ({ value: v, label: v }))` — assumes `v` is a string. The chip label at lines 59-69 also displays `filter.value` raw. Both need to handle the `{value,label}` form.

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/AdminFilterBar.tsx`

- [ ] **Step 1: Add a normalization helper**

After the imports (top of the file, after line 6), add:

```ts
function normalizeEnumValues(
  values: Array<string | { value: string; label: string }> | undefined
): { value: string; label: string }[] {
  if (!values) return [];
  return values.map((v) => (typeof v === "string" ? { value: v, label: v } : v));
}
```

- [ ] **Step 2: Update `formatFilterLabel` to look up the label**

Replace the `formatFilterLabel` function (currently lines 59-69) with:

```ts
function formatFilterLabel(columnDefs: ColumnDef[], filter: FilterRule): string {
  const col = getColumnDef(columnDefs, filter.column);
  const label = col?.label ?? filter.column;
  const operators = getOperators(col?.filterType ?? "text");
  const opDef = operators.find((o) => o.op === filter.operator);
  const opLabel = opDef?.label ?? filter.operator;
  if (opDef && !opDef.needsValue) {
    return `${label} ${opLabel}`;
  }
  // For enum columns with object-form values, render the human label, not the raw id.
  let displayValue: string = String(filter.value);
  if (col?.filterType === "enum" && col.enumValues) {
    const match = normalizeEnumValues(col.enumValues).find(
      (v) => v.value === String(filter.value)
    );
    if (match) displayValue = match.label;
  }
  return `${label} ${opLabel} "${displayValue}"`;
}
```

- [ ] **Step 3: Update the value Dropdown to use normalized options**

Find the `Dropdown` invocation for enum value inputs (currently around line 348-355):

```tsx
{colDef?.filterType === "enum" && colDef.enumValues ? (
  <div className="relative mt-1">
    <Dropdown
      value={filterValue}
      placeholder="Select value..."
      options={colDef.enumValues.map((v) => ({ value: v, label: v }))}
      onChange={setFilterValue}
    />
  </div>
) : ...
```

Replace with:

```tsx
{colDef?.filterType === "enum" && colDef.enumValues ? (
  <div className="relative mt-1">
    <Dropdown
      value={filterValue}
      placeholder="Select value..."
      options={normalizeEnumValues(colDef.enumValues)}
      onChange={setFilterValue}
    />
  </div>
) : ...
```

- [ ] **Step 4: Run the existing filter bar / page tests**

Run: `npx vitest run src/app/admin/unmatched-opportunities --reporter=basic`

Expected: any pre-existing tests still pass. (If none exist, vitest reports "no test files found" and exits 0 — also acceptable.)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/unmatched-opportunities/AdminFilterBar.tsx
git commit -m "feat(admin-filter-bar): support {value,label} enumValues in chips and dropdown"
```

---

## Task 3: Skip `isFilterOnly` columns in the column picker

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/AdminColumnPicker.tsx:47-55`

- [ ] **Step 1: Filter out `isFilterOnly` columns when building groups**

Replace the `groups` `useMemo` (lines 47-55):

```ts
const groups = useMemo(() => {
  const map = new Map<string, ColumnDef[]>();
  for (const col of columnDefs) {
    if (col.isFilterOnly) continue; // virtual filter-only columns never appear in the picker
    const group = col.group || "Other";
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(col);
  }
  return Array.from(map.entries());
}, [columnDefs]);
```

Also update `defaultColumns` (lines 57-60) to skip filterOnly so "Reset to defaults" doesn't try to surface them:

```ts
const defaultColumns = useMemo(
  () => columnDefs.filter((c) => c.isDefault && !c.isFilterOnly).map((c) => c.key),
  [columnDefs]
);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/unmatched-opportunities/AdminColumnPicker.tsx
git commit -m "feat(admin-column-picker): hide isFilterOnly virtual columns"
```

---

## Task 4: Skip `isFilterOnly` columns in DataGrid rendering

Belt-and-suspenders: even if a filter-only column key sneaks into `visibleColumns`, the DataGrid should not try to render it as a table column.

**Files:**
- Modify: `src/features/shared/components/DataGrid/DataGrid.tsx:134-182` (the `cols` `useMemo` that builds TanStack Table column defs)

- [ ] **Step 1: Locate and modify the visible-column resolution**

Find the block starting at line 134:

```ts
const cols: TanStackColumnDef<Record<string, unknown>>[] = visibleColumns.map((key) => {
  const colDef = columnDefs.find((c) => c.key === key);
  return {
    id: key,
    accessorFn: (row: Record<string, unknown>) => row[key],
    header: () => resolveLabel(key),
    cell: (info) => {
      const value = info.getValue();
      const row = info.row.original;
      if (cellRenderers?.[key] && colDef) {
        return cellRenderers[key]({ value, row, columnDef: colDef });
      }
      return renderCell(value, key, colDef);
    },
  };
});
```

Replace it with this `.flatMap` version that drops `isFilterOnly` entries:

```ts
const cols: TanStackColumnDef<Record<string, unknown>>[] = visibleColumns.flatMap((key) => {
  const colDef = columnDefs.find((c) => c.key === key);
  if (colDef?.isFilterOnly) return []; // never render filter-only columns
  return [{
    id: key,
    accessorFn: (row: Record<string, unknown>) => row[key],
    header: () => resolveLabel(key),
    cell: (info) => {
      const value = info.getValue();
      const row = info.row.original;
      if (cellRenderers?.[key] && colDef) {
        return cellRenderers[key]({ value, row, columnDef: colDef });
      }
      return renderCell(value, key, colDef);
    },
  }];
});
```

Note: in practice, `isFilterOnly` columns never reach `visibleColumns` because the page seeds it from `isDefault: true` columns and the picker (Task 3) hides them. This guard is belt-and-suspenders.

- [ ] **Step 2: Verify typecheck on the changed file**

Run: `npx tsc --noEmit 2>&1 | grep "DataGrid\.tsx"`

Expected: no output (no new errors in DataGrid.tsx).

- [ ] **Step 3: Run DataGrid tests**

Run: `npx vitest run src/features/shared/components/DataGrid --reporter=basic`

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/shared/components/DataGrid/DataGrid.tsx
git commit -m "feat(datagrid): skip isFilterOnly columns when rendering"
```

---

## Task 5: Add the virtual "rep" column

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/columns.ts` (append a new entry)

- [ ] **Step 1: Append the rep column**

Add a new entry inside `unmatchedOpportunityColumns` array after the last existing entry (after the `netBookingAmount` block ending at line 102, before the closing `];`):

```ts
  // ---- Filters only (virtual — not a row field) ----
  {
    key: "rep",
    label: "Rep",
    group: "Filters",
    isDefault: false,
    isFilterOnly: true,
    filterType: "enum",
    enumValues: [], // populated at runtime from useUsers() data
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/unmatched-opportunities/columns.ts
git commit -m "feat(unmatched-opps): add virtual rep column for filter bar"
```

---

## Task 6: API — accept `rep` filter (TDD)

**Files:**
- Create: `src/app/api/admin/unmatched-opportunities/__tests__/route.test.ts`
- Modify: `src/app/api/admin/unmatched-opportunities/route.ts`

- [ ] **Step 1: Write the failing test**

Create the test file:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: {
      findUnique: vi.fn(),
    },
    opportunity: {
      findMany: vi.fn(),
    },
    unmatchedOpportunity: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

function makeRequest(qs: string) {
  return new NextRequest(`http://localhost/api/admin/unmatched-opportunities?${qs}`);
}

describe("GET /api/admin/unmatched-opportunities — rep filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.unmatchedOpportunity.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.unmatchedOpportunity.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([] as never);
  });

  it("filters by rep: looks up email, fetches opp ids, constrains where.id", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      email: "monica@fullmindlearning.com",
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([
      { id: "175922" },
      { id: "175923" },
    ] as never);

    await GET(makeRequest("rep=619f3009-0966-47ec-a09a-5f406d1da596"));

    expect(prisma.userProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "619f3009-0966-47ec-a09a-5f406d1da596" },
      select: { email: true },
    });
    expect(prisma.opportunity.findMany).toHaveBeenCalledWith({
      where: { salesRepEmail: "monica@fullmindlearning.com" },
      select: { id: true },
    });
    const findManyCall = vi.mocked(prisma.unmatchedOpportunity.findMany).mock.calls[0][0];
    expect(findManyCall.where).toMatchObject({ id: { in: ["175922", "175923"] } });
  });

  it("returns empty page when rep UUID has no matching profile", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest("rep=00000000-0000-0000-0000-000000000000"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.pagination.total).toBe(0);
    expect(prisma.opportunity.findMany).not.toHaveBeenCalled();
    expect(prisma.unmatchedOpportunity.findMany).not.toHaveBeenCalled();
  });

  it("returns empty page when profile email is null", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({ email: null } as never);

    const res = await GET(makeRequest("rep=619f3009-0966-47ec-a09a-5f406d1da596"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("composes rep filter with resolved=false", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      email: "monica@fullmindlearning.com",
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([{ id: "175922" }] as never);

    await GET(makeRequest("rep=619f3009&resolved=false"));

    const findManyCall = vi.mocked(prisma.unmatchedOpportunity.findMany).mock.calls[0][0];
    expect(findManyCall.where).toMatchObject({
      resolved: false,
      id: { in: ["175922"] },
    });
  });

  it("ignores rep param when not provided (regression guard)", async () => {
    await GET(makeRequest("resolved=false"));

    expect(prisma.userProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.opportunity.findMany).not.toHaveBeenCalled();
    const findManyCall = vi.mocked(prisma.unmatchedOpportunity.findMany).mock.calls[0][0];
    expect(findManyCall.where).not.toHaveProperty("id");
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx vitest run src/app/api/admin/unmatched-opportunities/__tests__/route.test.ts --reporter=basic`

Expected: 5 tests fail. The first failure should be on `prisma.userProfile.findUnique` not being called (because the route doesn't read `rep` yet).

- [ ] **Step 3: Implement the rep filter in the route**

Modify `src/app/api/admin/unmatched-opportunities/route.ts`. After the line that reads `const stageGroup = searchParams.get("stage_group");` (around line 29), add:

```ts
    const rep = searchParams.get("rep");
```

Then, after the existing block that parses other params and before the line `const where: Record<string, unknown> = {};` (around line 36), insert the rep resolution. Actually, do the resolution *after* `where` is built but before the Prisma calls. Insert this block immediately before `const orderByColumn = ...` (currently around line 84):

```ts
    if (rep) {
      const profile = await prisma.userProfile.findUnique({
        where: { id: rep },
        select: { email: true },
      });
      if (!profile?.email) {
        return NextResponse.json({
          items: [],
          pagination: { page, pageSize, total: 0 },
        });
      }
      const oppRows = await prisma.opportunity.findMany({
        where: { salesRepEmail: profile.email },
        select: { id: true },
      });
      where.id = { in: oppRows.map((o) => o.id) };
    }
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run src/app/api/admin/unmatched-opportunities/__tests__/route.test.ts --reporter=basic`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/unmatched-opportunities/__tests__/route.test.ts src/app/api/admin/unmatched-opportunities/route.ts
git commit -m "feat(api): filter unmatched opps by rep via UserProfile.email lookup"
```

---

## Task 7: Page — read URL, seed filters, hydrate rep column, sync URL on clear

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx`

- [ ] **Step 1: Add imports for `useSearchParams`, `useRouter`, and `useUsers`**

Add to the top of the file (alongside existing imports):

```ts
import { useSearchParams, useRouter } from "next/navigation";
import { useUsers } from "@/features/shared/lib/queries";
```

- [ ] **Step 2: Extend `fetchOpportunities` param shape and URLSearchParams build**

In the `fetchOpportunities` function (currently lines 59-89), add `rep?: string` to the params type and forward it. Replace the function with:

```ts
async function fetchOpportunities(params: {
  resolved?: string;
  school_yr?: string;
  state?: string;
  stage?: string;
  reason?: string;
  search?: string;
  has_district_id?: string;
  stage_group?: string;
  rep?: string;
  sort_by?: string;
  sort_dir?: string;
  page: number;
  page_size: number;
}): Promise<{ items: UnmatchedOpportunity[]; pagination: PaginationInfo }> {
  const qs = new URLSearchParams();
  if (params.resolved) qs.set("resolved", params.resolved);
  if (params.school_yr) qs.set("school_yr", params.school_yr);
  if (params.state) qs.set("state", params.state);
  if (params.stage) qs.set("stage", params.stage);
  if (params.reason) qs.set("reason", params.reason);
  if (params.search) qs.set("search", params.search);
  if (params.has_district_id) qs.set("has_district_id", params.has_district_id);
  if (params.stage_group) qs.set("stage_group", params.stage_group);
  if (params.rep) qs.set("rep", params.rep);
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  qs.set("page", String(params.page));
  qs.set("page_size", String(params.page_size));
  const res = await fetch(`/api/admin/unmatched-opportunities?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}
```

- [ ] **Step 3: Inside `UnmatchedOpportunitiesPage`, add hooks and seed filter state**

The component starts around line 1181 with `export default function UnmatchedOpportunitiesPage() { const queryClient = useQueryClient();`. Immediately after that line, add:

```ts
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialRepId = searchParams?.get("rep") ?? null;

  const { data: users } = useUsers();
```

Then replace the `filters` state initializer (currently lines 1217-1219):

```ts
  const [filters, setFilters] = useState<FilterRule[]>([
    { column: "resolved", operator: "is_false", value: false },
  ]);
```

With:

```ts
  const [filters, setFilters] = useState<FilterRule[]>(() => {
    const base: FilterRule[] = [
      { column: "resolved", operator: "is_false", value: false },
    ];
    if (initialRepId) {
      base.push({ column: "rep", operator: "eq", value: initialRepId });
    }
    return base;
  });
```

- [ ] **Step 4: Hydrate the rep column with users**

Find the `hydratedColumns` `useMemo` (currently lines 1199-1206):

```ts
const hydratedColumns = useMemo(() => {
  if (!facets) return unmatchedOpportunityColumns;
  return unmatchedOpportunityColumns.map((col) => {
    if (col.key === "stage") return { ...col, enumValues: facets.stages };
    if (col.key === "reason") return { ...col, enumValues: facets.reasons };
    return col;
  });
}, [facets]);
```

Replace with:

```ts
const hydratedColumns = useMemo(() => {
  return unmatchedOpportunityColumns.map((col) => {
    if (col.key === "stage" && facets) return { ...col, enumValues: facets.stages };
    if (col.key === "reason" && facets) return { ...col, enumValues: facets.reasons };
    if (col.key === "rep") {
      const repOptions = (users ?? [])
        .filter((u) => u.fullName)
        .map((u) => ({ value: u.id, label: u.fullName as string }));
      return { ...col, enumValues: repOptions };
    }
    return col;
  });
}, [facets, users]);
```

- [ ] **Step 5: Forward `rep` to the API and add it to the query key**

Find the `useQuery` call for unmatched opportunities (currently lines 1269-1285) and the filter-derivation block above it (lines 1250-1267).

After the line `const searchFilter = filters.find((f) => f.column === "name" && f.operator === "contains");` (around line 1258), add:

```ts
  const repFilter = filters.find((f) => f.column === "rep" && f.operator === "eq");
  const repFilterId = repFilter ? String(repFilter.value) : undefined;
```

Then update the `useQuery` to include `rep` in both the queryKey and the `fetchOpportunities` call:

```ts
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ["unmatched-opportunities", filters, sorts, page, activeCard, repFilterId],
  queryFn: () =>
    fetchOpportunities({
      resolved: resolvedParam,
      school_yr: schoolYrFilter ? String(schoolYrFilter.value) : undefined,
      state: stateFilterRule ? String(stateFilterRule.value) : undefined,
      stage: stageFilter ? String(stageFilter.value) : undefined,
      reason: reasonFilter ? String(reasonFilter.value) : undefined,
      search: searchFilter ? String(searchFilter.value) : undefined,
      rep: repFilterId,
      ...cardParams,
      sort_by: sortRule?.column,
      sort_dir: sortRule?.direction,
      page,
      page_size: 50,
    }),
});
```

(Note: `repFilterId` is added as a serialized primitive in the queryKey per CLAUDE.md stable-key rule; `filters` and `sorts` were already in there.)

- [ ] **Step 6: On rep chip removal, also strip `?rep=` from the URL**

Find the `onRemoveFilter` prop on `AdminFilterBar` (currently line 1476):

```tsx
onRemoveFilter={(i) => { setFilters((prev) => prev.filter((_, idx) => idx !== i)); setPage(1); }}
```

Replace with:

```tsx
onRemoveFilter={(i) => {
  setFilters((prev) => {
    const removed = prev[i];
    if (removed?.column === "rep") {
      const url = new URL(window.location.href);
      url.searchParams.delete("rep");
      router.replace(url.pathname + (url.search ? url.search : ""));
    }
    return prev.filter((_, idx) => idx !== i);
  });
  setPage(1);
}}
```

- [ ] **Step 7: Verify typecheck on the changed files**

Run: `npx tsc --noEmit 2>&1 | grep -E "page\.tsx|columns\.ts|AdminFilterBar\.tsx|AdminColumnPicker\.tsx|DataGrid\.tsx|route\.ts" | grep "admin/unmatched-opportunities\|DataGrid"`

Expected: no errors from our changed files.

- [ ] **Step 8: Run all tests touching this feature**

Run: `npx vitest run src/app/api/admin/unmatched-opportunities src/app/admin/unmatched-opportunities src/features/shared/components/DataGrid --reporter=basic`

Expected: all tests pass (existing + the 5 new API tests from Task 6).

- [ ] **Step 9: Manual smoke test**

Start the dev server: `npm run dev` (port 3005, per CLAUDE.md).

Verify in a browser:

1. Navigate to `/?tab=leaderboard`. Confirm a rep with an unmatched-opp badge is visible.
2. Click the badge — URL becomes `/admin/unmatched-opportunities?rep=<uuid>`.
3. The page loads with **two chips visible**: `Status is false` and `Rep is "<rep name>"`.
4. The table shows only that rep's unmatched opportunities (count matches the badge).
5. Click `×` on the Rep chip. URL becomes `/admin/unmatched-opportunities` (no `?rep=`). Table re-fetches and shows all unmatched opportunities.
6. Click "+ Filter" → choose "Rep" → choose another rep from the dropdown → click "Apply Filter". Confirm a new chip appears with that rep's name and the table refetches scoped to them. (The URL does not auto-update in this direction — only the URL→state direction is wired. That is intentional per spec.)
7. Refresh the browser while the Rep chip is active (added via filter bar, not URL). The chip disappears (because it wasn't in the URL). Refreshing while on the deep-link URL keeps the chip.

If any of these fails, stop and investigate before committing.

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(unmatched-opps): filter by rep via URL deep-link and filter bar

- Reads ?rep= on mount and seeds the filters chip
- Hydrates the virtual Rep column from useUsers() so the picker is populated
- Forwards the rep id to the API as a stable serialized query key
- router.replace()'s the URL when the rep chip is cleared so refresh stays clean"
```

---

## Self-Review Checklist (run after the plan is complete)

- [ ] All chips in the design (Rep, Status, etc.) actually render (smoke test step 3-6).
- [ ] `?rep=` deep-link → table filters down (smoke step 4).
- [ ] Removing chip strips `?rep=` from URL (smoke step 5).
- [ ] Filter bar's "+ Filter" → Rep → name dropdown → apply works (smoke step 6).
- [ ] Refresh respects URL state (smoke step 7).
- [ ] No regressions in the other 4 admin filters (state, stage, reason, school year — exercise one to confirm).
- [ ] API test file passes (5 cases).

If any of these fail, return to the relevant task and fix before opening the PR.
