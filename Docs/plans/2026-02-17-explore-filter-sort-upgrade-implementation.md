# Explore Filter & Sort Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the Explore space filtering/sorting to an Attio-style 3-step progressive builder with multi-sort, searchable pickers, and localStorage-persisted saved views.

**Architecture:** Refactor-in-place approach. Evolve existing `ExploreFilters.tsx` into a 3-step builder, add `ExploreSortDropdown.tsx` and `ExploreSavedViews.tsx` as new sibling components, update the Zustand store to support multi-sort arrays and saved views, and extend the API route to handle new operators and multi-sort.

**Tech Stack:** Next.js, React, Zustand, TanStack Table, Prisma, Tailwind CSS. No new dependencies.

**Design doc:** `Docs/plans/2026-02-17-explore-filter-sort-upgrade-design.md`

**Branch:** `feature/explore-filter-sort-upgrade` — commit after each task.

---

## Task 1: Extend Store Types for Multi-Sort and New Operators

**Files:**
- Modify: `src/lib/map-v2-store.ts`
- Modify: `src/lib/explore-filters.ts`

**Step 1: Add `is_empty` and `is_not_empty` to FilterOp in both files**

In `src/lib/map-v2-store.ts`, update the `FilterOp` type:
```typescript
export type FilterOp = "eq" | "neq" | "in" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "is_true" | "is_false" | "is_empty" | "is_not_empty";
```

In `src/lib/explore-filters.ts`, add the same two operators to the `FilterOp` type and add two new cases in `buildWhereClause`:
```typescript
case "is_empty":
  where[prismaField] = null;
  break;
case "is_not_empty":
  where[prismaField] = { not: null };
  break;
```

**Step 2: Change `exploreSort` from single to array**

In `src/lib/map-v2-store.ts`:

Change the type from:
```typescript
exploreSort: Record<ExploreEntity, ExploreSortConfig | null>
```
to:
```typescript
exploreSort: Record<ExploreEntity, ExploreSortConfig[]>
```

Update the initial state from `null` values to empty arrays `[]`.

Add new actions to the store interface:
```typescript
addSortRule: (entity: ExploreEntity, rule: ExploreSortConfig) => void;
removeSortRule: (entity: ExploreEntity, column: string) => void;
reorderSortRules: (entity: ExploreEntity, rules: ExploreSortConfig[]) => void;
```

Implement these actions:
- `addSortRule`: Push a new rule to the entity's sort array (if column already exists, replace it)
- `removeSortRule`: Filter out the rule with the matching column
- `reorderSortRules`: Replace the entire array (used by drag-to-reorder)

Update `setExploreSort` to accept `ExploreSortConfig[]` instead of `ExploreSortConfig | null`.

**Step 3: Add saved views types and state**

Add to `src/lib/map-v2-store.ts`:
```typescript
export interface ExploreSavedView {
  id: string;
  name: string;
  entity: ExploreEntity;
  filters: ExploreFilter[];
  sorts: ExploreSortConfig[];
  columns: string[];
}
```

Add state:
```typescript
exploreSavedViews: Record<ExploreEntity, ExploreSavedView[]>;
activeViewId: Record<ExploreEntity, string | null>;
```

Add actions:
```typescript
saveView: (entity: ExploreEntity, view: ExploreSavedView) => void;
loadView: (entity: ExploreEntity, viewId: string) => void;
deleteView: (entity: ExploreEntity, viewId: string) => void;
setActiveViewId: (entity: ExploreEntity, viewId: string | null) => void;
```

Initialize `exploreSavedViews` as `{ districts: [], activities: [], tasks: [], contacts: [] }` and `activeViewId` similarly with all `null`.

**Step 4: Verify the app still compiles**

Run: `npx next build --no-lint 2>&1 | tail -20` (or `npx tsc --noEmit`)

This will fail because consumers of `exploreSort` expect the old shape. That's expected — we fix consumers in the next tasks.

**Step 5: Commit**

```
feat: extend store types for multi-sort, new filter operators, saved views
```

---

## Task 2: Update API Route for Multi-Sort and New Operators

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts`
- Modify: `src/lib/api.ts` (the `useExploreData` hook)

**Step 1: Update `parseQueryParams` to support multi-sort**

Replace the single `sort`/`order` parsing with a `sorts` array:
```typescript
// Multi-sort: ?sorts=[{"column":"name","direction":"asc"},{"column":"enrollment","direction":"desc"}]
// Backwards-compatible: also accept ?sort=name&order=asc for single-sort
let sorts: { column: string; direction: "asc" | "desc" }[] = [];
const sortsParam = url.searchParams.get("sorts");
if (sortsParam) {
  try {
    sorts = JSON.parse(sortsParam);
  } catch {
    // ignore malformed
  }
} else {
  // Legacy single-sort fallback
  const sort = url.searchParams.get("sort") ?? undefined;
  const order = (url.searchParams.get("order") ?? "asc") as "asc" | "desc";
  if (sort) sorts = [{ column: sort, direction: order }];
}
```

Return `sorts` instead of `sort`/`order` from `parseQueryParams`.

**Step 2: Update `handleDistricts` to build multi-sort orderBy**

Replace the single `orderBy` with an array:
```typescript
const orderBy: Record<string, string>[] = [];
for (const s of sorts) {
  const field = DISTRICT_FIELD_MAP[s.column];
  if (field) orderBy.push({ [field]: s.direction });
}
if (orderBy.length === 0) orderBy.push({ name: "asc" });
```

Prisma accepts `orderBy` as an array of objects for multi-sort.

**Step 3: Update `handleActivities`, `handleTasks`, `handleContacts` similarly**

For each handler, convert the single `sort`/`order` to the multi-sort array pattern. The logic is the same as districts but without the field map (activities/tasks/contacts use column names directly).

**Step 4: Update `useExploreData` in `src/lib/api.ts`**

Change the `sort` param type from `{ column: string; direction: "asc" | "desc" } | null` to `{ column: string; direction: "asc" | "desc" }[]`:

```typescript
params: {
  filters?: { id: string; column: string; op: string; value: unknown }[];
  sorts?: { column: string; direction: "asc" | "desc" }[];
  page?: number;
  pageSize?: number;
}
```

Update the URL building:
```typescript
if (params.sorts && params.sorts.length > 0) {
  searchParams.set("sorts", JSON.stringify(params.sorts));
}
```

Remove the old `sort`/`order` param handling.

**Step 5: Commit**

```
feat: update API route and hook for multi-sort and new filter operators
```

---

## Task 3: Update ExploreOverlay and ExploreTable for Multi-Sort

**Files:**
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`

**Step 1: Update ExploreOverlay sort handling**

Change the `handleSort` function to work with the array-based sort. When a column header is clicked, it replaces the entire sort array with a single-sort rule (toggling direction if the same column):

```typescript
const handleSort = (column: string) => {
  const currentSorts = exploreSort[exploreEntity];
  const existing = currentSorts.find((s) => s.column === column);
  if (existing) {
    setExploreSort(exploreEntity, [{
      column,
      direction: existing.direction === "asc" ? "desc" : "asc",
    }]);
  } else {
    setExploreSort(exploreEntity, [{ column, direction: "asc" }]);
  }
};
```

Update the `useExploreData` call to pass `sorts` instead of `sort`:
```typescript
const { data: result, isLoading } = useExploreData(exploreEntity, {
  filters: exploreFilters[exploreEntity],
  sorts: exploreSort[exploreEntity],
  page: explorePage,
});
```

**Step 2: Update ExploreTable sort prop**

Change the `sort` prop type from `{ column: string; direction: "asc" | "desc" } | null` to `{ column: string; direction: "asc" | "desc" }[]`.

Update the header sort indicator to check if the column is in the sorts array:
```typescript
const sortRule = sorts.find((s) => s.column === colKey);
const isSorted = !!sortRule;
// Show direction arrow from sortRule.direction
```

**Step 3: Verify the app compiles and explore table renders**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```
feat: wire multi-sort through overlay and table components
```

---

## Task 4: Refactor ExploreFilters into 3-Step Progressive Builder

**Files:**
- Modify: `src/components/map-v2/explore/ExploreFilters.tsx`

This is the largest task. The existing ExploreFilters already has a 2-step flow (column → value). We insert an operator step between them and add search to the column picker.

**Step 1: Define the operator mapping**

Add a constant at the top of the file that maps `filterType` to available operators:

```typescript
interface OperatorOption {
  op: FilterOp;
  label: string;
  needsValue: boolean; // false for is_empty/is_not_empty
}

const OPERATORS_BY_TYPE: Record<string, OperatorOption[]> = {
  text: [
    { op: "eq", label: "is", needsValue: true },
    { op: "neq", label: "is not", needsValue: true },
    { op: "contains", label: "contains", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  enum: [
    { op: "eq", label: "is", needsValue: true },
    { op: "neq", label: "is not", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  number: [
    { op: "eq", label: "is", needsValue: true },
    { op: "neq", label: "is not", needsValue: true },
    { op: "gt", label: "greater than", needsValue: true },
    { op: "lt", label: "less than", needsValue: true },
    { op: "between", label: "between", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  boolean: [
    { op: "is_true", label: "is true", needsValue: false },
    { op: "is_false", label: "is false", needsValue: false },
  ],
  date: [
    { op: "eq", label: "is", needsValue: true },
    { op: "gt", label: "after", needsValue: true },
    { op: "lt", label: "before", needsValue: true },
    { op: "between", label: "between", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  tags: [
    { op: "contains", label: "contains", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
};
```

**Step 2: Add a search input to the column picker (step 1)**

Add a `searchQuery` state. At the top of the column picker dropdown, add a text input. Filter the grouped columns by the search query (case-insensitive match on label).

**Step 3: Add the operator selection step (step 2)**

After selecting a column, instead of jumping straight to the value input, show a list of operators from `OPERATORS_BY_TYPE[selectedColumn.filterType]`. Each operator is a clickable row.

Add a `selectedOperator` state of type `OperatorOption | null`.

If the selected operator has `needsValue: false` (like `is_empty`, `is_not_empty`, `is_true`, `is_false`), immediately submit the filter and close the picker. Otherwise, proceed to step 3 (value input).

**Step 4: Update value inputs to use the selected operator**

The value input components remain mostly the same, but now they receive the specific operator. For example:
- `NumberFilterInput` no longer shows its own min/max; it shows a single input for `eq`/`neq`/`gt`/`lt`, or two inputs for `between`
- `TextFilterInput` is the same for `eq`/`neq`/`contains`
- `DateFilterInput` shows single date for `eq`/`gt`/`lt`, or two dates for `between`

**Step 5: Update filter chip display**

Update `formatFilterPill` to show `Attribute · Operator · Value`:

```typescript
function formatFilterPill(entity: ExploreEntity, filter: ExploreFilter): string {
  const label = getColumnLabel(entity, filter.column);
  const opLabel = getOperatorLabel(filter.op); // maps op to display string

  if (filter.op === "is_empty" || filter.op === "is_not_empty" ||
      filter.op === "is_true" || filter.op === "is_false") {
    return `${label} · ${opLabel}`;
  }

  if (filter.op === "between") {
    const [min, max] = filter.value as [number, number];
    return `${label} · between · ${min.toLocaleString()}–${max.toLocaleString()}`;
  }

  return `${label} · ${opLabel} · ${filter.value}`;
}
```

**Step 6: Add click-to-edit on chips**

When clicking an existing filter chip, open the picker pre-populated:
- Set `selectedColumn` to the chip's column
- Set `selectedOperator` to the chip's operator
- Jump directly to the value step (or operator step if the user wants to change it)

Store an `editingFilterId` state. When editing, the submit replaces the filter (via `updateExploreFilter`) instead of adding a new one.

**Step 7: Verify the 3-step flow works end-to-end**

Manually test: open the filter picker → search for a column → select operator → enter value → see chip → click chip to edit → remove chip.

**Step 8: Commit**

```
feat: refactor ExploreFilters into 3-step progressive builder with search
```

---

## Task 5: Build ExploreSortDropdown Component

**Files:**
- Create: `src/components/map-v2/explore/ExploreSortDropdown.tsx`
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Create the ExploreSortDropdown component**

Props:
```typescript
interface ExploreSortDropdownProps {
  entity: ExploreEntity;
  sorts: ExploreSortConfig[];
  onAddSort: (rule: ExploreSortConfig) => void;
  onRemoveSort: (column: string) => void;
  onReorderSorts: (rules: ExploreSortConfig[]) => void;
  onToggleDirection: (column: string) => void;
}
```

The component renders:
- A trigger button: `Sort` with a badge showing sort count when > 0
- A dropdown with:
  - List of active sort rules, each showing: `[⠿ drag handle] [Column label] [Asc/Desc toggle button] [× remove]`
  - Divider
  - `+ Add sort` button that switches to a searchable column picker

Implement drag-to-reorder using `draggable`, `onDragStart`, `onDragOver`, `onDrop` HTML5 drag events. Track `dragIndex` and `dropIndex` state. On drop, create the reordered array and call `onReorderSorts`.

**Step 2: Add searchable column picker inside the dropdown**

When the user clicks `+ Add sort`, show the same searchable grouped column picker pattern used in ExploreFilters. Filter out columns that are already in the sorts array.

After selecting a column, add it with direction `"asc"` by default and return to the sort rules list.

**Step 3: Wire ExploreSortDropdown into ExploreOverlay**

In the toolbar bar, add `<ExploreSortDropdown>` before the `<ExploreFilters>` component. Pass the multi-sort state and actions from the store.

**Step 4: Verify sort dropdown works**

Test: open dropdown → add a sort → toggle direction → add a second sort → drag to reorder → remove a sort → click column header (should replace all sorts with single).

**Step 5: Commit**

```
feat: add ExploreSortDropdown with multi-sort and drag reorder
```

---

## Task 6: Build ExploreSavedViews Component

**Files:**
- Create: `src/components/map-v2/explore/ExploreSavedViews.tsx`
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Create the ExploreSavedViews component**

Props:
```typescript
interface ExploreSavedViewsProps {
  entity: ExploreEntity;
  // Current state for comparison
  currentFilters: ExploreFilter[];
  currentSorts: ExploreSortConfig[];
  currentColumns: string[];
  // Saved views from store
  savedViews: ExploreSavedView[];
  activeViewId: string | null;
  // Actions
  onSave: (view: ExploreSavedView) => void;
  onLoad: (viewId: string) => void;
  onDelete: (viewId: string) => void;
  onDiscard: () => void;
}
```

The component renders:
- A trigger button showing the active view name (or "Unsaved View")
- A dropdown with:
  - List of saved views, each clickable to load
  - The active view highlighted
  - A delete button (trash icon) on each custom view (not "Default")
  - Divider
  - `+ Save current view` button that prompts for a name (inline text input)

**Step 2: Implement dirty detection**

Compare current filters/sorts/columns with the active saved view's values. If they differ, show a modified indicator (dot or italic) on the trigger button.

When dirty:
- Show `Discard` button (reverts to last saved state by calling `onLoad` with the `activeViewId`)
- Show `Save` button (overwrites the active view)
- Show `Save as new...` option

**Step 3: Implement localStorage persistence**

In `ExploreOverlay.tsx`, add an effect to load saved views from localStorage on mount:
```typescript
useEffect(() => {
  const key = `explore-views-${exploreEntity}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      const views = JSON.parse(stored);
      // Set saved views in store
    } catch { /* ignore */ }
  }
}, [exploreEntity]);
```

Add an effect to save to localStorage whenever `exploreSavedViews` changes:
```typescript
useEffect(() => {
  const key = `explore-views-${exploreEntity}`;
  localStorage.setItem(key, JSON.stringify(exploreSavedViews[exploreEntity]));
}, [exploreSavedViews, exploreEntity]);
```

**Step 4: Wire into ExploreOverlay toolbar**

Add `<ExploreSavedViews>` at the far left of the toolbar, before Sort and Filter.

The `Discard` and `Save` buttons render conditionally when dirty. Place them on the right side of the toolbar, before the column picker.

**Step 5: Verify saved views work**

Test: change some filters → see "Unsaved View" → save as "My View" → switch to default → switch back to "My View" → modify filters → discard → save.

**Step 6: Commit**

```
feat: add ExploreSavedViews with localStorage persistence
```

---

## Task 7: Polish Toolbar Layout and Visual Refinement

**Files:**
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx`

**Step 1: Refine the toolbar layout**

Update the filter bar section of ExploreOverlay to match the design:

```
[View ▾] [Sort ·N] [Filter] |chip|chip|chip|  ...spacer...  [Discard] [Save] [Cols]
```

- Left side: view dropdown, sort button, filter button, chips, clear all
- Right side: discard/save (conditional), column picker
- Use `flex items-center gap-2` with `flex-wrap` for the chips area and `ml-auto` for the right side

**Step 2: Ensure consistent styling**

All buttons should match the existing app styling:
- Trigger buttons: `text-xs font-medium rounded-lg border` with the plum/teal hover states
- Dropdowns: `bg-white rounded-lg border border-gray-200 shadow-lg`
- Chips: updated format with `·` separators

**Step 3: Commit**

```
feat: polish explore toolbar layout and visual consistency
```

---

## Task 8: Final Integration Testing

**Step 1: Test the complete filter flow**

- Add a text filter (District Name contains "academy")
- Add a number filter (Enrollment greater than 5000)
- Add an enum filter (Account Type is "district")
- Add an empty filter (Notes is empty)
- Add a boolean filter (Customer is true)
- Click chips to edit them
- Clear all filters
- Verify table updates correctly with each filter

**Step 2: Test multi-sort**

- Add sort by State ascending
- Add sort by Enrollment descending
- Drag to reorder
- Click a column header (should replace with single sort)
- Verify table sorts correctly

**Step 3: Test saved views**

- Save a view with filters + sorts
- Switch to Default
- Load the saved view
- Modify and discard
- Save changes
- Refresh page — views should persist from localStorage

**Step 4: Test edge cases**

- Empty state (no filters, no sorts)
- All entities (districts, activities, tasks, contacts)
- Column picker interaction with saved views
- Pagination still works with filters active

**Step 5: Commit any fixes**

```
fix: address integration testing issues
```
