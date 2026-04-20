# Backend Context: Increase Your Targets Tab

**Date:** 2026-04-20
**Slug:** increase-your-targets-tab

## Data Model (confirmed in `prisma/schema.prisma`)

### `TerritoryPlan` (line 473)
- `id` (UUID), `userId` (owner), `fiscalYear` (int, required — e.g. 2026, 2027)
- Denormalized rollups: `districtCount`, `stateCount`, `renewalRollup`, `expansionRollup`, `winbackRollup`, `newBusinessRollup`

### `TerritoryPlanDistrict` (line 514)
- Composite PK: `(planId, districtLeaid)`
- 4 target fields (all `Decimal?`): `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`
- `addedAt`, `notes`

### `DistrictFinancials` (line 298)
- Composite unique: `(leaid, vendor, fiscalYear)` — `vendor` is `"fullmind"`, `fiscalYear` is `"FY26"` / `"FY27"` (string)
- Fields used: `openPipeline`, `closedWonBookings`, `totalRevenue`, `completedRevenue`, `scheduledRevenue`, `sessionCount`, `subscriptionCount`
- Indexed: `(vendor, fiscalYear)`, `(leaid)`, `(fiscalYear)`

### `Opportunity`
- `districtLeaId`, `schoolYr` (e.g. `"2025-26"`), `stage`, `closeDate`, `salesRepName`, `salesRepEmail`, `netBookingAmount`
- Relations: `subscriptions` (has `productType`, `subProduct`, `netTotal`)

## API Patterns

### Auth
- `getUser()` from `src/lib/supabase/server.ts` → returns `{ user, isImpersonating }` or null
- 401 if `user` is null
- Standard error shape: `NextResponse.json({ error: "message" }, { status: 401|404|500 })`

### Existing reusable routes
- `POST /api/territory-plans/[id]/districts` (`src/app/api/territory-plans/[id]/districts/route.ts`)
  - Accepts `{ leaids, renewalTarget?, winbackTarget?, expansionTarget?, newBusinessTarget?, notes? }`
  - Single-district path uses `upsert` on composite PK — duplicate-safe
  - Calls `syncPlanRollups(planId)` and awards `district_added` points
  - **Reuse this** for "Add to plan + set target" — no new mutation endpoint needed
- `GET /api/territory-plans` — returns all plans (team-wide visibility, no ownership filter)
  - Can reuse for plan picker; filter client-side by `ownerId === currentUser.id`

## Side Effects

### `syncPlanRollups(planId)` — `src/features/plans/lib/rollup-sync.ts:7-33`
- Prisma aggregate: `_count.districtLeaid`, `_sum` of 4 target fields
- Must be called AFTER upsert or rollups stay zero
- Already called by existing `POST /api/territory-plans/[id]/districts` route

### `awardPoints(userId, action)` — `src/features/leaderboard/lib/scoring.ts:79-107`
- Actions: `plan_created`, `district_added`, `activity_logged`
- Fire-and-forget (non-blocking)
- **User directive: NO NEW scoring rules for this tab.** Existing `district_added` point-awarding happens via the reused endpoint. We do NOT add a new tab-specific action or bonus.

## New endpoints to create

### 1. `GET /api/leaderboard/increase-targets`
Returns the at-risk list.

**Query structure** (single raw SQL w/ Prisma `$queryRaw`):
```
WITH fy26 AS (
  SELECT leaid, total_revenue, completed_revenue, scheduled_revenue, session_count, subscription_count
  FROM district_financials
  WHERE vendor = 'fullmind' AND fiscal_year = 'FY26' AND total_revenue > 0
),
fy27_any AS (
  SELECT leaid FROM district_financials
  WHERE vendor = 'fullmind' AND fiscal_year = 'FY27'
    AND (COALESCE(open_pipeline,0) + COALESCE(closed_won_bookings,0) + COALESCE(total_revenue,0)) > 0
),
already_planned AS (
  SELECT DISTINCT district_leaid AS leaid FROM territory_plan_districts
),
last_opp AS (
  SELECT DISTINCT ON (district_lea_id) district_lea_id AS leaid, sales_rep_name, sales_rep_email, close_date, net_booking_amount, school_yr
  FROM opportunities
  WHERE district_lea_id IS NOT NULL AND stage ILIKE 'Closed Won%'
  ORDER BY district_lea_id, close_date DESC
),
top_products AS (
  SELECT o.district_lea_id AS leaid,
    ARRAY_AGG(DISTINCT s.product_type) FILTER (WHERE s.product_type IS NOT NULL) AS product_types,
    ARRAY_AGG(DISTINCT s.sub_product) FILTER (WHERE s.sub_product IS NOT NULL) AS sub_products
  FROM subscriptions s
  JOIN opportunities o ON o.id = s.opportunity_id
  WHERE o.district_lea_id IS NOT NULL
  GROUP BY o.district_lea_id
)
SELECT d.leaid, d.name, d.state_abbrev, d.enrollment,
  fy26.total_revenue, fy26.completed_revenue, fy26.scheduled_revenue,
  fy26.session_count, fy26.subscription_count,
  lo.sales_rep_name, lo.sales_rep_email, lo.close_date, lo.school_yr, lo.net_booking_amount,
  tp.product_types, tp.sub_products
FROM fy26
JOIN districts d ON d.leaid = fy26.leaid
LEFT JOIN last_opp lo ON lo.leaid = fy26.leaid
LEFT JOIN top_products tp ON tp.leaid = fy26.leaid
WHERE fy26.leaid NOT IN (SELECT leaid FROM fy27_any WHERE leaid IS NOT NULL)
  AND fy26.leaid NOT IN (SELECT leaid FROM already_planned WHERE leaid IS NOT NULL)
ORDER BY fy26.total_revenue DESC
```

**Response shape:**
```ts
type IncreaseTarget = {
  leaid: string;
  districtName: string;
  state: string;
  enrollment: number | null;
  fy26Revenue: number;
  fy26CompletedRevenue: number;
  fy26ScheduledRevenue: number;
  fy26SessionCount: number | null;
  fy26SubscriptionCount: number | null;
  lastClosedWon: {
    repName: string | null;
    repEmail: string | null;
    closeDate: string | null; // ISO date
    schoolYr: string | null;
    amount: number | null;
  } | null;
  productTypes: string[];
  subProducts: string[];
};
```

**Performance:** 68 rows, all CTEs hit indexes. Expect <100ms. No materialized view needed.

### 2. `GET /api/territory-plans/mine` (OR reuse `/api/territory-plans` with client-side filter)
Returns plans the current user owns. Decision: **reuse existing `/api/territory-plans`** and filter client-side — simpler, no new route.

### Mutation: reuse `POST /api/territory-plans/[id]/districts`
Already supports `{ leaids: string, renewalTarget?: number, winbackTarget?: number, expansionTarget?: number, newBusinessTarget?: number }`. No new endpoint needed.

## Gotchas

1. `fiscalYear` in `DistrictFinancials` is `string` (`"FY26"`), NOT int.
2. `syncPlanRollups` must fire AFTER upsert — already handled by reused route.
3. Existing route already awards `district_added` points — this is "existing scoring mechanics", user said to avoid NEW scoring rules only. No action needed.
4. User directive: **hide districts already in ANY plan** (not just the current user's). The `already_planned` CTE handles this.

## File locations to create
- `src/app/api/leaderboard/increase-targets/route.ts` — GET endpoint
- `src/features/leaderboard/lib/queries.ts` — add `useIncreaseTargetsList()` hook
- (No new mutation route — reuse `/api/territory-plans/[id]/districts`)
