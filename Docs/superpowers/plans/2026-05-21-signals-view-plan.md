# Implementation Plan: Signals View

**Date:** 2026-05-21
**Slug:** signals-view
**Branch:** worktree-saved-views-sidebar
**Spec:** `docs/superpowers/specs/2026-05-21-signals-view-spec.md`
**Backend context:** `docs/superpowers/specs/2026-05-21-signals-view-backend-context.md`

## Approach

Two read-only endpoints feed an inline-accordion tree:

- `GET /api/signals` → **summary**: every in-scope district with per-type counts +
  `newestSignalAt` + name/state. Lightweight aggregate → returns the *full* set
  (no server pagination); client renders ≤50 with "Show more" and filters search
  over the full set. (This refines the spec's `/api/signals/summary` path — the
  summary lives at the route root; items live under `[leaid]`.)
- `GET /api/signals/[leaid]` → **items**: that district's merged reverse-chron
  signals, server-paginated (`limit`/`offset`), fetched on expand.

Both auth-guarded, raw parameterized SQL over the readonly pool
(`src/lib/db-readonly.ts`), `leaid = ANY($1)` batches (no N+1), mirroring
`/api/views/data`.

### Canonical date / scope rules (apply in both endpoints)

- **Vacancies:** `COALESCE(date_posted, first_seen_at)` for sort + `since` + newest.
  District key `leaid`.
- **News:** `published_at`; district key via `news_article_districts.leaid` with
  `confidence IN ('high','llm','source')` (matches `/api/news`).
- **RFPs:** `captured_date` (canonical `date`, matches the existing feed + sort);
  `due_date` surfaced as secondary meta. District key `leaid` (NULL excluded by
  `= ANY`, so unresolved RFPs drop out).
- **Scope:** `planId` → resolve leaids from `territory_plan_districts.district_leaid`
  server-side (keeps URL/query-key small). Else `leaids` CSV (lists, Phase E).
- **`since`:** `7d|30d|90d|all` → ISO cutoff (default `30d`); `all` omits the filter.
- **`types`:** csv subset of `vac,news,rfp` (default all) → include/exclude per source.

---

## Backend tasks

### B1 — `GET /api/signals` (summary)
**File:** `src/app/api/signals/route.ts` (new)
- Auth-guard (`getUser()`, 401). Parse `planId | leaids` (one required, else 400),
  `types`, `since`.
- Resolve scope leaids (plan lookup or CSV).
- Three grouped sub-selects (`COUNT(*)`, `MAX(date)`) per source filtered by
  `leaid = ANY($1)` + `since`, merged by leaid into `{vac,news,rfp,newest}`.
- LEFT JOIN `SELECT leaid, name, state_abbrev FROM districts WHERE leaid = ANY($1)`
  so **0-signal districts still appear**.
- Sort districts: `newestSignalAt` desc NULLS LAST, then `name` asc.
- Respond `{ districts: Array<{ leaid, name, stateAbbrev, counts:{vac,news,rfp}, newestSignalAt }>, total }`.
- **Test:** unit-test the `since`→cutoff and `types`→source-mask helpers; a route
  test asserting shape + that an in-scope leaid with no signals is present with
  zeroed counts (mock readonly pool / prisma).

### B2 — `GET /api/signals/[leaid]` (items)
**File:** `src/app/api/signals/[leaid]/route.ts` (new)
- Auth-guard. Params `types`, `since`, `limit` (default 50, max 100), `offset`.
- `UNION ALL` of the three sources for the single `leaid`, normalized projection
  `(type, id::text, title, date, secondaryDate, meta)`; `ORDER BY date DESC`;
  `LIMIT limit+1 OFFSET offset` to compute `hasMore`.
  - vac: `id`, `title`, `date=COALESCE(date_posted,first_seen_at)`, `meta=category/status`.
  - news: `id`, `title`, `date=published_at`, `meta=source`.
  - rfp: `id::text`, `title`, `date=captured_date`, `secondaryDate=due_date`, `meta=agency_name`.
- Respond `{ items: Array<{ type:'vac'|'news'|'rfp', id, title, date, secondaryDate?, meta? }>, hasMore }`.
- **Test:** route test asserting reverse-chron merge across sources, `hasMore`
  paging, rfp `id` serialized as string, `types` filter excludes a source.

### B3 — shared signal SQL lib (optional extraction)
**File:** `src/lib/signals/sql.ts` (new) — `sinceCutoff(window)`, `parseTypes(csv)`,
per-source SQL fragment builders, so B1/B2 share the date/scope rules.
- **Test:** `src/lib/signals/__tests__/sql.test.ts` — cutoff math, type masks.

---

## Frontend tasks

All new components under `src/features/views/components/views/signals/`.

### F1 — Tab registry + canvas switch
**Files:** `src/features/views/lib/view-types.ts`, `src/features/views/components/GroupCanvas.tsx`
- `view-types.ts`: remove `vacancies|news|rfps` from `ViewId`/`VIEW_SPECS`; add
  `{ id:"signals", label:"Signals", icon: RadioTower, detailKind:"district" }`.
  Keep `DetailKind` unchanged.
- `GroupCanvas` `ViewBody`: drop the 3 cases + imports; add
  `case "signals": return <SignalsView leaids parentKind parentId savedLayouts />`.
- **Last-view fallback:** ensure `isViewId` / `GroupViewList` last-view read maps a
  stored `vacancies|news|rfps` to `signals` (or `DEFAULT_VIEW_ID`) instead of an
  invalid-view throw.
- **Test:** `view-types` — `isViewId("signals")` true, old ids false; `ViewTabsStrip`
  renders a Signals tab and not the 3 old ones.

### F2 — Query hooks
**File:** `src/features/views/components/views/signals/queries.ts` (or append to `views/lib/queries.ts`)
- `useSignalsSummary({ parentKind, parentId, leaids, types, since })`
  - key `["signals-summary", parentKind, parentId, typesCsv, since]`;
    `enabled` when plan (parentId) or non-null leaids.
- `useDistrictSignals({ leaid, types, since, page })`
  - key `["district-signals", leaid, typesCsv, since, page]`; `enabled` on expand;
    `limit = page*50`, `offset:0` (whole-window refetch, like GridView).
- **Test:** key stability (same inputs → same key string; object inputs don't leak).

### F3 — `SignalTypeTag`
**File:** `signals/SignalTypeTag.tsx`
- Props `{ type, withLabel? }`. Lucide `UserSearch`/`Newspaper`/`FileText`,
  `currentColor`, per-type tint token. Used by leaf rows + count chips.
- **Test:** renders correct icon + label per type.

### F4 — `SignalItemRow`
**File:** `signals/SignalItemRow.tsx`
- Props: one item. Renders type tag · title (truncate, `whitespace-nowrap`) ·
  meta line · relative date right. Root has `data-row-kind={vacancy|news|rfp}`
  (`vac→vacancy`) + `data-row-id={String(id)}`. Hover bg `#F7F5FA`.
- **Test:** correct `data-row-kind`/`data-row-id` (rfp numeric id → string);
  secondary date renders for rfp.

### F5 — `SignalDistrictRow`
**File:** `signals/SignalDistrictRow.tsx`
- Collapsed header: chevron · name (plum/muted) · per-type count chips (hidden at
  0) · freshness (relative age + coral `•` when `newestSignalAt > lastVisit`).
- 0-signal: muted, "No signals", chevron hidden, not expandable.
- Expanded: mounts `useDistrictSignals` (so it owns its query per
  conditional-rendering rule); skeleton item rows while loading; inline
  "Couldn't load · Retry" on error; "Show more" within district when `hasMore`.
- `expanded` controlled by parent (for expand-all); local page state for show-more.
- **Test:** expand mounts items query; 0-signal not expandable; show-more bumps page.

### F6 — `SignalsControls`
**File:** `signals/SignalsControls.tsx`
- Type chips (toggle, all-on default), time-window select (7/30/90/All, default 30),
  district search input (disabled-placeholder while summary loads), expand/collapse-all
  toggle. Toolbar `overflow-x-auto`. Emits changes up to `SignalsView`.
- **Test:** toggling a chip / window calls back with new value; search input controlled.

### F7 — `SignalsView` (orchestrator)
**File:** `signals/SignalsView.tsx` — the `case "signals"` body. Props `ViewBodyProps`.
- Holds toolbar state (`types`, `since`, `search`, `expandAll`) in one batched setter.
- `useSignalsSummary`; client-side: filter by `search`, render ≤50 rows with
  "Show more districts", 200+ filter-hint banner. Freshness order comes from server.
- Expand-all toggles a controlled expand set; per-row lazy load still applies.
- Freshness last-visit: read `localStorage["signals:lastVisit:"+parentKind+":"+parentId]`
  into a ref on mount, write `now` on unmount (cleanup) per CLAUDE.md.
- States: summary loading → skeleton district rows; whole-empty → "No signals match
  these filters" + reset; plan w/ no districts → add-districts prompt; **list scope
  (leaids null) → "Signals for lists coming soon"**; summary error → `ErrorState` retry.
- **Test:** renders district rows from mocked summary; search filters; chip toggle
  changes query key; list scope shows coming-soon; empty/error states.

### F8 — Remove orphaned views
**Files:** delete `views/VacanciesView.tsx`, `views/NewsView.tsx`, `views/RfpsView.tsx`,
`views/__tests__/NewsView.test.tsx`.
- **Pre-check:** grep importers first; keep `GridView`, `SOURCE_COLUMNS`,
  `SOURCE_FIELDS` (List Builder source selection still uses `vacancies|news|rfps`
  as `SavedListSource`) and all `detail/*DetailContent.tsx` (still routed).
- **Test:** `npm run build` + full vitest confirm no dangling imports.

---

## Ordering & parallelism

- **Track A (backend):** B3 → B1 ∥ B2. Independent of frontend (contract fixed above).
- **Track B (frontend):** F3 → F4 → F6 → F5 → F7, then **F1** (flip the tab/switch),
  then **F8** (cleanup). F2 anytime before F5/F7.
- Tracks A and B run in parallel (two implementer agents). Integration check after
  both: expand a real plan's Signals tab against the live endpoints.

## Test strategy summary

- **Unit:** `since`/`types` helpers (B3), query-key stability (F2), `SignalTypeTag`
  (F3), `SignalItemRow` data-attrs + id coercion (F4).
- **Component:** `SignalDistrictRow` expand/lazy/0-signal (F5), `SignalsControls`
  callbacks (F6), `SignalsView` summary render + search + chip refetch + list
  coming-soon + states (F7).
- **Route:** B1 shape + 0-signal district present; B2 reverse-chron merge, paging,
  rfp id string, type filter.
- **Regression:** `view-types`/`ViewTabsStrip` show one Signals tab; `npx vitest run`
  + `npm run build` green after F8.

## Risks / notes

- **List scope (Phase E):** lists have no leaid set yet → coming-soon note; plans
  fully work. Not a blocker, called out in spec Out-of-Scope.
- **RFP `date` = `captured_date`** (ingest time) is the freshness key; `due_date`
  is secondary meta. If reps expect `posted_date` ordering, that's a fast follow.
- **District search completeness** relies on summary returning the full set — keep
  the summary query lightweight (aggregate only, no item payload).
