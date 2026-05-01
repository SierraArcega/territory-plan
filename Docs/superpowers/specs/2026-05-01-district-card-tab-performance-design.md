# District Card Tab Performance — Design Spec

**Date:** 2026-05-01  
**Branch target:** `main`  
**Scope:** Map tab — district card right panel tab switching experience

---

## Problem

When a rep clicks a district on the map and opens the district card, every first visit to the Planning and Schools tabs fires a cold network request. The rep sees a skeleton while data loads (~350–420ms each). Contacts and Signals are already instant (data comes from the existing district detail response), but Planning and Schools are not — and these are the two tabs reps use most.

Root cause: tab components are conditionally rendered. They only mount when clicked, so their `useQuery` calls only fire on first visit.

---

## Solution

Four coordinated changes:

| # | Change | File(s) | Effect |
|---|--------|---------|--------|
| 1 | Run `centroid`, `getChildren`, `school.count` in parallel | `src/app/api/districts/[leaid]/route.ts` | ~80ms off card open |
| 2 | Prefetch all tab queries on card mount | `src/features/map/components/right-panels/DistrictCard.tsx` | Tab switches: ~350ms → instant |
| 3 | Fade-up animation on tab content | `DistrictCard.tsx` + `src/app/globals.css` | Removes jank, masks render gap |
| 4 | Loading dots on in-flight tabs | `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx` | Eliminates anxious double-clicks |

---

## Architecture

### 1. API Route — Parallel DB Queries

**File:** `src/app/api/districts/[leaid]/route.ts`

Currently the route runs three sequential `await`s after the main Prisma query:

```ts
// BEFORE — sequential, ~80ms wasted
const centroidResult = await prisma.$queryRaw(...)
const childLeaids = await getChildren(leaid)
const schoolCount = await prisma.school.count(...)
```

Change to `Promise.all`:

```ts
// AFTER — parallel, free ~80ms
const [centroidResult, childLeaids] = await Promise.all([
  prisma.$queryRaw<{ lat: number; lng: number }[]>`...`,
  getChildren(leaid),
]);
const isRollup = childLeaids.length > 0;
const schoolCount = isRollup
  ? await prisma.school.count({ where: { leaid: { in: childLeaids } } })
  : 0;
```

Note: `schoolCount` still runs after `childLeaids` resolves (it depends on it), but `centroid` and `getChildren` are independent and can run concurrently.

No change to the response shape — zero frontend impact.

### 2. Prefetch on Card Mount

**File:** `src/features/map/components/right-panels/DistrictCard.tsx`

Add a `useEffect` that fires `queryClient.prefetchQuery()` for all three tab-specific queries immediately when the card mounts with a valid `leaid`. These run in parallel, are non-blocking, and write directly into TanStack Query's in-memory cache.

```ts
const queryClient = useQueryClient();

useEffect(() => {
  if (!leaid) return;

  queryClient.prefetchQuery({
    queryKey: ['schoolsByDistrict', leaid],
    queryFn: () => fetchJson(`/api/schools/by-district/${leaid}`),
    staleTime: 5 * 60 * 1000,
  });

  if (activePlanId) {
    queryClient.prefetchQuery({
      queryKey: ['planDistrict', activePlanId, leaid],
      queryFn: () => fetchJson(`/api/territory-plans/${activePlanId}/districts/${leaid}`),
      staleTime: 2 * 60 * 1000,
    });
  }

  // Activities key is ["activities", queryString] where queryString is built
  // by buildActivitiesQueryString — must match exactly or the cache misses.
  // Implementation step: export buildActivitiesQueryString (or a shared
  // activitiesQueryOptions factory) from activities/lib/queries.ts so both
  // useActivities and this prefetch share the same key-building logic.
  const activityQueryString = buildActivitiesQueryString({ districtLeaid: leaid });
  queryClient.prefetchQuery({
    queryKey: ['activities', activityQueryString],
    queryFn: () => fetchJson(`/api/activities?${activityQueryString}`),
    staleTime: 2 * 60 * 1000,
  });
}, [leaid, activePlanId, queryClient]);
```

When a tab mounts and calls its own `useQuery` hook, TanStack Query finds the data already in cache (or the in-flight request already in progress) and returns immediately — no second network request is issued.

### 3. Fade-Up Animation on Tab Content

**File:** `src/features/map/components/right-panels/DistrictCard.tsx`

Add `key={activeTab}` to the tab content wrapper. This forces React to unmount and remount the wrapper div on every tab switch, which re-triggers the CSS animation automatically.

```tsx
<div key={activeTab} className="tab-content">
  {activeTab === 'planning' && <PlanningTab leaid={leaid} />}
  {activeTab === 'signals'  && <SignalsTab  leaid={leaid} />}
  {activeTab === 'schools'  && <SchoolsTab  leaid={leaid} />}
  {activeTab === 'contacts' && <ContactsTab contacts={contacts} />}
</div>
```

**File:** `src/app/globals.css`

```css
.tab-content {
  animation: tabFadeUp 150ms ease-out;
}
@keyframes tabFadeUp {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

150ms is intentional — fast enough to feel instant, slow enough to register as a deliberate transition. The animation covers React's ~20–60ms reconcile-and-paint gap, so by the time the animation settles, the content is fully rendered.

### 4. Tab Strip Loading Indicators

**File:** `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx`

Read `queryClient.getQueryState()` synchronously for the Schools and Planning query keys. This is a pure cache read — no fetches triggered, no re-renders caused.

```tsx
const queryClient = useQueryClient();

const schoolsLoading =
  queryClient.getQueryState(['schoolsByDistrict', leaid])?.status === 'pending';

const planningLoading =
  queryClient.getQueryState(['planDistrict', activePlanId, leaid])?.status === 'pending';
```

Render a pulsing dot next to the tab label when loading:

```tsx
<button className={activeTab === 'schools' ? 'active' : ''} onClick={() => setActiveTab('schools')}>
  Schools
  {schoolsLoading && <span className="tab-load-dot" />}
</button>
```

```css
.tab-load-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
  margin-left: 4px;
  animation: tabDotPulse 1.2s infinite;
}
@keyframes tabDotPulse {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50%       { opacity: 0.7; transform: scale(1); }
}
```

---

## Data Flow

```
User clicks district on map
  → DistrictCard mounts with leaid
  → useDistrictDetail(leaid) fires [existing]
  → prefetchQuery × 3 fires in parallel [new — non-blocking]
       ├── ['schoolsByDistrict', leaid]
       ├── ['planDistrict', planId, leaid]  (only if activePlanId exists)
       └── ['activities', { districtLeaid: leaid }]
  → Tab strip renders; getQueryState() reads dots

User clicks any tab
  → Tab component mounts
  → Its own useQuery() checks cache → HIT (instant render)
  → key={activeTab} changes → .tab-content remounts → fadeUp triggers
  → Content appears with smooth animation, no skeleton
```

---

## Edge Case: Tab Clicked Before Prefetch Resolves

If a rep clicks Planning or Schools within ~100–200ms of opening the card (before the prefetch has landed), the tab's `useQuery` hook finds the query already in-flight (status `'pending'`). TanStack Query **deduplicates** — it subscribes the tab's hook to the existing in-flight request rather than firing a second one. The tab shows its existing skeleton UI while the shared request completes.

**Behavior:** Skeleton shows, but only for the remaining duration of the original prefetch — not a full new wait. The loading dot on the tab strip remains visible until the request lands.

**This must be verified locally before PR.** Steps to reproduce and verify:
1. Open devtools → Network tab, set throttling to "Slow 3G"
2. Click a district on the map
3. Immediately click the Planning tab before the skeleton disappears
4. Verify in Network: only one request to `/api/territory-plans/:planId/districts/:leaid` (not two)
5. Verify in UI: skeleton shows briefly, then content fades in — no second load flash
6. Verify the loading dot is visible during the wait and disappears on resolve

---

## Error Handling

- `prefetchQuery()` silently swallows errors. If a prefetch fails, no UI change occurs. When the user clicks that tab, the tab's own `useQuery` fires and handles its error state as before.
- `Promise.all` in the API route: if `centroid` or `getChildren` fails, the existing `try/catch` returns a 500 as before. No behavior change.

---

## Testing

Three test additions, co-located in existing `__tests__/` directories:

### 1. `DistrictCard.test.tsx`
- Assert `queryClient.prefetchQuery` is called 3 times on mount with a valid `leaid` and `activePlanId`
- Assert it is called only 2 times (skipping planDistrict) when `activePlanId` is null
- Assert the activities prefetch key matches exactly what `useActivities({ districtLeaid: leaid })` would produce (i.e., both use `buildActivitiesQueryString` — no divergence)
- **Edge case:** Assert that when the Planning tab is clicked while `planDistrict` is still `'pending'`, no second fetch is issued (deduplicate check — verify `prefetchQuery` is not called again, and the tab renders with a skeleton that resolves to content)

### 2. `DistrictTabStrip.test.tsx`
- Assert loading dot renders when `getQueryState` returns `{ status: 'pending' }` for Schools
- Assert loading dot is absent when status is `'success'`
- Assert loading dot is absent for Contacts and Signals tabs (they have no prefetch)

### 3. `districts/[leaid]/route.test.ts`
- Assert `$queryRaw` (centroid) and `getChildren` are both called before either resolves (parallel execution)
- Assert response shape is unchanged from before the `Promise.all` refactor

---

## Local Verification Checklist (before PR)

- [ ] Run `npm run dev` on port 3005
- [ ] Open map tab, click a district — card opens with no visual regression
- [ ] Click all 4 tabs in sequence — no skeleton on Planning or Schools after first open
- [ ] Close card, click same district again — all tabs instant (cached)
- [ ] Click different district — prefetch fires again for new leaid, tabs instant after card settles
- [ ] **Edge case on Slow 3G:** confirm single in-flight request when tab clicked before prefetch lands
- [ ] Verify loading dots appear and disappear correctly
- [ ] Verify fade-up animation plays on every tab switch (check Planning → Signals — both should animate since key changes)
- [ ] Run `npm test` — all existing tests pass

---

## Out of Scope

- Streaming API changes
- Map tile overlay loading (Vacancies/Contacts pins on canvas)
- Hover prefetch on map district tiles (could be a follow-up)
- Any change to the left floating panel
