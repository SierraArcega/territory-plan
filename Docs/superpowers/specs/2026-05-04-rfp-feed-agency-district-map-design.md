# Feature Spec: RFP Feed — Agency District Map (Manual Match UI)

**Date:** 2026-05-04
**Slug:** rfp-feed-agency-district-map
**Branch:** `feat/rfp-feed-agency-district-map`
**Phase 1 spec:** [`2026-05-04-rfp-feed-backend-spec.md`](./2026-05-04-rfp-feed-backend-spec.md)
**Phase 1 backend context:** [`2026-05-04-rfp-feed-backend-backend-context.md`](./2026-05-04-rfp-feed-backend-backend-context.md)

## Summary

Phase 2 of the RFP Feed feature. Phase 1 ships an automated district resolver (3-tier name match) that successfully resolves ~58% of RFPs nationwide, but ~1,029 RFPs remain unresolved with patterns the resolver can't fix on its own (NYC abbreviations, "Other Virginia Localities (Legacy)", City-of-X wrappers, charter networks, state agencies). Sales reps need a way to manually map a HigherGov `agency_key` to a `District.leaid` *once* and have that mapping cascade to all current and future RFPs from that agency.

This spec mirrors the existing `unmatched-opportunities` admin pattern exactly — same `AdminFilterBar`, `AdminColumnPicker`, `DataGrid`, paginated route, resolution modal — and extends it with three resolution outcomes (district / state-only / non-LEA) and bulk multi-select.

## Requirements

- One-click mapping of `agency_key → District.leaid` that cascades to every RFP with that `agency_key` (current + future).
- Three resolution outcomes per agency:
  1. **Mapped to district** — agency belongs to a specific LEA in the `District` table.
  2. **Mapped to state-only** — agency is legit state-level (SEA, charter network, county wrapper) but no single LEA fits; tag with state for context.
  3. **Dismissed as non-LEA** — agency is not relevant (vendor, federal entity, mis-classified); suppress from triage view.
- Bulk multi-select: choose N agencies in the table, apply the same outcome to all in one transaction.
- Edit/undo: change a previous mapping; "Remove mapping" reverts the agency to untriaged and nulls `Rfp.leaid` for that `agency_key` until next sync re-runs the name-match resolver.
- Resolver checks `AgencyDistrictMap` first; override always wins over name match.
- Sales-rep-facing display: district name + state badge, never raw `leaid` strings (per project convention).
- Admin-only access via existing Supabase auth pattern.

## Visual Design

Mirrors `src/app/admin/unmatched-opportunities/page.tsx` 1:1. Same plum-derived neutrals (`#403770`, `#F7F5FA`, `#EFEDF5`), same KPI summary cards row, same `AdminFilterBar` chips, same `DataGrid` with sortable headers and pagination footer. Resolution modal mirrors `DistrictSearchModal`: agency name + state badge in header, suggested matches above a manual search input, "Create new district" sub-flow, district row click confirms in one step.

**New chrome on top of the existing pattern:**
- Checkbox column on the left of the `DataGrid` (added to the shared component as a generic `selectable` prop).
- Sticky bulk-action bar that slides in from the bottom when ≥1 row is selected: `Map N → district…` / `Mark N → state-only…` / `Dismiss N as non-LEA…`.
- Status badge column showing the current outcome (Untriaged / → District Name / → State (state) / Non-LEA).

## Backend Design

### Prisma schema additions

Append to `prisma/schema.prisma`:

```prisma
model AgencyDistrictMap {
  agencyKey   Int       @id @map("agency_key")
  kind        String                                       // "district" | "state" | "non_lea"
  leaid       String?   @db.VarChar(7)                     // set iff kind="district"
  stateFips   String?   @db.VarChar(2) @map("state_fips")  // set iff kind="state"
  source      String    @default("highergov")
  notes       String?   @db.Text
  resolvedBy  String?   @map("resolved_by")                // Supabase auth uid
  resolvedAt  DateTime  @default(now()) @map("resolved_at")
  district    District? @relation(fields: [leaid], references: [leaid])

  @@map("agency_district_maps")
  @@index([kind])
  @@index([leaid])
}
```

Inverse relation on `District`:
```prisma
agencyMaps AgencyDistrictMap[]
```

### Migration

Hand-written SQL per Phase 1's deployment learning (Prisma `migrate dev` doesn't work due to shadow-DB drift; apply via `prisma db execute` then `prisma migrate resolve --applied`).

```sql
-- migration: add_agency_district_maps
CREATE TABLE agency_district_maps (
  agency_key   integer PRIMARY KEY,
  kind         text NOT NULL CHECK (kind IN ('district', 'state', 'non_lea')),
  leaid        varchar(7) REFERENCES districts(leaid),
  state_fips   varchar(2),
  source       text NOT NULL DEFAULT 'highergov',
  notes        text,
  resolved_by  text,
  resolved_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_district_maps_kind_consistency CHECK (
    (kind = 'district' AND leaid IS NOT NULL AND state_fips IS NULL) OR
    (kind = 'state'    AND leaid IS NULL     AND state_fips IS NOT NULL) OR
    (kind = 'non_lea'  AND leaid IS NULL     AND state_fips IS NULL)
  )
);
CREATE INDEX agency_district_maps_kind_idx  ON agency_district_maps (kind);
CREATE INDEX agency_district_maps_leaid_idx ON agency_district_maps (leaid);
```

No data migration — table starts empty. The first time a rep maps an agency, the row appears.

### Resolver change

`src/features/rfps/lib/district-resolver.ts`

Rename `resolveDistrict(agencyName, stateAbbrev)` → `resolveAgency({ agencyKey, agencyName, stateAbbrev })`. Return type changes to:

```ts
type ResolveResult = {
  leaid: string | null;
  kind: "override_district" | "override_state" | "override_non_lea" | "name_match" | "unresolved";
};
```

Flow:

```
1. SELECT kind, leaid FROM agency_district_maps WHERE agency_key = $1
   - if row exists with kind="district" → { leaid: row.leaid, kind: "override_district" }
   - if row exists with kind="state"    → { leaid: null,      kind: "override_state" }
   - if row exists with kind="non_lea"  → { leaid: null,      kind: "override_non_lea" }
2. else fall through to existing 3-tier name match (unchanged), wrapping with kind: "name_match"
3. else { leaid: null, kind: "unresolved" }
```

### Sync change

`src/features/rfps/lib/sync.ts`

- Pass `agency.agency_key` into the resolver call (already available; just plumb it).
- Cache key already keyed on `agency_key`; no change to cache structure.
- Counters: split `recordsResolved` into `recordsResolvedByOverride` and `recordsResolvedByName` so we can see override adoption over time. Total `recordsResolved = byOverride + byName`.

### Admin GET endpoint

`GET /api/admin/agency-district-maps`

Query params (all optional unless noted):

| Param | Default | Notes |
|---|---|---|
| `status` | `untriaged` | `untriaged \| district \| state \| non_lea \| all` |
| `state` | — | USPS, narrows by `Rfp.stateAbbrev` |
| `q` | — | substring (case-insensitive) over `agency_name` |
| `sort_by` | `unresolved_rfp_count` | `unresolved_rfp_count \| total_rfp_count \| latest_captured \| soonest_open_due \| total_value_low \| agency_name` |
| `sort_dir` | `desc` | `asc \| desc` |
| `page` | 1 | 1-indexed |
| `page_size` | 50 | max 50 (per `CLAUDE.md` perf rule) |

Underlying query (one CTE):

```sql
WITH agg AS (
  SELECT
    r.agency_key,
    r.agency_name,
    r.agency_path,
    r.state_abbrev,
    COUNT(*) FILTER (WHERE r.leaid IS NULL)            AS unresolved_rfp_count,
    COUNT(*)                                           AS total_rfp_count,
    MAX(r.captured_date)                               AS latest_captured,
    MIN(r.posted_date)                                 AS earliest_posted,
    MAX(r.due_date) FILTER (WHERE r.due_date >= now()) AS soonest_open_due,
    SUM(COALESCE(r.value_low,  0))                     AS total_value_low,
    SUM(COALESCE(r.value_high, 0))                     AS total_value_high
  FROM rfps r
  GROUP BY r.agency_key, r.agency_name, r.agency_path, r.state_abbrev
)
SELECT
  agg.*,
  m.kind, m.leaid, m.state_fips, m.notes, m.resolved_at, m.resolved_by,
  d.name AS resolved_district_name
FROM agg
LEFT JOIN agency_district_maps m ON m.agency_key = agg.agency_key
LEFT JOIN districts d            ON d.leaid     = m.leaid
WHERE
  CASE
    WHEN $status = 'untriaged' THEN m.kind IS NULL
    WHEN $status = 'all'       THEN TRUE
    ELSE m.kind = $status
  END
  AND ($state IS NULL OR agg.state_abbrev = $state)
  AND ($q IS NULL OR agg.agency_name ILIKE '%' || $q || '%')
ORDER BY <sort_by> <sort_dir>, agg.agency_key
LIMIT $page_size OFFSET ($page - 1) * $page_size;
```

Returns:
```json
{
  "items": [
    {
      "agencyKey": 29140,
      "agencyName": "United Independent School District",
      "agencyPath": "https://www.highergov.com/agency/tx-29140/",
      "stateAbbrev": "TX",
      "unresolvedRfpCount": 3,
      "totalRfpCount": 7,
      "latestCaptured": "2026-05-03T...",
      "soonestOpenDue": "2026-06-15T...",
      "totalValueLow": "100000.00",
      "totalValueHigh": "500000.00",
      "mapping": null
        // OR { "kind": "district", "leaid": "...", "stateFips": null, "districtName": "...", "notes": null, "resolvedBy": "...", "resolvedAt": "..." }
    }
  ],
  "pagination": { "page": 1, "pageSize": 50, "total": 1029 }
}
```

### Admin POST endpoint (bulk write)

`POST /api/admin/agency-district-maps`

Body:
```json
{
  "agencyKeys": [29140, 29141, 29142],
  "kind": "district",
  "leaid": "4838940",
  "notes": "NYC DOE wrapper agencies"
}
```

For `kind="state"`: `stateFips` required, `leaid` omitted. For multi-agency bulk: `stateFips` is omitted from the body and the server fills it per-row from each agency's `Rfp.stateAbbrev` (handles mixed-state selections correctly without forcing the rep to assert a single state for unrelated agencies). UI enforces a single explicit `stateFips` only for the single-agency case.
For `kind="non_lea"`: both `leaid` and `stateFips` omitted.

Validation rejects mismatched combinations (mirrors the SQL `CHECK` constraint). For bulk `kind="district"`, all selected agencies are mapped to the same `leaid` — that's the explicit point of the action (e.g., NYC DOE wrappers).

Server runs in one transaction:
1. `UPSERT` N rows into `agency_district_maps` (`ON CONFLICT (agency_key) DO UPDATE SET ...`).
2. If `kind="district"`: `UPDATE rfps SET leaid = $leaid WHERE agency_key = ANY($agencyKeys::int[])`.
3. If `kind="state"` or `kind="non_lea"`: `UPDATE rfps SET leaid = NULL WHERE agency_key = ANY($agencyKeys::int[])` (no-op if already null, but defensive — handles the edge case of switching from `kind="district"` to `kind="state"` mid-life).

Response: `{ mappedAgencyCount: N, cascadedRfpCount: M }`. Toast in UI consumes both.

`resolvedBy` populated from `getUser()` Supabase session.

### Admin DELETE endpoint (undo)

`DELETE /api/admin/agency-district-maps/[agencyKey]`

In one transaction:
1. `DELETE FROM agency_district_maps WHERE agency_key = $1`.
2. `UPDATE rfps SET leaid = NULL WHERE agency_key = $1` (next nightly sync's name-matcher will repopulate where applicable).

Response: `{ removedRfpLeaidCount: M }`. Toast: "Mapping removed. M RFPs reverted to untriaged — next sync will re-run name match."

### Auth

All three admin routes (GET, POST, DELETE) reuse `getUser()` from `@/lib/supabase/server`, matching the auth pattern in `src/app/api/admin/unmatched-opportunities/route.ts`. No new auth pattern.

## Frontend Design

### File layout

```
src/app/admin/agency-district-maps/
  page.tsx                  # main page (mirrors unmatched-opportunities/page.tsx structure)
  AdminFilterBar.tsx        # copy + adapt from unmatched-opportunities
  AdminColumnPicker.tsx     # copy + adapt from unmatched-opportunities
  columns.ts                # column defs

src/features/shared/components/DataGrid/
  DataGrid.tsx              # ADD: optional `selectable: boolean` prop + selection state
  types.ts                  # ADD: SelectionChange callback type
```

### Page layout

Top-to-bottom:
1. **Header** — title "RFP Agency Mappings" + count subtitle (`{N} agencies showing`).
2. **KPI summary cards** (5 cards, same visual treatment as unmatched-opps):
   - Untriaged (count of agencies with no map row + ≥1 unresolved RFP)
   - Mapped to district (count)
   - State-only (count)
   - Non-LEA (count)
   - Total unresolved RFPs (sum of `unresolved_rfp_count`)
   Cards are clickable to set the `status` filter.
3. **Toolbar:** `AdminFilterBar` on the left, `AdminColumnPicker` on the right. Default chip: `status = untriaged`.
4. **DataGrid** with the columns below.
5. **Sticky bulk-action bar** (slides in when ≥1 row selected).
6. **Modals/dialogs:** resolution modal (Flow A/B), confirm dialog (Flow C), edit-mapping modal (Flow D), success toast.

### Columns

| Column | Default | Source | Notes |
|---|---|---|---|
| ☐ select | ✓ | — | added via `selectable: true` |
| Agency name | ✓ | `agency_name` | click row → opens resolution panel |
| State | ✓ | `state_abbrev` | full state name in dropdown filter (matches `AdminFilterBar` pattern) |
| RFPs | ✓ | `total_rfp_count` | tabular-num, sortable |
| Unresolved | ✓ | `unresolved_rfp_count` | tabular-num, sortable |
| Total value | ✓ | `total_value_low … total_value_high` | compact range `$1.2M – $4.5M` |
| Latest seen | ✓ | `latest_captured` | relative ("2d ago"), sortable |
| Soonest due |   | `soonest_open_due` | helps urgency triage |
| Status |   | derived | badge: `Untriaged` / `→ Greene County Schools` / `→ NC (state)` / `Non-LEA` |
| Resolved by |   | `resolved_by` | user email |
| Resolved at |   | `resolved_at` | relative |
| HigherGov |   | `agency_path` | external link icon |
| (action) | ✓ | — | "Resolve" (untriaged) / "Edit mapping" (already mapped) |

### Resolution flows

#### Flow A — Map to district

1. Modal header: agency name(s) + state badge(s).
2. **Single-agency case:** suggestions section hits `/api/admin/districts/suggestions?name={agency_name}&state={state}` (existing endpoint, used by unmatched-opps); top 3-5 candidates shown.
3. **Multi-agency case:** skip suggestions; show banner "X agencies selected — all will be mapped to this district" + collapsed list of agency names.
4. Search input → `/api/admin/districts/search?q={q}&state={state}` (defaults `state` filter to the agency's state for single-agency, no default for multi-agency).
5. District row click → confirms in one step (matches unmatched-opps).
6. POSTs `{ agencyKeys, kind: "district", leaid }`.
7. Toast: `Mapped N agencies → {District Name}, updated M RFPs.`

#### Flow A.5 — Create new district (sub-flow inside Flow A)

Mirrors `CreateAccountForm` from unmatched-opportunities. Reused as-is or copy-adapted; allows the rep to add a missing district inline without leaving the resolution modal. On create, the new district auto-selects and Flow A continues.

#### Flow B — Map to state-only

1. **Single-agency case:** modal shows state picker (defaults to agency's `state_abbrev`; full `US_STATES` list). Submitted body includes `stateFips`.
2. **Multi-agency case:** no state picker; the server derives each agency's `stateFips` from its own `Rfp.stateAbbrev`. Modal shows the per-agency state next to each agency name in the preview list so the rep can sanity-check the mixed-state outcome.
3. Optional notes textarea: "Why state-only?" (stored in `notes` column; same value applied to all rows in bulk).
4. Confirm → POST `{ agencyKeys, kind: "state", stateFips? }` (omit `stateFips` for bulk).
5. No `Rfp.leaid` cascade.
6. Toast: `Marked N agencies as state-only.`

#### Flow C — Dismiss as non-LEA

1. Compact confirmation dialog (no full modal): agency name(s) + total RFP count.
2. Confirm → POST `{ agencyKeys, kind: "non_lea" }`.
3. Toast: `Dismissed N agencies (M RFPs no longer in untriaged view).`

#### Flow D — Edit / undo

When a row already has a map (visible when `status` filter is `district`/`state`/`non_lea`/`all`):
- Action button reads "Edit mapping".
- Opens the resolution modal pre-populated with current `kind`, `leaid`/`stateFips`, `notes`.
- Submitting overwrites via `POST` (same endpoint).
- A "Remove mapping" link in the modal footer fires `DELETE`. Toast confirms revert + that next sync will re-run name-match.

### Bulk-action bar

Sticky bottom bar, slides in when `selectedRowIds.length > 0`. Shows:
- "{N} selected" + agency-name preview
- Three primary buttons: `Map → district…` / `Mark → state-only…` / `Dismiss as non-LEA…`
- "Clear selection" link

Each button opens the same modal as the single-row action, but the POST submits with the array of `agencyKeys`.

### DataGrid changes

`src/features/shared/components/DataGrid/DataGrid.tsx` gets a generic `selectable` prop:

```ts
interface DataGridProps {
  // ...existing props
  selectable?: boolean;
  selectedRowIds?: string[];
  onSelectionChange?: (rowIds: string[]) => void;
}
```

When `selectable` is true:
- Renders a leading checkbox column.
- Header checkbox toggles "select all visible".
- `onSelectionChange` fires with the full set of selected row IDs across pages (caller manages persistence across page changes — for v1, selection clears on page change to keep it simple).

For v1, **selection clears on page change**. Cross-page bulk select is a follow-up if reps need it.

## Test Plan

Co-located in `__tests__/` per convention. Vitest, closure-deferred `vi.mock("@/lib/prisma")`.

| Test file | Covers |
|---|---|
| `src/features/rfps/lib/__tests__/district-resolver.test.ts` (extend existing) | New override branches: `kind=district` returns leaid; `kind=state` returns null with kind=`override_state`; `kind=non_lea` returns null with kind=`override_non_lea`; missing map row falls through to existing 3-tier name match (regression coverage). |
| `src/features/rfps/lib/__tests__/sync.test.ts` (extend existing) | Override path counted in `recordsResolvedByOverride`. Cache hits work when some agencies have overrides and others don't. End-to-end happy path: 3 records with mixed override/name-match resolutions land with correct `leaid`s. |
| `src/app/api/admin/agency-district-maps/__tests__/route.test.ts` (new) | **GET:** status filter (untriaged/district/state/non_lea/all), state filter, q search, default sort by `unresolved_rfp_count desc`, pagination, auth required. **POST:** bulk array writes N rows in one txn; cascade `UPDATE rfps SET leaid` runs only for `kind="district"`; invariant validation rejects mismatched combos (e.g. `kind="state"` with `leaid` set returns 400); `resolvedBy` populated from session; auth required. **DELETE:** removes map row + nulls `Rfp.leaid` for the agency_key. |
| `src/app/admin/agency-district-maps/__tests__/page.test.ts` (new, smoke) | Renders without crashing; toggling status chip refetches; bulk-select bar appears when ≥1 row checked; modal pre-populates on Edit mapping. |
| `src/features/shared/components/DataGrid/__tests__/selection.test.ts` (new) | Checkbox column renders only when `selectable=true`; `onSelectionChange` fires with row id array; "select all visible" toggles all currently-rendered rows; selection clears on page change. |

## States (loading / empty / error)

- **Loading list:** existing `DataGrid` skeleton; matches unmatched-opps.
- **Empty (no untriaged agencies):** "All caught up — no untriaged agencies in this view." Encouragement, not error.
- **POST conflict / validation error:** inline error in modal (e.g., "kind=state requires a state, not a district") + don't close modal on failure.
- **DELETE error:** toast in error color with retry link.
- **Cascade size warning:** if a single mapping cascades to >100 RFPs, the modal shows a confirmation step with the count ("Map 142 RFPs to {District}? This can't be undone in bulk.") to prevent fat-finger mistakes.

## Out of Scope (v1 — explicit)

- **NY abbreviation map** (Priority C from the resume note) — separate small spec, lower urgency once override UI exists. Once a rep has manually mapped NYC DOE once, all future RFPs from `agency_key = <NYC-DOE-key>` resolve via override.
- **Verifying the daily cron is firing** (Priority B) — operational task; SQL check + Vercel dashboard look. No code.
- **Cross-page bulk select** — selection clears on page change in v1. Add if reps hit the limit.
- **Audit log of mapping changes** — current schema captures `resolvedBy`/`resolvedAt` for the *current* state only; re-mapping overwrites. Surfacing history is a follow-up if needed.
- **Generic admin auth refactor** — reuse existing pattern; don't carve out a shared helper here.
- **Awarded contract ingest, forecasts, document attachments** — already deferred per Phase 1 spec.
- **Auto-suggesting an agency-to-district mapping based on related signals** (LMS opportunities for the same district, prior won contracts) — could be a v3 enhancement.

## Conventions Retained

- snake_case at DB layer, camelCase in Prisma model fields.
- Sales-rep-facing display: district name + state badge; never raw `leaid` strings.
- Reuse `accountType` on `District` for SEA / CMO / cooperative — no parallel classification table.
- Auth via `getUser()` from `@/lib/supabase/server`.
- Many small focused commits over one big final commit (per user feedback memory).
- Vitest closure-deferred Prisma mocks per the existing test files.

## References

- Phase 1 spec: `Docs/superpowers/specs/2026-05-04-rfp-feed-backend-spec.md`
- Phase 1 backend context: `Docs/superpowers/specs/2026-05-04-rfp-feed-backend-backend-context.md`
- Phase 1 plan: `Docs/superpowers/plans/2026-05-04-rfp-feed-backend.md`
- Resume note: `Docs/superpowers/notes/2026-05-04-rfp-feed-resume-prompt.md`
- Mirror pattern: `src/app/admin/unmatched-opportunities/` (page, AdminFilterBar, AdminColumnPicker, columns)
- Mirror API pattern: `src/app/api/admin/unmatched-opportunities/route.ts`
- Existing district search endpoints (reused): `/api/admin/districts/search`, `/api/admin/districts/suggestions`
