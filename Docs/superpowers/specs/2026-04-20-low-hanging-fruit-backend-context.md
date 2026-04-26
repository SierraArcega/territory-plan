# Backend Context: Low Hanging Fruit (revamp of Missing Renewal Opp tab)

**Date:** 2026-04-20
**Slug:** low-hanging-fruit

## 1. Existing endpoint review: `GET /api/leaderboard/increase-targets`

**File:** `src/app/api/leaderboard/increase-targets/route.ts` (~352 lines)

**Contract**
- `GET` only. No body, no query params.
- Auth: `getUser()` from `src/lib/supabase/server.ts` (honors impersonation). 401 if unauthenticated. No admin gate, no owner filter — all reps see all districts.
- Response: `{ districts: IncreaseTarget[]; totalRevenueAtRisk: number }`. ~127 rows.
- Caching: `dynamic = "force-dynamic"`. Client query key `["leaderboard","increase-targets"]`, `staleTime: 60_000`.
- Errors: try/catch, 500 with `{ error: "Failed to load at-risk districts" }`.

**SQL structure** (single `prisma.$queryRaw` template). CTEs in order:
1. `fy26_df` — `district_financials` where `vendor='fullmind' AND fiscal_year='FY26' AND total_revenue > 0`. Pulls revenue/completed/scheduled/session/subscription counts.
2. `fy26_opp` — `opportunities` where `school_yr='2025-26' AND stage ILIKE 'Closed Won%'`. Sums `net_booking_amount` and `minimum_purchase_amount`.
3. `fy27_done` — any FY27 `closed_won_bookings + total_revenue > 0`.
4. `fy27_pipe` — FY27 `open_pipeline > 0`.
5. `fy27_plan` — districts in any FY2027 territory plan with `plan_ids` array and `has_target` rollup.
6. `fullmind_prior` / `fullmind_prior_latest` — latest (FY25/FY24) Fullmind total_revenue.
7. `ek12_prior` / `ek12_prior_latest` — same for `vendor='elevate'`.
8. Three source CTEs (`src_missing_renewal`, `src_fullmind_winback`, `src_ek12_winback`) — winbacks come from `district_tags` junction (`Fullmind Win Back - FY25/FY26`, `EK12 Win Back - FY24/FY25`).
9. `candidates` / `eligible` — UNION, dedup by priority (missing_renewal > fullmind_winback > ek12_winback).
10. `last_opp` — `DISTINCT ON (district_lea_id)` last closed-won.
11. `top_products` — `ARRAY_AGG DISTINCT product_type, sub_product` from `subscriptions JOIN opportunities`.

Final SELECT joins `eligible` to `districts` + aux CTEs. Excludes `fy27_done` and `fy27_pipe`. Winback categories also excluded if already in an FY27 plan; missing_renewal stays visible (for "Open in LMS" action). Orders by category priority, then GREATEST of the four revenue signals DESC.

**Response fields** (already returned, see `src/features/leaderboard/lib/types.ts`):
- Identifiers: `leaid`, `districtName`, `state`, `enrollment`, `lmsId`
- Category: `category` (`missing_renewal | fullmind_winback | ek12_winback`)
- FY26 breakdown: `fy26Revenue`, `fy26CompletedRevenue`, `fy26ScheduledRevenue`, `fy26SessionCount`, `fy26SubscriptionCount`, `fy26OppBookings`, `fy26MinBookings`
- Prior year: `priorYearRevenue`, `priorYearVendor`, `priorYearFy`
- FY27 readiness: `inFy27Plan`, `planIds[]`, `hasFy27Target`, `hasFy27Pipeline`, `fy27OpenPipeline`, `inPlan` (alias)
- Context: `lastClosedWon: { repName, repEmail, closeDate, schoolYr, amount }`, `productTypes[]`, `subProducts[]`

**Stale test warning:** `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts` references CTE names (`fy27_any`, `already_planned`) that no longer exist in the route. Assertions inspecting the SQL template will fail. Refresh this as part of any route changes.

---

## 2. Fields needed by new UI — gap analysis

**Card (3 per row):**

| Field | Status |
|---|---|
| district name, state, FY26 revenue, sessions | already returned |
| products purchased (top N) | already returned — client trims |
| last rep, last sale summary | already returned — `buildLastSaleSummary` pattern exists in `IncreaseTargetsTab.tsx` |
| category tag | already returned |
| **suggested target $** | **NEW** — derive from existing fields, see §3 |

**Slide-over drawer:**

| Field | Status |
|---|---|
| FY26 revenue trend (completed / scheduled / sessions) | already returned |
| FY27 readiness (plan, target, pipeline, open $) | already returned |
| Full product + sub-product lists | already returned |
| Last closed-won detail | already returned |
| External LMS link | derive client-side from `lmsId` (pattern already used) |
| **FY24 / FY25 revenue (YoY chart)** | **needs backend work** |
| **FY27 revenue if any** | trivial to add — `fy27_done` CTE already computes it |

**Year-over-year revenue** — source `district_financials (leaid, vendor, fiscal_year)` unique index already exists; `fullmind_prior` / `ek12_prior` CTEs already query FY24/FY25 and just collapse to latest. Extension is cheap (pivot FY24/FY25/FY26/FY27 Fullmind `total_revenue` into 4 nullable columns; add Elevate vendor for winback rows). **Recommendation: inline in same route** — 4 numeric columns × 127 rows is trivially cheap; avoids a second drawer-open round-trip.

---

## 3. Suggested target calculation

Inputs `fy26Revenue`, `priorYearRevenue`, `category` are **all already in the response**. No new SQL.

**Recommendation: compute in the response mapper, not in SQL.** Reasons:
1. The mapper already normalizes Decimal → number and already applies the `fy26OppBookings` fallback (route.ts:305). Re-deriving in SQL would duplicate that.
2. `Math.round(x / 5000) * 5000` is trivial in JS and easier to tweak than a raw-SQL template edit.
3. Wizard surfaces the value directly from the row — no new mutation endpoint.
4. If the heuristic grows (user-editable multipliers), policy stays out of SQL.

Heuristic:

```ts
function suggestedTarget(row: IncreaseTarget): number | null {
  if (row.category === "missing_renewal") {
    return row.fy26Revenue > 0 ? Math.round((row.fy26Revenue * 1.05) / 5000) * 5000 : null;
  }
  return row.priorYearRevenue > 0 ? Math.round((row.priorYearRevenue * 0.90) / 5000) * 5000 : null;
}
```

Add to `IncreaseTarget`: `suggestedTarget: number | null` — null when both inputs are 0, so UI renders "—" not $0.

---

## 4. Endpoint naming: rename vs. extend

**Recommendation: Extend, do not rename.** The endpoint already underpins the Leaderboard modal tab (`IncreaseTargetsTab.tsx`), has a query hook (`useIncreaseTargetsList`), a test harness, and Decimal-normalization patterns. The new page and the simplified Leaderboard stat block both read the same data; renaming forces a shadow copy and double-invalidation during transition. Client-side rename of the hook name (`useLowHangingFruitList`) is fine and purely cosmetic.

---

## 5. Reuse check: `POST /api/territory-plans/[id]/districts`

**File:** `src/app/api/territory-plans/[id]/districts/route.ts`

- Single-add with targets takes the `prisma.territoryPlanDistrict.upsert` path — **idempotent** on `(planId, districtLeaid)` PK. Safe for wizard's sequential N calls.
- Per-call side effects: `syncClassificationTagsForDistrict` + `syncMissingRenewalOppTagForDistrict` (serial awaits), `syncPlanRollups(planId)` (recomputes plan totals), `awardPoints(user.id, "district_added")` (fire-and-forget).
- No server-side rate limit. Sequential wizard of 20 districts ≈ 4–10 seconds (200–500ms per call). Acceptable for step-by-step wizard.
- **Race risk:** parallel submissions would run N concurrent `syncPlanRollups` on one plan — not corrupting, but wasteful and can reveal in-flight partial totals. Keep sequential.
- **Points double-award:** `awardPoints` fires on every upsert, including updates. Re-cycling the wizard over the same district awards twice. Flag it; accept it for this slice.

**Recommendation:** reuse as-is, sequentially.

---

## 6. Auth / permissions

`getUser()` only, matching today. No admin gate, no owner filter. All reps see all districts — no change. Impersonation is correctly honored.

---

## 7. Testing patterns

Vitest + jsdom, co-located in `__tests__/`, `vi.mock` for `@/lib/prisma` and `@/lib/supabase/server`. Two files to mirror:

- `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts` — same endpoint; shows `makeRow(overrides)` factory + SQL-template introspection. **Currently stale** — refresh concurrently with route changes.
- `src/app/api/territory-plans/__tests__/route.test.ts` — shows how to mock `territoryPlanDistrict.upsert` + the auto-tags/rollup-sync side-effect modules. Mirror for any wizard integration test.

Run with `npm test`.

---

## 8. Open questions / risks

1. **FY24/FY25 data coverage for missing_renewal rows.** Prior-year CTEs exist, but for Fullmind-customer (non-winback) accounts, is FY24/FY25 `district_financials` populated? If sparse, YoY chart will show mostly zeros. Fallback option: `opportunities.school_yr='2024-25'` closed_won sum.
2. **FY27 in trend always 0.** The list excludes `fy27_done` districts, so FY27 column will always be 0 for list members. Show or omit?
3. **`suggestedTarget`: null vs. 0.** Null recommended — UI renders "—" when no signal.
4. **Points double-award** on wizard re-cycling. Accept or gate?
5. **Stale test file** — refresh in same PR.
6. **Leaderboard-tab transition ordering.** Old `IncreaseTargetsTab.tsx` consumes every field. Extending the response is backward-compatible; old tab replaced in the same PR with the lean stat block.
7. **LMS URL template** worth extracting to `src/features/shared/lib/` if the drawer reuses it.

---

## Summary: what to create

- **Extend** `src/app/api/leaderboard/increase-targets/route.ts`:
  - Add `revenue_trend` CTE pivoting FY24/FY25/FY26/FY27 Fullmind `total_revenue` (+ Elevate for winbacks).
  - Compute `suggestedTarget: number | null` in the response mapper.
- **Extend type** `src/features/leaderboard/lib/types.ts` (`IncreaseTarget`) with `revenueTrend: { fy24, fy25, fy26, fy27 }` (nullable numbers) and `suggestedTarget`.
- **Refresh** `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts` — update CTE names, add cases for new fields.
- **No new routes, no new mutations, no schema changes, no migrations.**
