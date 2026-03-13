# Goal & Plan Opportunity Progress — Design Spec

**Date:** 2026-03-12
**Slug:** goal-plan-opportunity-progress
**Status:** Draft

## Summary

Wire real opportunity data from the opportunity sync scheduler into the goals dashboard and territory plan views. Reps plan in revenue, track in revenue + take. The system provides a single aggregation layer that feeds every surface: goals dashboard (dedicated progress view), plan districts table (inline actuals), district detail panel (deep detail), and plan summary cards (headline progress).

## Requirements

### Problem
Reps set revenue targets per district (renewal, winback, expansion, new business) and overall goals (earnings, take, pipeline) but have no visibility into actual performance. The opportunity scheduler now syncs production data into the `opportunities` table — this feature connects that data to the planning and goals surfaces.

### Who Uses It
Sales reps checking progress against their goals and plan targets. They care most about take (drives comp), but plan and track in revenue with take rate as the margin lens.

### Success Criteria
- Reps can see "I planned X revenue, I've achieved Y" at the district level within a plan
- Goals dashboard shows real take, revenue, and pipeline actuals
- Prior fiscal year context is available for comparison
- All financial actuals come from the opportunities table (single source of truth)
- Hardcoded FY columns on districts table are no longer consumed by new features

### Constraints
- Opportunity data refreshes hourly via the scheduler
- Opportunities join to plan districts via `district_lea_id` = `territory_plan_district.district_leaid`
- Rep scoping uses `sales_rep_email` on opportunities
- School year to fiscal year mapping: "2025-26" = FY26

## Data Layer

### `district_opportunity_actuals` SQL View

Aggregates the `opportunities` table by `district_lea_id` and `school_yr`:

| Column | Derivation |
|---|---|
| `district_lea_id` | Group key |
| `school_yr` | Group key |
| `sales_rep_email` | Group key (for rep-scoped queries) |
| `bookings` | SUM(net_booking_amount) WHERE stage prefix >= 6 (closed-won) |
| `open_pipeline` | SUM(net_booking_amount) WHERE stage prefix 0-5 |
| `weighted_pipeline` | SUM(net_booking_amount * stage_weight) WHERE stage prefix 0-5 |
| `total_revenue` | SUM(total_revenue) |
| `completed_revenue` | SUM(completed_revenue) |
| `scheduled_revenue` | SUM(scheduled_revenue) |
| `total_take` | SUM(total_take) |
| `completed_take` | SUM(completed_take) (derived: completed_revenue - educator cost for past sessions) |
| `scheduled_take` | SUM(scheduled_take) (derived: scheduled_revenue - educator cost for future sessions) |
| `avg_take_rate` | total_take / NULLIF(total_revenue, 0) |
| `invoiced` | SUM(invoiced) |
| `credited` | SUM(credited) |
| `opp_count` | COUNT(*) |

**Stage weight map** (from scheduler spec):

| Stage prefix | Weight |
|---|---|
| 0 | 0.05 |
| 1 | 0.10 |
| 2 | 0.25 |
| 3 | 0.50 |
| 4 | 0.75 |
| 5 | 0.90 |

**Indexes:** `district_lea_id`, `school_yr`, `sales_rep_email`

### Fiscal Year Scoping

When querying actuals for a plan with `fiscalYear = 26`:
- Current FY actuals: `WHERE school_yr = '2025-26'`
- Prior FY actuals: `WHERE school_yr = '2024-25'`

### Rep Scoping

Goal dashboard actuals filter by `sales_rep_email` matching the authenticated user's email. A rep only sees actuals from opportunities assigned to them, even if another rep has opportunities in the same district.

### Deprecation Path

The hardcoded FY columns on the `districts` table (`fy25_net_invoicing`, `fy26_net_invoicing`, etc.) are superseded by this aggregation view. New features consume from `district_opportunity_actuals`. Existing features continue to work; migration of old consumers is out of scope.

## Goals Dashboard

### API Changes: `GET /profile/goals/{fy}/dashboard`

**`actuals` object — enriched fields:**

| Field | Source |
|---|---|
| `revenue` | SUM(total_revenue) from aggregation view for rep's districts, current FY |
| `take` | SUM(total_take) for rep's districts, current FY |
| `completedTake` | SUM(completed_take) — new field |
| `scheduledTake` | SUM(scheduled_take) — new field |
| `pipeline` | SUM(weighted_pipeline) for rep's districts, current FY |
| `bookings` | SUM(bookings) — new field |
| `invoiced` | SUM(invoiced) — new field |
| `earnings` | Derived: BASE_SALARY + (take * COMMISSION_RATE) |
| `newDistricts` | Count of districts with opportunities but no prior FY opportunities |

**`plans[]` array — add per-plan actuals:**

| Field | Source |
|---|---|
| `revenueActual` | SUM(total_revenue) for districts in this plan, current FY, this rep |
| `takeActual` | SUM(total_take) for districts in this plan, current FY, this rep |
| `bookingsActual` | SUM(bookings) for districts in this plan, current FY, this rep |

### UI Changes

Three headline metrics using existing DonutChart/GoalProgress components:

1. **Take Progress** — Primary donut. Completed take (solid segment) + scheduled take (lighter segment) against calculated take target. DonutMetricPopover shows completed/scheduled/target breakdown.

2. **Revenue Progress** — Revenue actual vs required revenue (derived from earnings target and take rate in GoalEditorModal). Shows "how much business am I generating."

3. **Pipeline** — Weighted pipeline vs required pipeline (revenue * 5x multiplier). Shows "do I have enough in the funnel."

**Plan contribution breakdown:** Each plan card in the dashboard shows revenue actual and take actual alongside existing target totals.

**No changes to GoalEditorModal:** Existing inputs (earnings target, take rate %, new districts) already derive take/revenue/pipeline targets correctly.

## Plan Districts Table

### New Columns (4)

Added after the existing target columns (Renewal, Winback, Expansion, New Biz) and before Services:

| Column | Display | Tooltip |
|---|---|---|
| **Revenue** | "$X / $Y" (actual / target) | "Actual revenue from completed and scheduled sessions vs your combined revenue targets (renewal + winback + expansion + new business) for this district" |
| **Take** | "$X" | "Total take (revenue minus educator costs) for this district in the current fiscal year" |
| **Pipeline** | "$X" | "Total weighted open pipeline (stages 0-5) for this district in the current fiscal year" |
| **Prior FY** | "$X" | "Total revenue from opportunities in this district during the previous fiscal year" |

**Existing target column tooltips — add to each:**
- Renewal: "Target revenue from renewal opportunities in this district for the current fiscal year"
- Winback: "Target revenue from winback opportunities in this district for the current fiscal year"
- Expansion: "Target revenue from expansion opportunities in this district for the current fiscal year"
- New Biz: "Target revenue from new business opportunities in this district for the current fiscal year"

**Revenue column:** Shows actual vs target where target = sum of the four category targets for that district. Visual progress indicator (inline bar or color coding) — defer specific styling to frontend-design skill.

**Footer:** Adds rollup totals for Revenue Actual, Take, Pipeline, and Prior FY alongside existing target totals.

### Data Source

Per-district actuals come from `district_opportunity_actuals` joined on `district_lea_id` and filtered to the plan's `fiscalYear`. Prior FY uses `fiscalYear - 1`.

## District Detail Panel

### New Section in Planning Tab

A new "Performance" section added to the existing Planning tab, below the targets/services content. Contains:

**Summary metrics (grid layout):**

| Metric | Display |
|---|---|
| Revenue vs Target | Actual (completed + scheduled) vs sum of category targets, with progress indicator |
| Take | Completed take + "scheduled" annotation |
| Take Rate | Actual % vs goal take rate % |
| Pipeline | Weighted open pipeline with opp count |
| Invoiced | Total billed amount |
| Credited | Credits/refunds issued |
| Prior FY Revenue | Last year's revenue with YoY % change |

**Opportunity list:**

Below the summary metrics, a list of individual opportunities for this district in the current FY:
- Opportunity name
- Stage (with stage label)
- Net booking amount
- Take amount
- Revenue (completed + scheduled)

Sorted by net_booking_amount DESC.

### API Addition

The plan district detail endpoint (`usePlanDistrictDetail`) adds:

```typescript
{
  // existing fields...
  actuals: {
    totalRevenue: number;
    completedRevenue: number;
    scheduledRevenue: number;
    totalTake: number;
    completedTake: number;
    scheduledTake: number;
    takeRate: number | null;
    openPipeline: number;
    weightedPipeline: number;
    invoiced: number;
    credited: number;
    oppCount: number;
    priorFyRevenue: number;
    priorFyTake: number;
    yoyRevenueChange: number | null; // percentage
  };
  opportunities: Array<{
    id: string;
    name: string;
    stage: string;
    netBookingAmount: number;
    totalRevenue: number;
    totalTake: number;
    completedRevenue: number;
    scheduledRevenue: number;
  }>;
}
```

## Plan Summary Card

### FlippablePlanCard Changes

**Headline:** "Revenue: $320K / $500K" with progress bar (replacing current pipeline-only bar).

**Additional context line:** Pipeline amount and prior FY comparison.

**On expand/hover:** Category breakdown:
- Renewal: actual / target
- Winback: actual / target
- Expansion: actual / target
- New Biz: actual / target

### New Plan-Level Rollup Fields

Added to `TerritoryPlan` and computed by `syncPlanRollups()`:

| Field | Derivation |
|---|---|
| `revenueActual` | SUM(total_revenue) from aggregation view for plan's districts, plan's FY |
| `takeActual` | SUM(total_take) for plan's districts, plan's FY |
| `priorFyRevenue` | SUM(total_revenue) for plan's districts, prior FY |

## Phase 2 (Out of Scope)

- **Unmatched opportunities indicator** — surface count and dollar value of unmatched opps per rep
- **Sync latency indicator** — "last synced X minutes ago" display
- **Explore table enrichment** — actuals columns in the explore/search tables
- **Map card overlays** — opportunity data on district map cards
- **Migration of existing FY column consumers** — updating features that currently read `fy25_net_invoicing` etc.
- **Bookings vs revenue distinction in goals** — if reps want to track closed-won contract value separately from session revenue

## States

- **Loading:** Skeleton placeholders in new columns/sections while actuals load. Existing target data renders immediately; actuals populate async.
- **Empty (no opportunities):** New columns show "-" or "$0". District detail Performance section shows "No opportunity data available for this fiscal year." Goals dashboard shows zero actuals with full target display.
- **Error:** If aggregation view query fails, show existing data without actuals. Toast notification: "Unable to load performance data. Retrying..."
- **Stale data:** Opportunity data is up to 1 hour old. No indicator in Phase 1 (Phase 2 item).
