# Grid Data Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed entity-table views in `/views/*` with a shared, sortable, filterable, column-customizable data grid backed by `@tanstack/react-table`, with per-plan/list shared layouts persisted to JSONB.

**Architecture:** One shared `GridView` component fed by a per-source `SOURCE_COLUMNS` registry. A single `GET /api/views/data` endpoint serves all six grids via the existing saved-views SQL compiler (filter-tree → parameterized SQL with allowlisted columns). Layouts persist on `TerritoryPlan.viewLayouts` / `SavedList.viewLayouts` as JSONB, auto-saved 500ms after each edit. Filter widgets are constrained inputs only (multi-select, range, toggle, date-range) — free text reserved for name/title contains search.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · `@tanstack/react-table` 8 · `@tanstack/react-query` 5 · Prisma · raw pg (read-only pool) · Tailwind 4 · Zod · Vitest + Testing Library.

**Spec:** `Docs/superpowers/specs/2026-05-14-grid-data-views-design.md`

---

## File Structure

### Created

```
prisma/migrations/<timestamp>_grid_view_layouts/migration.sql

src/lib/saved-views/grid-layout-schema.ts          ← Zod schema for ViewLayouts JSON
src/lib/saved-views/__tests__/grid-layout-schema.test.ts
src/lib/saved-views/__tests__/sql-compiler-order-by.test.ts  ← buildOrderBy tests

src/features/views/lib/columns.ts                  ← SOURCE_COLUMNS registry (all 6 sources)
src/features/views/lib/__tests__/columns.test.ts

src/features/views/lib/enum-sources.ts             ← static enum source ids + client helper
src/features/views/lib/__tests__/enum-sources.test.ts

src/features/views/hooks/useGridLayout.ts
src/features/views/hooks/__tests__/useGridLayout.test.tsx
src/features/views/hooks/useEnumValues.ts
src/features/views/hooks/useViewsData.ts

src/app/api/views/data/route.ts
src/app/api/views/data/__tests__/route.test.ts
src/app/api/views/enum-values/route.ts
src/app/api/views/enum-values/__tests__/route.test.ts

src/features/views/components/grid/GridView.tsx
src/features/views/components/grid/GridHeader.tsx
src/features/views/components/grid/GridHeaderCell.tsx
src/features/views/components/grid/GridRow.tsx
src/features/views/components/grid/GridFilterChips.tsx
src/features/views/components/grid/GridColumnMenu.tsx
src/features/views/components/grid/FilterFieldPicker.tsx
src/features/views/components/grid/widgets/MultiSelectWidget.tsx
src/features/views/components/grid/widgets/SelectWidget.tsx
src/features/views/components/grid/widgets/NumberRangeWidget.tsx
src/features/views/components/grid/widgets/DateRangeWidget.tsx
src/features/views/components/grid/widgets/ToggleWidget.tsx
src/features/views/components/grid/widgets/TextWidget.tsx
src/features/views/components/grid/__tests__/...    ← per-component tests
```

### Modified

```
prisma/schema.prisma                                ← +viewLayouts JSONB on TerritoryPlan, SavedList
src/lib/saved-views/sql-compiler.ts                 ← +buildOrderBy export
src/app/api/territory-plans/[id]/route.ts           ← PATCH accepts viewLayouts
src/app/api/lists/[id]/route.ts                     ← PATCH accepts viewLayouts
src/features/views/components/views/TableView.tsx   ← delegate to <GridView source="districts" />
src/features/views/components/views/ContactsView.tsx ← delegate to <GridView source="contacts" />
src/features/views/components/views/OppsView.tsx    ← delegate to <GridView source="opps" />
src/features/views/components/views/VacanciesView.tsx ← delegate to <GridView source="vacancies" />
src/features/views/components/views/NewsView.tsx    ← cards/table toggle + GridView path
src/features/views/components/views/RfpsView.tsx    ← delegate to <GridView source="rfps" />
src/features/views/lib/queries.ts                   ← +useViewsData, +useUpdatePlanLayout, +useUpdateListLayout
```

---

## Phase A — Backend Foundations

### Task A1: Prisma migration — `viewLayouts` JSONB columns

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_grid_view_layouts/migration.sql`

- [ ] **Step 1: Add field to `TerritoryPlan` model**

Edit `prisma/schema.prisma`. Find the `TerritoryPlan` model and add the line above `// Relations`:

```prisma
viewLayouts  Json?  @map("view_layouts")
```

- [ ] **Step 2: Add field to `SavedList` model**

In the same file, find `SavedList` and add above `owner`:

```prisma
viewLayouts  Json?  @map("view_layouts")
```

- [ ] **Step 3: Generate the migration**

Run: `npx prisma migrate dev --name grid_view_layouts --create-only`

Expected: a new `prisma/migrations/<timestamp>_grid_view_layouts/migration.sql` is created. Inspect that the SQL contains exactly:

```sql
ALTER TABLE "territory_plans" ADD COLUMN "view_layouts" JSONB;
ALTER TABLE "saved_lists" ADD COLUMN "view_layouts" JSONB;
```

If the generator emits anything else (indexes, defaults, NOT NULL), open the file and trim it down to just those two ALTERs.

- [ ] **Step 4: Apply the migration**

Run: `npx prisma migrate dev`
Expected: clean apply, no errors. Prisma client regenerated.

- [ ] **Step 5: Smoke-check the client**

Run: `npx tsc --noEmit` and verify zero new errors. Confirm `prisma.territoryPlan.update({ data: { viewLayouts: {} } })` is type-valid by grepping the generated `node_modules/.prisma/client/index.d.ts` for `viewLayouts`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/<timestamp>_grid_view_layouts
git commit -m "feat(grid): add viewLayouts JSONB column to plan + list"
```

---

### Task A2: `SOURCE_COLUMNS` registry

**Files:**
- Create: `src/features/views/lib/columns.ts`
- Create: `src/features/views/lib/__tests__/columns.test.ts`
- Create: `src/features/views/lib/enum-sources.ts`

- [ ] **Step 1: Write failing test for column registry shape**

Create `src/features/views/lib/__tests__/columns.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SOURCE_COLUMNS } from "../columns";
import { SOURCE_FIELDS } from "@/lib/saved-views/source-fields";

describe("SOURCE_COLUMNS", () => {
  const sources = ["districts","contacts","opps","vacancies","news","rfps"] as const;

  it("covers all 6 sources", () => {
    for (const s of sources) {
      expect(SOURCE_COLUMNS[s]).toBeDefined();
      expect(SOURCE_COLUMNS[s].length).toBeGreaterThan(0);
    }
  });

  it("every filterable column links to a SOURCE_FIELDS entry", () => {
    for (const s of sources) {
      for (const col of SOURCE_COLUMNS[s]) {
        if (col.filterFieldId !== null) {
          const field = SOURCE_FIELDS[s].find(f => f.id === col.filterFieldId);
          expect(field, `${s}.${col.id} → ${col.filterFieldId}`).toBeDefined();
        }
      }
    }
  });

  it("every raw sortable column has a SOURCE_FIELDS column reference", () => {
    for (const s of sources) {
      for (const col of SOURCE_COLUMNS[s]) {
        if (col.kind === "raw" && col.sortable) {
          expect(col.filterFieldId, `${s}.${col.id} sortable but no fieldId`).not.toBeNull();
        }
      }
    }
  });

  it("derived columns are not sortable", () => {
    for (const s of sources) {
      for (const col of SOURCE_COLUMNS[s]) {
        if (col.kind === "derived") expect(col.sortable).toBe(false);
      }
    }
  });

  it("default order is unique within each source", () => {
    for (const s of sources) {
      const orders = SOURCE_COLUMNS[s].map(c => c.defaultOrder);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `npx vitest run src/features/views/lib/__tests__/columns.test.ts`
Expected: FAIL — module `../columns` doesn't exist.

- [ ] **Step 3: Implement `enum-sources.ts`**

Create `src/features/views/lib/enum-sources.ts`:

```ts
export type EnumSourceId =
  | "states"
  | "users"
  | "stages"
  | "personas"
  | "seniorities"
  | "feed_sources";

export const STATIC_ENUM_SOURCES: Record<EnumSourceId, boolean> = {
  states: false,        // dynamic — fetched from /api/views/enum-values
  users: false,
  stages: false,
  personas: false,
  seniorities: false,
  feed_sources: false,
};
```

- [ ] **Step 4: Implement `SOURCE_COLUMNS`**

Create `src/features/views/lib/columns.ts`. The full registry is large; one column shown for shape, then the rest as a single literal. Use the inventory in the spec § Column Model & Registry.

```ts
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { EnumSourceId } from "./enum-sources";

export type FilterWidget =
  | { kind: "multiselect"; values: readonly string[] }
  | { kind: "multiselect"; enumSource: EnumSourceId }
  | { kind: "select"; values: readonly string[] }
  | { kind: "select"; enumSource: EnumSourceId }
  | { kind: "numberRange"; min?: number; max?: number; step?: number;
      presets?: readonly { label: string; range: [number, number] }[] }
  | { kind: "dateRange";
      relativeChips?: readonly ("7d" | "30d" | "90d" | "qtd" | "ytd")[] }
  | { kind: "toggle"; labels: { on: string; off: string } }
  | { kind: "text" };

export interface ColumnDef {
  id: string;
  header: string;
  kind: "raw" | "derived";
  /** When kind:"raw" — read from SOURCE_FIELDS[source][filterFieldId].column.
   *  When kind:"derived" — a client-side fn name resolved in the grid renderer. */
  accessor: string;
  sortable: boolean;
  filterFieldId: string | null;
  filterWidget: FilterWidget | null;
  align: "left" | "right" | "center";
  format: "money" | "number" | "percent" | "date" | "pill" | "text" | "avatar" | "boolean";
  defaultVisible: boolean;
  defaultOrder: number;
}

const MONEY_PRESETS = [
  { label: "$0–$50k",      range: [0, 50_000]      as [number, number] },
  { label: "$50k–$250k",   range: [50_000, 250_000] as [number, number] },
  { label: "$250k–$1M",    range: [250_000, 1_000_000] as [number, number] },
  { label: "$1M+",         range: [1_000_000, Number.MAX_SAFE_INTEGER] as [number, number] },
] as const;

const RELATIVE_DATE_CHIPS = ["7d", "30d", "90d", "qtd", "ytd"] as const;

export const SOURCE_COLUMNS: Record<SavedListSource, ColumnDef[]> = {
  districts: [
    { id: "name",            header: "District",    kind: "raw",     accessor: "name",
      sortable: true,  filterFieldId: "name",            filterWidget: { kind: "text" },
      align: "left",   format: "text",   defaultVisible: true,  defaultOrder: 0 },
    { id: "state",           header: "State",       kind: "raw",     accessor: "stateAbbrev",
      sortable: true,  filterFieldId: "state",           filterWidget: { kind: "multiselect", enumSource: "states" },
      align: "left",   format: "text",   defaultVisible: true,  defaultOrder: 1 },
    { id: "tier",            header: "Tier",        kind: "derived", accessor: "tier",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "left",   format: "pill",   defaultVisible: true,  defaultOrder: 2 },
    { id: "enrollment",      header: "Enrollment",  kind: "raw",     accessor: "enrollment",
      sortable: true,  filterFieldId: "enrollment",      filterWidget: { kind: "numberRange", min: 0, step: 100 },
      align: "right",  format: "number", defaultVisible: false, defaultOrder: 3 },
    { id: "frpl_rate",       header: "FRPL %",      kind: "raw",     accessor: "frplRate",
      sortable: true,  filterFieldId: "frpl_rate",       filterWidget: { kind: "numberRange", min: 0, max: 1, step: 0.01 },
      align: "right",  format: "percent",defaultVisible: false, defaultOrder: 4 },
    { id: "is_customer",     header: "Customer",    kind: "raw",     accessor: "isCustomer",
      sortable: true,  filterFieldId: "is_customer",     filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean",defaultVisible: false, defaultOrder: 5 },
    { id: "has_open_pipe",   header: "Open pipe",   kind: "raw",     accessor: "hasOpenPipeline",
      sortable: true,  filterFieldId: "has_open_pipeline", filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean",defaultVisible: false, defaultOrder: 6 },
    { id: "fy26_arr",        header: "FY26 ARR",    kind: "raw",     accessor: "metricValue",
      sortable: true,  filterFieldId: null,              filterWidget: { kind: "numberRange", min: 0, presets: MONEY_PRESETS },
      align: "right",  format: "money",  defaultVisible: true,  defaultOrder: 7 },
    { id: "stage",           header: "Stage",       kind: "derived", accessor: "stage",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "left",   format: "pill",   defaultVisible: true,  defaultOrder: 8 },
  ],
  contacts: [
    { id: "name",      header: "Name",      kind: "raw", accessor: "name",
      sortable: true,  filterFieldId: null,             filterWidget: { kind: "text" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 0 },
    { id: "title",     header: "Title",     kind: "raw", accessor: "title",
      sortable: true,  filterFieldId: "title",          filterWidget: { kind: "text" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 1 },
    { id: "persona",   header: "Persona",   kind: "raw", accessor: "persona",
      sortable: true,  filterFieldId: "persona",        filterWidget: { kind: "multiselect", enumSource: "personas" },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 2 },
    { id: "seniority", header: "Seniority", kind: "raw", accessor: "seniorityLevel",
      sortable: true,  filterFieldId: "seniority_level",filterWidget: { kind: "multiselect", enumSource: "seniorities" },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 3 },
    { id: "is_primary",header: "Primary",   kind: "raw", accessor: "isPrimary",
      sortable: true,  filterFieldId: "is_primary",     filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean", defaultVisible: false, defaultOrder: 4 },
    { id: "leaid",     header: "District",  kind: "raw", accessor: "leaid",
      sortable: false, filterFieldId: "leaid",          filterWidget: null,
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 5 },
  ],
  opps: [
    { id: "stage",      header: "Stage",       kind: "raw", accessor: "stage",
      sortable: true,  filterFieldId: "stage",         filterWidget: { kind: "multiselect", enumSource: "stages" },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 0 },
    { id: "bookings",   header: "Bookings",    kind: "raw", accessor: "netBookingAmount",
      sortable: true,  filterFieldId: "net_booking_amount", filterWidget: { kind: "numberRange", min: 0, presets: MONEY_PRESETS },
      align: "right",  format: "money", defaultVisible: true,  defaultOrder: 1 },
    { id: "close_date", header: "Close",       kind: "raw", accessor: "closeDate",
      sortable: true,  filterFieldId: "close_date",    filterWidget: { kind: "dateRange", relativeChips: RELATIVE_DATE_CHIPS },
      align: "left",   format: "date",  defaultVisible: true,  defaultOrder: 2 },
    { id: "state",      header: "State",       kind: "raw", accessor: "state",
      sortable: true,  filterFieldId: "state",         filterWidget: { kind: "multiselect", enumSource: "states" },
      align: "left",   format: "text",  defaultVisible: false, defaultOrder: 3 },
    { id: "school_yr",  header: "School year", kind: "raw", accessor: "schoolYr",
      sortable: true,  filterFieldId: "school_yr",     filterWidget: { kind: "multiselect", values: ["2024-25","2025-26","2026-27"] },
      align: "left",   format: "text",  defaultVisible: false, defaultOrder: 4 },
    { id: "owner",      header: "Owner",       kind: "raw", accessor: "ownerName",
      sortable: false, filterFieldId: null,            filterWidget: { kind: "multiselect", enumSource: "users" },
      align: "left",   format: "avatar",defaultVisible: true,  defaultOrder: 5 },
  ],
  vacancies: [
    { id: "status",            header: "Status",     kind: "raw", accessor: "status",
      sortable: true,  filterFieldId: "status",     filterWidget: { kind: "multiselect", values: ["open","closed","expired"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 0 },
    { id: "category",          header: "Category",   kind: "raw", accessor: "category",
      sortable: true,  filterFieldId: "category",   filterWidget: { kind: "multiselect", values: ["SPED","ELL","General Ed","Admin","Specialist","Counseling","Related Services","Other"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 1 },
    { id: "fullmind_relevant", header: "Relevant",   kind: "raw", accessor: "fullmindRelevant",
      sortable: true,  filterFieldId: "fullmind_relevant", filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean",defaultVisible: false, defaultOrder: 2 },
    { id: "title",             header: "Title",      kind: "raw", accessor: "title",
      sortable: true,  filterFieldId: "title",      filterWidget: { kind: "text" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 3 },
    { id: "date_posted",       header: "Posted",     kind: "raw", accessor: "datePosted",
      sortable: true,  filterFieldId: "date_posted",filterWidget: { kind: "dateRange", relativeChips: RELATIVE_DATE_CHIPS },
      align: "left",   format: "date",  defaultVisible: true,  defaultOrder: 4 },
  ],
  news: [
    { id: "relevance",     header: "Relevance",  kind: "raw", accessor: "fullmindRelevance",
      sortable: true,  filterFieldId: "fullmind_relevance", filterWidget: { kind: "multiselect", values: ["high","medium","low"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 0 },
    { id: "feed_source",   header: "Source",     kind: "raw", accessor: "feedSource",
      sortable: true,  filterFieldId: "feed_source", filterWidget: { kind: "multiselect", enumSource: "feed_sources" },
      align: "left",   format: "text",  defaultVisible: false, defaultOrder: 1 },
    { id: "published_at",  header: "Published",  kind: "raw", accessor: "publishedAt",
      sortable: true,  filterFieldId: "published_at",filterWidget: { kind: "dateRange", relativeChips: RELATIVE_DATE_CHIPS },
      align: "left",   format: "date",  defaultVisible: true,  defaultOrder: 2 },
    { id: "title",         header: "Title",      kind: "raw", accessor: "title",
      sortable: true,  filterFieldId: "title",  filterWidget: { kind: "text" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 3 },
  ],
  rfps: [
    { id: "status",        header: "Status",     kind: "raw", accessor: "status",
      sortable: true,  filterFieldId: "status",  filterWidget: { kind: "multiselect", values: ["draft","open","awarded","closed"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 0 },
    { id: "relevance",     header: "Relevance",  kind: "raw", accessor: "fullmindRelevance",
      sortable: true,  filterFieldId: "fullmind_relevance", filterWidget: { kind: "multiselect", values: ["high","medium","low"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 1 },
    { id: "value_low",     header: "Min value",  kind: "raw", accessor: "valueLow",
      sortable: true,  filterFieldId: "value_low",filterWidget: { kind: "numberRange", min: 0, presets: MONEY_PRESETS },
      align: "right",  format: "money", defaultVisible: false, defaultOrder: 2 },
    { id: "value_high",    header: "Max value",  kind: "raw", accessor: "valueHigh",
      sortable: true,  filterFieldId: "value_high",filterWidget: { kind: "numberRange", min: 0, presets: MONEY_PRESETS },
      align: "right",  format: "money", defaultVisible: true,  defaultOrder: 3 },
    { id: "due_date",      header: "Due",        kind: "raw", accessor: "dueDate",
      sortable: true,  filterFieldId: "due_date",filterWidget: { kind: "dateRange", relativeChips: RELATIVE_DATE_CHIPS },
      align: "left",   format: "date",  defaultVisible: true,  defaultOrder: 4 },
    { id: "state",         header: "State",      kind: "raw", accessor: "stateAbbrev",
      sortable: true,  filterFieldId: "state",   filterWidget: { kind: "multiselect", enumSource: "states" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 5 },
  ],
};

export function getDefaultLayoutColumns(source: SavedListSource) {
  return SOURCE_COLUMNS[source]
    .slice()
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((c) => ({ id: c.id, order: c.defaultOrder, visible: c.defaultVisible }));
}

export function lookupColumn(source: SavedListSource, id: string): ColumnDef | null {
  return SOURCE_COLUMNS[source].find((c) => c.id === id) ?? null;
}
```

- [ ] **Step 5: Run tests, confirm they pass**

Run: `npx vitest run src/features/views/lib/__tests__/columns.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/views/lib/columns.ts src/features/views/lib/enum-sources.ts src/features/views/lib/__tests__/columns.test.ts
git commit -m "feat(grid): add SOURCE_COLUMNS registry + enum source ids"
```

---

### Task A3: Grid-layout Zod schema + extend PATCH handlers

**Files:**
- Create: `src/lib/saved-views/grid-layout-schema.ts`
- Create: `src/lib/saved-views/__tests__/grid-layout-schema.test.ts`
- Modify: `src/app/api/territory-plans/[id]/route.ts`
- Modify: `src/app/api/lists/[id]/route.ts`

- [ ] **Step 1: Write failing tests for the schema**

Create `src/lib/saved-views/__tests__/grid-layout-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gridLayoutSchema, viewLayoutsSchema } from "../grid-layout-schema";

describe("gridLayoutSchema", () => {
  const valid = {
    columns: [
      { id: "name",  order: 0, visible: true },
      { id: "state", order: 1, visible: true, width: 100 },
    ],
    sort: [{ id: "name", dir: "asc" as const }],
    filters: { kind: "and" as const, children: [] },
  };

  it("accepts a valid layout", () => {
    expect(() => gridLayoutSchema("districts").parse(valid)).not.toThrow();
  });

  it("rejects unknown column ids", () => {
    const bad = { ...valid, columns: [{ id: "fake_column", order: 0, visible: true }] };
    expect(() => gridLayoutSchema("districts").parse(bad)).toThrow(/fake_column/);
  });

  it("rejects sort on derived columns", () => {
    const bad = { ...valid, sort: [{ id: "tier", dir: "asc" as const }] };
    expect(() => gridLayoutSchema("districts").parse(bad)).toThrow(/tier/);
  });

  it("rejects sort on unknown column ids", () => {
    const bad = { ...valid, sort: [{ id: "ghost", dir: "asc" as const }] };
    expect(() => gridLayoutSchema("districts").parse(bad)).toThrow();
  });
});

describe("viewLayoutsSchema", () => {
  it("each view-type entry is validated against its source", () => {
    const layouts = {
      table: { columns: [{ id: "name", order: 0, visible: true }], sort: [], filters: { kind: "and" as const, children: [] } },
      contacts: { columns: [{ id: "name", order: 0, visible: true }], sort: [], filters: { kind: "and" as const, children: [] } },
    };
    expect(() => viewLayoutsSchema().parse(layouts)).not.toThrow();
  });

  it("null clears layouts", () => {
    expect(() => viewLayoutsSchema().parse(null)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/lib/saved-views/__tests__/grid-layout-schema.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the schema**

Create `src/lib/saved-views/grid-layout-schema.ts`:

```ts
import { z } from "zod";
import type { SavedListSource } from "./filter-tree";
import { filterTreeAnd } from "./schema";
import { SOURCE_COLUMNS, lookupColumn } from "@/features/views/lib/columns";

const columnEntrySchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  width: z.number().positive().optional(),
  visible: z.boolean(),
});

const sortEntrySchema = z.object({
  id: z.string(),
  dir: z.enum(["asc", "desc"]),
});

export function gridLayoutSchema(source: SavedListSource) {
  const knownColumnIds = new Set(SOURCE_COLUMNS[source].map((c) => c.id));
  const sortableIds = new Set(
    SOURCE_COLUMNS[source].filter((c) => c.kind === "raw" && c.sortable).map((c) => c.id),
  );

  return z.object({
    columns: z.array(columnEntrySchema).superRefine((cols, ctx) => {
      for (const col of cols) {
        if (!knownColumnIds.has(col.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown column "${col.id}" for source "${source}"`,
          });
        }
      }
    }),
    sort: z.array(sortEntrySchema).superRefine((entries, ctx) => {
      for (const e of entries) {
        if (!sortableIds.has(e.id)) {
          const col = lookupColumn(source, e.id);
          const reason = col?.kind === "derived" ? "is derived" : "is not sortable";
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Sort field "${e.id}" ${reason}`,
          });
        }
      }
    }),
    filters: filterTreeAnd,
  });
}

const VIEW_TYPE_TO_SOURCE: Record<string, SavedListSource> = {
  table: "districts",
  contacts: "contacts",
  opps: "opps",
  vacancies: "vacancies",
  news: "news",
  rfps: "rfps",
};

export function viewLayoutsSchema() {
  return z
    .object({
      table:     gridLayoutSchema("districts").optional(),
      contacts:  gridLayoutSchema("contacts").optional(),
      opps:      gridLayoutSchema("opps").optional(),
      vacancies: gridLayoutSchema("vacancies").optional(),
      news:      gridLayoutSchema("news").optional(),
      rfps:      gridLayoutSchema("rfps").optional(),
    })
    .nullable();
}

export type GridViewLayout = z.infer<ReturnType<typeof gridLayoutSchema>>;
export type ViewLayouts = z.infer<ReturnType<typeof viewLayoutsSchema>>;
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/lib/saved-views/__tests__/grid-layout-schema.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Extend territory-plan PATCH**

Open `src/app/api/territory-plans/[id]/route.ts`. Find the Zod schema used for PATCH input. Add `viewLayouts: viewLayoutsSchema().optional()`. In the Prisma update call, pass `viewLayouts: body.viewLayouts ?? Prisma.JsonNull` when the key is present.

Add a unit test in the existing route test file asserting that PATCH with a valid layout persists, and PATCH with an unknown column id returns 400.

- [ ] **Step 6: Extend list PATCH**

Same pattern in `src/app/api/lists/[id]/route.ts`. Note: the list source dictates which view-type entry is valid. For v1, accept all entries in the schema (we don't enforce "a contacts list can only carry contacts layout") — the column-id allowlist already prevents nonsense.

- [ ] **Step 7: Run all saved-views tests**

Run: `npx vitest run src/lib/saved-views src/app/api/territory-plans src/app/api/lists`
Expected: all green, including new PATCH tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/saved-views/grid-layout-schema.ts src/lib/saved-views/__tests__/grid-layout-schema.test.ts \
        src/app/api/territory-plans/[id]/route.ts src/app/api/territory-plans/[id]/__tests__/*.test.ts \
        src/app/api/lists/[id]/route.ts src/app/api/lists/[id]/__tests__/*.test.ts
git commit -m "feat(grid): viewLayouts Zod schema + plan/list PATCH support"
```

---

### Task A4: `buildOrderBy` in SQL compiler

**Files:**
- Modify: `src/lib/saved-views/sql-compiler.ts`
- Create: `src/lib/saved-views/__tests__/sql-compiler-order-by.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/saved-views/__tests__/sql-compiler-order-by.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildOrderBy } from "../sql-compiler";

describe("buildOrderBy", () => {
  it("returns empty string for empty sort", () => {
    expect(buildOrderBy([], "districts")).toBe("");
  });

  it("compiles a single asc sort to ORDER BY with NULLS LAST", () => {
    const sql = buildOrderBy([{ id: "enrollment", dir: "asc" }], "districts");
    expect(sql).toBe(`ORDER BY "enrollment" ASC NULLS LAST`);
  });

  it("compiles desc with NULLS LAST", () => {
    const sql = buildOrderBy([{ id: "enrollment", dir: "desc" }], "districts");
    expect(sql).toBe(`ORDER BY "enrollment" DESC NULLS LAST`);
  });

  it("compiles multi-sort in order", () => {
    const sql = buildOrderBy(
      [{ id: "state", dir: "asc" }, { id: "enrollment", dir: "desc" }],
      "districts",
    );
    expect(sql).toBe(`ORDER BY "state_abbrev" ASC NULLS LAST, "enrollment" DESC NULLS LAST`);
  });

  it("throws on unknown field", () => {
    expect(() => buildOrderBy([{ id: "ghost", dir: "asc" }], "districts")).toThrow(/ghost/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/lib/saved-views/__tests__/sql-compiler-order-by.test.ts`
Expected: FAIL — `buildOrderBy` not exported.

- [ ] **Step 3: Implement**

Open `src/lib/saved-views/sql-compiler.ts`. At the bottom, add:

```ts
export function buildOrderBy(
  sort: { id: string; dir: "asc" | "desc" }[],
  source: SavedListSource,
): string {
  if (sort.length === 0) return "";
  const parts = sort.map(({ id, dir }) => {
    const field = lookupField(source, id);
    if (!field) throw new Error(`Unknown sort field "${id}" for source "${source}"`);
    if (!/^[a-z_][a-z0-9_]*$/i.test(field.column)) {
      throw new Error(`Invalid identifier in sort column: ${field.column}`);
    }
    const safeDir = dir === "asc" ? "ASC" : "DESC";
    return `"${field.column}" ${safeDir} NULLS LAST`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}
```

(`lookupField` is already imported from `./source-fields`; no new imports needed.)

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/lib/saved-views/__tests__/sql-compiler-order-by.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Confirm existing compiler tests still pass**

Run: `npx vitest run src/lib/saved-views/__tests__/sql-compiler.test.ts`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/lib/saved-views/sql-compiler.ts src/lib/saved-views/__tests__/sql-compiler-order-by.test.ts
git commit -m "feat(grid): add buildOrderBy to saved-views SQL compiler"
```

---

### Task A5: `GET /api/views/data` route

**Files:**
- Create: `src/app/api/views/data/route.ts`
- Create: `src/app/api/views/data/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/views/data/__tests__/route.test.ts`. Cover (a) 401 when unauthenticated, (b) 400 on unknown source, (c) 400 on sort against derived column, (d) leaids scope narrows the result, (e) filters merge with list's saved filter, (f) timeout returns `{rows:[], truncated:true}`. Use the existing route-test patterns from `src/app/api/lists/__tests__/route.test.ts` (mock `getUser`, mock the read-only pool query).

(Showing one test for shape; the rest follow the same template.)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/getUser", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: { query: vi.fn() },
}));

import { getUser } from "@/lib/getUser";
import { readonlyPool } from "@/lib/db-readonly";

describe("GET /api/views/data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1" });
  });

  it("returns 401 when unauthenticated", async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request("http://x/api/views/data?source=districts");
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 on unknown source", async () => {
    const req = new Request("http://x/api/views/data?source=invalid");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });

  it("rejects sort against a derived column", async () => {
    const req = new Request(
      "http://x/api/views/data?source=districts&sort=tier:asc&leaids=lea1",
    );
    const res = await GET(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tier/);
  });

  it("forwards leaids scope to the SQL where clause", async () => {
    (readonlyPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [{ leaid: "lea1", name: "X" }],
    });
    const req = new Request(
      "http://x/api/views/data?source=districts&leaids=lea1,lea2",
    );
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const callArgs = (readonlyPool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toMatch(/leaid"\s*=\s*ANY/i);
    expect(callArgs[1]).toContainEqual(["lea1", "lea2"]);
  });

  it("returns truncated payload on statement-timeout", async () => {
    (readonlyPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error("canceling"), { code: "57014" }),
    );
    const req = new Request(
      "http://x/api/views/data?source=districts&leaids=lea1",
    );
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ rows: [], total: 0, truncated: true });
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/app/api/views/data/__tests__/route.test.ts`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement the route**

Create `src/app/api/views/data/route.ts`. Skeleton (full body in the file):

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/getUser";
import { readonlyPool } from "@/lib/db-readonly";
import { filterTreeAnd } from "@/lib/saved-views/schema";
import {
  buildWhereSql,
  buildOrderBy,
} from "@/lib/saved-views/sql-compiler";
import { SOURCE_TABLES, SOURCE_FIELDS } from "@/lib/saved-views/source-fields";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SOURCES = ["districts","contacts","opps","vacancies","news","rfps"] as const;

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const source = sp.get("source") as SavedListSource;
  if (!SOURCES.includes(source as never))
    return NextResponse.json({ error: `Unknown source "${source}"` }, { status: 400 });

  const leaidsArg = sp.get("leaids");
  const leaids = leaidsArg
    ? leaidsArg.split(",").map(s => s.trim()).filter(Boolean)
    : null;

  const listId = sp.get("listId");

  // parse filters
  let filters = { kind: "and" as const, children: [] as never[] };
  const filtersArg = sp.get("filters");
  if (filtersArg) {
    try {
      filters = filterTreeAnd.parse(JSON.parse(filtersArg));
    } catch (err) {
      return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
    }
  }

  // parse sort
  const sortArgs = sp.getAll("sort");
  const sortableIds = new Set(
    SOURCE_FIELDS[source].map(f => f.id),
  );
  const sort: { id: string; dir: "asc" | "desc" }[] = [];
  for (const raw of sortArgs) {
    const [id, dirRaw] = raw.split(":");
    const dir = (dirRaw === "desc" ? "desc" : "asc") as "asc" | "desc";
    if (!sortableIds.has(id)) {
      return NextResponse.json(
        { error: `Sort field "${id}" not supported for source "${source}"` },
        { status: 400 },
      );
    }
    sort.push({ id, dir });
  }

  const limit = Math.min(parseInt(sp.get("limit") || "50", 10), 200);
  const offset = Math.max(parseInt(sp.get("offset") || "0", 10), 0);

  // resolve listId scoping (merge filters) — visibility check + AND with savedList.filterTree
  let mergedFilters = filters;
  if (listId) {
    const list = await prisma.savedList.findUnique({ where: { id: listId } });
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
    if (list.ownerId !== user.id && !list.shared) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (list.source !== source) {
      return NextResponse.json({ error: "List source mismatch" }, { status: 400 });
    }
    mergedFilters = {
      kind: "and",
      children: [filters, list.filterTree as never],
    };
  }

  const table = SOURCE_TABLES[source];
  const params: unknown[] = [];
  const where = buildWhereSql(mergedFilters, source, params);
  const orderBy = buildOrderBy(sort, source);

  // append leaids scope
  let leaidScope = "";
  if (leaids && leaids.length > 0 && table.districtJoinColumn) {
    params.push(leaids);
    leaidScope = `${where ? " AND " : ""}"${table.districtJoinColumn}" = ANY($${params.length})`;
  } else if (leaids !== null && leaids.length === 0) {
    return NextResponse.json({ rows: [], total: 0 });
  }

  const sql = `
    SELECT * FROM "${table.table}"
    ${where || leaidScope ? "WHERE " : ""}${where}${leaidScope}
    ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;

  try {
    const result = await readonlyPool.query(sql, params);
    return NextResponse.json({ rows: result.rows, total: result.rows.length });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "57014") {
      return NextResponse.json({ rows: [], total: 0, truncated: true });
    }
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
```

Notes for the engineer:
- `buildWhereSql` is the existing exported compiler entrypoint — check the actual export name in `src/lib/saved-views/sql-compiler.ts` and adjust the import if different.
- Total row counts behind a filter are computed via `COUNT(*) OVER()` in v1 only if rep feedback asks for it; for now `total` reflects the loaded page.
- Auth check must come first, before any SQL.

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/app/api/views/data/__tests__/route.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Smoke test via curl**

Start dev server: `npm run dev` (port 3005). In another shell:

```bash
curl -s -b cookies.txt 'http://localhost:3005/api/views/data?source=districts&leaids=fakeLea&limit=2' | jq .
```

Expected: `{ rows: [], total: 0 }` (no rows for a bogus leaid). Confirm no 500.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/views/data
git commit -m "feat(grid): GET /api/views/data — unified read endpoint for all 6 grids"
```

---

### Task A6: `GET /api/views/enum-values` route

**Files:**
- Create: `src/app/api/views/enum-values/route.ts`
- Create: `src/app/api/views/enum-values/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests**

Cover: (a) 401 unauthenticated; (b) 400 on unknown source id; (c) `states` returns a static list of 50 + DC; (d) `users` returns rows from `UserProfile` (mock Prisma); (e) `stages` returns distinct stages from `opportunities` (mock readonly query).

- [ ] **Step 2: Implement**

Create `src/app/api/views/enum-values/route.ts`. A switch on `source`:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readonlyPool } from "@/lib/db-readonly";
import { getUser } from "@/lib/getUser";

const STATES = [/* 50 + DC, value=abbrev, label="State Name" */];

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const source = new URL(req.url).searchParams.get("source");
  switch (source) {
    case "states":
      return NextResponse.json({ values: STATES });
    case "users": {
      const users = await prisma.userProfile.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({
        values: users.map(u => ({ value: u.id, label: u.name ?? u.email })),
      });
    }
    case "stages": {
      const rows = await readonlyPool.query<{ stage: string }>(
        `SELECT DISTINCT stage FROM opportunities WHERE stage IS NOT NULL ORDER BY stage`,
      );
      return NextResponse.json({
        values: rows.rows.map(r => ({ value: r.stage, label: r.stage })),
      });
    }
    case "personas":
    case "seniorities":
    case "feed_sources": {
      const table = source === "feed_sources" ? "news_articles" : "contacts";
      const column = source === "feed_sources" ? "feed_source"
        : source === "personas" ? "persona" : "seniority_level";
      // Identifiers are literals here — no user input flows into the SQL string.
      const rows = await readonlyPool.query<Record<string, string>>(
        `SELECT DISTINCT "${column}" AS v FROM "${table}"
         WHERE "${column}" IS NOT NULL ORDER BY "${column}"`,
      );
      return NextResponse.json({
        values: rows.rows.map(r => ({ value: r.v, label: r.v })),
      });
    }
    default:
      return NextResponse.json({ error: `Unknown source "${source}"` }, { status: 400 });
  }
}
```

The STATES array needs concrete values — pull from `src/lib/states.ts` (already exists per CLAUDE.md mentions of `normalizeState`).

- [ ] **Step 3: Run tests, confirm pass**

Run: `npx vitest run src/app/api/views/enum-values`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/views/enum-values
git commit -m "feat(grid): GET /api/views/enum-values — dynamic enum source resolver"
```

---

## Phase B — Grid Primitives

### Task B1: `GridView` shell + `useViewsData` hook

**Files:**
- Create: `src/features/views/components/grid/GridView.tsx`
- Create: `src/features/views/hooks/useViewsData.ts`
- Modify: `src/features/views/lib/queries.ts` (export shared API_BASE if not already)

- [ ] **Step 1: Implement `useViewsData`**

```ts
// src/features/views/hooks/useViewsData.ts
import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

interface UseViewsDataArgs {
  source: SavedListSource;
  leaids: string[] | null;
  listId: string | null;
  layout: GridViewLayout;
  limit: number;
  offset: number;
}

export function useViewsData(args: UseViewsDataArgs) {
  const { source, leaids, listId, layout, limit, offset } = args;
  const filtersJson = JSON.stringify(layout.filters);
  const sortJson = JSON.stringify(layout.sort);
  const leaidsKey = leaids ? leaids.slice().sort().join(",") : "";
  const enabled = leaids !== null || listId !== null;

  const url = (() => {
    const params = new URLSearchParams({ source, limit: String(limit), offset: String(offset) });
    if (leaids) params.set("leaids", leaids.join(","));
    if (listId) params.set("listId", listId);
    if (layout.filters.children.length > 0) params.set("filters", filtersJson);
    for (const s of layout.sort) params.append("sort", `${s.id}:${s.dir}`);
    return `${API_BASE}/views/data?${params.toString()}`;
  })();

  return useQuery({
    queryKey: ["views", "data", source, leaidsKey, listId ?? "", filtersJson, sortJson, limit, offset] as const,
    queryFn: () => fetchJson<{ rows: Record<string, unknown>[]; total: number; truncated?: boolean }>(url),
    enabled,
    staleTime: 30 * 1000,
  });
}
```

- [ ] **Step 2: Implement `GridView` shell**

```tsx
// src/features/views/components/grid/GridView.tsx
"use client";
import { useState } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import type { ColumnDef as TanColumnDef } from "@tanstack/react-table";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import { SOURCE_COLUMNS } from "@/features/views/lib/columns";
import { useGridLayout } from "@/features/views/hooks/useGridLayout";
import { useViewsData } from "@/features/views/hooks/useViewsData";
import { LoadingState, ErrorState, EmptyState, ShowMoreButton, ViewScroll } from "../views/_shared";

interface GridViewProps {
  source: SavedListSource;
  leaids: string[] | null;
  listId: string | null;
  parentKind: "plan" | "list";
  parentId: string;
  viewType: "table" | "contacts" | "opps" | "vacancies" | "news" | "rfps";
}

export default function GridView(props: GridViewProps) {
  const [page, setPage] = useState(1);
  const { layout, setLayout } = useGridLayout(props.parentKind, props.parentId, props.viewType, props.source);
  const limit = page * 50;
  const q = useViewsData({ source: props.source, leaids: props.leaids, listId: props.listId, layout, limit, offset: 0 });

  const visibleCols = SOURCE_COLUMNS[props.source]
    .filter(c => layout.columns.find(l => l.id === c.id)?.visible ?? c.defaultVisible)
    .sort((a, b) => {
      const oa = layout.columns.find(l => l.id === a.id)?.order ?? a.defaultOrder;
      const ob = layout.columns.find(l => l.id === b.id)?.order ?? b.defaultOrder;
      return oa - ob;
    });

  const tanCols: TanColumnDef<Record<string, unknown>>[] = visibleCols.map(c => ({
    id: c.id,
    header: c.header,
    accessorKey: c.accessor,
  }));

  const table = useReactTable({
    data: q.data?.rows ?? [],
    columns: tanCols,
    getCoreRowModel: getCoreRowModel(),
  });

  if (q.isLoading) return <LoadingState rows={8} />;
  if (q.isError)   return <ErrorState message={String(q.error?.message ?? "Failed")} onRetry={() => q.refetch()} />;
  if (!q.data || q.data.rows.length === 0)
    return <EmptyState title="No matching rows" hint="Adjust filters or pick a different scope." />;

  return (
    <ViewScroll>
      {/* GridHeader (filter chips + column menu) goes here in B6/B7 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F7F5FA] sticky top-0 z-[1]">
              {table.getHeaderGroups()[0].headers.map(h => (
                <th key={h.id} className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] py-2.5 px-3.5 border-b border-[#D4CFE2] whitespace-nowrap text-left">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                data-row-kind={props.source === "districts" ? "district" : props.source.slice(0, -1)}
                data-row-id={String(row.original.id ?? row.original.leaid ?? "")}
                className="hover:bg-[#F7F5FA] cursor-pointer transition-colors duration-100"
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="py-2.5 px-3.5 border-b border-[#EFEDF5]">
                    {flexRender(cell.column.columnDef.cell ?? ((info: { getValue: () => unknown }) => String(info.getValue() ?? "—")), cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {q.data && q.data.rows.length >= limit && (
        <ShowMoreButton onClick={() => setPage(p => p + 1)} remaining={50} />
      )}
    </ViewScroll>
  );
}
```

- [ ] **Step 3: Write basic interaction test**

Create `src/features/views/components/grid/__tests__/GridView.test.tsx`. Mock `useViewsData` + `useGridLayout`, render with a simple source, assert that visible columns render in expected order and rows mount with the right `data-row-kind`.

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/features/views/components/grid/__tests__/GridView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/GridView.tsx \
        src/features/views/hooks/useViewsData.ts \
        src/features/views/components/grid/__tests__/GridView.test.tsx
git commit -m "feat(grid): GridView shell + useViewsData hook"
```

---

### Task B2: `GridHeaderCell` with sort cycle

**Files:**
- Create: `src/features/views/components/grid/GridHeaderCell.tsx`
- Create: `src/features/views/components/grid/__tests__/GridHeaderCell.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GridHeaderCell } from "../GridHeaderCell";

describe("GridHeaderCell", () => {
  it("cycles none → asc → desc → none on click when sortable", () => {
    const onChange = vi.fn();
    const { rerender } = render(<GridHeaderCell label="Name" sortable={true} sortDir={null} onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("asc");

    rerender(<GridHeaderCell label="Name" sortable={true} sortDir="asc" onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("desc");

    rerender(<GridHeaderCell label="Name" sortable={true} sortDir="desc" onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders as static text when not sortable", () => {
    render(<GridHeaderCell label="Tier" sortable={false} sortDir={null} onSortChange={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Tier")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// src/features/views/components/grid/GridHeaderCell.tsx
import { ChevronUp, ChevronDown } from "lucide-react";

interface GridHeaderCellProps {
  label: string;
  sortable: boolean;
  sortDir: "asc" | "desc" | null;
  onSortChange: (next: "asc" | "desc" | null) => void;
}

export function GridHeaderCell({ label, sortable, sortDir, onSortChange }: GridHeaderCellProps) {
  if (!sortable) return <span className="whitespace-nowrap">{label}</span>;
  const next = sortDir === null ? "asc" : sortDir === "asc" ? "desc" : null;
  return (
    <button
      type="button"
      onClick={() => onSortChange(next)}
      className="flex items-center gap-1 whitespace-nowrap text-inherit hover:text-[#403770]"
    >
      <span>{label}</span>
      {sortDir === "asc"  && <ChevronUp   className="h-3 w-3" />}
      {sortDir === "desc" && <ChevronDown className="h-3 w-3" />}
    </button>
  );
}
```

- [ ] **Step 3: Run tests, confirm pass**

Run: `npx vitest run src/features/views/components/grid/__tests__/GridHeaderCell.test.tsx`
Expected: PASS.

- [ ] **Step 4: Wire into GridView**

In `GridView.tsx`, replace the `flexRender(h.column.columnDef.header, …)` with `<GridHeaderCell label={col.header} sortable={col.sortable} sortDir={…} onSortChange={dir => setLayout({...layout, sort: dir ? [{id: col.id, dir}] : []})} />`.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/GridHeaderCell.tsx \
        src/features/views/components/grid/__tests__/GridHeaderCell.test.tsx \
        src/features/views/components/grid/GridView.tsx
git commit -m "feat(grid): clickable header cell with sort cycle"
```

---

### Task B3: `MultiSelectWidget`

**Files:**
- Create: `src/features/views/components/grid/widgets/MultiSelectWidget.tsx`
- Create: `src/features/views/components/grid/widgets/__tests__/MultiSelectWidget.test.tsx`
- Create: `src/features/views/hooks/useEnumValues.ts`

- [ ] **Step 1: Write `useEnumValues` (small, no test needed for itself — tested via integration)**

```ts
import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import type { EnumSourceId } from "@/features/views/lib/enum-sources";

export function useEnumValues(enumSource: EnumSourceId | null) {
  return useQuery({
    queryKey: ["views", "enum-values", enumSource] as const,
    queryFn: () => fetchJson<{ values: { value: string; label: string }[] }>(`${API_BASE}/views/enum-values?source=${enumSource}`),
    enabled: enumSource !== null,
    staleTime: Infinity,
  });
}
```

- [ ] **Step 2: Write widget test**

Tests cover: (a) static-values mode renders all options; (b) dynamic-source mode shows skeleton while fetching, then options; (c) checkbox toggles add/remove from selection; (d) type-to-search filters the visible options; (e) "Apply" button fires onChange with selected values.

- [ ] **Step 3: Implement**

```tsx
// src/features/views/components/grid/widgets/MultiSelectWidget.tsx
import { useState, useMemo } from "react";
import { useEnumValues } from "@/features/views/hooks/useEnumValues";
import type { FilterWidget } from "@/features/views/lib/columns";

interface Props {
  widget: Extract<FilterWidget, { kind: "multiselect" }>;
  value: string[];
  onApply: (next: string[]) => void;
  onCancel: () => void;
}

export function MultiSelectWidget({ widget, value, onApply, onCancel }: Props) {
  const [selected, setSelected] = useState(value);
  const [query, setQuery] = useState("");

  const enumQuery = useEnumValues("enumSource" in widget ? widget.enumSource : null);
  const options = "values" in widget
    ? widget.values.map(v => ({ value: v, label: v }))
    : (enumQuery.data?.values ?? []);

  const filtered = useMemo(() =>
    query ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : options,
    [options, query],
  );

  const toggle = (v: string) =>
    setSelected(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  return (
    <div className="w-64 rounded-lg border border-[#E2DEEC] bg-white p-2 shadow-md">
      <input
        autoFocus
        placeholder="Search…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px]"
      />
      <div className="mt-2 max-h-56 overflow-y-auto">
        {"enumSource" in widget && enumQuery.isLoading ? (
          <div className="px-2 py-3 text-[12px] text-[#8A80A8]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-[#8A80A8]">No matches</div>
        ) : filtered.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 px-2 py-1 hover:bg-[#F7F5FA] cursor-pointer">
            <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
            <span className="text-[13px]">{opt.label}</span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2 border-t border-[#EFEDF5] pt-2">
        <button onClick={onCancel} className="text-[12px] text-[#8A80A8]">Cancel</button>
        <button onClick={() => onApply(selected)} className="rounded bg-[#403770] px-3 py-1 text-[12px] text-white">Apply</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/features/views/components/grid/widgets/__tests__/MultiSelectWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/widgets/MultiSelectWidget.tsx \
        src/features/views/components/grid/widgets/__tests__/MultiSelectWidget.test.tsx \
        src/features/views/hooks/useEnumValues.ts
git commit -m "feat(grid): MultiSelectWidget + useEnumValues hook"
```

---

### Task B4: `NumberRangeWidget` + `DateRangeWidget`

**Files:** `src/features/views/components/grid/widgets/NumberRangeWidget.tsx`, `DateRangeWidget.tsx`, paired tests.

- [ ] **Step 1: Write NumberRangeWidget tests**

Cover: (a) renders min/max inputs; (b) preset chips populate the inputs on click; (c) Apply fires onChange with `{min, max}`; (d) clear sets both to null.

- [ ] **Step 2: Implement NumberRangeWidget**

```tsx
import { useState } from "react";
import type { FilterWidget } from "@/features/views/lib/columns";

interface Props {
  widget: Extract<FilterWidget, { kind: "numberRange" }>;
  value: { min: number | null; max: number | null };
  onApply: (next: { min: number | null; max: number | null }) => void;
  onCancel: () => void;
}

export function NumberRangeWidget({ widget, value, onApply, onCancel }: Props) {
  const [min, setMin] = useState<string>(value.min?.toString() ?? "");
  const [max, setMax] = useState<string>(value.max?.toString() ?? "");

  const applyPreset = (range: readonly [number, number]) => {
    setMin(String(range[0]));
    setMax(range[1] === Number.MAX_SAFE_INTEGER ? "" : String(range[1]));
  };

  return (
    <div className="w-72 rounded-lg border border-[#E2DEEC] bg-white p-3 shadow-md">
      <div className="flex gap-2">
        <input type="number" placeholder="Min" value={min} onChange={e => setMin(e.target.value)}
          className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px] tabular-nums" />
        <input type="number" placeholder="Max" value={max} onChange={e => setMax(e.target.value)}
          className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px] tabular-nums" />
      </div>
      {widget.presets && (
        <div className="mt-2 flex flex-wrap gap-1">
          {widget.presets.map(p => (
            <button key={p.label} onClick={() => applyPreset(p.range)}
              className="rounded-full border border-[#E2DEEC] px-2 py-0.5 text-[11px] text-[#544A78] hover:bg-[#F7F5FA]">
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2 border-t border-[#EFEDF5] pt-2">
        <button onClick={onCancel} className="text-[12px] text-[#8A80A8]">Cancel</button>
        <button onClick={() => onApply({ min: min ? Number(min) : null, max: max ? Number(max) : null })}
          className="rounded bg-[#403770] px-3 py-1 text-[12px] text-white">Apply</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write DateRangeWidget tests**

Cover: (a) relative chips set value to current-period; (b) custom from–to inputs work independently; (c) Apply emits a filter-tree-compatible value.

- [ ] **Step 4: Implement DateRangeWidget**

Use native `<input type="date">` for the custom range. Relative chips compute now-7d, now-30d, etc. Emit `{ kind: "within", value: "30 days" }` style for relative, or `{ from, to }` for custom — match the filter-tree spec for `within` / `before` ops.

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/features/views/components/grid/widgets/__tests__`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/views/components/grid/widgets/NumberRangeWidget.tsx \
        src/features/views/components/grid/widgets/DateRangeWidget.tsx \
        src/features/views/components/grid/widgets/__tests__
git commit -m "feat(grid): NumberRangeWidget + DateRangeWidget"
```

---

### Task B5: `ToggleWidget` + `SelectWidget` + `TextWidget`

**Files:** three widgets + their tests in `widgets/__tests__/`.

- [ ] **Step 1: Implement ToggleWidget**

Segmented control with two buttons (e.g., "Yes" / "No"). One-click apply (no Apply button — toggles commit immediately).

- [ ] **Step 2: Implement SelectWidget**

Single-value dropdown. Static `values` or `enumSource` like MultiSelect.

- [ ] **Step 3: Implement TextWidget**

Debounced (300ms) input. Single Apply on debounce. Only used for `contains` filters.

- [ ] **Step 4: Tests for each**

One test file per widget, covering selection + value emission.

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/features/views/components/grid/widgets/__tests__`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/views/components/grid/widgets/{ToggleWidget,SelectWidget,TextWidget}.tsx \
        src/features/views/components/grid/widgets/__tests__/{Toggle,Select,Text}Widget.test.tsx
git commit -m "feat(grid): ToggleWidget + SelectWidget + TextWidget"
```

---

### Task B6: `GridFilterChips` + `FilterFieldPicker`

**Files:**
- Create: `src/features/views/components/grid/GridFilterChips.tsx`
- Create: `src/features/views/components/grid/FilterFieldPicker.tsx`
- Paired tests in `__tests__/`.

- [ ] **Step 1: Define chip render shape**

Each chip = `{ fieldId, op, displayValue }`. Click the body → reopen the widget. Click `×` → remove from `layout.filters.children`.

- [ ] **Step 2: Write tests**

Cover: (a) chips render the active filter list from `layout.filters.children`; (b) `+ Filter` shows the field picker; (c) selecting a field opens the right widget; (d) widget Apply adds to filters; (e) chip `×` removes the filter; (f) "Clear all" empties `layout.filters.children`.

- [ ] **Step 3: Implement `FilterFieldPicker`**

Popover listing every column where `filterWidget !== null`, grouped by source if needed. Click → calls back with `{columnId}` so the parent can mount the right widget.

- [ ] **Step 4: Implement `GridFilterChips`**

Row of pills + `+ Filter` button + "Clear all" link. Horizontal scroll on narrow viewport (`overflow-x-auto`, `whitespace-nowrap` on each chip span).

- [ ] **Step 5: Wire into GridView's header area**

GridView renders `<GridFilterChips layout={layout} onChange={setLayout} source={source} />` above the table.

- [ ] **Step 6: Run tests, confirm pass + check narrow-width**

Run: `npx vitest run src/features/views/components/grid/__tests__`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/views/components/grid/{GridFilterChips,FilterFieldPicker}.tsx \
        src/features/views/components/grid/__tests__/{GridFilterChips,FilterFieldPicker}.test.tsx \
        src/features/views/components/grid/GridView.tsx
git commit -m "feat(grid): filter chips + field picker wired into GridView"
```

---

### Task B7: `GridColumnMenu` (gear icon → visibility / reorder / reset)

**Files:**
- Create: `src/features/views/components/grid/GridColumnMenu.tsx`
- Create: `src/features/views/components/grid/__tests__/GridColumnMenu.test.tsx`

- [ ] **Step 1: Write tests**

Cover: (a) gear opens popover; (b) checkbox toggles `column.visible`; (c) drag-to-reorder updates `column.order` (for v1, two up/down buttons on each row are fine if @dnd-kit isn't already present); (d) "Reset to defaults" call sets layout to defaults from registry.

- [ ] **Step 2: Implement**

Popover anchored to the gear icon. Body = list of columns from `SOURCE_COLUMNS[source]`, each row showing checkbox + label + up/down arrows. Footer = "Reset to defaults" link.

Use `getDefaultLayoutColumns(source)` from `columns.ts` for the reset action.

- [ ] **Step 3: Wire into view-tabs strip**

In `GroupCanvas.tsx` (or wherever the view-tabs strip lives), add the gear icon at the right end. Render `<GridColumnMenu />` adjacent to existing search/share/save actions only when the active view is one of the six grid-using view types.

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/features/views/components/grid/__tests__/GridColumnMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/GridColumnMenu.tsx \
        src/features/views/components/grid/__tests__/GridColumnMenu.test.tsx \
        src/features/views/components/GroupCanvas.tsx
git commit -m "feat(grid): GridColumnMenu — column visibility + reorder + reset"
```

---

### Task B8: `useGridLayout` hook with debounced auto-save

**Files:**
- Create: `src/features/views/hooks/useGridLayout.ts`
- Create: `src/features/views/hooks/__tests__/useGridLayout.test.tsx`
- Modify: `src/features/views/lib/queries.ts` (`+useUpdatePlanLayout`, `+useUpdateListLayout`)

- [ ] **Step 1: Write tests**

Cover: (a) returns default layout when parent has no saved layout; (b) `setLayout` debounces at 500ms then PATCHes; (c) consecutive setLayout calls within 500ms collapse to one PATCH; (d) PATCH error rolls back optimistic update.

- [ ] **Step 2: Implement the mutation hooks**

In `queries.ts`:

```ts
export function useUpdatePlanLayout(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (viewLayouts: ViewLayouts) =>
      fetchJson(`${API_BASE}/territory-plans/${planId}`, { method: "PATCH", body: JSON.stringify({ viewLayouts }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["views", "plans"] }),
  });
}
// same shape for useUpdateListLayout(listId)
```

- [ ] **Step 3: Implement `useGridLayout`**

```ts
// src/features/views/hooks/useGridLayout.ts
import { useEffect, useRef, useState } from "react";
import { getDefaultLayoutColumns } from "@/features/views/lib/columns";
import { useUpdatePlanLayout, useUpdateListLayout, usePlan, useList } from "@/features/views/lib/queries";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { GridViewLayout, ViewLayouts } from "@/lib/saved-views/grid-layout-schema";

export function useGridLayout(
  parentKind: "plan" | "list",
  parentId: string,
  viewType: keyof NonNullable<ViewLayouts>,
  source: SavedListSource,
) {
  const planQ = usePlan(parentKind === "plan" ? parentId : null);
  const listQ = useList(parentKind === "list" ? parentId : null);
  const parent = parentKind === "plan" ? planQ.data : listQ.data;

  const planM = useUpdatePlanLayout(parentKind === "plan" ? parentId : "");
  const listM = useUpdateListLayout(parentKind === "list" ? parentId : "");

  const saved = (parent?.viewLayouts as ViewLayouts | null)?.[viewType] ?? null;
  const defaultLayout: GridViewLayout = saved ?? {
    columns: getDefaultLayoutColumns(source),
    sort: [],
    filters: { kind: "and", children: [] },
  };

  const [layout, setLayoutState] = useState<GridViewLayout>(defaultLayout);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hydrate when server data arrives
  useEffect(() => { if (saved) setLayoutState(saved); }, [JSON.stringify(saved)]);

  const setLayout = (next: GridViewLayout) => {
    setLayoutState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const merged: ViewLayouts = { ...(parent?.viewLayouts as ViewLayouts), [viewType]: next };
      if (parentKind === "plan") planM.mutate(merged);
      else listM.mutate(merged);
    }, 500);
  };

  // cleanup on unmount per CLAUDE.md
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { layout, setLayout };
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/features/views/hooks/__tests__/useGridLayout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/hooks/useGridLayout.ts \
        src/features/views/hooks/__tests__/useGridLayout.test.tsx \
        src/features/views/lib/queries.ts
git commit -m "feat(grid): useGridLayout hook with debounced auto-save"
```

---

## Phase C — Districts Grid (Proof)

### Task C1: Replace existing TableView body with GridView

**Files:**
- Modify: `src/features/views/components/views/TableView.tsx`

- [ ] **Step 1: Replace body**

Delete the existing Row/table markup. New body:

```tsx
import GridView from "../grid/GridView";
import type { ViewBodyProps } from "./_shared";

export default function TableView({ leaids, parentKind, parentId }: ViewBodyProps) {
  return (
    <GridView
      source="districts"
      leaids={leaids}
      listId={null}
      parentKind={parentKind}
      parentId={parentId}
      viewType="table"
    />
  );
}
```

(Ensure `_shared.tsx` exports a `ViewBodyProps` type that includes `parentKind` and `parentId` — add it if not present, and thread the values from `GroupCanvas` down to the view bodies.)

- [ ] **Step 2: Update GroupCanvas to pass parentKind / parentId**

Open `src/features/views/components/GroupCanvas.tsx`. Find where the active view body is rendered. Pass `parentKind` and `parentId` props.

- [ ] **Step 3: Run dev server**

Run: `npm run dev`. Navigate to `/views/plans/<planId>` and switch to the Table view.

Expected: same default columns render as before, but click-sort on headers works and the filter chip row is empty with a `+ Filter` button.

- [ ] **Step 4: Run the existing TableView test**

Run: `npx vitest run src/features/views/components/views/__tests__/TableView.test.tsx` (if it exists). Update mocks / expectations if the old presentational tests reference the deleted markup.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/views/TableView.tsx \
        src/features/views/components/views/_shared.tsx \
        src/features/views/components/GroupCanvas.tsx \
        src/features/views/components/views/__tests__/TableView.test.tsx
git commit -m "feat(grid): wire GridView into Districts/Table view"
```

---

### Task C2: End-to-end persistence test

**Files:**
- Create: `src/features/views/components/grid/__tests__/GridView.e2e.test.tsx`

- [ ] **Step 1: Write the e2e test**

Mount the full `<GridView source="districts" parentKind="plan" parentId="p1" …/>` in a TanStack QueryClientProvider, with `useViewsData` and the plan PATCH mutation mocked. Steps:

1. Mock initial plan fetch returns no `viewLayouts`.
2. Render — assert default columns.
3. Open `+ Filter`, pick "State", select "NY", Apply.
4. Wait 600ms.
5. Assert `useUpdatePlanLayout` mutation was called once with `viewLayouts.table.filters.children` containing the NY rule.
6. Assert `useViewsData` was re-called with the new filters in the query key.

- [ ] **Step 2: Run, confirm pass**

Run: `npx vitest run src/features/views/components/grid/__tests__/GridView.e2e.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/views/components/grid/__tests__/GridView.e2e.test.tsx
git commit -m "test(grid): end-to-end filter → debounced save → refetch"
```

---

## Phase D — Roll Out to Other Entity Views

Each task in this phase is identical in shape: replace the entity-specific table body with `<GridView source="X" />`. Code template repeated below so the engineer can read tasks out of order.

### Task D1: Contacts grid

**Files:**
- Modify: `src/features/views/components/views/ContactsView.tsx`

- [ ] **Step 1: Replace body**

```tsx
import GridView from "../grid/GridView";
import type { ViewBodyProps } from "./_shared";

export default function ContactsView({ leaids, parentKind, parentId }: ViewBodyProps) {
  return <GridView source="contacts" leaids={leaids} listId={null} parentKind={parentKind} parentId={parentId} viewType="contacts" />;
}
```

- [ ] **Step 2: Smoke test in browser + update existing ContactsView test**

- [ ] **Step 3: Commit**

```bash
git add src/features/views/components/views/ContactsView.tsx \
        src/features/views/components/views/__tests__/ContactsView.test.tsx
git commit -m "feat(grid): wire GridView into Contacts view"
```

### Task D2: Opps grid

Identical pattern with `source="opps"`, `viewType="opps"`. Commit message: `feat(grid): wire GridView into Opps view`.

### Task D3: Vacancies grid

`source="vacancies"`, `viewType="vacancies"`. Commit: `feat(grid): wire GridView into Vacancies view`.

### Task D4: RFPs grid

`source="rfps"`, `viewType="rfps"`. Commit: `feat(grid): wire GridView into RFPs view`.

### Task D5: News cards/table toggle + GridView

**Files:**
- Modify: `src/features/views/components/views/NewsView.tsx`

- [ ] **Step 1: Add toggle state**

Local component state `viewMode: "cards" | "table"`, default `"cards"`. Persisted to `viewLayouts.news.mode` via the layout hook? Simpler: add a `mode` field to the news GridViewLayout and persist it as part of the saved layout. Update `gridLayoutSchema` for `news` to include `mode: z.enum(["cards","table"]).default("cards")`.

- [ ] **Step 2: Render**

```tsx
{layout.mode === "cards"
  ? <NewsCards leaids={leaids} />
  : <GridView source="news" leaids={leaids} listId={null} parentKind={parentKind} parentId={parentId} viewType="news" />}
```

Toggle UI: a small `[cards | table]` segmented control next to the column gear in the view-tabs strip, visible only when active view is `news`.

- [ ] **Step 3: Update tests + commit**

```bash
git add src/features/views/components/views/NewsView.tsx \
        src/lib/saved-views/grid-layout-schema.ts \
        src/lib/saved-views/__tests__/grid-layout-schema.test.ts \
        src/features/views/components/views/__tests__/NewsView.test.tsx
git commit -m "feat(grid): news view-as-cards|table toggle + grid path"
```

---

## Phase E — Polish (deferable; ship A–D first)

### Task E1: Column resize handles

**Files:** `src/features/views/components/grid/GridHeaderCell.tsx`, `GridView.tsx`, paired tests.

- [ ] **Step 1: Add a resize handle to each header cell**

Right-edge 4px-wide invisible drag region. On mousedown, capture pointer and track delta. On release, fire `onWidthChange(newWidth)`. Min 60px, max 600px.

- [ ] **Step 2: Persist width**

Update `column.width` in the layout on commit. Debounced save through `useGridLayout`.

- [ ] **Step 3: Test + commit**

Commit: `feat(grid): column resize handles`.

### Task E2: Column drag-to-reorder

**Files:** `GridColumnMenu.tsx`, possibly install `@dnd-kit/sortable` if not present.

- [ ] **Step 1: Replace up/down arrows with drag handles**

If `@dnd-kit/sortable` isn't in `package.json`, add it: `npm i @dnd-kit/sortable @dnd-kit/core`. Wrap the column list in `SortableContext`, each row in `useSortable`.

- [ ] **Step 2: Persist order**

On drag-end, update `column.order` for every row to match the new visual order.

- [ ] **Step 3: Test + commit**

Commit: `feat(grid): column drag-to-reorder in column menu`.

### Task E3: Shift-click multi-sort

**Files:** `GridHeaderCell.tsx`, `GridView.tsx`.

- [ ] **Step 1: Accept `event.shiftKey` in `onSortChange`**

When shift is held, add (or remove) the column from the existing sort list instead of replacing.

- [ ] **Step 2: Show numeric badge on each sorted header**

`1`, `2`, `3` next to the sort arrow indicating sort precedence.

- [ ] **Step 3: Test + commit**

Commit: `feat(grid): shift-click multi-sort`.

### Task E4: Filtered-empty + filtered-error states

**Files:** `GridView.tsx`, new state components.

- [ ] **Step 1: Differentiate empty states**

When `layout.filters.children.length > 0` and 0 rows, show "No rows match the active filters" with a "Clear filters" button. When `truncated: true`, show "Result too large — narrow your filters" banner above the rows that did return.

- [ ] **Step 2: Test + commit**

Commit: `feat(grid): filtered-empty + truncated banners`.

### Task E5: Mobile pass

**Files:** `GridView.tsx`, `GridFilterChips.tsx`, `GridColumnMenu.tsx`.

- [ ] **Step 1: Verify on Safari Responsive Design Mode**

Run dev server, open `/views/plans/<id>` in Safari Responsive Mode at iPhone 14 width. Check:
- Filter chip row scrolls horizontally without breaking the layout.
- Column gear popover has `maxWidth: calc(100vw - 16px)`.
- No `overflow: hidden` on html/body (per CLAUDE.md mobile rules).
- Table itself scrolls horizontally without breaking map gestures in Map view.

- [ ] **Step 2: Fix any issues found, add missing `whitespace-nowrap` to text spans, paginate filter widgets if needed**

- [ ] **Step 3: Smoke-test on real iPhone**

Per CLAUDE.md: navigate to `http://a-arcega.local:3005/views/plans/<id>` after starting `npm run dev`. Touch sort, open the filter chip row, drag-scroll, open column menu, drag a column. Smoke-test the Map tab to confirm no regression.

- [ ] **Step 4: Commit**

Commit: `feat(grid): mobile audit + narrow-width fixes`.

---

## Self-Review

Walking through the spec § Requirements vs the plan:

- [x] **viewLayouts JSONB on plan + list** — Task A1.
- [x] **SOURCE_COLUMNS registry covering all 6 sources** — Task A2.
- [x] **Zod validation for viewLayouts + extend plan/list PATCH** — Task A3.
- [x] **buildOrderBy in sql-compiler with NULLS LAST + identifier defense** — Task A4.
- [x] **GET /api/views/data with auth, source/sort/filter/scope validation, statement-timeout handling** — Task A5.
- [x] **GET /api/views/enum-values** — Task A6.
- [x] **GridView, GridHeaderCell, filter widgets, chips, column menu** — Tasks B1–B7.
- [x] **useGridLayout with debounced auto-save (500ms)** — Task B8.
- [x] **Wire into all 6 entity views including News cards/table toggle** — Tasks C1, D1–D5.
- [x] **Polish: resize, reorder, multi-sort, empty states, mobile pass** — Tasks E1–E5.
- [x] **TanStack Query keys serialized to primitives** — built into useViewsData (Task B1).
- [x] **Zustand narrow selectors** — noted in B1; no broad store subscriptions in plan.
- [x] **Read-only pool + 5s statement_timeout truncated path** — Task A5 implementation + tests.
- [x] **Tests co-located in __tests__/** — every task creates the test alongside the source.
- [x] **No SQL injection** — column names from allowlist, values bound as $N, identifier regex defense — Task A4 implementation matches existing compiler discipline.

No spec requirement is left uncovered. No placeholders (the `<timestamp>` in the migration path is intrinsic — Prisma generates it). Type/method names are consistent: `setLayout`, `useGridLayout`, `useViewsData`, `useEnumValues`, `buildOrderBy`, `SOURCE_COLUMNS`, `getDefaultLayoutColumns`, `lookupColumn`, `gridLayoutSchema`, `viewLayoutsSchema` all referenced consistently across tasks.
