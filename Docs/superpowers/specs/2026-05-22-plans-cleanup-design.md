# Plans Feature Cleanup — Design Spec
_2026-05-22_

## Overview

Five bugs/improvements across the Plans portfolio page, My Views sidebar, and plan-row sidebar items. All changes are contained to the views feature and the territory-plans API route. No schema migrations required.

---

## 1. Team Plans Shows 0

**Root cause:** `usePlansWithStats()` in `queries.ts` always appends `&mine=1`, scoping the API response to plans where the current user is owner or collaborator. `PortfolioView` uses this same hook to perform its three-way split (mine / team / archived), so the `team` bucket is always empty — the API never returns other users' plans.

**Fix:** Add a `mine` boolean parameter to `usePlansWithStats(showHidden = false, mine = true)`. `PortfolioView` calls it with `mine = false`; all sidebar callers (`MyViewsSection`, `PlansSubsection`) keep the default `mine = true`. The query key includes `mine` so the two fetches occupy separate cache slots and both stay warm simultaneously.

**Files:** `src/features/views/lib/queries.ts`, `src/features/views/components/PortfolioView.tsx`

---

## 2. No-Plans Users Cannot Reach Team Plans

**Root cause:** In `MyViewsSection`, the "All plans" `<Link>` to `/views` is inside the `else` branch of `showEmptyState`. Users with zero own plans see only the empty-state box and have no navigation path to the portfolio where team plans are visible.

**Fix:** Move the "All plans" link outside the conditional so it renders unconditionally (above the empty-state box when shown, above the plans/lists subsections otherwise). The empty-state box body copy remains unchanged.

**Files:** `src/features/views/components/MyViewsSection.tsx`

---

## 3. Progress Ring Renders for Null Progress

**Root cause:** `GroupRow` passes `progress ?? 0` to `<ProgressRing>`. When a plan has no targets configured, `progress` is `null` (returned by `computeAllPlanStats` when `targetsTotal === 0`). The fallback `0` causes a zero-length arc with `strokeLinecap="round"` to render as a coral dot — meaningless noise for plans without targets.

**Fix:** Conditionally render the ring only when `progress !== null`:
```tsx
{progress !== null && <ProgressRing pct={progress} />}
```
Plans with targets configured (including 0% achieved) still show the ring. Plans with no targets configured show nothing.

**Files:** `src/features/views/components/GroupRow.tsx`

---

## 4. Expanded Meta Line Omits 0% for Plans Without Targets

**Root cause:** The expanded meta line in `GroupRow` gates the percentage label on `typeof progress === "number"`. When `progress` is `null` (no targets), the condition is false and no percentage appears — so Missouri shows "FY27" while North Dakota (with targets, 0 bookings) shows "0% FY27".

**Fix:** Broaden the condition to include `null`:
```tsx
{(typeof progress === "number" || progress === null) && (
  <span>{progress ?? 0}%</span>
)}
```
Both cases now display `0%`. The ring (item 3) is hidden for null progress because a zero-length arc is visual noise with no meaning; the text label `0%` is retained because it is explicit and informative — the user understands the plan has no bookings yet.

**Files:** `src/features/views/components/GroupRow.tsx`

---

## 5. View Count Badges in Sidebar Plan Rows

Show a count to the right of each view-type item (Map, Table, Kanban, Contacts, Opps, Signals) when a plan is expanded in the sidebar. Lets users anticipate what's inside before clicking and doubles as a prefetch signal — the counts come from data already loaded by `usePlansWithStats(?stats=1)`.

### Count mapping

| View | Count | Data source |
|------|-------|-------------|
| Map | # districts | `districtLeaids.length` |
| Table | # districts | `districtLeaids.length` |
| Kanban | # open opps | `oppsCount` |
| Contacts | # contacts | `contactsCount` |
| Opps | # open opps | `oppsCount` |
| Signals | # news last 30 days | `recentNewsCount` (new field) |

### Backend — `recentNewsCount`

Add to `PlanStats` interface:
```ts
recentNewsCount: number;
```

Add a third grouped SQL query inside `computeAllPlanStats`, run in `Promise.all` alongside the existing opps and contacts queries:
```sql
SELECT nad.leaid, COUNT(DISTINCT na.id) AS count
FROM news_article_districts nad
JOIN news_articles na ON na.id = nad.article_id
WHERE nad.leaid = ANY($1::text[])
  AND na.published_at >= NOW() - INTERVAL '30 days'
GROUP BY nad.leaid
```
Sum per plan in the existing JS aggregation loop. Append `recentNewsCount` to the GET response under the `...(stats ? { … } : {})` spread — invisible to callers without `?stats=1`.

Add `recentNewsCount: number` to `PlanWithStats` in `queries.ts`.

### Frontend — prop threading

`PlansSubsection` builds a `viewCounts` map per plan:
```ts
const viewCounts: Partial<Record<ViewId, number>> = {
  map:      plan.districtLeaids.length,
  table:    plan.districtLeaids.length,
  kanban:   plan.oppsCount,
  contacts: plan.contactsCount,
  opps:     plan.oppsCount,
  signals:  plan.recentNewsCount,
};
```

`GroupRow` receives `viewCounts?: Partial<Record<ViewId, number>>` and passes it to `GroupViewList`.

`GroupViewList` renders the count right-aligned, after the label:
```tsx
<span className="ml-auto text-[10px] font-medium tabular-nums text-[#A69DC0] whitespace-nowrap">
  {count}
</span>
```
Omitted when the value is `undefined`. Zero is shown as `0`.

**Files:** `src/app/api/territory-plans/route.ts`, `src/features/views/lib/queries.ts`, `src/features/views/components/PlansSubsection.tsx`, `src/features/views/components/GroupRow.tsx`, `src/features/views/components/GroupViewList.tsx`

---

## Scope boundaries

- No DB schema changes
- No new API routes
- No changes to the portfolio card layout (`PlanCardPortfolio`)
- Leaderboard widget overlap investigation: confirmed no CSS overlap; widget is in normal document flow below My Views section
- `PortfolioView` all-plans fetch is separate cache entry from sidebar mine-only fetch; both coexist without invalidation conflicts
