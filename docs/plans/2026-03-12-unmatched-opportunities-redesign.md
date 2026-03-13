# Unmatched Opportunities Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the admin unmatched-opportunities page from a hand-built table to the shared DataGrid component with standard toolbar patterns, and update the frontend-design and design-review skills to prevent future hand-built tables.

**Architecture:** The page will use `DataGrid` (same as ExploreTable) for the table, with local React state for sort/filter/columns (no Zustand — admin pages are standalone). The API route will be extended to support sort and filter query params. New lightweight admin toolbar components (filter bar, column picker) will follow the same visual patterns as the Explore toolbar but accept column defs as props instead of being coupled to `ExploreEntity`.

**Tech Stack:** DataGrid (`src/features/shared/components/DataGrid/`), TanStack React Query, Lucide React icons, Prisma

---

## Task 1: Create column definitions

**Files:**
- Create: `src/app/admin/unmatched-opportunities/columns.ts`

**Step 1: Create the column definitions file**

```ts
// src/app/admin/unmatched-opportunities/columns.ts
import type { ColumnDef } from "@/features/shared/components/DataGrid/types";

// US state abbreviations for enum filter
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR",
];

export const unmatchedOpportunityColumns: ColumnDef[] = [
  {
    key: "name",
    label: "Name",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "accountName",
    label: "Account",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "state",
    label: "State",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: US_STATES,
  },
  {
    key: "schoolYr",
    label: "School Year",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: ["2024-25", "2025-26", "2026-27"],
  },
  {
    key: "stage",
    label: "Stage",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "netBookingAmount",
    label: "Net Booking ($)",
    group: "Financial",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "reason",
    label: "Reason",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "resolved",
    label: "Status",
    group: "Core",
    isDefault: true,
    filterType: "boolean",
  },
];
```

**Step 2: Commit**

```bash
git add src/app/admin/unmatched-opportunities/columns.ts
git commit -m "feat(admin): add column definitions for unmatched opportunities DataGrid"
```

---

## Task 2: Extend the API route to support sort and filter params

**Files:**
- Modify: `src/app/api/admin/unmatched-opportunities/route.ts`

The current route only supports `resolved`, `school_yr`, `state` query params with hardcoded `orderBy: { netBookingAmount: "desc" }`. Extend to support:
- `sort_by` — column key to sort by (default: `netBookingAmount`)
- `sort_dir` — `asc` or `desc` (default: `desc`)
- `search` — text search across name and accountName
- Keep existing `resolved`, `school_yr`, `state` params for backward compat

**Step 1: Update the GET handler**

```ts
// src/app/api/admin/unmatched-opportunities/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Allowed sort columns (must match Prisma model fields)
const SORTABLE_COLUMNS = new Set([
  "name", "accountName", "state", "schoolYr", "stage",
  "netBookingAmount", "reason", "resolved",
]);

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved");
    const schoolYr = searchParams.get("school_yr");
    const state = searchParams.get("state");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sort_by") || "netBookingAmount";
    const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") || "50", 10)));

    const where: Record<string, unknown> = {};

    if (resolved === "true") {
      where.resolved = true;
    } else if (resolved === "false") {
      where.resolved = false;
    }

    if (schoolYr) {
      where.schoolYr = schoolYr;
    }

    if (state) {
      where.state = state;
    }

    if (search && search.length >= 2) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { accountName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Validate sort column
    const orderByColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "netBookingAmount";

    const [items, total] = await Promise.all([
      prisma.unmatchedOpportunity.findMany({
        where,
        orderBy: { [orderByColumn]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.unmatchedOpportunity.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total },
    });
  } catch (error) {
    console.error("Error fetching unmatched opportunities:", error);
    return NextResponse.json({ error: "Failed to fetch unmatched opportunities" }, { status: 500 });
  }
}
```

**Step 2: Verify the app compiles**

Run: `npx next build --no-lint 2>&1 | tail -20` (or `npx tsc --noEmit`)

**Step 3: Commit**

```bash
git add src/app/api/admin/unmatched-opportunities/route.ts
git commit -m "feat(admin): extend unmatched-opportunities API with sort and search params"
```

---

## Task 3: Rewrite the page to use DataGrid

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx`

This is the main task. Replace the entire custom table, toolbar, and pagination with:
- DataGrid component for the table
- Local React state for `visibleColumns`, `sorts`, `page`
- `fetchOpportunities` updated to pass `sort_by` and `sort_dir` params
- Custom cell renderers for: `resolved` (StatusBadge), `netBookingAmount` (currency format), and a resolve action column
- Keep `DistrictSearchModal` and `StatusBadge` in this file (fix in Task 4)

**Key integration points (reference `ExploreOverlay.tsx` lines 411-439 for DataGrid usage pattern):**

```tsx
// Local state (no Zustand — admin pages are standalone)
const [visibleColumns, setVisibleColumns] = useState<string[]>(
  unmatchedOpportunityColumns.filter((c) => c.isDefault).map((c) => c.key)
);
const [sorts, setSorts] = useState<SortRule[]>([
  { column: "netBookingAmount", direction: "desc" },
]);
const [page, setPage] = useState(1);
const [filters, setFilters] = useState<FilterRule[]>([
  { column: "resolved", operator: "is_false", value: false },
]);
```

**DataGrid props to wire up:**

```tsx
<DataGrid
  data={items}
  columnDefs={unmatchedOpportunityColumns}
  entityType="opportunities"
  isLoading={isLoading}
  isError={isError}
  onRetry={() => refetch()}
  visibleColumns={visibleColumns}
  onColumnsChange={setVisibleColumns}
  sorts={sorts}
  onSort={handleSort}
  hasActiveFilters={filters.length > 0}
  onClearFilters={() => { setFilters([]); setPage(1); }}
  pagination={data?.pagination}
  onPageChange={setPage}
  cellRenderers={cellRenderers}
/>
```

**handleSort pattern (single-sort, same as ExploreOverlay):**

```tsx
const handleSort = useCallback((column: string) => {
  setSorts((prev) => {
    const existing = prev.find((s) => s.column === column);
    if (!existing) return [{ column, direction: "asc" }];
    if (existing.direction === "asc") return [{ column, direction: "desc" }];
    return []; // Third click clears sort
  });
  setPage(1);
}, []);
```

**Cell renderers:**

```tsx
const cellRenderers = useMemo(() => ({
  resolved: ({ value }: { value: unknown }) => (
    <StatusBadge resolved={value as boolean} />
  ),
  netBookingAmount: ({ value }: { value: unknown }) => (
    <span className="tabular-nums font-medium">{formatCurrency(value as string)}</span>
  ),
}), []);
```

**For the resolve action:** DataGrid doesn't have a built-in action column. Add a virtual "actions" column to the column defs (not filterable/sortable) with a cell renderer that shows the Resolve button or resolved LEAID.

**fetchOpportunities update — pass sort params from state:**

```tsx
const sortRule = sorts[0]; // single sort
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ["unmatched-opportunities", filters, sorts, page],
  queryFn: () => fetchOpportunities({
    resolved: resolvedFilter,
    school_yr: schoolYrFilter,
    state: stateFilter,
    sort_by: sortRule?.column,
    sort_dir: sortRule?.direction,
    page,
    page_size: 50,
  }),
});
```

**Important:** Derive filter values from the `filters` state array (not separate state vars):

```tsx
// Extract filter values from FilterRule[] for the API
const resolvedFilter = filters.find((f) => f.column === "resolved");
const stateFilter = filters.find((f) => f.column === "state");
// etc.
```

**Step 1: Rewrite the page**

Replace everything in `page.tsx` except the types, API helpers, `formatCurrency`, `StatusBadge`, and `DistrictSearchModal`.

**Step 2: Verify it compiles and renders**

Run: `npx tsc --noEmit`
Run: `npm run dev` and navigate to `/admin/unmatched-opportunities`

**Step 3: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(admin): migrate unmatched-opportunities table to DataGrid"
```

---

## Task 4: Fix DistrictSearchModal — Lucide icons + standard close button

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx` (the DistrictSearchModal section)

**Step 1: Add Lucide imports and fix the modal**

Add to top of file:
```tsx
import { Search, X } from "lucide-react";
```

Replace the hand-drawn search SVG with:
```tsx
<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]" />
```

Add standard close button to the modal header (per `Documentation/UI Framework/Components/Containers/_foundations.md` § Close Button):
```tsx
<div className="flex items-center justify-between mb-4">
  <div>
    <h3 className="text-lg font-semibold text-[#403770]">Resolve to District</h3>
    <p className="text-sm text-[#8A80A8] mt-1">
      Search by district name, LEAID, or state abbreviation.
    </p>
  </div>
  <button
    onClick={onClose}
    aria-label="Close"
    className="flex items-center justify-center w-8 h-8 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors"
  >
    <X className="w-4 h-4" />
  </button>
</div>
```

Remove the separate Cancel button in the footer (close button in header is sufficient per modal spec, or keep both — either is valid).

**Step 2: Verify**

Run: `npx tsc --noEmit`
Visual check at `/admin/unmatched-opportunities` — click Resolve on a row, verify modal shows Lucide search icon and X close button.

**Step 3: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "fix(admin): use Lucide icons and standard close button in DistrictSearchModal"
```

---

## Task 5: Build lightweight admin toolbar (filter bar + column picker)

**Files:**
- Create: `src/app/admin/unmatched-opportunities/AdminFilterBar.tsx`
- Create: `src/app/admin/unmatched-opportunities/AdminColumnPicker.tsx`

These are lightweight versions of `ExploreFilters` and `ExploreColumnPicker` that accept `ColumnDef[]` as a prop instead of looking up by `ExploreEntity`. They follow the same visual patterns.

**AdminFilterBar** — shows active filters as pills + an "Add filter" button that opens a popover with column picker → operator → value:

```tsx
// Props interface
interface AdminFilterBarProps {
  columnDefs: ColumnDef[];
  filters: FilterRule[];
  onAddFilter: (filter: FilterRule) => void;
  onRemoveFilter: (index: number) => void;
  onUpdateFilter: (index: number, filter: FilterRule) => void;
}
```

Follow the exact visual pattern from `ExploreFilters.tsx`:
- "Filter" button with `ListFilter` Lucide icon
- Popover with column dropdown → operator dropdown → value input
- Active filters shown as pills with X to remove
- Enum columns show a `<select>` with `enumValues`
- Boolean columns show "is true" / "is false" (no value input)
- Text columns show a text input
- Number columns show a number input

**AdminColumnPicker** — shows a "Columns" button that opens a popover with checkboxes grouped by `ColumnDef.group`:

```tsx
interface AdminColumnPickerProps {
  columnDefs: ColumnDef[];
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}
```

Follow the exact visual pattern from `ExploreColumnPicker.tsx`:
- "Columns" button with `Columns3` Lucide icon
- Popover grouped by `ColumnDef.group`
- Checkboxes for each column
- "Reset to defaults" link at bottom

**Step 1: Build AdminFilterBar**

Reference `ExploreFilters.tsx` for the visual pattern. Key differences:
- No `ExploreEntity` / Zustand dependency
- No competitor columns / relation source lookups
- Accepts `columnDefs` and `filters` as props
- Uses same operator mapping (`OPERATORS_BY_TYPE`) — copy the subset needed (text, enum, number, boolean)

**Step 2: Build AdminColumnPicker**

Reference `ExploreColumnPicker.tsx` for the visual pattern. Key differences:
- No `ExploreEntity` / competitor FY dependency
- Accepts `columnDefs`, `visibleColumns`, `onColumnsChange` as props

**Step 3: Wire into the page**

In `page.tsx`, add toolbar above the DataGrid:

```tsx
<div className="flex items-center gap-2 mb-3 flex-wrap">
  <AdminFilterBar
    columnDefs={unmatchedOpportunityColumns}
    filters={filters}
    onAddFilter={(f) => { setFilters((prev) => [...prev, f]); setPage(1); }}
    onRemoveFilter={(i) => { setFilters((prev) => prev.filter((_, idx) => idx !== i)); setPage(1); }}
    onUpdateFilter={(i, f) => { setFilters((prev) => prev.map((existing, idx) => idx === i ? f : existing)); setPage(1); }}
  />
  <div className="ml-auto">
    <AdminColumnPicker
      columnDefs={unmatchedOpportunityColumns}
      visibleColumns={visibleColumns}
      onColumnsChange={setVisibleColumns}
    />
  </div>
</div>
```

**Step 4: Update fetchOpportunities to derive API params from FilterRule[]**

Map the `filters` array to API query params:
```tsx
function filtersToParams(filters: FilterRule[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const f of filters) {
    if (f.column === "resolved") {
      if (f.operator === "is_true") params.resolved = "true";
      if (f.operator === "is_false") params.resolved = "false";
    }
    if (f.column === "schoolYr" && f.operator === "eq") {
      params.school_yr = String(f.value);
    }
    if (f.column === "state" && f.operator === "eq") {
      params.state = String(f.value);
    }
    // text search handled separately
  }
  return params;
}
```

**Step 5: Verify**

Run: `npx tsc --noEmit`
Visual check: filter bar shows, can add/remove filters, column picker works.

**Step 6: Commit**

```bash
git add src/app/admin/unmatched-opportunities/AdminFilterBar.tsx src/app/admin/unmatched-opportunities/AdminColumnPicker.tsx src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(admin): add filter bar and column picker for unmatched-opportunities"
```

---

## Task 6: Update frontend-design skill — add Component Reuse Gate

**Files:**
- Modify: `.claude/skills/frontend-design/SKILL.md`

**Step 1: Add the Component Reuse Gate section**

After the "### Step 2 — Check existing components" section (which ends with "Use Glob and Grep to find existing implementations. Reuse and extend before creating."), add:

```markdown
### Step 2b — Shared Component Gate (HARD REQUIREMENT)

Before building any of the following, check if a shared component already covers the use case:

| Building... | Check first | Location |
|-------------|-------------|----------|
| Any data table | DataGrid | `src/features/shared/components/DataGrid/` |
| Table filters | ExploreFilters pattern | `src/features/map/components/explore/ExploreFilters.tsx` |
| Column picker | ExploreColumnPicker pattern | `src/features/map/components/explore/ExploreColumnPicker.tsx` |
| Sort controls | DataGrid built-in sort (click column headers) | `src/features/shared/components/DataGrid/DataGrid.tsx` |
| Inline editing | InlineEditCell | `src/features/shared/components/InlineEditCell.tsx` |
| Editable currency | EditableCurrencyCell | `src/features/map/components/explore/cellRenderers.tsx` |
| Pagination | DataGrid built-in pagination | `src/features/shared/components/DataGrid/DataGrid.tsx` |

**If a shared component covers 80%+ of the need, you MUST use it.** Do not hand-build tables, pagination, filter toolbars, or sort controls. The only acceptable reasons to skip:
1. The use case is fundamentally different (not just "simpler")
2. The shared component would need breaking changes

When the shared component is coupled to a specific context (e.g., `ExploreEntity`), build a lightweight version that follows the same visual patterns but accepts generic props (e.g., `ColumnDef[]`). Reference the original for exact class names and layout.
```

**Step 2: Commit**

```bash
git add .claude/skills/frontend-design/SKILL.md
git commit -m "docs: add Component Reuse Gate to frontend-design skill"
```

---

## Task 7: Update design-review skill — add Shared Component Audit

**Files:**
- Modify: `.claude/skills/design-review/SKILL.md`

**Step 1: Add component reuse check to the audit rubric**

In the "### 4. Audit Against Rubric" section, add a new row to the table:

```markdown
| Component reuse | Tables use DataGrid, toolbars use standard filter/sort/column patterns, forms use shared form primitives — no hand-built equivalents | `Tables/_foundations.md` § Standard Foundation, shared component inventory |
```

**Step 2: Add to Common Violations table**

In the "## Common Violations" section, add:

```markdown
| Hand-built table | Custom `<table>` with manual thead/tbody/pagination | `DataGrid` with `ColumnDef[]` | Tables/_foundations.md § Standard Foundation |
| Hand-built filters | Custom filter chips, raw `<select>`/`<input>` for filtering | Composable filter builder (ExploreFilters pattern) | Toolbar pattern in ExploreOverlay |
| Hand-built pagination | Custom Previous/Next buttons with page state | `DataGrid` built-in pagination | `DataGrid.tsx` footer section |
```

**Step 3: Commit**

```bash
git add .claude/skills/design-review/SKILL.md
git commit -m "docs: add shared component audit checks to design-review skill"
```

---

## Task 8: Final verification and design review

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 2: Run the dev server and manually verify**

Run: `npm run dev`
Navigate to `/admin/unmatched-opportunities` and check:
- [ ] Table renders with DataGrid (sort arrows on column headers)
- [ ] Click column headers to sort — verify sort indicator changes
- [ ] Filter bar: add a "State is CA" filter — verify results filter
- [ ] Filter bar: add a "Status is false" filter (unresolved) — verify
- [ ] Column picker: hide/show columns — verify table updates
- [ ] Pagination: navigate pages — verify
- [ ] Scroll: table scrolls horizontally on narrow viewport
- [ ] Resolve: click Resolve on unresolved row — modal opens with Lucide search icon and X close button
- [ ] Resolve: search a district, select it — resolves the opportunity
- [ ] Empty state: clear all filters on empty result set — shows "No opportunities yet"

**Step 3: Invoke design-review skill**

Run `/design-review` on `src/app/admin/unmatched-opportunities/page.tsx` to audit against tokens.md.

**Step 4: Fix any findings, then commit**

```bash
git add -A
git commit -m "feat(admin): complete unmatched-opportunities DataGrid migration"
```
