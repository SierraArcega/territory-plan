# Final Code Review Report: Signals View

**Date:** 2026-05-21
**Slug:** signals-view
**Branch:** worktree-saved-views-sidebar
**Reviewed range:** `30c28728..de728029` (Signals commits only)
**Spec:** `docs/superpowers/specs/2026-05-21-signals-view-spec.md`
**Plan:** `docs/superpowers/plans/2026-05-21-signals-view-plan.md`

## Summary

Replaces the three separate Saved-Views tabs (Vacancies / News / RFPs) with a
single district-grouped **Signals** accordion. Two read-only, auth-guarded
endpoints back an inline tree: a lightweight summary (one row per in-scope
district with per-type counts + freshness) and a lazy per-district merged
reverse-chronological item feed. The implementation matches the spec and plan
closely, reuses existing shared view primitives and the central click
delegation, and is well-tested. SQL is fully parameterized, auth guards are in
place on both routes, and no forbidden patterns appear in source.

**Scoping note:** the `30c28728..de728029` range includes commits from a
concurrent session (district notes, MapViewContainer/Kanban/GroupCanvas,
selection bar, `district-column-metadata.ts`). Those were excluded from this
review per instructions. Only the three Signals commits were assessed:
`64f08574` (backend), `8f282f43` (frontend), `de728029` (registry).

## Changes

| File | Commit | Notes |
| --- | --- | --- |
| `src/lib/signals/sql.ts` (+test) | 64f08574 | `parseWindow`, `sinceCutoff`, `parseTypes`, `DATE_EXPR`, `NEWS_CONFIDENCE_LEVELS`; static fragments only |
| `src/app/api/signals/route.ts` (+test) | 64f08574 | Summary endpoint; parameterized rollups + district base; 0-signal merge; freshness sort |
| `src/app/api/signals/[leaid]/route.ts` (+test) | 64f08574 | Items endpoint; UNION ALL; limit+1 hasMore; rfp `id::text` |
| `src/features/views/components/views/signals/SignalsView.tsx` (+test) | 8f282f43 | Orchestrator; batched toolbar state; ≤50 render cap; last-visit watermark |
| `src/features/views/components/views/signals/SignalsControls.tsx` (+test) | 8f282f43 | Sticky toolbar; type chips, window, search, expand-all |
| `src/features/views/components/views/signals/SignalDistrictRow.tsx` (+test) | 8f282f43 | Collapsible district; lazy per-district feed on expand |
| `src/features/views/components/views/signals/SignalItemRow.tsx` (+test) | 8f282f43 | Leaf row; `data-row-kind`/`data-row-id`; `String(id)` |
| `src/features/views/components/views/signals/SignalTypeTag.tsx` (+test) | 8f282f43 | Tinted VAC/NEWS/RFP marker |
| `src/features/views/components/views/signals/queries.ts` (+test) | 8f282f43 | `useSignalsSummary`, `useDistrictSignals`; serialized keys |
| `src/features/views/components/views/signals/relative-date.ts` | 8f282f43 | `relativeAge`, `isNewerThan` |
| `src/features/views/lib/view-types.ts` (+test) | de728029 | `ViewId` drops vac/news/rfp, adds `signals`; `DetailKind` unchanged |
| `views/VacanciesView.tsx`, `NewsView.tsx`, `RfpsView.tsx` (+NewsView test) | de728029 | Deleted (orphaned); GridView/SOURCE_COLUMNS retained |
| `__tests__/ViewTabsStrip.test.tsx`, `GroupRow.test.tsx` | de728029 | Updated to assert one Signals tab |

## Test Results

- **Signals-scoped suites:** `npx vitest run src/lib/signals src/app/api/signals
  src/features/views/components/views/signals` → **64 passed, 0 failed** (9 files).
- **Wider run (reported by implementer):** `npx vitest run src/features/views
  src/lib/signals src/app/api/signals` → 416 passed, 3 failed. The 3 failures are
  in `grid/__tests__/GridColumnMenu.test.tsx` (`reorderColumns` pure helper),
  which imports only `GridColumnMenu` + `columns.ts` — neither touched by this
  feature. **Confirmed not a Signals regression** (concurrent session's area).
- **Typecheck (`tsc --noEmit`):** zero errors in any Signals file. The 28 total
  project errors are all in `src/features/rfps/lib/__tests__/` and
  `src/lib/__tests__/states.test.ts` — pre-existing / out of scope.

## Design Review

**Pending** — running in parallel. Not assessed here. Spot-checks during code
review found brand tokens used consistently (plum neutrals `#403770`/`#544A78`/
`#8A80A8`/`#A69DC0`/`#EFEDF5`/`#F7F5FA`, coral `#F37167`), Lucide icons with
`currentColor`/`aria-hidden`, `whitespace-nowrap` on text spans, `overflow-x-auto`
on the toolbar, and `touch-action` handling consistent with CLAUDE.md mobile
guidance. No Tailwind grays in source.

## Code Review Findings

### Strengths

- **SQL injection — clean.** Every user-supplied value is bound as `$N`:
  scope `leaids`/`leaid`, `cutoff`, news confidence array, `limit`, `offset`.
  Only static fragments are interpolated — `DATE_EXPR.*(alias)` (fixed aliases
  `v`/`n`/`r`) and type literals (`'vac'::text`). The `pushConfidence(params)`
  index threading correctly keeps `$N` numbering aligned whether or not the
  `since` cutoff param was added, and limit/offset are pushed after the SELECTs
  are built. Verified by route tests asserting param contents and SQL fragments.
- **Auth guards present on both routes** — `getUser()` is the first call in each
  `GET`, returning 401 on null. Covered by tests.
- **RFP `Int → string`** handled twice: `r.id::text` in SQL and a defensive
  `String(id)` in `SignalItemRow`'s `data-row-id`. The detail route `parseInt`s
  it back. Tested (`id: "42"`). News ids are cuid strings already; vacancy ids
  pass through as-is.
- **News confidence filter** uses `['high','llm','source']`, matching
  `/api/news`'s `DEFAULT_CONFIDENCE_FILTER` exactly — bound via `= ANY($N)`.
- **0-signal districts** correctly appear: the route queries the `districts`
  base separately and merges rollups into it (functionally equivalent to the
  spec's "LEFT JOIN"), so in-scope districts with no signals render with zeroed
  counts and null `newestSignalAt`. Sort is newest-first, NULLS LAST, then name
  ASC. All three behaviors are unit-tested.
- **Stable serialized query keys** — `["signals-summary", parentKind, parentId,
  csv, since]` and `["district-signals", leaid, csv, since, page]`. `typesCsv`
  collapses the mask object to a canonical-order string so deep-equal masks
  share a cache entry. No raw objects/arrays in keys.
- **Render cap + pagination** — districts render `≤50` client-side with
  `ShowMoreButton`; `FilterHintBanner` at 200+; per-district items
  server-paginated (`limit = page*50`, `offset 0`, like GridView) with an
  in-district "Show more" gated on server `hasMore` (limit+1 sentinel).
- **useEffect cleanup** — the last-visit watermark reads into a ref on mount and
  writes `now` to localStorage in the cleanup, wrapped in try/catch for private
  mode / quota. First visit shows no "new" dots (avoids a sea of dots).
- **Conditional rendering over fetching** — `ExpandedFeed` mounts only when a
  district is expanded, owning its own query; collapse unmounts it and TanStack
  `gcTime` keeps re-expands fast. Batched toolbar `setState` (single patch).
- **Last-view migration is safe** (spec F1): `readLastView` returns null for a
  stored `vacancies`/`news`/`rfps` (no longer in `VIEW_SPECS`) and callers fall
  back to `DEFAULT_VIEW_ID`; `useViewsRouter`'s `isViewId` guard nulls an old
  URL segment. No throw on a stale stored id.
- **Orphan cleanup verified** — no remaining importers of the deleted
  `VacanciesView`/`NewsView`/`RfpsView`; `GridView`/`SOURCE_COLUMNS` retained
  for the List Builder; detail content files retained.
- **Strong tests** — 64 passing across SQL helpers, both routes (auth, scope
  validation, merge, 0-signal, sort, off-type, paging, id coercion, window),
  and all five components + queries.

### Issues

| # | Severity | File | Issue |
| --- | --- | --- | --- |
| 1 | Low | `signals/queries.ts` (L99–116) | `useSignalsSummary` query key omits `leaids` for the list branch — keyed only on `parentKind`/`parentId`. For plans this is correct (server derives leaids); for lists, two different leaid sets under the same `parentId` would collide. Lists are disabled today (Phase E "coming soon"), so this is latent, not active. Add `leaidsKey(leaids)` (already exists in `_shared`) to the key when lists ship. |
| 2 | Low | `app/api/signals/route.ts` (L88–92) | The `leaids` CSV branch is entered for any non-null `leaids` param including empty string (`leaids=`), then short-circuits to an empty result (L101–103). Harmless and arguably correct, but means `?leaids=` returns 200/empty rather than the 400 a caller might expect. Plans path is unaffected. |
| 3 | Nit | `signals/SignalsView.tsx` (L108–115, L156) | Two minor UX gaps: (a) the "Show more districts" `page` is not reset when the search term changes (paginating then searching leaves `page` elevated — visually harmless since the filtered slice is smaller); (b) `expandAll` only recomputes the open set on toggle, so changing the search while expand-all is on won't auto-expand newly-matching rows. Neither is a correctness bug. |
| 4 | Nit | `app/api/signals/__tests__/route.test.ts` (L25–26) | One `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + `as any` on the prisma mock — standard test-mock pragma, confined to a test file. No `any`/`@ts-ignore`/`eslint-disable` in any source file. |

No high- or medium-severity issues found. No N+1 (batched `= ANY($1)`,
`Promise.all` rollups). No XSS surface (no `dangerouslySetInnerHTML`; titles/meta
render as text). No sensitive data in responses. Statement-timeout (57014)
handled gracefully on both routes (returns `truncated: true`, 200).

## Recommendation

**READY FOR REVIEW**

The feature is spec-compliant, secure (fully parameterized SQL, auth-guarded),
performant (serialized keys, ≤50 cap, lazy loads, cleanup), consistent with
codebase patterns, and well-tested (64 passing). The four findings are all
Low/Nit — none block merge; #1 (list query-key + leaids) should be addressed
when list scope ships in Phase E. The reported 3 wider-suite failures are
confirmed outside this feature.
