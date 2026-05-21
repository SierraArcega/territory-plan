# Feature Spec: Signals View (merge Vacancies + News + RFPs)

**Date:** 2026-05-21
**Slug:** signals-view
**Branch:** worktree-saved-views-sidebar

## Summary

Replace the three separate Saved-Views tabs — **Vacancies**, **News**, **RFPs** —
with a single **Signals** view. Signals is a district-grouped, inline accordion
tree: each district is a collapsible row that expands in place to reveal one
mixed, reverse-chronological feed of that district's signals. The goal is one
clear picture per district — "what's happening across my territory" — without
hopping between three tabs.

## Requirements

From discovery (stage 1a):

- **Scope of "signals":** exactly the three existing sources — Vacancies, News, RFPs.
- **Structure:** district-grouped. Each district expands into a *single* mixed,
  reverse-chronological list; every leaf row is tagged with its type (VAC / NEWS / RFP).
- **District (collapsed) row:** district name + per-type counts (e.g. "3 vac · 2 news · 1 rfp")
  + a freshness indicator (age of newest signal; a "new" dot when newer than last visit).
- **Default district sort:** freshness — district with the most-recent signal first.
  0-signal districts sort last (alphabetical among themselves).
- **Empty districts:** show *all* in-scope districts, including ones with 0 signals
  (rendered "No signals", not expandable).
- **Top controls:** type filter chips (Vacancies / News / RFPs) · time window
  (7d / 30d / 90d / All) · district search · expand-/collapse-all.
- **Leaf click:** opens the existing detail panel for that entity (vacancy/news/rfp).
- **Tabs:** the three separate tabs are *replaced* by one Signals tab.

### Constraints

- Performance (CLAUDE.md): paginate lists, never render >50 items at once,
  stable (serialized-primitive) query keys, batch store mutations, isolate
  subscriptions, clean up on unmount.
- Narrow-width resilience: every text span gets `whitespace-nowrap` + a planned
  overflow behavior; sidebars/right-rails routinely squeeze this column.
- Brand: Fullmind plum-derived neutrals + tokens (no Tailwind grays); Lucide
  icons with `currentColor`.
- Mobile: panel uses `touch-action: pan-y` and global `-webkit-overflow-scrolling`;
  never `overflow:hidden` on html/body.

### Success criteria

- A rep opens a plan's Signals tab and immediately sees their districts ordered
  by most-recent activity, with at-a-glance counts.
- Expanding a district shows its vacancies/news/RFPs interleaved newest-first.
- Clicking any item opens the same detail panel that exists today.
- No measurable regression in tab-switch perf; initial render shows only district
  summary rows (items load on demand).

## Visual Design

**Approved approach:** Inline accordion tree (single scroll column; districts
expand in place). Layout chosen over master–detail split and sticky-header feed.

### Tab registry

`src/features/views/lib/view-types.ts`:
- `ViewId` drops `"vacancies" | "news" | "rfps"`, adds `"signals"`.
- `VIEW_SPECS` replaces the three entries with one:
  `{ id: "signals", label: "Signals", icon: RadioTower, detailKind: "district" }`.
  - `detailKind` is a harmless placeholder — Signals rows declare their own
    `data-row-kind`, so the central click delegation in `GroupCanvas` routes per row.
- `DetailKind` is **unchanged** (`vacancy` / `news` / `rfp` remain valid).
- Tab order: Map · Table · Kanban · Contacts · Opps · **Signals**.

### Toolbar (sticky, top of view)

- **Type chips** — Vacancies / News / RFPs; toggle on/off; all on by default.
  Toggling off removes that type from counts, items, and freshness. Active =
  filled plum; inactive = outline. (Server param `types=vac,news,rfp`.)
- **Time window** — segmented/select `7d / 30d / 90d / All`. **Default: 30d.**
  Filters on each source's chronological date.
- **District search** — text input; client-side filter on district name over
  the already-loaded summary rows (no refetch). Disabled-placeholder while
  summary loads (show loading state, don't hide UI).
- **Expand / collapse all** — single toggle; expanding triggers lazy item loads.

Toolbar is horizontally scrollable (`overflow-x-auto`) on narrow widths.

### District row (collapsed)

```
▾  Springfield SD          [3 vac][2 news][1 rfp]   • 2d
```
- Chevron (rotates on expand) · district name (plum `#403770`, 600 weight).
- Per-type count chips, tinted by type, hidden when that type's count is 0.
- Freshness on the right: relative age of newest signal (e.g. "2d"); a coral
  `#F37167` dot when `newestSignalAt` is newer than the user's last visit
  (`localStorage` key `signals:lastVisit:{plan|list}:{id}`, written on
  mount/unmount).
- **0-signal district:** muted name (`#8A80A8`), "No signals" right-aligned
  (`#A69DC0`), chevron hidden, not expandable.
- Hover: row bg `#F7F5FA`.

### Signal leaf row (indented, reverse-chronological)

```
   VAC   HS Math Teacher posted              2d
   RFP   Tutoring services · due 6/15        3d
   NEWS  Board approves ESSER budget         4d
```
- Type tag = Lucide icon + 3-letter label, tinted (Vacancy `UserSearch`,
  News `Newspaper`, RFP `FileText`).
- Title (truncates, `whitespace-nowrap` + ellipsis) · meta line (12px muted:
  source/category, secondary date such as RFP due date) · relative date right.
- Whole row has `data-row-kind={vacancy|news|rfp}` + `data-row-id={id}`.
  **RFP ids are `Int` — stringify in the attribute** (detail content `parseInt`s).
- Click → `GroupCanvas` delegation sets `?detail=kind:id` → existing detail panel.
- Hover: bg `#F7F5FA`; cursor pointer.

## Component Plan

### Existing components to reuse
- Detail panels: `VacancyDetailContent`, `NewsDetailContent`, `RfpDetailContent`
  via `DetailPanel` + `useViewsRouter.openDetail` — **no changes**.
- `_shared` view helpers: `EmptyState`, `ErrorState`, `LoadingState`,
  `ShowMoreButton`, `ViewScroll`, `PAGE_SIZE`, `ViewBodyProps`
  (`src/features/views/components/views/_shared`).
- `GroupCanvas` click delegation on `[data-row-kind][data-row-id]` — reused as-is.
- TanStack Query patterns from `src/features/views/lib/queries.ts`.

### New components — `src/features/views/components/views/signals/`
- `SignalsView.tsx` — view body (the `case "signals"` slot). Owns toolbar state
  (types, window, search, expand-all) + the summary query; renders district rows.
- `SignalsControls.tsx` — the sticky toolbar (chips, window select, search,
  expand/collapse-all).
- `SignalDistrictRow.tsx` — one collapsible district (header + lazy feed on expand).
- `SignalItemRow.tsx` — one leaf signal row (type tag, title, meta, date, data-attrs).
- `SignalTypeTag.tsx` — the tinted VAC/NEWS/RFP tag (shared by leaf rows + count chips).
- Query hooks (in `signals/queries.ts` or appended to `views/lib/queries.ts`):
  - `useSignalsSummary({ parentKind, parentId, leaids, types, since })`
  - `useDistrictSignals({ leaid, parentId, types, since })` — enabled on expand.

### Components to extend
- `view-types.ts` — registry change above.
- `GroupCanvas.tsx` — `ViewBody` switch: remove the three `vacancies`/`news`/`rfps`
  cases + imports, add `case "signals": return <SignalsView … />`.
- Remove now-orphaned `views/VacanciesView.tsx`, `views/NewsView.tsx`,
  `views/RfpsView.tsx` (+ `NewsView` test). Confirm no other importer first;
  the per-source `GridView` and `SOURCE_COLUMNS` for these sources stay (still
  used by the List Builder's source selection). Detail content files stay.
- `GroupViewList` / last-view persistence: any stored last-view of
  `vacancies`/`news`/`rfps` must fall back to `signals` (or the default) instead
  of throwing on an unknown `ViewId`.

## Backend Design

See: `docs/superpowers/specs/2026-05-21-signals-view-backend-context.md`.

- **New models/tables:** none. Reuses `vacancies`, `news_articles` +
  `news_article_districts`, `rfps`, `districts`.
- **New API routes** (raw SQL over the readonly pool, mirroring `/api/views/data`):
  - `GET /api/signals/summary?planId&types&since` → one row per in-scope district:
    `{ leaid, districtName, counts: { vac, news, rfp }, newestSignalAt }`.
    Built from three grouped sub-selects (`vacancies.date_posted`,
    `news_articles.published_at` via the join table, `rfps.captured_date`)
    merged by leaid and **LEFT JOINed against `districts`** so 0-signal districts
    still appear. Sorted by `newestSignalAt` desc, nulls last (then name asc).
    Paginated at district level (limit/offset).
  - `GET /api/signals/[leaid]?planId&types&since&limit&offset` → that district's
    merged reverse-chronological items:
    `{ kind, id, title, meta, secondaryDate?, date }[]`, capped per page.
- **Scope:** plans pass `plan.districtLeaids` (full set → enables 0-signal rows).
  Lists resolve to `null` today (Phase E) → Signals shows a "coming soon" note
  for lists. The freshness sort + counts require the leaid set up front, which
  plans provide.
- **New queries:** the two SQL queries above. RFP `leaid` is nullable — rows with
  no resolved leaid are excluded (they belong to no district).

## States

- **Loading:** initial summary → shimmer district rows (~5); district expand →
  inline skeleton item rows beneath the district while its feed loads.
- **Empty:**
  - Whole view, filters exclude everything → "No signals match these filters" + reset.
  - Plan has no districts → prompt to add districts to the plan.
  - List scope (null) → "Signals for lists are coming soon" note.
- **Error:** summary fetch → `ErrorState` with retry; per-district items fetch →
  inline "Couldn't load signals · Retry" under that district (does not blank the tree).

## Performance Notes

- Query keys use serialized primitives: `["signals-summary", parentKind, parentId, typesCsv, since]`
  and `["district-signals", leaid, parentId, typesCsv, since, offset]`.
- District list paginates at ≤50 rows ("Show more districts"); 200+ shows a
  filter-hint banner. Per-district items cap ~50 with in-district "Show more".
- Items load only on expand; TanStack `gcTime` keeps re-expands instant.
- District search filters client-side (no refetch). Toolbar toggles that change
  `types`/`since` refetch the summary (new stable key).
- Expand/collapse state batched into a single store/`setState` update.

## Out of Scope

- Custom/saved Signals filter presets; a "+ View" custom-view editor.
- A cross-district global (ungrouped) feed — Signals is always district-grouped.
- Writing back to / dismissing signals; bulk actions on signals.
- Resolving list leaid sets (Phase E) — lists get Signals once scope resolves.
- Mobile-specific layout beyond narrow-width resilience.
- Changing the underlying ingest/classification of vacancies, news, or RFPs.
