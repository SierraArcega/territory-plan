# Map Summary Stats Bar

**Date:** 2026-02-22
**Status:** Approved

## Problem

When vendors are active on the map, there's no way to see aggregate metrics for the visible/filtered districts — how many are highlighted, how much pipeline/revenue/enrollment they represent.

## Decision

Dedicated API endpoint + client-side sub-filtering + bottom status bar.

**Rejected alternatives:**
- Extending `/api/districts` with `?summary=true` — muddies existing endpoint, caching conflicts
- Embedding financial data in vector tiles — tile bloat, dedup across tile boundaries, stale cache

## Design

### API: `GET /api/districts/summary`

Query params:
- `fy` — `fy25` | `fy26` (required)
- `states` — comma-separated state abbreviations
- `owner` — sales executive name
- `planId` — territory plan ID
- `accountTypes` — comma-separated account type values
- `vendors` — comma-separated vendor IDs (determines which category columns must be non-null)

SQL: JOIN `district_map_features` (for category/filter columns) with `districts` (for financial data). Apply same WHERE clauses as tile endpoint. Return aggregated totals + per-category breakdown.

Response shape:
```json
{
  "count": 1247,
  "totalEnrollment": 4832100,
  "sessionsRevenue": 12450000.00,
  "netInvoicing": 8230000.00,
  "closedWonBookings": 6100000.00,
  "openPipeline": 18700000.00,
  "weightedPipeline": 9350000.00,
  "byCategory": {
    "target": { "count": 400, "totalEnrollment": ..., "openPipeline": 0, ... },
    "pipeline": { "count": 200, "openPipeline": 5200000, ... },
    "first_year": { "count": 150, "sessionsRevenue": 3100000, ... },
    "multi_year": { "count": 350, "sessionsRevenue": 9350000, ... },
    "lapsed": { "count": 147, ... }
  }
}
```

The `byCategory` breakdown enables client-side sub-filtering without additional API calls.

### Client Hook: `useMapSummary()`

File: `src/features/map/lib/useMapSummary.ts`

- Watches Zustand store for: `selectedFiscalYear`, `filterStates`, `filterOwner`, `filterPlanId`, `filterAccountTypes`, `activeVendors`
- Builds cache key from major filter dimensions
- Fetches `/api/districts/summary` when cache key changes (debounced ~200ms)
- Stores full response including `byCategory`
- Derives `visibleTotals` by re-aggregating from `byCategory` based on `fullmindEngagement` and `competitorEngagement` — pure client-side, no network call
- Returns `{ totals, isLoading, error }`

Re-fetch triggers (API call): FY, states, owner, plan, account types, active vendors.
Client-only re-computation: engagement level sub-filters.

### UI Component: `MapSummaryBar`

File: `src/features/map/components/MapSummaryBar.tsx`

Slim bar docked at the bottom of the map viewport. Matches LayerBubble aesthetic (white/95 backdrop-blur, rounded, shadow).

```
+-------------------------------------------------------------------+
| 1,247 districts | 4.8M students | $8.2M revenue | $18.7M pipeline |
+-------------------------------------------------------------------+
```

Behavior:
- Visible when `activeVendors.size > 0`
- Hidden when no vendors active
- Subtle skeleton during loading
- Dollar values formatted with abbreviations ($1.2M, $450K)
- Positioned above LayerBubble pill, left-aligned

Metrics (left to right):
1. District count
2. Total enrollment
3. Sessions revenue
4. Net invoicing
5. Closed-won bookings
6. Open pipeline
7. Weighted pipeline

Overflow: horizontal scroll or wrap on narrow viewports.

## Key Risk: Filter Drift

The summary endpoint must apply the same filter logic as the tile endpoint. Mitigate by extracting shared WHERE-clause building into a helper function imported by both routes.
