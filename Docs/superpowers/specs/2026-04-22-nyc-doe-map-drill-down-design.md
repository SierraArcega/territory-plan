# NYC DOE Map Drill-Down — Design Spec

**Date:** 2026-04-22
**Branch:** `worktree-nyc-doe-rollup`
**Author:** Aston + Claude (brainstorm session)
**Status:** Draft — awaiting user review before implementation plan

## Problem

Selecting **New York City Department Of Education** (`leaid=3620580`) on the map
produces a silently broken plan. The district has **0 rows in the `schools`
table** — NYC's actual schools are stored under 32 Community/Geographic School
Districts (leaids `3600076`–`3600103`, `3600119`–`3600123`, `3600152`, `3600153`)
plus NYC charter schools in the `3601xxx` LEAID range. There is no parent-child
relationship in the schema; the rollup and its children are flat siblings.

Observed symptoms (screenshots 2026-04-22 12:01 & 12:02):

- Plan detail shows `Districts: 1`, `Enrollment: 0`, `0 contacts across 0 districts`
- Find Contacts toast reads "Nothing to enrich — all targets already have
  contacts" when in reality there are **zero targets**
- Every school-level feature (Principal enrichment, school lists, opportunities)
  returns empty for rollup-only plans

The April 22 Test plan used in the screenshots is demo data, but the underlying
failure mode applies to any user who picks NYC on the map.

## Goals

1. Clicking the NYC area on the map selects the individual Community School
   District at that point — never the rollup — so District 5 alone is still a
   one-click operation.
2. Users who explicitly want "all of NYC" can opt in via search + an explicit
   CTA, not by accidentally clicking a giant polygon.
3. Plans that already reference the rollup auto-convert to the 32+N child
   districts on their next load, with an audit trail, so no user is stuck with
   a dead plan.
4. The schema change generalizes: the next rollup we discover (another state
   DOE, a charter umbrella, etc.) is a data-entry task, not a code change.

## Non-goals

- Making the rollup entity itself a viable plan target. Rollup plans will
  always auto-expand; selecting the rollup and keeping it as-is is explicitly
  not supported.
- Geographic rollups outside admin hierarchy (e.g., "every school in NYC
  including charters from other networks"). Handled in this spec only because
  NYC charter LEAIDs happen to sit under NYC DOE administratively per user
  decision; a general geographic-region feature is out of scope.
- Fixing the 3 pre-existing test failures on `origin/main`. Separate concern
  tracked under the compilation-warnings memory note.

## Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Scope | NYC-first, schema extensible (new `parent_leaid` column, NYC values seeded now) |
| 2 | Map click | Children always win the hit-test; rollup polygon rendered as outline-only, non-clickable |
| 3 | Existing plans referencing the rollup | Silent auto-migrate on read, inside a DB transaction, with an activity-log entry |
| 4 | Bulk-enrich invoked on a rollup | API returns `reason: "rollup-district"` + children list; UI shows "Expand to N districts" CTA |
| 5 | Scope of "children" under NYC DOE | 32 community districts **AND** NYC charter LEAIDs in the `3601xxx` range |

## Architecture

### Schema change

```sql
ALTER TABLE districts
  ADD COLUMN parent_leaid TEXT NULL REFERENCES districts(leaid) ON DELETE SET NULL,
  ADD CONSTRAINT districts_no_self_parent CHECK (parent_leaid IS NULL OR parent_leaid != leaid);

CREATE INDEX idx_districts_parent_leaid ON districts(parent_leaid);
```

- Self-referencing nullable FK; `ON DELETE SET NULL` so an accidental rollup
  delete orphans children instead of cascading.
- CHECK constraint prevents self-parenting; no runtime cycle prevention needed
  because the seed migration is the only writer.
- Prisma schema mirrors the column and adds the self-relation.

### Seed migration

The migration file enumerates the NYC children explicitly (auditable
one-shot), rather than pattern-matching at runtime. Structure:

1. Set `parent_leaid='3620580'` for the 32 community districts, listed by leaid.
2. Set `parent_leaid='3620580'` for NYC charter LEAIDs found via
   `SELECT leaid FROM districts WHERE state_fips='36' AND leaid LIKE '3601%'` —
   the resulting list is committed to the migration file as a static UPDATE for
   reproducibility.
3. Rollup itself keeps `parent_leaid=NULL`.

### Runtime helpers — new file

`src/features/districts/lib/rollup.ts`:

- `isRollup(leaid: string): Promise<boolean>` — `EXISTS (SELECT 1 FROM districts WHERE parent_leaid = $1)`; cached per request.
- `getChildren(leaid: string): Promise<string[]>` — `SELECT leaid FROM districts WHERE parent_leaid = $1`; cached per request.
- Both helpers return coherent values for a non-rollup district (`false` and `[]`).

### Tile API change

`src/app/api/tiles/[z]/[x]/[y]/route.ts`:

- Add `is_rollup` boolean to each tile feature's properties, derived via
  `(d.leaid IN (SELECT DISTINCT parent_leaid FROM districts WHERE parent_leaid IS NOT NULL))`.
- Bump the tile cache version (`?v=5` → `?v=6`) so clients invalidate old tiles.

### Map rendering

`src/features/map/lib/layers.ts`:

- Split the existing district fill layer by `['get', 'is_rollup']`:
  - `true` → fill transparent, line: 2px dashed plum (existing token), hover disabled
  - `false` / missing → unchanged
- Single source, single source-layer; two paint variants. No new HTTP request.

### Map click handler

`src/features/map/components/MapV2Container.tsx` (~line 1188):

- Replace `districtFeatures[0].properties.leaid` with:
  `districtFeatures.find(f => !f.properties.is_rollup)?.properties.leaid ?? districtFeatures[0]?.properties.leaid`
- Net: if any non-rollup feature is under the cursor, it wins. Rollups only
  ever get selected when no child is at that point (which shouldn't happen for
  NYC since children tile the whole area, but is a safe fallback for future
  rollups with incomplete child coverage).

### Search → right-rail CTA

`DistrictCard.tsx` and search result row:

- Search result: rollup districts render with a dot-separator suffix
  "New York City Department Of Education · 32 community districts".
- On rollup selection, `DistrictCard` shows a top strip:
  - Copy: "Rollup district — contains N community districts with M schools"
  - Primary button: `[Select all N children]` — dispatches a single
    `selectDistricts(childLeaids)` store action (one `set()` per the
    performance convention in CLAUDE.md).
  - Secondary: `[Keep as rollup]` — rendered but disabled with tooltip
    "Will return 0 contacts — not recommended". Left in place for future
    read-only use cases; adding the button now avoids a follow-up PR.

### Plan read auto-migrate

`src/app/api/territory-plans/[id]/route.ts`:

- On GET, after loading `territory_plan_districts`, pass the leaid list through
  an expansion step:
  1. For each leaid, call `getChildren(leaid)`; if non-empty, collect the children.
  2. If any expansion occurred, within a single DB transaction:
     - `DELETE FROM territory_plan_districts WHERE plan_id=? AND leaid IN (rollupLeaids)`
     - `INSERT ... ON CONFLICT DO NOTHING` (dedup against children the user already selected)
     - Write an activity-log row: `type='system-migration'`, `subtype='rollup-expanded'`, metadata includes `{rollupLeaid, childLeaids: [...]}`.
  3. Re-read the plan and return.
- Idempotent: on a subsequent load, `getChildren` returns nothing expandable (children have `parent_leaid` set but are themselves leaves).
- Transactional: a write failure aborts the migration and the request returns
  500; a refresh retries cleanly.

### Plan write guard

POST/PUT `/api/territory-plans/[id]` and `/api/territory-plans` (create):

- Before writing `territory_plan_districts`, expand any rollup leaids in the
  request payload to their children. Writer never stores rollup leaids.
- Client doesn't need to know; the API is the source of truth.

### Bulk-enrich guard

`src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` (actual path;
bulk-enrich is plan-level, not district-level):

- Pre-check: inspect the plan's `districts` for any rollup leaids (via
  `getRollupLeaids(planLeaids)` helper); if any are present, return HTTP 400
  with `{ error, reason: "rollup-district", rollupLeaids: string[], childLeaids: string[] }`.
- Stays in place after auto-migrate ships as a defensive layer for any rollup
  not yet identified.

### UI toast change

Bulk-enrich toast consumer at `src/features/plans/components/ContactsActionBar.tsx`
(specifically around line 131, which currently emits "Nothing to enrich — all
targets already have contacts"):

- Catch the 400 response with `reason: "rollup-district"` before the existing
  `result.queued === 0` branch; toast copy becomes "NYC DOE contains N
  community districts. [Expand to N districts]" with a click-through action
  that calls a new endpoint `PATCH /api/territory-plans/[id]/expand-rollup`
  (passing the rollup leaid), then re-triggers bulk-enrich.
- Existing toast copy "Nothing to enrich — all targets already have contacts"
  stays for the legitimate case (all schools already have primaries) which is
  `queued === 0` on a non-rollup plan.

### Expand-rollup endpoint

`src/app/api/territory-plans/[id]/expand-rollup/route.ts` (new):

- `PATCH { rollupLeaid }` → performs the same expansion logic as the auto-migrate
  path, returns the updated plan. Used by the bulk-enrich toast CTA and by the
  "Convert now" button if we ever surface one.

## Data flow

1. **Map render** — tile API tags each feature with `is_rollup`; paint layer
   renders rollups as outline-only.
2. **User clicks in Brooklyn** — `queryRenderedFeatures` returns `[District 20, NYC DOE]`; handler picks the non-rollup (District 20). Single-district flow proceeds unchanged.
3. **User searches "NYC DOE"** — search result marked; clicking opens
   `DistrictCard` with the rollup strip. "Select all 32 children" dispatches a
   batched `selectDistricts` action.
4. **User opens an old plan referencing the rollup** — GET endpoint auto-expands
   inside a transaction, writes activity log, returns expanded plan. User sees
   32+N rows on first load; no banner needed.
5. **User saves a plan with rollup leaids** — write endpoint expands server-side; rollup leaids never reach the table.
6. **Find Contacts on a rollup leaid** (fallback path) — API returns
   `reason: "rollup-district"`; UI toast offers "Expand to N districts";
   one-click expansion via the new PATCH route.

## Error handling & edge cases

- **Rollup with zero children in DB** (pre-migration state): treated as a
  regular district — no expansion, no special UX, same as today.
- **Child that's already in the plan explicitly**: dedup by leaid when inserting
  during expansion.
- **Plan holding only the rollup**: same treatment — becomes 32+N children on
  first load.
- **Rollup → child cycle**: impossible in this model. A child has
  `parent_leaid` set, so it's always a leaf (`isRollup` returns false for it).
- **Delete of a rollup row**: FK `ON DELETE SET NULL` orphans children (they
  become top-level districts again). Extremely unlikely but safer than
  cascading.
- **Tile cache staleness**: cache version bump `?v=5` → `?v=6` invalidates
  client tiles; the service worker / browser cache picks up the new version on
  next load.
- **Race on concurrent plan read + manual edit**: the auto-migrate transaction
  holds a row lock on `territory_plan_districts` for the plan; a concurrent
  edit serializes behind it. The activity log and the district set are always
  consistent.

## Testing plan

### Unit — Vitest

- `rollup.ts` helpers: rollup with children, leaf, rollup with zero children.
- Auto-migrate expansion: rollup-only plan → 32+N children; mixed plan
  (rollup + unrelated district) → rollup replaced + unrelated preserved;
  plan already containing children + rollup → children preserved, rollup
  dropped (dedup).
- Click hit-test picker: overlapping rollup+child → child wins; child-only →
  child; rollup-only (no children at that point) → rollup (fallback).

### Integration — Vitest + test DB

- POST `/api/territory-plans/[id]` with rollup in body → stored as children.
- GET `/api/territory-plans/[id]` on plan with rollup row → returns 32+N child
  rows, activity log entry written, subsequent GET idempotent.
- POST `/api/districts/3620580/bulk-enrich-principals` → 400 with
  `reason: "rollup-district"` and `children` array.
- PATCH `/api/territory-plans/[id]/expand-rollup` → converts rollup → children,
  writes audit log, returns expanded plan.
- Tile API: `is_rollup=true` for 3620580, `false` for 3600076.

### Component — Vitest + Testing Library (jsdom)

- `DistrictCard` with `isRollup=true`: renders strip with correct counts and
  both buttons; "Select all" click dispatches `selectDistricts(childLeaids)`
  with exactly N leaids in one store action.
- Bulk-enrich error toast for `reason: "rollup-district"` matches spec copy
  and button wiring.

### Manual smoke (dev server port 3005)

- Click Brooklyn map → District 20 (or resident district) selected, not NYC DOE.
- Search "NYC DOE" → right-rail shows rollup strip with 32+N counts.
- Open the April 22 Test plan (or a seed plan with leaid 3620580) → first load
  shows 32+N districts, non-zero enrollment, activity feed has
  "rollup-expanded" entry.
- Find Contacts on expanded plan → normal flow, contacts populated.
- Select all 32 via the right-rail CTA → plan-add flow accepts all in one shot.

### Out of scope for tests

- Playwright E2E for map clicks — the click picker is unit-testable at the
  handler level; E2E for pure MapLibre interactions is historically flaky.
- Load testing for auto-migrate at scale — NYC DOE's ~50 children is the only
  known rollup; scaling concerns aren't applicable.

## Operator prerequisite — child polygon geometry

**Lesson learned during shipping:** the "children win map clicks" design
requires children to have real polygon `geometry` in the `districts` table.
The initial assumption (from an exploration pass) that NYC's 32 Community
School Districts had polygons was wrong — they only had `point_location`
(geocoded centroids). `district_map_features.render_geometry` (a
`COALESCE(geometry, point_location)` fallback in the matview) therefore
emitted 1-point geometries for CSDs, and MapLibre couldn't hit-test them.

**Resolution:** `prisma/seed-nyc-csd-polygons.ts` imports NYC Open Data's
"School Districts" dataset (id `8ugf-3d8u`, 33 features covering CSDs 1-32
with District 10 as two non-contiguous parts merged via scalar `ST_Union`)
into `districts.geometry`. District 75 (citywide admin overlay, not a
geographic region) and the 276 NYC charters remain as points — they're not
admin boundaries in the traditional sense.

**Matview refresh required after any geometry import:** `district_map_features`
is a materialized view (`relkind='m'`), so new geometries don't appear in
tiles until a `REFRESH MATERIALIZED VIEW district_map_features;` runs. Plan
for any future rollup seeding: (a) import geometry, (b) refresh matview,
(c) bump tile cache version so clients re-fetch.

**Future rollups:** we'd likely follow the same three-step pattern. The
`parent_leaid` column is agnostic to geometry source — it only requires the
children exist in `districts`. Populating `geometry` for the children is a
separate data-ingestion concern.

## Known limitations / follow-ups

- **Historical queries using the rollup leaid** return empty (e.g., leaderboards
  filtered by `district.leaid=3620580`). Accepted — users should use children
  going forward. Could be addressed later by a "rollup-aware leaderboard" view.
- **Zoom-to-district on NYC DOE outline**: keeps existing behavior (bbox covers
  5 boroughs). No new work.
- **MCP server / CSV import / direct API users** that insert rollup leaids: no
  entry-point guard added. Auto-migrate on plan read is the backstop.
- **Discovery of additional rollups**: we don't auto-detect them. When a new
  rollup surfaces, we add rows to `parent_leaid` manually; the UX works without
  code changes.
- **Charters vs. community districts are undifferentiated in the rollup** —
  NYC DOE's 309 children include 33 Geographic/Special districts and 276
  charters. The DistrictCard strip copy ("N child districts") and the "Select
  all N children" CTA treat them uniformly. A future enhancement could split
  them into two sub-tabs (community districts / charters) or introduce a
  separate `nyc-charters` pseudo-rollup so users can pick one group at a time.
- **District 75 has no polygon** and renders as a point. Users can find it
  via search but can't click a boundary on the map. Not addressable without
  inventing a geometry for a citywide admin overlay that has no geographic
  footprint distinct from NYC DOE's.

## File touchpoints

New:
- `prisma/migrations/<timestamp>_add_parent_leaid/migration.sql`
- `src/features/districts/lib/rollup.ts`
- `src/app/api/territory-plans/[id]/expand-rollup/route.ts`

Modified:
- `prisma/schema.prisma` (District.parentLeaid self-relation)
- `src/app/api/tiles/[z]/[x]/[y]/route.ts` (is_rollup property + cache version)
- `src/features/map/lib/layers.ts` (rollup paint rule)
- `src/features/map/components/MapV2Container.tsx` (click hit-test picker)
- `src/features/map/components/right-panels/DistrictCard.tsx` (rollup strip)
- `src/features/map/components/SearchBar/*` (rollup badge in results)
- `src/features/map/lib/store.ts` (new `selectDistricts(leaids[])` batched action, if not already present)
- `src/app/api/territory-plans/[id]/route.ts` (auto-migrate on GET)
- `src/app/api/territory-plans/route.ts` + `src/app/api/territory-plans/[id]/route.ts` (write guard on POST/PUT)
- `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` (rollup pre-check; plan-level bulk-enrich, not district-level)
- `src/features/plans/components/ContactsActionBar.tsx` (toast copy + expand CTA around line 131)
- Tests co-located under each touched module's `__tests__/`
