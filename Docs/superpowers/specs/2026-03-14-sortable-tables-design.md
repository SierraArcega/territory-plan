# Sortable Data Tables — Design Spec

**Date:** 2026-03-14
**Branch:** aston-sortable-tables
**Status:** Approved

---

## Problem

Four Data Tables (Activities, Plans, Districts, Contacts) have no column sorting despite the UI Framework spec (`data-table.md`) requiring it. A fifth table (TasksTable) implemented sorting independently with its own bespoke logic. The result is inconsistent behavior across the app and a pattern that can drift. This spec defines a shared sorting system that brings all five tables into compliance.

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
- `src/features/tasks/components/TasksTable.tsx` (refactored to use shared hook, preserving existing default sort)

---

## Architecture

All five tables are client-side rendered with full datasets fetched upfront — no pagination in use. Sorting is purely client-side with no API involvement.

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

**`null` direction:** Returns the `data` array reference as-is (no copy, no snapshot). This means the parent's current fetch/query order is restored. If `data` updates while sort state is null, the latest parent order is reflected immediately.

**Default comparators — field type detection:**

The hook inspects the runtime value of the first non-null element in the dataset for the given field using `typeof` and `instanceof`:
- `instanceof Date` → `.getTime()` comparison
- `typeof === "number"` → subtraction
- `typeof === "string"` → `localeCompare`

ISO date strings (e.g. `"2026-03-14T00:00:00Z"`) are stored as strings in the data model and will fall into the `localeCompare` branch. ISO 8601 sorts correctly lexicographically, but any non-ISO date format will not. **For all date fields in these tables, a custom comparator must be passed** that coerces to `Date` before comparing (see per-table column notes). Do not rely on the string default for date fields.

**Null value policy:** When a field value is `null` or `undefined`, the row sorts to the **end** regardless of sort direction (asc or desc). Null rows always appear after all non-null rows. This matches the existing TasksTable behavior for null `dueDate` (where `Infinity` was used as the sentinel).

**Custom comparators:** Tables pass a `comparators` map to override default behavior for specific fields. Required for:
- Status/Priority fields with logical workflow order
- Date fields stored as ISO strings (to ensure correct coercion)
- Nested fields (see DistrictsTable notes below)

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

| State | Arrow icon | Header text |
|---|---|---|
| Inactive (no hover) | Not rendered | `text-[#8A80A8]` |
| Inactive (hover) | `#A69DC0`, 50% opacity on the arrow element only | `text-[#8A80A8]` |
| Active asc | Solid up arrow, `text-[#403770]` | `text-[#403770]` |
| Active desc | Solid down arrow, `text-[#403770]` | `text-[#403770]` |

- Arrow size: `w-3 h-3`, positioned right of label with `gap-1`
- The 50% opacity on hover applies only to the arrow icon element — header text remains at full opacity in all states
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
| Status | Yes | Custom comparator: Planned → In Progress → Completed |
| Date | Yes | Custom comparator: coerce ISO string to `Date` |
| Scope | No | Derived display string |

### PlansTable
| Column | Sortable | Notes |
|---|---|---|
| Name | Yes | String, `localeCompare` |
| Owner | Yes | Custom comparator: access `plan.owner?.fullName ?? null` |
| FY | Yes | Number |
| Status | Yes | Custom comparator: matching plan workflow order |
| Dates | Yes | Custom comparator: sort by `startDate`, coerce ISO string to `Date` |
| Dist. | Yes | Number (district count) |
| Description | No | Free text, not meaningful to sort |
| Color | No | Visual only |

### DistrictsTable

The `Revenue`, `Take`, `Pipeline`, and `Prior FY` columns are sourced from `district.actuals?.totalRevenue` etc. — nested under `actuals`, not top-level fields on `TerritoryPlanDistrict`. These are not directly addressable via `keyof T`. **All actuals-based columns require custom comparators** that extract the nested value before comparing.

| Column | Sortable | Notes |
|---|---|---|
| District | Yes | String, `localeCompare` on `district.name` |
| State | Yes | String, `localeCompare` on `district.stateAbbrev` |
| Renewal | Yes | Number (`district.renewalTarget`) |
| Winback | Yes | Number (`district.winbackTarget`) |
| Expansion | Yes | Number (`district.expansionTarget`) |
| New Biz | Yes | Number (`district.newBizTarget`) |
| Revenue | Yes | Custom comparator: extract `district.actuals?.totalRevenue ?? null` |
| Take | Yes | Custom comparator: extract `district.actuals?.totalTake ?? null` |
| Pipeline | Yes | Custom comparator: extract `district.actuals?.weightedPipeline ?? null` |
| Prior FY | Yes | Custom comparator: extract `district.actuals?.priorFyRevenue ?? null` |
| Services | No | Multi-select, no natural sort order |

### ContactsTable
| Column | Sortable | Notes |
|---|---|---|
| Person | Yes | Custom comparator: access contact name field |
| Email | Yes | String, `localeCompare` |
| District | Yes | String, `localeCompare` |
| Department | Yes | String, `localeCompare` on `contact.persona` |
| Seniority | Yes | String, `localeCompare` (no numeric rank in data model) |
| Last Activity | No | Not yet implemented |

### TasksTable (refactored from existing)

**Default sort preserved:** `defaultField: "createdAt"`, `defaultDir: "desc"` — matches current behavior. The addition of the third `null` sort state is a new capability but not a breaking change since it is only reachable after two clicks.

| Column | Sortable | Notes |
|---|---|---|
| Title | Yes | String, `localeCompare` |
| Status | Yes | Custom comparator: migrate existing `STATUS_ORDER` map |
| Priority | Yes | Custom comparator: migrate existing `PRIORITY_ORDER` map |
| Due Date | Yes | Custom comparator: coerce to `Date`; existing `Infinity` sentinel for nulls replaced by hook's null-sort-last policy |
| Created | Yes | Custom comparator: coerce ISO string to `Date` |
| Linked | No | Computed count badge |

---

## Testing

### Unit — `useSortableTable`
- Three-state cycle: new field → asc, same asc → desc, same desc → null
- String sort: correct ascending and descending order via `localeCompare`
- Date sort: correct ordering via `instanceof Date` detection
- Number sort: correct ordering via `typeof === "number"` detection
- Type detection — `instanceof Date` branch: dataset with `Date` objects uses `.getTime()` comparison, not `localeCompare`
- Type detection — ISO string branch: dataset with ISO date strings (e.g. `"2026-03-14T00:00:00Z"`) falls into `localeCompare` branch, not Date branch — confirming the documented footgun
- Type detection — number branch: dataset with numeric fields uses subtraction comparator
- Custom comparator: overrides default for a field
- `null` dir returns `data` array reference as-is (no copy)
- Null field values sort to the end regardless of direction (asc and desc)

### Unit — `SortHeader`
- Renders correct `aria-sort` for each state (ascending / descending / none)
- Active color class `text-[#403770]` applied when sorted, `text-[#8A80A8]` when not
- Arrow element renders on hover (inactive) and always when active
- 50% opacity applied to arrow element only on hover (not to text)
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
