# Admin Leaderboard Customization UI

**Date:** 2026-03-28
**Branch:** feat/seasonal-leaderboard (or feat/leaderboard-admin)
**Status:** Design approved

## Overview

An admin tab within the existing AdminDashboard for configuring the seasonal leaderboard system. Surfaces all tunable parameters that currently require seed scripts or database changes, giving admins full control over scoring, tiers, weights, visibility, and season lifecycle.

## Placement

New "Leaderboard" tab added to `ADMIN_SUB_ITEMS` in the sidebar navigation, rendered as a tab in `AdminDashboard.tsx` alongside Dashboard, Unmatched Opps, Users, Integrations, and Data Sync. Follows the existing lazy-loaded tab pattern with Suspense boundaries.

## Page Structure

Single scrollable page showing **only the active season's configuration**. Historical season data is exportable as CSV, not displayed on the page. Five collapsible sections, each with its own Save button that triggers a preview/confirm modal before applying.

### Section 1: Season Identity (expanded by default)

- **Season Name** — text field, decorative only (reusable across seasons, e.g. "Season of the Dragon")
- **Season UID** — timestamp-based unique identifier (`s_{unix_timestamp}`), auto-generated on creation, displayed but not editable
- **Start Date** — date picker
- **End Date** — date picker, nullable (ongoing seasons have no end date)
- **Status** — Active/Inactive badge (read-only, changed via lifecycle actions)
- **Visibility toggles:**
  - `showName` (boolean) — whether reps see the season name in leaderboard UI
  - `showDates` (boolean) — whether reps see start/end dates in leaderboard UI

### Section 2: Scoring Metrics (collapsed by default)

Subtitle shows count of active metrics and available actions (e.g. "3 active metrics · Add from 47 available actions").

**Add metric row:**
- Searchable dropdown of available actions, grouped by category (Plans, Activities, Tasks, Opportunities, Revenue, etc.) with descriptions
- Point value input (integer)
- Weight input (decimal, default 1.0×)
- Add button

**Active metrics table:**
Columns: Action (with category label), Label, Points (inline-editable), Weight (inline-editable), Remove (×).

**Metric registry:** Available actions come from a database table (`MetricRegistry`) that defines all possible trackable actions with their action key, label, description, and category. This decouples the available action list from hardcoded values.

**Guardrails:**
- New seasons default to 3 metrics: `plan_created`, `activity_logged`, `revenue_targeted`
- Adding a 6th metric triggers a confirmation dialog: "Add more than 5 metrics? More metrics can dilute scoring signals and make it harder for reps to understand what drives their rank." Admin can proceed or cancel.
- No hard upper cap enforced in UI (practical limit ~100 based on DB/UI performance)

**Scoring formula:** Effective points per action = `pointValue × weight`. The `awardPoints()` function multiplies these when incrementing `SeasonScore.totalPoints`.

### Section 3: Tier Thresholds (collapsed by default)

Visual cards for each tier, sorted highest to lowest:
- Valedictorian (gold gradient) — editable min points, current rep count
- Dean's List (indigo gradient) — editable min points, current rep count
- Honor Roll (teal gradient) — editable min points, current rep count
- Freshman (neutral) — always 0 pts, not editable

Each card shows the tier icon, name, number of reps currently in that tier, and an inline-editable point threshold.

### Section 4: Combined Score Weights (collapsed by default)

Three slider controls with numeric percentage display:
- **Season Points** — weight for season metric points (default 60%)
- **Pipeline** — weight for pipeline value (default 20%)
- **Take** — weight for take/revenue (default 20%)

**Validation:** Weights must sum to 100%. Live indicator shows current sum — green checkmark when valid, orange warning when invalid. Save button disabled until weights sum to 100%.

These values map directly to `Season.seasonWeight`, `Season.pipelineWeight`, `Season.takeWeight` and feed into `calculateCombinedScore()`.

### Section 5: Season Transition (collapsed by default)

- **Soft Reset Depth** — stepper control (0–3), determines how many tiers reps drop when a new season starts
- **Live preview** — shows tier transition mapping based on current depth value (e.g. "Valedictorian → Dean's List", "Honor Roll → Freshman")

## Empty State

When no active season exists (first-time setup or between seasons), the tab shows a centered empty state with a "Create Your First Season" button. This bypasses the collapsible sections and goes directly to a new season creation flow with the 3 default metrics pre-populated.

## Bottom Actions

Three buttons below the collapsible sections:
- **+ New Season** — creates a new season, copies current season's config as starting template. Generates a new timestamp UID. Opens Season Identity section for editing.
- **End Current Season** — deactivates the current season (with preview/confirm showing final standings)
- **Export Season History** — downloads CSV of all historical season data (season name, UID, dates, final scores, tier distributions, config snapshots)

## Preview/Confirm Modal

Every Save button across all sections triggers this modal before applying changes.

**Structure:**
1. **What's Changing** — list of before → after values for each modified field
2. **Rep Impact** (orange warning box, only shown when reps are affected) — count of reps who would change tiers, with names listed
3. **Cancel / Apply Changes** buttons — Apply in coral (#F37167) to signal consequential action

The impact calculation runs server-side: the API receives the pending config, computes which reps would change tier/rank, and returns the diff for display.

## Data Model Changes

### New fields on `Season`:
- `seasonUid` (String, unique) — timestamp-based unique identifier, e.g. `s_1711648200`
- `showName` (Boolean, default true) — whether season name is visible to reps
- `showDates` (Boolean, default true) — whether season dates are visible to reps
- `endDate` becomes nullable (currently required)

### New field on `SeasonMetric`:
- `weight` (Decimal, default 1.0) — multiplier applied to `pointValue` when calculating effective points

### New model: `MetricRegistry`
- `id` (Int, PK)
- `action` (String, unique) — action key (e.g. "plan_created")
- `label` (String) — human-readable name
- `description` (String) — explanation of what triggers this action
- `category` (String) — grouping for dropdown (Plans, Activities, Tasks, Opportunities, Revenue)

### Scoring logic update:
`awardPoints()` changes from:
```
totalPoints += metric.pointValue
```
to:
```
totalPoints += Math.round(metric.pointValue * metric.weight)
```

## API Endpoints

### GET `/api/admin/leaderboard`
Returns active season config: identity, metrics with weights, tier thresholds, combined weights, soft reset depth, plus current rep counts per tier.

### PUT `/api/admin/leaderboard/season`
Updates Season Identity fields (name, dates, visibility toggles).

### PUT `/api/admin/leaderboard/metrics`
Updates scoring metrics (add/remove/edit point values and weights).

### PUT `/api/admin/leaderboard/tiers`
Updates tier thresholds.

### PUT `/api/admin/leaderboard/weights`
Updates combined score weights (must sum to 1.0).

### PUT `/api/admin/leaderboard/transition`
Updates soft reset depth.

### POST `/api/admin/leaderboard/preview`
Accepts pending config changes, returns impact diff (which reps would change tiers, before/after rankings). Used by the preview/confirm modal.

### POST `/api/admin/leaderboard/season/new`
Creates a new season with timestamp UID, copies current config as template.

### POST `/api/admin/leaderboard/season/end`
Deactivates current season, returns final standings summary.

### GET `/api/admin/leaderboard/export`
Returns CSV of all historical season data.

### GET `/api/admin/leaderboard/registry`
Returns all available actions from MetricRegistry for the dropdown picker.

## Leaderboard UI Integration

Admin changes flow through to the rep-facing leaderboard with no additional wiring:

| Admin Control | Leaderboard Impact |
|---|---|
| Active metrics + point values + weights | Determines `totalPoints` via `awardPoints()`. Only enabled actions earn points at configured `pointValue × weight`. |
| Combined score weights | `calculateCombinedScore()` reads `seasonWeight`, `pipelineWeight`, `takeWeight` from the Season model. |
| Tier thresholds | `calculateTier()` reads `SeasonTierThreshold` rows. Changing thresholds immediately reclassifies reps. |
| Visibility toggles | Nav widget, home widget, and modal header conditionally show season name and dates based on `showName`/`showDates`. |
| Season lifecycle | Ending + starting a season triggers soft reset. Leaderboard API filters to active season. |

## File Organization

```
src/features/admin/components/
  LeaderboardTab.tsx          — main tab container with collapsible sections
  leaderboard/
    SeasonIdentity.tsx        — Section 1
    ScoringMetrics.tsx        — Section 2 (includes MetricPicker dropdown)
    TierThresholds.tsx        — Section 3
    CombinedWeights.tsx       — Section 4
    SeasonTransition.tsx      — Section 5
    PreviewConfirmModal.tsx   — shared preview/confirm dialog
    MetricPicker.tsx          — searchable, categorized dropdown
    BottomActions.tsx         — New Season, End Season, Export

src/features/admin/hooks/
  useAdminLeaderboard.ts      — TanStack Query hooks for all admin leaderboard endpoints

src/app/api/admin/leaderboard/
  route.ts                    — GET (read config)
  season/route.ts             — PUT (update identity), POST (new/end season)
  metrics/route.ts            — PUT (update metrics)
  tiers/route.ts              — PUT (update thresholds)
  weights/route.ts            — PUT (update weights)
  transition/route.ts         — PUT (update soft reset)
  preview/route.ts            — POST (impact preview)
  export/route.ts             — GET (CSV export)
  registry/route.ts           — GET (available actions)
```
