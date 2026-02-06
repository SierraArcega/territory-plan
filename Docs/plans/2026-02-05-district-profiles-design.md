# District Profiles UX Design

## Goal

Add a "District Profiles" tab to the Data Reconciliation view that makes it easy for both leadership (visibility) and ops teams (investigation) to understand and act on data quality issues across district records.

## Data Source

- FastAPI endpoint: `GET /api/reconciliation/district-profiles` (already running)
- See `Docs/DISTRICT_PROFILES_API_SPEC.md` for full response structure
- Returns district-level profiles with opportunities, schools, sessions, courses, revenue totals, and data quality flags

## Layout

Third tab in the Data Reconciliation view, alongside "Unmatched Accounts" and "Account Fragmentation."

### Structure (top to bottom)

1. **Summary cards row** — 3 cards showing the big picture
2. **Filter bar** — state dropdown, status toggle, search box, CSV export
3. **Sortable table** with expandable rows

## Summary Cards (3 across)

| Card | Metric | Accent Color |
|------|--------|-------------|
| Orphaned Districts | Count where `is_orphaned: true` | Coral (#F37167) |
| Missing NCES | Count where `has_nces: false` | Yellow/amber |
| Total Districts | Total count in results | Steel Blue (#6EA3BE) |

Each card: label, big number, optional subtitle (e.g., "across 12 states"). Uses existing card pattern: `rounded-xl border border-gray-200`.

## Table

### Columns

| Column | Content |
|--------|---------|
| District Name | Name + state in smaller gray text below |
| District ID | The ID + red "Orphaned" pill badge if orphaned |
| NCES ID | The ID or yellow "Missing" pill if null |
| Schools | `schools.count` |
| Sessions | `sessions.count` |
| Opps | `opportunities.count` |
| Data Sources | Colored dots/pills for each type that references this ID |

### Default Sort

Entity count descending (biggest/messiest districts first).

### Filters

- **State dropdown** — populated from API results or `useStates()` hook
- **Status filter** — All / Orphaned Only / Valid Only
- **Search** — client-side filter by district name

## Expanded Row Detail

Clicking a row expands inline (same pattern as Account Fragmentation expandable rows).

### Left Side — Entity Breakdown

Compact grid:
```
Opportunities: 148    Schools: 47
Sessions: 29,886      Courses: 1,620
```
Under Schools: 2-3 sample school names in small gray text.

### Right Side — Data Quality Checklist

Vertical list with green checkmarks or red X marks:
- Has NCES ID
- Has State
- Has Opportunities
- Has Schools
- Has Sessions
- Is in District Index (not orphaned)

### Bottom — State Sources

Small line showing where state was sourced: "State from: district record, schools"

## Interactions

- **No action buttons in v1** — purpose is visibility and investigation
- **CSV Export** — download button in filter bar, exports current filtered view
- **Sortable columns** — click column headers to sort
- **Expandable rows** — click to show detail

## What This Does NOT Include (future iterations)

- Revenue cards/metrics
- Duplicate finder (grouping by normalized name + state)
- Migration planner (merge actions)
- Bulk operations
