# Leaderboard Admin Exclusion & Team Totals — Design Spec

**Date:** 2026-04-13
**Status:** Design
**Author:** Sierra Arcega (with Claude)
**Branch context:** Sits on top of `feat/leaderboard-combined` (Aston's Revenue Overview redesign + EK12 matview fix).

## Problem

The leaderboard currently includes every user that has an `InitiativeScore` row — including admins. In practice one admin (Anurag) is used as a catch-all bucket for orphaned revenue (opportunities whose sales rep can't be resolved). Because Anurag sits in the ranked roster:

1. He appears as a "competitor" on the Revenue Overview podium and table alongside real reps.
2. His $13.8M of orphan revenue dominates `maxRevenue` in the combined-score normalization, deflating every other rep's revenue score.
3. There's no way to see team-wide revenue totals at a glance; each user has to mentally sum the column to understand what Fullmind's actual total revenue is.

## Goal

Exclude admin users from every ranked roster in the leaderboard UI, while keeping their revenue visible in team-level totals so the displayed numbers still match the real team total. The user should never look at the leaderboard and wonder "where did that $13.8M go."

## Non-Goals

- No UI for editing `UserProfile.role`. Admin/rep assignment is a manual DB/admin operation and stays that way.
- No upstream fix for orphan revenue attribution (that's Salesforce/ETL work).
- No detection of non-admin users who accidentally carry orphan revenue. This design filters strictly by role.
- No changes to the `manager` role. Managers remain in the roster for now.
- No new test infrastructure for API routes (none exists for the leaderboard endpoints today, and adding it is out of scope).

## Behavior

**Rule:** Users with `UserProfile.role === 'admin'` are excluded from:

- The Revenue Overview tab (podium + table).
- The Initiative tab roster.
- The `/api/leaderboard/me` self-card's rank computation, `above`/`below` neighbors, and `totalReps` count.
- All max-value computations (`maxInitiativePoints`, `maxTake`, `maxPipeline`, `maxRevenue`, `maxRevenueTargeted`) used in combined-score normalization.

**Team totals (new response field + new UI):** The `/api/leaderboard` response gains a `teamTotals` object that sums revenue/pipeline/targeted/priorYearRevenue across **all** users (reps + admins), along with parallel `unassigned*` fields that capture the admin-only subtotal. The Revenue Overview table renders a new `<tfoot>` "Team Total" row; columns with a nonzero unassigned value show an inline annotation like `$68.2M · incl. $13.8M unassigned` so the orphan bucket is always visible.

**Combined-score impact:** Excluding admins from max-value computations will *raise* visible reps' combined scores (the normalization ceiling drops). This is the correct behavior — reps should compete against each other, not against an orphan bucket — and podium ordering may shift as a result. Flagging this explicitly because it is a user-visible consequence even though it's desirable.

## Architecture

Pure query-layer filtering + a new response field. No schema changes, no migrations, no new models, no new endpoints.

### Data flow

```
UserProfile.role ──┐
                   ▼
  InitiativeScore (fetched with role in nested user select)
                   │
                   ▼
      ┌─────────── partition by role ───────────┐
      │                                         │
  rosterScores                              adminScores
   (role ≠ 'admin')                         (role = 'admin')
      │                                         │
      ▼                                         ▼
  compute maxes,                           compute unassigned*
  build `entries`                          subtotals only
      │                                         │
      └──────────── merge into teamTotals ──────┘
                       │
                       ▼
          { entries, teamTotals, ... }
```

### Components touched

**Backend (3 API routes):**

- `src/app/api/leaderboard/route.ts` — Revenue Overview source. Adds roster partition, restricted max computation, and `teamTotals` to the response.
- `src/app/api/leaderboard/details/route.ts` — Initiative tab source. Filters admins from the scores list upstream of plans/activities fetch and `entries` build.
- `src/app/api/leaderboard/me/route.ts` — Self card source. Filters admins from `allScores` before computing `myIndex`, neighbors, and `totalReps`. If the current user IS an admin, `myIndex` becomes -1 and the existing "not on leaderboard" fallback kicks in — no new code path needed.

**Frontend (3 files):**

- `src/features/leaderboard/lib/types.ts` — adds optional `teamTotals` field to `LeaderboardResponse`.
- `src/features/leaderboard/components/RevenueTable.tsx` — new optional `teamTotals` prop; renders `<tfoot>` "Team Total" row with inline "incl. $X unassigned" annotation where applicable.
- `src/features/leaderboard/components/RevenueOverviewTab.tsx` — projects `teamTotals` per-FY using the existing `pipelineFY` / `targetedFY` selectors (mirroring how it already projects each entry), then passes a pre-resolved `{ revenue, priorYearRevenue, pipeline, revenueTargeted, unassignedRevenue, unassignedPriorYearRevenue, unassignedPipeline, unassignedRevenueTargeted }` object into `RevenueTable`.

**Frontend NOT touched:**

- `RevenuePodium` — already derives from filtered `entries`.
- `LeaderboardDetailView` — already derives from filtered `entries`/`data.entries`.
- `LeaderboardModal` — just a container.

## Detailed Design

### New response field shape

The Revenue Overview tab lets the user toggle `Pipeline` and `Targeted` between current FY, next FY, and both — so the team totals for those columns have to be per-FY, mirroring how each `LeaderboardEntry` already ships `pipelineCurrentFY` / `pipelineNextFY` / `targetedCurrentFY` / `targetedNextFY`. `Current Revenue` and `Prior Year Closed` are single-FY columns (no toggle) so they ship as scalars.

```ts
// src/features/leaderboard/lib/types.ts — added to LeaderboardResponse
teamTotals?: {
  // Single-FY columns (no client-side toggle)
  revenue: number;                           // roster + admin, revenueSchoolYr
  priorYearRevenue: number;                  // roster + admin, priorSchoolYr
  unassignedRevenue: number;                 // admin-only subtotal, revenueSchoolYr
  unassignedPriorYearRevenue: number;        // admin-only subtotal, priorSchoolYr

  // Per-FY columns (client toggles current / next / both)
  pipelineCurrentFY: number;                 // roster + admin
  pipelineNextFY: number;                    // roster + admin
  unassignedPipelineCurrentFY: number;       // admin-only
  unassignedPipelineNextFY: number;          // admin-only

  targetedCurrentFY: number;                 // roster + admin
  targetedNextFY: number;                    // roster + admin
  unassignedTargetedCurrentFY: number;       // admin-only
  unassignedTargetedNextFY: number;          // admin-only
};
```

Optional so that (a) older clients during deploy don't crash, and (b) test fixtures can omit it. When absent, the `RevenueTable` footer is simply not rendered.

`RevenueOverviewTab` projects the footer values using the same FY-selector logic it already uses for each entry's `pipeline` and `revenueTargeted`, and passes the resolved totals plus the corresponding `unassigned*` values into `RevenueTable` as a pre-projected `teamTotals` prop. This keeps `RevenueTable` simple — it doesn't need to know about FY selectors.

### Backend filter pattern

For each of the 3 endpoints, the change is a small additive edit:

```ts
// add to scores query include
user: { select: { id: true, fullName: true, avatarUrl: true, email: true, role: true } }

// after fetching scores (+ actuals where applicable)
const rosterScores = scores.filter((s) => s.user.role !== 'admin');
const adminScores  = scores.filter((s) => s.user.role === 'admin');

// drive everything off rosterScores from here down
// (entries, maxes, userIds for plan/activity queries, etc.)
```

For `/api/leaderboard` specifically, admin actuals are still fetched (via the same `repActuals` loop, because filtering happens after) and then aggregated into the `teamTotals.unassigned*` fields before being dropped from the roster.

### Frontend footer rendering

`RevenueOverviewTab` pre-projects a flat `RevenueTableTotals` object (keys match the table's column keys: `revenue`, `priorYearRevenue`, `pipeline`, `revenueTargeted`, plus parallel `unassigned*` fields). `RevenueTable` takes it as an optional prop and renders a `<tfoot>` row:

```tsx
{teamTotals && entries.length > 0 && (
  <tfoot>
    <tr className="border-t-2 border-[#EFEDF5] bg-[#F7F5FA]">
      <td />
      <td className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-[#8A849A]">
        Team Total
      </td>
      {COLUMNS.map((col) => {
        const total = teamTotals[col.key];
        const unassignedKey = `unassigned${col.key[0].toUpperCase()}${col.key.slice(1)}` as keyof RevenueTableTotals;
        const unassigned = teamTotals[unassignedKey];
        return (
          <td key={col.key} className="px-3 py-3 text-right text-sm tabular-nums font-semibold text-[#2D2440]">
            {formatRevenue(total)}
            {unassigned > 0 && (
              <div className="text-[10px] text-[#8A849A] font-normal mt-0.5">
                incl. {formatRevenue(unassigned)} unassigned
              </div>
            )}
          </td>
        );
      })}
    </tr>
  </tfoot>
)}
```

The implementation will define `RevenueTableTotals` as a named type near `RevenueSortColumn` so the key mapping is statically checkable.

## Testing

**Unit (Vitest + Testing Library):**

- `src/features/leaderboard/components/__tests__/RevenueTable.test.tsx` — new cases:
  1. Footer hidden when `teamTotals` prop is undefined.
  2. Footer hidden when `entries` is empty.
  3. Footer rendered with correct per-column totals when `teamTotals` is provided.
  4. "incl. $X unassigned" annotation appears only on columns where `unassigned*` > 0 (so e.g. a column with zero orphan shows just the total).

**Manual verification (required before merge):**

1. On `feat/leaderboard-combined` with admin exclusion applied, open `http://localhost:3005/?tab=leaderboard`. Confirm Anurag is absent from both the Revenue Overview podium/table AND the Initiative tab roster.
2. Confirm team total Current Revenue matches `sum(visible rep revenue) + Anurag's current-year revenue`.
3. Confirm "incl. $X unassigned" appears on Current Revenue column and the number matches Anurag's current-year revenue.
4. Compare combined scores for visible reps before and after — they should be higher (or unchanged when Anurag wasn't the max).
5. Sign in as a regular rep; confirm `/api/leaderboard/me` still returns correct rank and neighbors (no admin in above/below slots).
6. Sign in as an admin; confirm self card falls through to "not on leaderboard" state.

**API-route tests are explicitly deferred.** No such tests exist for `/api/leaderboard*` today. Adding mocking infrastructure for Prisma + auth for just this change is scope creep; we'll rely on UI tests + manual verification.

## Error Handling & Edge Cases

- **Zero admins in the system:** `adminScores` is empty, `teamTotals.unassigned*` are all 0, footer renders but no inline annotation anywhere. Correct.
- **Zero reps, only admins:** `entries.length === 0`, footer is not rendered (empty state shows the existing "No scores yet" message). Correct.
- **All admins have zero revenue:** same as zero admins for display purposes — footer renders without annotation.
- **Admin is the currently authed user on the self card:** existing "not on leaderboard" fallback at `myIndex === -1` handles it.
- **Older client polls during deploy:** `teamTotals` is optional; footer not rendered; everything else works unchanged.
- **Role not set on a user (shouldn't happen):** Prisma default is `rep`, enforced at the DB and type level. No defensive code needed.

## Open Questions

None as of spec time — all resolved during brainstorming:

- ✅ Just `admin` role excluded (not `manager`).
- ✅ Admins excluded from max-value normalization.
- ✅ Scope includes all 3 leaderboard endpoints (not just Revenue Overview).
- ✅ Team totals surfaced via new `<tfoot>` row on `RevenueTable`.

## Rollout

Single PR on top of `feat/leaderboard-combined`. No migration, no feature flag. Post-merge the change is visible to all users on next page load. Low-risk: query-layer filter + one new JSON field + one new `<tfoot>` element.
