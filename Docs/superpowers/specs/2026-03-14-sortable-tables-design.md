# Sortable Data Tables — Design Spec

**Date:** 2026-03-14
**Branch:** aston-sortable-tables
**Status:** Approved

---

## Problem

Four Data Tables (Activities, Plans, Districts, Contacts) have no column sorting despite the UI Framework spec (`data-table.md`) requiring it. TasksTable implemented sorting independently with its own bespoke logic. The result is inconsistent behavior across the app and a pattern that can drift. This spec defines a shared sorting system that brings all five tables into compliance.

**Root cause:** No implementation plan explicitly called out column sorting as a requirement for these tables. Each was shipped without a checklist check against the UI Framework spec. TasksTable happened to get it; the others did not.

---

## Scope

**New files:**
- `src/features/shared/hooks/useSortableTable.ts`
- `src/features/shared/components/SortHeader.tsx`

**Modified files:**
- `src/features/plans/components/ActivitiesTable.tsx`
- `src/features/plans/components/PlansTable.tsx`
- `src/features/plans/components/DistrictsTable.tsx`
- `src/features/plans/components/ContactsTable.tsx`
- `src/features/tasks/components/TasksTable.tsx` (refactored to use shared hook)

---

## Architecture

All four tables are client-side rendered with full datasets fetched upfront — no pagination in use. Sorting is purely client-side with no API involvement.

The shared hook manages sort state and returns a sorted array. The shared component renders a `<th>` with the correct visual state and accessibility attributes. Each table wires them together independently, retaining full control of its own row layout.

---

## `useSortableTable` Hook

**File:** `src/features/shared/hooks/useSortableTable.ts`

```ts
type SortDir = "asc" | "desc" | null;

interface SortState<T> {
  field: keyof T | null;
  dir: SortDir;
}

interface UseSortableTableOptions<T> {
  data: T[];
  defaultField?: keyof T;
  defaultDir?: "asc" | "desc";
  comparators?: Partial<Record<keyof T, (a: T, b: T, dir: SortDir) => number>>;
}

interface UseSortableTableReturn<T> {
  sorted: T[];
  sortState: SortState<T>;
  onSort: (field: keyof T) => void;
}
```

**Sort cycle:** Clicking a column header cycles through three states:
1. New field clicked → `asc`
2. Same field, currently `asc` → `desc`
3. Same field, currently `desc` → `null` (unsorted, original order restored)

**Default comparators:**
- `string` → `localeCompare`
- `Date` → `.getTime()` comparison
- `number` → subtraction

**Custom comparators:** Tables pass a `comparators` map to override default behavior for specific fields. Used where alphabetical order is wrong — e.g. Status fields should follow a logical workflow order, not sort as raw strings.

**`null` direction:** Returns the original `data` array unchanged. No sorting applied, no mutation.

---

## `SortHeader` Component

**File:** `src/features/shared/components/SortHeader.tsx`

```tsx
interface SortHeaderProps<T> {
  field: keyof T;
  label: string;
  sortState: SortState<T>;
  onSort: (field: keyof T) => void;
  className?: string;
}
```

**Visual states** (per `Documentation/UI Framework/Components/Tables/data-table.md`):

| State | Arrow | Text color |
|---|---|---|
| Inactive | Faint `#A69DC0` at 50% opacity on hover | `text-[#8A80A8]` |
| Active asc | Solid up arrow `#403770` | `text-[#403770]` |
| Active desc | Solid down arrow `#403770` | `text-[#403770]` |

- Arrow size: `w-3 h-3`, positioned right of label with `gap-1`
- Cursor: `cursor-pointer` on sortable headers
- Existing header style preserved: `text-[11px] font-semibold uppercase tracking-wider`

**Accessibility:**
- `aria-sort="ascending" | "descending" | "none"` on `<th>`
- Tab-focusable
- `Enter` / `Space` advances the sort cycle

Non-sortable columns remain plain `<th>` elements — `SortHeader` is not used on icon columns, derived/computed columns, checkbox columns, or action columns.

---

## Sortable Columns Per Table

### ActivitiesTable
| Column | Sortable | Notes |
|---|---|---|
| Title | Yes | String, `localeCompare` |
| Type | Yes | String, `localeCompare` |
| Status | Yes | Custom order: Planned → In Progress → Completed |
| Date | Yes | Date comparison |
| Scope | No | Derived display string |

### PlansTable
| Column | Sortable | Notes |
|---|---|---|
| Name | Yes | String, `localeCompare` |
| Owner | Yes | String, `localeCompare` on `owner?.fullName` |
| FY | Yes | Number |
| Status | Yes | Custom order matching plan workflow |
| Dates | Yes | Sort by `startDate` |
| Dist. | Yes | Number (district count) |
| Description | No | Free text, not meaningful to sort |
| Color | No | Visual only |

### DistrictsTable
| Column | Sortable | Notes |
|---|---|---|
| District | Yes | String, `localeCompare` |
| State | Yes | String, `localeCompare` |
| Renewal | Yes | Number |
| Winback | Yes | Number |
| Expansion | Yes | Number |
| New Biz | Yes | Number |
| Revenue | Yes | Number (computed from actuals) |
| Take | Yes | Number |
| Pipeline | Yes | Number |
| Prior FY | Yes | Number |
| Services | No | Multi-select, no natural sort order |

### ContactsTable
| Column | Sortable | Notes |
|---|---|---|
| Person | Yes | String, `localeCompare` on contact name |
| Email | Yes | String, `localeCompare` |
| District | Yes | String, `localeCompare` |
| Department | Yes | String, `localeCompare` on `contact.persona` |
| Seniority | Yes | String, `localeCompare` (no numeric rank in data model) |
| Last Activity | No | Not yet implemented |

### TasksTable (refactored from existing)
| Column | Sortable | Notes |
|---|---|---|
| Title | Yes | String, `localeCompare` |
| Status | Yes | Custom order (existing `STATUS_ORDER` map migrated to comparator) |
| Priority | Yes | Custom order (existing `PRIORITY_ORDER` map migrated to comparator) |
| Due Date | Yes | Date comparison |
| Created | Yes | Date comparison |
| Linked | No | Computed count badge |

---

## Testing

### Unit — `useSortableTable`
- Three-state cycle: new field → asc, same asc → desc, same desc → null
- String sort: correct ascending and descending order
- Date sort: correct ordering by timestamp
- Number sort: correct ordering
- Custom comparator: overrides default for a field
- `null` dir returns original array unchanged

### Unit — `SortHeader`
- Renders correct `aria-sort` for each state
- Active color classes applied when sorted, inactive when not
- Arrow visible on hover (inactive), solid when active
- `Enter` / `Space` keydown fires `onSort`

### Integration — per table (one test each)
- Click sortable column → rows re-order correctly
- Click again → order reverses
- Click again → original order restored
- Non-sortable columns: no `onClick`, no arrow rendered

---

## Out of Scope

- Server-side sort params (all five tables fetch full datasets client-side)
- DataGrid / ExploreTable (already have their own sorting system)
- Pagination (separate concern, not addressed here)
- Multi-column sort (Data Table tier = single-column sort only)