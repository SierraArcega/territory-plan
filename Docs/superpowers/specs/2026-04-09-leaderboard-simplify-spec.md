# Leaderboard Simplification Spec

**Date:** 2026-04-09
**Branch:** `feat/leaderboard-simplify`
**Approach:** Refactor LeaderboardModal in-place (Approach A)

## Goal

Replace the current 6-tab points-driven leaderboard with a simplified 2-tab structure that prioritizes real revenue figures over gamified initiative points.

## Tab Structure

### Tab 1: Revenue Overview (default)

The new default view. Shows dollar-based performance metrics ranked by current year revenue.

**Top 3 Podium:**
- Cards for ranks 1-3 in classic 2-1-3 layout (winner centered and raised)
- Gold (#1), silver (#2), bronze (#3) visual treatment
- Each card shows: rank, avatar/initials, rep name, current year revenue
- Podium sits above the table

**Table Columns:**
| Column | Description | Default Sort |
|--------|-------------|:---:|
| # | Rank | — |
| Rep | Avatar + full name | — |
| Current Revenue | Revenue closed in current fiscal year | **Yes (desc)** |
| Prior Year Closed | Realized revenue from previous fiscal year | — |
| Pipeline | Total open pipeline value in current fiscal year | — |
| Targeted | Sum of territory plan revenue targets for current FY and following FY combined | — |

**Behaviors:**
- Default sort: Current Revenue descending
- All column headers are clickable to re-sort
- Rank numbers update dynamically when sort column changes
- No tier badges on this tab
- Currency formatting with `$` prefix and comma separators (e.g., `$961,964`)
- Tabular numeric font variant for alignment

**Data Sources:**
- Current Revenue: `getRepActuals(email, currentFY)` → `totalRevenue`
- Prior Year Closed: `getRepActuals(email, priorFY)` → `totalRevenue`
- Pipeline: `getRepActuals(email, currentFY)` → `openPipeline`
- Targeted: Sum of `TerritoryPlanDistrict` targets (renewalTarget + winbackTarget + expansionTarget + newBusinessTarget) across current and next FY plans

### Tab 2: Initiative

Contains the existing points/tier leaderboard system, moved from its current default position. All existing functionality is preserved:

- Combined, Initiative, Pipeline, Take, Revenue, Targeted sub-views become sub-tabs within this tab
- Tier badges (Freshman, Honor Roll, Dean's List, Valedictorian) appear here only
- Expandable rows with point breakdowns
- All existing scoring logic unchanged

## Components

### New Components

**`RevenueOverviewTab.tsx`** (`src/features/leaderboard/components/`)
- Orchestrates the Revenue Overview tab
- Fetches data via existing `/api/leaderboard` endpoint (already returns revenue data)
- Manages sort state (column + direction)
- Renders podium + table

**`RevenuePodium.tsx`** (`src/features/leaderboard/components/`)
- Renders top 3 cards in 2-1-3 layout
- Props: top 3 entries with name, avatar, current revenue
- Gold/silver/bronze styling

**`RevenueTable.tsx`** (`src/features/leaderboard/components/`)
- Sortable table with the 4 revenue columns
- Props: sorted entries array, current sort config, onSort callback
- All reps appear in the table including top 3 (matches spreadsheet mental model — podium is celebratory, table is the full data)

### Modified Components

**`LeaderboardModal.tsx`**
- Replace 6-tab array with 2-tab array: ["Revenue Overview", "Initiative"]
- Tab 0 renders `<RevenueOverviewTab />`
- Tab 1 renders existing modal content (Combined/Initiative/Pipeline/Take/Revenue/Targeted as nested sub-tabs)
- Default active tab: 0 (Revenue Overview)

**`LeaderboardDetailView.tsx`**
- Update to use 2-tab structure matching the modal
- Revenue Overview as default view

### Unchanged Components

- `LeaderboardHomeWidget.tsx` — still opens modal, no changes needed
- `LeaderboardNavWidget.tsx` — still shows rank widget, no changes needed
- `RankTicker.tsx` — unchanged
- `TierBadge.tsx` — unchanged (only used in Initiative tab)
- All admin components — unchanged

## API

No new API endpoints needed. The existing `GET /api/leaderboard` already returns:
- `pipeline`, `take`, `revenue`, `revenueTargeted` per entry
- Initiative config with fiscal year settings

The only addition needed is **prior year revenue**, which requires a second call to `getRepActuals` with the previous fiscal year. This can be:
- Added to the existing `/api/leaderboard` response (preferred — one extra DB call server-side)
- Or fetched client-side as a separate query

**Recommended:** Add `priorYearRevenue` field to the leaderboard API response. Derive the prior FY from the initiative's `revenueFiscalYear` setting.

## Styling

- Fullmind brand tokens from `Documentation/UI Framework/tokens.md`
- Plum-derived neutrals (#F7F5FA, #EFEDF5) for backgrounds and borders
- Primary purple (#5B2E91) for active tab, sort indicators, and highlighted revenue column
- Podium: gold (#B8860B / #FFF9E6), silver (#808088 / #F5F5F7), bronze (#A0724E / #FDF5EE)
- Lucide icons only (e.g., ChevronDown for sort indicator)
- Tabular nums font-variant for money columns

## Out of Scope

- Granular New/Return/Completed/Scheduled drill-down (future "see more details" feature)
- Changes to scoring logic or tier calculations
- Admin configuration changes
- Changes to home widget or nav widget appearance
- Mobile-specific layout (existing responsive behavior carries over)
