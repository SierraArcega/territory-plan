# Backend Context: Performance Dashboard + Pipeline (home/dashboard tab)

Discovery date: 2026-05-28. Working tree: `.claude/worktrees/home-dashboard`.
Feature target: a rep-facing Performance Dashboard under the **Dashboard** tab of
`src/features/home/`, showing one rep's standing on 5 topline metrics vs target
**and ranked against all active reps**, with an FY selector, plus a Pipeline tab.

**Headline finding:** almost the entire per-rep attribution + ranking engine
this feature needs **already exists** for the Leaderboard. The materialized view
`district_opportunity_actuals` (DOA) is aggregated by
`(district_lea_id, school_yr, sales_rep_email, category)` and is described in
code as "the single source of truth for rep-scoped and category-scoped
opportunity rollups — matches the leaderboard." The `category` column **is** the
source/segment dimension this design needs. Reuse this, do not invent new
attribution.

> Note: `docs/architecture.md` references `src/features/progress` and
> `src/features/goals`. **Neither exists.** The real analog feature is
> `src/features/leaderboard/`. It also says the 5 metrics live in `fy{XX}_*`
> columns on `districts`; those columns were **migrated off `districts`** into the
> `district_financials` table (see Fiscal Year section). Treat architecture.md as
> stale on both points.

---

## Rep model

`UserProfile` — `prisma/schema.prisma:980` (table `user_profiles`).

| Field | Column | Notes |
|---|---|---|
| `id` | `id` (uuid, PK) | == Supabase `auth.users.id` |
| `email` | `email` (unique) | **The join key to opportunities / DOA** (`sales_rep_email`) |
| `fullName` | `full_name` | display |
| `avatarUrl` | `avatar_url` | for avatars |
| `role` | `role` enum `UserRole` | `admin \| manager \| rep` (`schema.prisma:954`) |
| `jobTitle`, `location`, `lastLoginAt`, `hasCompletedSetup` | — | metadata |

**Enumerating "all active reps":** there is **no explicit active/inactive flag**.
The established pattern is to filter by role:
- Leaderboard payload: `role IN ('rep','manager','admin')`, then **admins are
  treated as "unassigned"** and excluded from the ranked roster
  (`fetch-leaderboard.ts:44` and `:88-89`).
- `revenue-rank` route: `role IN ('rep','manager')`
  (`src/app/api/leaderboard/revenue-rank/route.ts:28`).

So "active reps" = `role IN ('rep','manager')` is the most defensible roster for
ranking. (See Open Questions — there is no `is_active` / soft-delete column.)

**Current user (server-side):** `getUser()` from `src/lib/supabase/server.ts:55`
returns the effective user (`{ id, email, isImpersonating }`), honoring admin
impersonation via the `impersonate_uid` cookie. Every API route uses this; 401 if
null. `getRealUser()` / `getAdminUser()` / `isAdmin()` also live there.

**Current user (client-side):** `useProfile()` —
`src/features/shared/lib/queries.ts:168` (`GET /api/profile`, queryKey
`["profile"]`). Returns the full `UserProfile`.

---

## Attribution (the central question)

There are **two parallel attribution mechanisms**, and the 5 metrics each use
one or the other. Get this right — it's the crux of the feature.

### 1. Opportunity-level → rep (the one that matters for metrics 2–5)

`Opportunity` model — `prisma/schema.prisma:1485` (table `opportunities`).
Rep ownership is **denormalized on each opp row**:
- `salesRepEmail` `sales_rep_email` (TEXT) — **the canonical join key**
- `salesRepId` `sales_rep_id` (uuid) — present but DOA aggregates by **email**, not id
- `salesRepName` `sales_rep_name` (TEXT)

Other key opp columns (Pipeline tab needs these at row level):
`stage`, `netBookingAmount`, `closeDate`, `createdAt`, `startDate`, `expiration`,
`contractType` (drives segment — see below), `leadSource`, `schoolYr`
(`"2025-26"` string = FY26), `districtLeaId` (`district_lea_id`, VARCHAR(7), FK
→ `districts.leaid`), `districtName`, `state`, `stateFips`, `stageHistory` (JSON),
`minimumPurchaseAmount`, `maximumBudget`, `weightedPipeline` (derived in DOA),
`completedRevenue/Take`, `scheduledRevenue/Take`, `totalRevenue/Take`, `invoiced`,
`credited`, `averageTakeRate`. Indexes: `schoolYr`, `districtLeaId`, `stage`,
`(districtLeaId, schoolYr, stage)`, `stateFips`.

**`district_opportunity_actuals` (matview)** — the rollup. Defined in
`prisma/migrations/20260416_actuals_view_min_purchase_strip_district_prefix/migration.sql`
(latest shape). Prisma model `DistrictOpportunityActuals` at `schema.prisma:1611`
is `@@ignore`d (matview — read via raw SQL only, never `prisma.districtOpportunityActuals`).
Grain: `(district_lea_id, school_yr, sales_rep_email, category)`. Refreshed hourly
after scheduler sync. Columns: `bookings`, `min_purchase_bookings`,
`open_pipeline`, `weighted_pipeline`, `total_revenue`, `completed_revenue`,
`scheduled_revenue`, `total_take`, `completed_take`, `scheduled_take`,
`avg_take_rate`, `invoiced`, `credited`, `opp_count`, `subscription_count`.

Stage→bucket logic baked into the matview (migration lines 97–103): numeric stage
prefix `0–5` = open pipeline; prefix `>=6` or text `closed won/active/position
purchased/...` = closed-won bookings; `closed lost` = excluded. Weighted pipeline
uses stage weights `{0:.05,1:.10,2:.25,3:.50,4:.75,5:.90}`.

**Ready-made helpers** — `src/lib/opportunity-actuals.ts`:
- `getRepActuals(email, schoolYr)` — one rep, one FY (line 162). Returns
  `{totalRevenue, totalTake, completedTake, scheduledTake, weightedPipeline,
  openPipeline, bookings, minPurchaseBookings, invoiced}`. `totalRevenue` =
  `rep_session_actuals.session_revenue` (bucketed by `session_fy(start_time)`) +
  `sub_revenue` from DOA — the two streams are sourced differently (see spec
  `Docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md`).
- `getRepActualsBatch(emails[], schoolYrs[])` — **use this** for ranking; 2
  round-trips total (line 278). Returns `Map<email, Map<schoolYr, RepActuals>>`.
  Exists specifically to avoid the N-rep × N-year fan-out that overran pgbouncer.
- `getRepLeaderboardRank(email, schoolYr)` — rank by total_take (line 410); a
  template for the per-metric ranking this feature needs (swap the ORDER BY key).
- `getNewDistrictsCount(email, currentSY, priorSY)` — "new districts" (line 383).
- `getDistrictActuals` / `getDistrictOpportunities` / `getPlanDistrictActuals` —
  district- and plan-scoped variants (lines 110, 454, 502).
- `fiscalYearToSchoolYear(fy)` — `26 → "2025-26"` (line 32).

`rep_session_actuals` is a separate matview (manual migrations
`prisma/migrations/manual/2026-05-01_rep_session_actuals_matview.sql`,
`2026-04-30_session_fy_function.sql`).

### 2. Plan/territory → rep (used for metric 1: Targets)

`TerritoryPlan` (`schema.prisma:495`, table `territory_plans`): `ownerId`
(`owner_id`), `userId` (`user_id`), `fiscalYear` Int (e.g. 2026), and denormalized
rollups `renewalRollup / expansionRollup / winbackRollup / newBusinessRollup`.

`TerritoryPlanDistrict` (`schema.prisma:539`, table `territory_plan_districts`):
PK `(planId, districtLeaid)`, per-district targets `renewalTarget`,
`winbackTarget`, `expansionTarget`, `newBusinessTarget`, plus `churnRisk`.

A rep "works" a district by having it in a plan they own. The leaderboard's
"targeted" number = sum of the 4 target columns across the rep's plan-districts
for that FY, **minus** that rep's already-open pipeline for the district (so
"converted to pipeline" doesn't double count). See the exact algorithm in
`fetch-leaderboard.ts:154-174` (`sumTargetsWithPipelineDeduction`) — directly
reusable for the Targets card's "converted to pipeline" sub-count. Rep resolution:
`plan.ownerId ?? plan.userId`.

### 3. District → rep (exists but not used by leaderboard)

`districts.owner_id` (`schema.prisma:142`, rel `DistrictOwner`) and
`districts.sales_executive_id` (`:143`, rel `DistrictSalesExec`) are real FKs to
`user_profiles`. The leaderboard does **not** use these — it attributes via opp
`sales_rep_email` and via plan ownership. Flag for the user: decide whether
"districts the rep is working" (metric 1) means *plan membership* (leaderboard
semantics) or *district.owner_id* — they can differ.

---

## The 5 metrics (table)

All `$`-typed columns are `Decimal(15,2)`. "DOA" = `district_opportunity_actuals`
matview, summed for the rep over a `school_yr`. Segment split = `GROUP BY category`.

| # | Metric (design) | Source | Exact column(s) | Per-rep? | Segment split? |
|---|---|---|---|---|---|
| 1 | **Targets** (districts worked; New/Win-back/Expansion; converted-to-pipeline; active) | `territory_plan_districts` (+ DOA for pipeline dedup) | `renewalTarget`,`winbackTarget`,`expansionTarget`,`newBusinessTarget`; count of districts; cross-ref DOA `open_pipeline` for "converted" | via plan `ownerId/userId` | yes (4 target columns) |
| 2 | **Open Pipeline ($)** | DOA | `open_pipeline`, `weighted_pipeline`, `opp_count` | via `sales_rep_email` | yes (`category`) |
| 3 | **Closed Won Bookings ($)** | DOA | `bookings` (closed-won net booking), `opp_count`; also `min_purchase_bookings` (contract floor) | via `sales_rep_email` | yes (`category`) |
| 4 | **Sched + Delivered Rev ($)** | DOA + `rep_session_actuals` | `scheduled_revenue` + `completed_revenue` (delivered); `total_revenue` = session + sub revenue | via `sales_rep_email` | yes (`category`) |
| 5 | **Sched + Delivered Take ($, margin)** | DOA | `scheduled_take` + `completed_take`; `total_take`; margin = `avg_take_rate` (take/revenue) | via `sales_rep_email` | yes (`category`) |

The design's wording differs slightly from the column names. Mapping:
"Delivered" = `completed_revenue`/`completed_take`; "Scheduled" =
`scheduled_revenue`/`scheduled_take`; "Bookings" = `bookings`; "min commit" /
"max budget" in the pipeline cards map to opp-level `minimum_purchase_amount` /
`maximum_budget` (and DOA `min_purchase_bookings`).

**Caution on metric 4 (revenue):** `getRepActuals` proves total revenue is
**not** a simple DOA sum — it adds `rep_session_actuals.session_revenue` (bucketed
by session start time, not opp school_yr). The matview's `total_revenue` /
`completed_revenue` already fold in EK12 subscription revenue but **session
revenue lives in the separate matview**. Use `getRepActuals`/`getRepActualsBatch`
rather than summing DOA directly for revenue. Take intentionally excludes
subscription revenue (no take-rate concept for subs).

### `district_financials` table (the architecture.md "fy{XX}" metrics)

`DistrictFinancials` — `schema.prisma:315`, table `district_financials`. **This is
the "VendorFinancials" table** referenced in architecture.md (the matview/raw-SQL
name `vendor_financials` in older migrations was renamed to `district_financials`).
Grain: `(leaid, vendor, fiscal_year)` (`@@unique`). `fiscalYear` is **VARCHAR(4)
like `"FY25"`/`"FY26"`** — *not* a school-year string. Fields:
`open_pipeline`, `closed_won_bookings`, `invoicing`, `scheduled_revenue`,
`completed_revenue`, `deferred_revenue`, `total_revenue`, `completed_take`,
`scheduled_take`, `total_take`, `session_count`, `subscription_count`,
`closed_won_opp_count`, `open_pipeline_opp_count`, `weighted_pipeline`, `po_count`.

**Fullmind's own row vs competitors:** distinguished by `vendor = 'fullmind'`
(string). Competitors have other `vendor` values. Fullmind's rows are
machine-maintained by the DB function `refresh_fullmind_financials()`
(`prisma/migrations/manual/create_refresh_fullmind_financials.sql`), which also
syncs `districts.is_customer` / `has_open_pipeline`.

> **`district_financials` has NO per-rep dimension** (no `sales_rep_*`). It's
> per-district/per-vendor/per-FY only. **It cannot rank reps.** For this
> rep-vs-rep feature, **use DOA** (which has `sales_rep_email`), not
> `district_financials`. `district_financials` is for the map summary bar /
> choropleth / competitor comparison, which are district-scoped. Documented here
> only to prevent the wrong table being chosen.

---

## Source segmentation (Return / New / Win-back / Expansion)

The single source of truth is the `category` column on DOA, derived from
`opportunities.contract_type` in the matview (migration lines 60–65):

```sql
CASE
  WHEN LOWER(contract_type) LIKE '%renewal%'                                   THEN 'renewal'      -- design "Return business"
  WHEN LOWER(contract_type) LIKE '%winback%' OR LIKE '%win back%'              THEN 'winback'      -- "Win-back"
  WHEN LOWER(contract_type) LIKE '%expansion%'                                 THEN 'expansion'    -- "Expansion"
  ELSE                                                                              'new_business'  -- "New biz"
END
```

Design ↔ DB mapping (the design's segment filter `all/return/new/winback`):
`return → renewal`, `new → new_business`, `winback → winback`,
`expansion → expansion`. To split any metric by segment, `GROUP BY category` on
DOA (it's already indexed: `idx_doa_category`, and the unique index includes
category). For metric 1 (Targets) segment = the 4 target columns on
`territory_plan_districts` (renewal/winback/expansion/newBusiness).

`opportunities.leadSource` exists too but is a finer-grained lead-origin field,
**not** the New/Win-back/Expansion segment — don't confuse them.

---

## Opportunities table (Pipeline tab row-level needs)

Covered above under Attribution §1. For the Pipeline tab's "Top opportunities"
table and deal modal, query the raw `opportunities` table (not the matview) per
`getDistrictOpportunities` (opportunity-actuals.ts:454) as the template — but
scope by `sales_rep_email = <rep>` and `school_yr = <FY>` instead of by district.
Available row fields: account/`district_name` (+ `state`/`stateFips` for the state
chip), `category` (source), `stage`, `net_booking_amount`, weighted (from DOA or
`net_booking_amount * stage weight`), `close_date`, `created_at` (age), age via
`now - created_at`, `stage_history` (JSON, for days-in-stage / stalled),
`minimum_purchase_amount` (min commit), `maximum_budget` (max budget). No
dedicated "health status" / "next action" column — those are derived (stalled =
days-in-stage over threshold) or come from `activities` (see Open Questions).

---

## leaderboard reuse (the "progress + goals" equivalent)

`src/features/leaderboard/` is the existing team-aggregation feature. Reuse heavily.

**Reusable as-is / near-as-is:**
- `fetchLeaderboardData()` (`lib/fetch-leaderboard.ts`) — the whole engine:
  enumerates reps, batch-fetches per-rep actuals for prior/current/next FY,
  computes per-rep targeted$ with pipeline dedup, computes per-rep open pipeline,
  ranks by `revenueCurrentFY`, returns `entries[]` + `teamTotals`. This is ~80%
  of metrics 1–3 for *all* reps in one call. The dashboard needs the same data
  re-ranked per metric.
- `getRepActualsBatch` / `getRepLeaderboardRank` (opportunity-actuals.ts) — the
  ranking primitives.
- `GET /api/leaderboard` (`route.ts`) — cookie-authed, returns the payload above.
- `GET /api/leaderboard/revenue-rank?fy=current|next`
  (`revenue-rank/route.ts`) — returns **the calling user's** rank + revenue +
  bookings + totalReps for one FY. This is the closest existing endpoint to the
  dashboard's "where do I stand" need; generalize it (per-metric, per-FY).
- `GET /api/leaderboard/increase-targets` — FY26 customers with no FY27 activity
  & not in a plan = "Top targets not yet in pipeline" (Pipeline tab). Hook:
  `useLowHangingFruitList()`.
- Frontend hooks (`lib/queries.ts`): `useLeaderboard()`, `useRevenueRank(fy)`,
  `useMyPlans()`, `useLowHangingFruitList()`, `useAddDistrictToPlanMutation()`.
- Types: `lib/types.ts` (`LeaderboardEntry`, `RevenueRankResponse`, etc.).
- `getUnmatchedCountsByRep` (`src/lib/unmatched-counts.ts`) — unmatched opps per
  rep (the "stale warning chip" on the Targets card could surface this).

**Must build new:**
- Per-metric ranking for **all 5** metrics (leaderboard only ranks by revenue).
  Generalize `getRepLeaderboardRank` to take a metric key and return ranks for
  every rep, ideally in one query (window function over DOA + a UNION for
  session revenue). The Rank-trajectory chart needs **monthly** ranks across the
  FY — that's a new query (bucket opps by month from `close_date`/`created_at`
  and rank per month). No existing monthly-rank query exists.
- Segment-filtered ranks/values (DOA `GROUP BY category`) — leaderboard ignores
  `category`.
- The combined Sched+Delivered Rev (metric 4) and Take (metric 5) toplines, and
  delivered-vs-scheduled split — not currently surfaced by the leaderboard.
- All Pipeline-tab data (coverage by stage, stage health table, funnel
  conversion, forecast, pipe-by-month, at-risk). The stage→bucket SQL exists in
  the matview but stage-level breakdowns are not aggregated anywhere yet.

---

## API patterns (mirror these)

Routes live at `src/app/api/{resource}/route.ts`, App Router, named exports
`GET/POST/...`. Canonical shape (from `revenue-rank/route.ts` and
`leaderboard/route.ts`):

```ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";                 // ORM
import { getRepActualsBatch } from "@/lib/opportunity-actuals"; // raw-SQL helpers

export const dynamic = "force-dynamic";            // cookie-authed, never static

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  // ...validate params, return 400 on bad input...
  // ...aggregate via prisma + opportunity-actuals helpers...
  return NextResponse.json(payload);               // or { error }, { status }
}
```

- **ORM:** Prisma (`@/lib/prisma`) for relational reads/writes;
  `prisma.$queryRaw` for matview/window-function aggregation; readonly pool
  `@/lib/db-readonly` is **reports/query-tool only** (role `query_tool_readonly`,
  cannot see `user_profiles`) — do **not** use it here. `@/lib/db.ts` is a small
  pg Pool for geospatial raw SQL.
- **Matviews** must be read via raw SQL (Prisma models are `@@ignore`d). Wrap in
  the `safeQueryRaw` 42P01 pattern (opportunity-actuals.ts:12) for resilience.
- **Perf:** never per-rep fan-out queries — batch (the batch helper exists
  precisely because the naive version exhausted pgbouncer). For frontend, the FY
  selector + Me/Team toggle should produce **stable string query keys**
  (`["perf", schoolYr, segment]`), per CLAUDE.md.
- **Frontend fetch:** TanStack Query hooks in
  `src/features/home/lib/queries.ts` (the feature already has this file) calling
  `fetchJson` from `@/features/shared/lib/api-client` (`API_BASE`).

**Where the tab plugs in:** `src/features/home/components/HomeTabBar.tsx` already
declares `dashboard` in the `HomeTab` union (`:5`) with a `BarChart3` tab that is
currently `disabled: true` (`:27`). `HomeView.tsx` switches on `activeTab` and
renders `FeedTab/ActivitiesTab/PlansTab`; add a `dashboard` branch + new
`DashboardTab` component, and flip `disabled` off. URL state uses `?tab=...`
query params (see `HomeView.tsx`).

---

## Fiscal year

FY starts **July 1**. School-year string `"2025-26"` == **FY26** (named by the
*end* year). Today 2026-05-28 → month index 4 (May) < 6 → still FY26.

Canonical derivation (duplicated in `fetch-leaderboard.ts:49-54` and
`revenue-rank/route.ts:22-25` — **there is no shared util; extract one**):

```ts
const now = new Date();
const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
const schoolYr = (fy: number) => `${fy - 1}-${String(fy).slice(-2)}`;
// FY26 → "2025-26"; priorFY=currentFY-1; nextFY=currentFY+1
```

`opportunity-actuals.ts:fiscalYearToSchoolYear(26 | 2026) → "2025-26"` converts a
numeric FY to the school-year string DOA/opportunities use. **Three FY namings
coexist:** (a) opp/DOA `school_yr` `"2025-26"`, (b) `territory_plans.fiscalYear`
Int `2026`, (c) `district_financials.fiscalYear` VarChar `"FY26"`. The dashboard's
FY pills (FY24/25/26/27) must map to all three. The design's FY27 pill =
`territory_plans.fiscalYear = 2027` / `school_yr "2026-27"` — data may be sparse.

---

## Open questions for the user

1. **Active-rep definition.** No `is_active`/soft-delete column on
   `user_profiles`. Use `role IN ('rep','manager')` (revenue-rank) or include
   `admin`-as-unassigned (leaderboard)? The design says "12 reps" — what's the
   exact roster filter? Is there a region concept (design shows "Northeast
   region · 12 reps") — **no region column exists** on `user_profiles`; where
   does region come from?
2. **"Districts the rep is working" (metric 1).** Plan membership
   (`territory_plan_districts`, leaderboard semantics) or `districts.owner_id` /
   `sales_executive_id`? They can diverge. Design's "Active 187/287" and
   "Converted to pipeline 84/287" sub-counts — define "active" precisely (has a
   logged activity? has open pipeline?).
3. **Rank trajectory = monthly ranks across the FY.** No monthly-rank or
   monthly-bucketed aggregation exists. Which date drives the month bucket —
   `close_date` (bookings), `created_at` (pipeline), `session.start_time`
   (revenue)? Confirm before building (it differs per metric). The "Pre-FY
   carryover" band — what carries over?
4. **Pipeline "health status" / "next action" / "at-risk".** No such columns on
   `opportunities`. Derive from `stage_history` (days-in-stage) + linked
   `activities` (last touch)? Confirm the staleness thresholds the design's
   "stalled"/"silent"/"slipped" chips imply.
5. **Forecast rows (Best case / Commit / Most likely).** Design implies
   probability tiers beyond the matview's stage weights. Is there a commit/
   best-case categorization in CRM, or should these derive from weighted pipeline
   + stage bands?
6. **FY27 / next-FY data availability.** Design shows an FY27 pill. Is there real
   FY27 opp/plan data, or should that pill be disabled when empty?
7. **Revenue metric source of truth.** `getRepActuals` blends DOA + the separate
   `rep_session_actuals` matview for `total_revenue`. Confirm the dashboard's
   "Sched + Delivered Rev" should follow the *same* blended logic (not a plain
   DOA sum) so it reconciles with the leaderboard.
8. **`salesRepId` vs `salesRepEmail`.** DOA ranks by **email**. If a rep changes
   email, attribution breaks. Confirm email is stable as the join key, or whether
   `sales_rep_id` (uuid) should be preferred (would require a matview change).
