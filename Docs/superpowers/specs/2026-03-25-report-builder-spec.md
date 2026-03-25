# Feature Spec: Report Builder

**Date:** 2026-03-25
**Slug:** report-builder
**Branch:** worktree-report-builder

## Requirements

- **Users:** Both sales reps (ad-hoc territory analysis) and leadership (recurring performance reports)
- **Data scope:** All Supabase/Prisma tables exposed as queryable data sources
- **Persistence:** Save reports, share with teammates, export to CSV
- **Visualizations:** Table only in v1 (charts deferred to v2)
- **Navigation:** Top-level "Reports" tab in sidebar + entry point on Home dashboard
- **Layout:** Full-page builder — stacked config rows on top, DataGrid results below

## Visual Design

### Approved Layout: Stacked Rows + DataGrid

```
┌──────────────────────────────────────────────────────────────┐
│ Source: [Districts ▼]  "Untitled Report"  [Save] [Share] [⬇] │
├──────────────────────────────────────────────────────────────┤
│ Columns: [name ×] [state ×] [enrollment ×]  [+ Column]      │
├──────────────────────────────────────────────────────────────┤
│ Filters: [state = NY ×] [enrollment > 1000 ×]  [+ Filter]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────┬───────┬───────────┬──────────┐                   │
│  │ Name   │ State │ Enrollment│ Pipeline │                   │
│  ├────────┼───────┼───────────┼──────────┤                   │
│  │ ...    │ ...   │ ...       │ ...      │                   │
│  └────────┴───────┴───────────┴──────────┘                   │
│  Showing 1–50 of 12,345              < Page 1 of 247 >      │
└──────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Extend the Explore pattern** — reuse `buildWhereClause`, `FilterDef`, field maps, and the `DataGrid` component
2. **Static field maps per entity** — extend the existing `DISTRICT_FIELD_MAP`/`PLANS_FIELD_MAP` pattern to cover all ~30 Prisma models
3. **New metadata API** — `GET /api/reports/schema` returns available tables and their columns (from field maps, not runtime introspection)
4. **Config-driven query** — frontend builds a query config object (`{ source, columns, filters, sorts, page, pageSize }`) and sends it to a generic query endpoint

## Component Plan

### Existing Components to Reuse

| Component | Path | Usage |
|-----------|------|-------|
| `DataGrid` | `src/features/shared/components/DataGrid/` | Results table with sorting, pagination, column reorder |
| `AppShell` | `src/features/shared/components/layout/AppShell.tsx` | Page shell (sidebar + content area) |
| `Sidebar` | `src/features/shared/components/navigation/Sidebar.tsx` | Add "Reports" tab |
| `buildWhereClause` | `src/features/explore/lib/filters.ts` | Filter → Prisma where clause conversion |
| `FilterDef` type | `src/features/explore/lib/filters.ts` | Filter definition type |
| `fetchJson` | `src/features/shared/lib/api-client.ts` | API call helper |
| `cn` | `src/features/shared/lib/cn.ts` | Tailwind class merging |

### New Components

| Component | Category | Description |
|-----------|----------|-------------|
| `ReportsView` | View | Top-level view rendered inside AppShell — report list or active report |
| `ReportBuilder` | Page | Main builder page with config rows + DataGrid |
| `ReportConfigBar` | Config | Container for the 3 config rows (source, columns, filters) |
| `SourceSelector` | Config | Dropdown to pick which table/entity to query |
| `ColumnPicker` | Config | Pill-based column selector with add/remove |
| `FilterBuilder` | Config | Row of active filter pills + "Add Filter" popover |
| `FilterPill` | Config | Single filter chip showing `column op value ×` |
| `ReportsList` | List | Saved reports list (name, source, last modified, actions) |
| `ShareModal` | Modal | Share report with teammates via link or user selection |

### Components to Extend

| Component | Change |
|-----------|--------|
| `Sidebar` | Add `"reports"` to `TabId` union and `MAIN_TABS` array |
| `AppShell` | Handle `"reports"` tab in content routing |

## Backend Design

### See: `docs/superpowers/specs/2026-03-25-report-builder-backend-context.md`

### New Database Model

```prisma
model SavedReport {
  id          String   @id @default(uuid())
  name        String
  source      String   // table/entity name (e.g., "districts", "opportunities")
  config      Json     // { columns, filters, sorts, pageSize }
  createdBy   String   // user ID
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  sharedWith  String[] // user IDs with access (empty = private)

  creator     UserProfile @relation(fields: [createdBy], references: [id])

  @@map("saved_reports")
}
```

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/reports/schema` | GET | Returns available tables + their columns (from field maps) |
| `/api/reports/query` | POST | Executes a report query (source, columns, filters, sorts, pagination) |
| `/api/reports/export` | POST | Runs query and returns CSV download |
| `/api/reports` | GET | List saved reports for current user (owned + shared) |
| `/api/reports` | POST | Create/save a new report |
| `/api/reports/[id]` | GET | Load a specific saved report |
| `/api/reports/[id]` | PUT | Update a saved report |
| `/api/reports/[id]` | DELETE | Delete a saved report |
| `/api/reports/[id]/share` | POST | Share a report with specific users |

### New Field Maps

Extend the field map pattern to cover all entities. Priority order:

1. **Districts** — already exists (155+ fields)
2. **Plans** — already exists (11 fields)
3. **Opportunities** — new (~15 fields: id, name, amount, stage, close date, etc.)
4. **Activities** — new (~12 fields: type, date, outcome, districts visited, etc.)
5. **Contacts** — new (~8 fields: name, title, email, district, persona)
6. **Schools** — new (~10 fields: name, district, Title I, FRPL, enrollment)
7. **Tasks** — new (~8 fields: title, status, priority, due date, assignee)
8. **States** — new (~10 fields: name, abbrev, enrollment, customer count, pipeline)
9. **VendorFinancials** — new (~10 fields: vendor, pipeline, bookings, revenue, take)
10. **Sessions** — new (~8 fields: service type, date, amount, opportunity)

Remaining entities (tags, services, calendar events, vacancies, etc.) can be added later.

## States

### Loading
- **Schema loading:** Skeleton dropdown for source selector, disabled columns/filters rows
- **Query loading:** DataGrid's built-in skeleton rows (5 rows with animated pulse bars)
- **Save/share:** Button spinner states

### Empty
- **No results:** DataGrid's built-in empty state ("No matching results" with clear filters button)
- **No saved reports:** Centered illustration + "Create your first report" CTA
- **No columns selected:** Prompt text "Select columns to display"

### Error
- **Schema fetch error:** Inline error banner above config with retry button
- **Query error:** DataGrid's built-in error state ("Something went wrong" with retry)
- **Save error:** Toast notification with error message

## Out of Scope

- Chart visualizations (v2)
- Scheduled/automated reports
- Cross-table joins or SQL mode
- Dashboard/block layout
- Aggregation functions (GROUP BY, SUM, AVG)
- Report templates or presets
- Report versioning/history
- Real-time collaboration
