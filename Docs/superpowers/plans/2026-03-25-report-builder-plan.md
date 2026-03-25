# Implementation Plan: Report Builder

**Date:** 2026-03-25
**Spec:** `docs/superpowers/specs/2026-03-25-report-builder-spec.md`
**Backend Context:** `docs/superpowers/specs/2026-03-25-report-builder-backend-context.md`
**Branch:** worktree-report-builder

---

## Phase 1: Backend Foundation (no frontend dependency)

### Task 1.1: Database Schema — SavedReport Model

**Files:** `prisma/schema.prisma`

- Add `SavedReport` model with fields: id (uuid), name, source, config (Json), createdBy, createdAt, updatedAt, sharedWith (String[])
- Add relation to `UserProfile` model
- Run `npx prisma db push` to sync schema (dev environment)
- Run `npx prisma generate` to update client types

### Task 1.2: Field Maps for All Entities

**Files:** `src/features/reports/lib/field-maps.ts` (new)

Create field maps for all entities, extending the existing pattern from `explore/lib/filters.ts`:
- Export `ENTITY_FIELD_MAPS: Record<string, Record<string, string>>` containing maps for: districts (import existing), plans (import existing), opportunities, activities, contacts, schools, tasks, states, vendorFinancials, sessions
- Export `ENTITY_LABELS: Record<string, string>` for display names
- Export `getEntityFieldMap(entity: string)` helper
- Each map covers: key columns for that entity (not exhaustive — the important/useful ones)

### Task 1.3: Schema API

**Files:** `src/app/api/reports/schema/route.ts` (new)

- `GET /api/reports/schema` — returns `{ entities: [{ name, label, columns: [{ key, label, type }] }] }`
- Auth: `getUser()` check
- Reads from `ENTITY_FIELD_MAPS` + derives column types from Prisma schema metadata or hardcoded type annotations in the field maps
- Add column type hints to field maps: `{ prismaField, type: 'string' | 'number' | 'boolean' | 'date' }` for filter UI

### Task 1.4: Query API

**Files:** `src/app/api/reports/query/route.ts` (new)

- `POST /api/reports/query` — accepts `{ source, columns, filters, sorts, page, pageSize }`
- Auth: `getUser()` check
- Validates `source` against known entity names
- Uses `buildWhereClause` from explore filters with appropriate field map
- Uses Prisma `findMany` with dynamic `select`, `where`, `orderBy`, `skip`, `take`
- Returns `{ data: Record<string, unknown>[], pagination: { page, pageSize, total } }`
- Handles Decimal/Date serialization

### Task 1.5: Export API

**Files:** `src/app/api/reports/export/route.ts` (new)

- `POST /api/reports/export` — same body as query API
- Runs the query without pagination (or with a large limit like 10,000)
- Converts results to CSV string
- Returns with `Content-Type: text/csv` and `Content-Disposition: attachment` headers

### Task 1.6: CRUD API for Saved Reports

**Files:** `src/app/api/reports/route.ts` (new), `src/app/api/reports/[id]/route.ts` (new), `src/app/api/reports/[id]/share/route.ts` (new)

- `GET /api/reports` — list reports where `createdBy = user.id OR sharedWith contains user.id`
- `POST /api/reports` — create report (name, source, config)
- `GET /api/reports/[id]` — load single report (auth check: owner or shared)
- `PUT /api/reports/[id]` — update report (owner only)
- `DELETE /api/reports/[id]` — delete report (owner only)
- `POST /api/reports/[id]/share` — update sharedWith array

**Tests for Phase 1:** Unit tests for field maps, integration tests for API routes using Vitest

---

## Phase 2: Frontend — Query Hooks & Types (no UI dependency)

### Task 2.1: Types

**Files:** `src/features/reports/lib/types.ts` (new)

- `ReportConfig`: `{ source, columns, filters, sorts, page, pageSize }`
- `ReportSchema`: `{ entities: EntitySchema[] }`
- `EntitySchema`: `{ name, label, columns: ColumnSchema[] }`
- `ColumnSchema`: `{ key, label, type }`
- `SavedReport`: `{ id, name, source, config, createdBy, createdAt, updatedAt, sharedWith }`
- Re-export `FilterDef`, `FilterOp` from explore

### Task 2.2: TanStack Query Hooks

**Files:** `src/features/reports/lib/queries.ts` (new)

- `useReportSchema()` — fetches schema, staleTime: 10min
- `useReportQuery(config)` — fetches query results, enabled when source + columns are set
- `useSavedReports()` — list saved reports
- `useSavedReport(id)` — load single report
- `useSaveReportMutation()` — create/update report
- `useDeleteReportMutation()` — delete report
- `useShareReportMutation()` — share report
- `useExportReport()` — trigger CSV download (not a query — a mutation that downloads)

---

## Phase 3: Frontend — UI Components

### Task 3.1: Navigation Integration

**Files:** `src/features/shared/components/navigation/Sidebar.tsx`, `src/features/shared/components/layout/AppShell.tsx` (or parent view router)

- Add `"reports"` to `TabId` type union
- Add Reports tab to `MAIN_TABS` (after "progress", before "resources") with a bar-chart icon
- Update AppShell or parent view router to render `ReportsView` when `activeTab === "reports"`

### Task 3.2: ReportsView (List + Router)

**Files:** `src/features/reports/components/ReportsView.tsx` (new)

- If no report selected → show `ReportsList`
- If report selected (new or saved) → show `ReportBuilder`
- "New Report" button creates a blank config and enters builder
- URL state or local state for active report ID

### Task 3.3: ReportsList

**Files:** `src/features/reports/components/ReportsList.tsx` (new)

- Fetches `useSavedReports()`
- Card or table layout showing: name, source entity, last modified date, owner
- Click to open in builder
- Delete button with confirmation
- Empty state: illustration + "Create your first report" CTA

### Task 3.4: ReportConfigBar

**Files:** `src/features/reports/components/ReportConfigBar.tsx` (new)

- Container for the 3 config rows
- **Row 1:** SourceSelector + editable report name + Save/Share/Export buttons
- **Row 2:** ColumnPicker
- **Row 3:** FilterBuilder
- Manages the `ReportConfig` state and passes it down / lifts changes up

### Task 3.5: SourceSelector

**Files:** `src/features/reports/components/SourceSelector.tsx` (new)

- Dropdown listing all entities from `useReportSchema()`
- On change: resets columns and filters (since fields change)
- Shows entity label (e.g., "Districts", "Opportunities")

### Task 3.6: ColumnPicker

**Files:** `src/features/reports/components/ColumnPicker.tsx` (new)

- Shows selected columns as removable pills
- "+ Column" button opens a dropdown/popover of available columns for the selected source
- Columns are searchable in the dropdown
- Drag-to-reorder pills (nice-to-have, skip if complex)

### Task 3.7: FilterBuilder + FilterPill

**Files:** `src/features/reports/components/FilterBuilder.tsx` (new), `src/features/reports/components/FilterPill.tsx` (new)

- Shows active filters as removable pills (format: `column op value ×`)
- "+ Add Filter" opens a popover with:
  1. Column dropdown (from available columns for source)
  2. Operator dropdown (contextual — numbers get gt/lt/between, strings get contains/eq)
  3. Value input (text, number, or select depending on column type)
- FilterPill renders a single filter with remove button

### Task 3.8: ShareModal

**Files:** `src/features/reports/components/ShareModal.tsx` (new)

- Modal with user search/select
- Shows currently shared users with remove option
- Uses `useShareReportMutation()`

### Task 3.9: ReportBuilder (Main Page)

**Files:** `src/features/reports/components/ReportBuilder.tsx` (new)

- Composes: `ReportConfigBar` + `DataGrid`
- Manages `ReportConfig` state (source, columns, filters, sorts, page, pageSize)
- Passes config to `useReportQuery()` for data
- Passes data + config to `DataGrid` for rendering
- Handles save (calls `useSaveReportMutation`)
- Handles export (calls `useExportReport`)

---

## Phase 4: Integration & Polish

### Task 4.1: Home Dashboard Entry Point

**Files:** `src/features/home/components/HomeView.tsx` (or relevant home component)

- Add a "Reports" card/section that links to the reports tab
- Shows count of saved reports or recent reports

### Task 4.2: Loading, Empty, and Error States

- Verify all states render correctly:
  - Schema loading → skeleton source selector
  - Query loading → DataGrid skeleton rows
  - No results → DataGrid empty state
  - No saved reports → custom empty state with CTA
  - API errors → DataGrid error state or inline banner

### Task 4.3: Tests

- Component tests for ReportConfigBar, SourceSelector, ColumnPicker, FilterBuilder
- Integration test: build a query config → verify API call → verify DataGrid renders results
- Hook tests for query hooks

---

## Task Dependencies

```
1.1 (schema) ──→ 1.2 (field maps) ──→ 1.3 (schema API) ──→ 2.2 (hooks)
                                   ──→ 1.4 (query API)  ──→ 2.2 (hooks)
                                   ──→ 1.5 (export API) ──→ 2.2 (hooks)
                       1.6 (CRUD API) ──→ 2.2 (hooks)
                                          2.1 (types) ──→ 2.2 (hooks)

Phase 1 + 2 complete ──→ Phase 3 (all UI tasks)
Phase 3 complete ──→ Phase 4 (integration & polish)

Within Phase 3:
3.1 (nav) ──→ 3.2 (view) ──→ 3.3 (list)
3.5 (source) + 3.6 (columns) + 3.7 (filters) ──→ 3.4 (config bar) ──→ 3.9 (builder)
3.8 (share modal) independent until wired in 3.9
```

## Parallelization Opportunities

- **Phase 1:** Tasks 1.2–1.6 can largely be done in parallel after 1.1
- **Phase 2:** Tasks 2.1 and 2.2 can be done together
- **Phase 3:** Tasks 3.5, 3.6, 3.7, 3.8 are independent and can be parallelized
- **Backend + Frontend types:** Phase 1 + 2 can be dispatched together since types don't depend on running APIs
