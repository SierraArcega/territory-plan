# Initiative Deprecation — Design

**Status:** Approved for implementation planning
**Date:** 2026-04-27
**Branch:** `feat/initiative-deprecation`

## Goal

Remove the Initiative concept from the territory-plan app. Preserve the Revenue
Overview leaderboard (modal + full-page view) and the sidebar entry point.
Replace the Initiative-driven floating tier widget with a Revenue Rank widget.

## Why

The Initiative tab and its admin configuration surface are no longer in use.
Keeping them around costs ongoing DB writes (every plan/district/activity
creation does an `awardPoints` upsert), a Mon-Fri Slack cron, and four DB
queries on every home-page load via the floating tier widget. Sales reps don't
need the tier/points feature; revenue ranking is what they actually use.

## Scope

### Preserved (zero visible change)

- The leaderboard modal entry point in the sidebar
- The Revenue Overview tab inside the modal — podium, FY filters, table
- The full-page Revenue Overview at the "Leaderboard" sidebar nav route
- All revenue / pipeline / targeted / min-purchases data flows
- `getRepActuals()` and the `district_opportunity_actuals` matview

### Replaced

- **Floating tier widget** (`Freshman #X — Y pts` pill above Profile) →
  **Revenue Rank widget**. Default: rank by current-FY revenue (FY26 today).
  Toggle: next-FY revenue (FY27 today). Click → opens modal. Toggle state:
  `sessionStorage`. The home-page mirror (`LeaderboardHomeWidget`) gets the
  same rewrite — both consume the new `useRevenueRank` hook.

### Dropped

- Initiative tab in modal (`LeaderboardModal`)
- Initiative tab in full-page view (`LeaderboardDetailView`)
- Admin → Leaderboard tab (`AdminDashboard`)
- Slack cron `leaderboard-slack-post`
- Inline `awardPoints()` writes (function deleted; call sites removed)
- All scoring logic (`scoring.ts` deleted)
- Initiative DB tables (PR 2 only; see merge structure below)

### Decoupling required

- `fetch-leaderboard.ts` rewritten so Revenue Overview no longer depends on
  an active `Initiative` row existing in DB
- `/api/leaderboard` and `/api/leaderboard/details` strip Initiative-only
  fields from their responses

## Merge structure (two PRs from one branch)

### PR 1 — code-only (ships first)

- All file modifications, additions, deletions
- `vercel.json` cron removal
- `awardPoints()` call-site removals
- **`prisma/schema.prisma` is untouched.** Initiative models stay defined,
  tables stay in DB, Prisma still generates types. Code just doesn't
  reference them anymore. Tables become orphaned-but-harmless.
- Reversible via single `git revert`. Zero data loss.

### PR 2 — schema-only (merged ~2 weeks after PR 1 soaks)

- Delete `Initiative*` and `MetricRegistry` models from `schema.prisma`
- Generate the drop migration via `npx prisma migrate dev`
- After this merges, the data is gone — but the data lost is config + scoring
  rows (~50 rows total), not business data. Real revenue/pipeline/plans are in
  other tables.

## File inventory

### Modified

- `src/features/leaderboard/lib/fetch-leaderboard.ts` — roster from
  `UserProfile` instead of `InitiativeScore`; drop `since: initiative.startDate`
  filter; strip Initiative fields from response
- `src/features/leaderboard/lib/types.ts` — remove `tier`, `combinedScore`,
  `pointBreakdown`, `initiativeScore`, `totalPoints`, `InitiativeInfo` from
  `LeaderboardEntry` and payload
- `src/features/leaderboard/lib/queries.ts` — drop `useMyLeaderboardRank`;
  add `useRevenueRank({ fy })`
- `src/features/leaderboard/components/LeaderboardModal.tsx` — drop Initiative
  tab and sub-view selector; modal opens to Revenue Overview
- `src/features/leaderboard/components/LeaderboardDetailView.tsx` — drop tab
  bar, render `RevenueOverviewTab` only
- `src/features/leaderboard/components/LeaderboardNavWidget.tsx` — rewrite as
  Revenue Rank widget
- `src/features/leaderboard/components/LeaderboardHomeWidget.tsx` — same
  rewrite
- `src/features/admin/components/AdminDashboard.tsx` — remove leaderboard tab
  and lazy import
- `src/features/shared/components/navigation/Sidebar.tsx` — keep top-level
  Leaderboard nav entry; remove any admin sub-item if present
- `src/app/api/territory-plans/route.ts:222` — delete `awardPoints("plan_created")`
- `src/app/api/territory-plans/[id]/districts/route.ts:188` — delete
  `awardPoints("district_added")`
- `src/app/api/activities/route.ts:466` — delete `awardPoints("activity_logged")`
- `src/app/api/leaderboard/route.ts` — drop `NoActiveInitiativeError` handling
- `src/app/api/leaderboard/details/route.ts` — same decoupling as
  `fetch-leaderboard.ts`
- `vercel.json` — remove `leaderboard-slack-post` cron entry

### Added

- `src/app/api/leaderboard/revenue-rank/route.ts` — new endpoint
- `src/app/api/leaderboard/revenue-rank/__tests__/route.test.ts`

### Deleted

- `src/app/api/leaderboard/me/route.ts` (replaced by `/revenue-rank`)
- `src/features/admin/components/LeaderboardTab.tsx`
- `src/features/admin/components/leaderboard/` (entire folder: 9 components +
  tests)
- `src/features/admin/hooks/useAdminLeaderboard.ts`
- `src/features/admin/lib/leaderboard-types.ts`
- `src/app/api/admin/leaderboard/` (entire folder: route, registry, metrics,
  tiers, weights, preview, recalculate, export, initiative/{route,new,end})
- `src/app/api/cron/leaderboard-slack-post/route.tsx`
- `src/app/api/leaderboard-image/route.tsx` + tests (orphaned)
- `src/features/leaderboard/lib/image-layout.tsx`
- `src/features/leaderboard/lib/fonts/` (consumed only by image-layout)
- `src/features/leaderboard/lib/scoring.ts`
- `src/features/leaderboard/lib/__tests__/scoring.test.ts`
- `Docs/superpowers/plans/2026-03-28-leaderboard-admin.md`
- `Docs/superpowers/specs/2026-03-28-leaderboard-admin-spec.md`
- `Docs/leaderboard-admin-handoff.md`

### PR 2 only

- `prisma/schema.prisma` — remove `Initiative`, `InitiativeMetric`,
  `InitiativeScore`, `InitiativeTierThreshold`, `MetricRegistry` models and
  any back-relation on `UserProfile`
- New migration: `prisma/migrations/<timestamp>_drop_initiative_tables/migration.sql`

## Revenue Rank widget

### Visual

A pill above the Profile entry in the sidebar. Replaces the current
Freshman/rank/pts widget. Same general size, position, and click behavior.

```
┌──────────────────────────────┐
│ Revenue Rank      #3 of 22   │
│ FY26  /  FY27                │  ← FY26 active by default (current FY)
│ $3.56M                       │
└──────────────────────────────┘
```

- **Top row:** label "Revenue Rank" + rank in `#X of Y` form
- **Toggle row:** two pill toggles labeled with the current and next fiscal
  year (`FY26` / `FY27` today; computed from current date, not hard-coded).
  Default = current FY. Clicking either swaps rank + figure.
- **Bottom row:** rep's revenue figure for selected FY, formatted compactly
  (`$3.56M`, `$685K`, `$0`)
- **Loading:** skeleton (existing pattern from `LeaderboardNavWidget`)
- **Admin / unknown user:** rank shows `—`, figure hidden
- **Zero revenue:** display `$0` honestly. Don't suppress.
- Existing affordances kept: shimmer animation every 5 minutes, scale animation
  on rank change (per FY), click → opens modal, hover glow
- Toggle state: `sessionStorage` per project convention

### API

`GET /api/leaderboard/revenue-rank?fy=current|next`

Returns the calling user's rank and revenue value plus roster size:

```typescript
{
  fy: "current" | "next",            // echo of request
  schoolYear: "2025-26",             // for client display
  rank: number,                      // 1-indexed
  totalReps: number,                 // roster size (rep + manager, no admin)
  revenue: number,                   // user's revenue in dollars
  inRoster: boolean,                 // false for admins
}
```

- Auth: cookie-authed (matches `/api/leaderboard`). 401 if unauthenticated.
- Roster: `prisma.userProfile.findMany({ where: { role: { in: ['rep', 'manager'] } } })`.
  Admins excluded from roster but included in the loop's data fetch (to compute
  `unassigned*` totals if ever needed — though this endpoint doesn't return them).
- For each user: `getRepActuals(email, schoolYear)` (existing helper).
- Sort descending by revenue, find caller's index, `rank = index + 1`.
- `schoolYear` derivation matches `fetch-leaderboard.ts`:
  - `current`: school year for current FY (e.g., `2025-26`)
  - `next`: next school year (e.g., `2026-27`)

### Hook

```typescript
useQuery({
  queryKey: ['revenue-rank', fy],
  queryFn: () => fetchJson(`/api/leaderboard/revenue-rank?fy=${fy}`),
  staleTime: 60_000,
  gcTime: 5 * 60_000,
})
```

Stable string key per project performance rules. Two cache entries (one per
FY) so toggling is instant after first fetch.

### Cost vs. today's `/api/leaderboard/me`

Today's `/me` does ~5 DB queries per home-page load (initiative + scores +
plan count + activity count + plans/districts for revenue_targeted). The new
`/revenue-rank` does N parallel `getRepActuals(email, year)` calls (N ≈ 25)
against the existing `district_opportunity_actuals` matview. Comparable or
cheaper, and the FY toggle is fully cached after first hit.

## Revenue path decoupling

Revenue Overview today routes through:

```
RevenueOverviewTab
  → useLeaderboard()
    → GET /api/leaderboard
      → fetchLeaderboardData()
        → prisma.initiative.findFirst({isActive})  ← throws if missing
        → prisma.initiativeScore.findMany()        ← roster source
        → for each: getRepActuals(email, fy)
        → prisma.territoryPlan.findMany({since: initiative.startDate})
        → prisma.activity.groupBy({since: initiative.startDate})
        → prisma.territoryPlanDistrict.findMany() (×3 for targeted)
        → builds entries with: tier, combinedScore, pointBreakdown,
          initiativeScore, totalPoints, take/pipeline/revenue/targeted
```

After:

```
RevenueOverviewTab
  → useLeaderboard()                   (unchanged)
    → GET /api/leaderboard              (drops NoActiveInitiative branch)
      → fetchLeaderboardData()          (rewritten)
        → prisma.userProfile.findMany({role: {in: ['rep','manager','admin']}})
        → for each: getRepActuals(email, fy)
        → prisma.territoryPlanDistrict.findMany() (×2 for targeted)
        → builds entries with: take/pipeline/revenue/targeted/etc.
```

### LeaderboardPayload field changes

| Field | Kept? | Why |
|---|---|---|
| `entries[].userId, fullName, avatarUrl` | Keep | Podium + table |
| `entries[].rank` | Keep | Recomputed from revenue sort |
| `entries[].take, pipeline, pipelineCurrentFY, pipelineNextFY` | Keep | Table |
| `entries[].revenue, revenueCurrentFY, revenuePriorFY` | Keep | Table + podium |
| `entries[].priorYearRevenue, minPurchasesCurrentFY, minPurchasesPriorFY` | Keep | Table |
| `entries[].revenueTargeted, targetedCurrentFY, targetedNextFY` | Keep | Table |
| `entries[].tier, totalPoints, combinedScore, initiativeScore, pointBreakdown` | **Drop** | Initiative-only |
| `teamTotals` (all 18 fields) | Keep | "incl. $X unassigned" annotations |
| `fiscalYears` | Keep | FY label formatting |
| `initiative` (whole `InitiativeInfo` block) | **Drop** | Was Initiative tab + name/dates header |
| `metrics`, `thresholds` | **Drop** | Initiative-only |

### Ranking change

Today entries return sorted by `score.totalPoints` desc. After: sort by
`revenueCurrentFY` desc as a stable default. `RevenueTable` sorts client-side
on user click, so the server default doesn't constrain UX.

### Roster behavioral diff (flagged)

If any rep was previously *not* in `InitiativeScore` (e.g., a new hire who
hadn't earned a single point), they were invisible in Revenue Overview.
After the swap they appear with `$0` revenue. Arguably more correct, but is a
visible change. Worth eyeballing the rep list pre/post during verification.

### Date scoping

The `since: initiative.startDate` filter goes away. It only ever scoped the
*point breakdown* (plan_count, activity_count) — which we're dropping. Revenue
/ pipeline / targeted queries don't use it. No behavioral change to the
numbers Revenue Overview displays.

## Testing

### Tests deleted

- `src/features/leaderboard/lib/__tests__/scoring.test.ts`
- `src/features/admin/components/leaderboard/__tests__/CollapsibleSection.test.tsx`
- `src/app/api/leaderboard-image/__tests__/route.test.ts`

### Tests updated

- `src/features/leaderboard/lib/__tests__/filters.test.ts`,
  `format.test.ts`, `suggestedTarget.test.ts` — verify no Initiative imports;
  surgical removal if found
- Any test that constructs a fake `LeaderboardPayload` or `LeaderboardEntry`
  fixture — slim to new shape

### Tests added

- `src/app/api/leaderboard/revenue-rank/__tests__/route.test.ts` covering:
  - 401 when unauthenticated
  - Returns rank + revenue for a known rep with `fy=current`
  - Returns rank + revenue for the same rep with `fy=next`
  - Returns `inRoster: false` for an admin caller
  - Returns `rank: N+1, revenue: 0` for a rep with no actuals data

## Manual verification (sandbox DB before merging PR 1)

1. Run new code against sandbox DB with realistic seed
2. Open Revenue Overview modal — verify podium ranks + figures match expected
3. Open full-page Leaderboard view — Revenue Overview only, no Initiative tab
4. Sidebar — Revenue Rank widget renders, FY toggle flips data
5. Click widget → modal opens to Revenue Overview
6. Open admin dashboard — no Leaderboard tab in nav
7. Create a plan / log an activity — confirm no errors from removed
   `awardPoints` calls
8. `vercel logs --follow` (or equivalent) — confirm no `leaderboard-slack-post`
   invocations

### Number-parity check

Before merging PR 1:

1. Snapshot current Revenue Overview podium + table (top 5 reps, all column
   values per FY filter combination) against production data
2. Run new code locally pointed at same DB
3. Compare cell-by-cell. Numbers should match exactly for any rep currently
   in roster.
4. Verify Revenue Rank widget against three reps (top, middle, bottom).
5. Verify `/api/leaderboard/details` works; `/api/leaderboard/me` 404s.

## Rollback

- **PR 1 problem found in production:** `git revert <pr1-merge-commit>`.
  Production restores. Initiative tables still intact with all data. Cron
  returns. Floating tier widget returns. Zero data loss.
- **PR 2 problem found in production:** Don't bother reverting — it's pure
  cleanup at that point. If a hard rollback is required, manually re-create
  empty tables; data is gone either way.

## PR 2 sanity check

Before merging PR 2:

```bash
grep -rn "initiative\|Initiative\|MetricRegistry" src/ prisma/ --include="*.ts" --include="*.tsx" --include="*.prisma" \
  | grep -v "node_modules\|migrations" \
  | grep -v -i "//.*initiative\|/\*.*initiative"
```

Expected: zero hits outside `prisma/schema.prisma` (which we're cleaning) and
historical migration files (untouched). Any other hit means PR 1 left a
reference behind — fix before PR 2 ships.

## Open questions

None. Design approved 2026-04-27.
