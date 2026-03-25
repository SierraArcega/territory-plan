# Combined Revenue + Sessions with Service Type Breakdown

**Date:** 2026-03-24
**Status:** Approved
**Area:** Plan Detail Modal > Districts Tab > Expanded District > YoY Pacing

## Problem

The YoY Pacing table shows Revenue and Sessions as separate aggregate rows with no per-service-type breakdown. Revenue is a function of sessions, so showing them separately is redundant. Users need to see which service types are driving revenue and session volume, with full YoY comparison.

## Design

### Data Source Decision

The existing pacing queries use pre-aggregated fields on `opportunities` (`total_revenue`, `scheduled_sessions`). For the service-type breakdown, we must query the `sessions` table directly (it has `service_type` per session).

To ensure **parent row = exact sum of children**, the combined Revenue & Sessions row will be derived from the `sessions` table data (summing across all service types), NOT from the existing opportunity-level `total_revenue` / `scheduled_sessions`.

This means:
- **Revenue** = `SUM(session_price)` from `sessions` table (all sessions — completed + scheduled). This should closely match `SUM(total_revenue)` from opportunities since that field is computed from session prices in the scheduler.
- **Session count** = `COUNT(*)` from `sessions` table (all sessions, not just scheduled). This differs from the old "Sessions" row which only counted `scheduled_sessions`.

Pipeline and Deals continue to use the existing opportunity-level queries — they are unrelated to the sessions table.

### UI Changes

Merge the Revenue and Sessions rows into a single expandable **"Revenue & Sessions"** row. Pipeline and Deals remain unchanged.

**Collapsed state (3 rows):**

| Metric | Current | Same Date PFY | Full PFY |
|--------|---------|---------------|----------|
| **Revenue & Sessions** ▸ | $100.0K / 0 | $0 / 0 | $178.8K / 820 0% |
| Pipeline | $100.0K | $0 | $0 |
| Deals | 1 | 0 | 3 33% |

**Expanded state** — clicking the Revenue & Sessions row reveals per-service-type sub-rows with identical YoY columns:

| Metric | Current | Same Date PFY | Full PFY |
|--------|---------|---------------|----------|
| **Revenue & Sessions** ▾ | $100.0K / 0 | $0 / 0 | $178.8K / 820 0% |
| &nbsp;&nbsp;Tutoring | $60K / 0 | $0 / 0 | $120K / 600 |
| &nbsp;&nbsp;Virtual Staffing | $40K / 0 | $0 / 0 | $58.8K / 220 |
| Pipeline | $100.0K | $0 | $0 |
| Deals | 1 | 0 | 3 33% |

- Combined row format: `$<revenue> / <session_count>` (revenue formatted with K/M suffixes, session count as integer)
- Sub-rows use same format, indented with left padding
- Pace badges: both Same Date PFY comparison (`getPaceBadge`) and Full PFY percentage (`getPercentOfBadge`) apply to the revenue portion of each sub-row, matching the parent row behavior
- If no service type breakdown data exists (empty array), the row is not expandable (no chevron)
- Service types sorted alphabetically
- Null or empty-string service types grouped as "Other" (use `COALESCE(NULLIF(s.service_type, ''), 'Other')`)
- When both revenue and sessions are zero for a cell, display `$0 / 0`

### API Changes

**File:** `src/app/api/territory-plans/[id]/route.ts`

Add 3 parallel queries joining `sessions` to `opportunities`, grouped by `service_type` and `district_lea_id`. These replace the revenue/sessions portion of the existing pacing queries.

```sql
-- Current FY by service type per district
SELECT o.district_lea_id,
       COALESCE(NULLIF(s.service_type, ''), 'Other') AS service_type,
       COUNT(*)::int AS sessions,
       COALESCE(SUM(s.session_price), 0) AS revenue
FROM sessions s
JOIN opportunities o ON o.id = s.opportunity_id
WHERE o.district_lea_id = ANY($1)
  AND o.school_yr = $2
GROUP BY o.district_lea_id, COALESCE(NULLIF(s.service_type, ''), 'Other')

-- Same Date PFY: same query with school_yr = priorSchoolYr AND s.start_time <= oneYearAgo
-- Full PFY: same query with school_yr = priorSchoolYr (no date filter)
```

**Same Date PFY filtering:** Use `s.start_time <= oneYearAgo` (session start time) rather than `o.created_at`, since we want sessions that had actually occurred by this point last year.

**Note on `district_lea_id`:** This field is nullable on `Opportunity`. Sessions on opportunities with NULL `district_lea_id` are excluded (correct behavior — they are unmatched opportunities).

Build a lookup: `Map<district_lea_id, Map<service_type, { current, sameDate, full }>>`. For each district, produce a `serviceTypeBreakdown` array. Also compute `currentRevenue` / `currentSessions` by summing across all service types for that district (replaces the opportunity-level revenue/sessions in pacing).

**Existing pacing queries:** Keep them for Pipeline and Deals only. Remove `revenue` and `sessions` from the `PacingRow` type since those now come from the sessions-table queries.

Response shape per district's pacing:

```json
{
  "currentRevenue": 100000,
  "currentSessions": 0,
  "currentPipeline": 100000,
  "currentDeals": 1,
  "priorSameDateRevenue": 0,
  "priorSameDateSessions": 0,
  "priorSameDatePipeline": 0,
  "priorSameDateDeals": 0,
  "priorFullRevenue": 178800,
  "priorFullSessions": 820,
  "priorFullPipeline": 0,
  "priorFullDeals": 3,
  "serviceTypeBreakdown": [
    {
      "serviceType": "Tutoring",
      "currentRevenue": 60000,
      "currentSessions": 0,
      "priorSameDateRevenue": 0,
      "priorSameDateSessions": 0,
      "priorFullRevenue": 120000,
      "priorFullSessions": 600
    },
    {
      "serviceType": "Virtual Staffing",
      "currentRevenue": 40000,
      "currentSessions": 0,
      "priorSameDateRevenue": 0,
      "priorSameDateSessions": 0,
      "priorFullRevenue": 58800,
      "priorFullSessions": 220
    }
  ]
}
```

### Type Changes

**File:** `src/features/shared/types/api-types.ts`

```typescript
export interface ServiceTypePacing {
  serviceType: string;
  currentRevenue: number;
  currentSessions: number;
  priorSameDateRevenue: number;
  priorSameDateSessions: number;
  priorFullRevenue: number;
  priorFullSessions: number;
}

// Extend existing DistrictPacing:
export interface DistrictPacing {
  // ... existing fields (currentRevenue, currentPipeline, etc.) ...
  serviceTypeBreakdown?: ServiceTypePacing[];
}
```

### Component Changes

**File:** `src/features/map/components/SearchResults/PlanDistrictsTab.tsx` — `PacingTable` function

1. Remove separate Revenue and Sessions entries from the `metrics` array
2. Render a combined "Revenue & Sessions" row before Pipeline and Deals
3. Add `useState<boolean>` for expanded state
4. Render chevron (▸/▾) only when `serviceTypeBreakdown` has entries
5. When expanded, render sub-rows for each service type using same grid layout with additional left padding (`pl-5`)
6. Each cell shows `$revenue / sessions` with both YoY pace badges applied to the revenue value
7. Pipeline and Deals rows render unchanged below

## Files Modified

1. `src/app/api/territory-plans/[id]/route.ts` — add 3 sessions-table queries, restructure pacing to use sessions data for revenue/sessions
2. `src/features/shared/types/api-types.ts` — add `ServiceTypePacing`, add `serviceTypeBreakdown` to `DistrictPacing`
3. `src/features/map/components/SearchResults/PlanDistrictsTab.tsx` — refactor `PacingTable`

## Testing

- Vitest unit test for `PacingTable` with mock pacing data including `serviceTypeBreakdown`
- Verify collapsed state shows combined revenue/sessions
- Verify expanded state shows per-service-type sub-rows
- Verify parent row = sum of children
- Verify empty breakdown hides chevron and row is not expandable
- Verify null/empty service types grouped as "Other"
- Verify both pace badges render on sub-rows
