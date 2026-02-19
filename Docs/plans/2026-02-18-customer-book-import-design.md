# Customer Book CSV Import — Design

**Date:** 2026-02-18
**Status:** Approved

## Goal

Import ~970 district rows from a Customer Book Consolidation CSV into the database: create missing districts, create/match territory plans by name + fiscal year, set per-district targets (renewal, expansion, winback, new business), and update FY27 pipeline on the district record.

## CSV Structure

| Column | Field | Example |
|--------|-------|---------|
| A | Account (district name) | "Aldine Independent School District" |
| B | LEA ID (primary key) | "4807710" |
| C | State abbreviation | "TX" |
| D | Territory Plan Name | "Texas 2027" |
| E | Fiscal Year | 2027 |
| F | District Owner (sales rep) | "Liz Winnen" |
| G | Company (ignored) | "EK12" |
| H | Renewal Target | "$1,080,674.00" |
| I | Expansion Target | "$100,000.00" |
| J | Win Back Target | "$0.00" |
| K | New Business Target | "$0.00" |
| L | FY27 Open Pipeline | "$825,000.00" |

Row 1 is a summary/totals row (skipped). Row 2 is headers. Data starts at row 3.

## Approach

TypeScript seed script (`scripts/import-customer-book.ts`) using Prisma client directly. Run with `npx tsx scripts/import-customer-book.ts`.

## Data Flow

```
CSV file
  → Parse rows (skip row 1 summary + row 2 headers)
  → Parse dollar strings → numbers ("$1,234.56" → 1234.56)

For each unique plan name + FY:
  → Find existing plan by name + fiscalYear
  → If not found, create it (with TerritoryPlanState link)

For each row:
  → Check if district exists by LEA ID
  → If not, create minimal district (leaid, name, stateFips, accountType)
  → Set district.owner if CSV has one and district.owner is currently null
  → Upsert TerritoryPlanDistrict with the 4 target values
  → Update district.fy27OpenPipeline if CSV value > 0

Print summary: plans created/matched, districts created, targets set, pipeline updated
```

## Key Decisions

| Decision | Choice |
|----------|--------|
| Plan matching | By `name` + `fiscalYear` — find existing or create new |
| District creation | Minimal record (leaid, name, stateFips, accountType="district") |
| Target handling | Upsert — overwrite existing targets |
| FY27 pipeline | Update `fy27OpenPipeline` on district if CSV value > 0 |
| District owner | Set `owner` if CSV has a value AND district's current `owner` is null |
| Company column | Ignored |
| State linking | Auto-link plan to state via TerritoryPlanState when creating new plan |

## Dollar Parsing

CSV has values like `"$1,080,674.00"`, `$0.00`, `"$200,000"` (no decimals). The parser strips `$`, commas, and quotes, then parses to a float. Values of 0 are stored as `0` for targets, and skipped for pipeline updates.

## State Resolution

CSV has state abbreviations (e.g., "IN", "TX"). The script queries the `states` table once at startup to build an `abbrev → fips` lookup map, since districts and plan-state links require `stateFips`.

## Error Handling

- Log and skip rows with invalid/missing LEA ID
- Log rows where state abbreviation doesn't match any known state
- Continue processing remaining rows (don't fail the whole import on one bad row)
- Print a final error summary with counts

## Out of Scope

- UI for CSV upload (future consideration)
- Enrichment of newly created districts (enrollment, geometry, etc. — handled by existing ETL)
- Auto-tag sync (can be run separately via `seed-auto-tags.ts`)
- Service category assignments (return vs new services per district)
