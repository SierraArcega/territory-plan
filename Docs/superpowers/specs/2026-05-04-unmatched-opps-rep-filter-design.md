# Unmatched Opportunities — Rep Filter

## Problem

The leaderboard shows a per-rep "X unmatched · $Y" badge linking to
`/admin/unmatched-opportunities?rep=<UserProfile.id>`. The link does not
filter the destination page — `?rep=` is silently dropped. Admins clicking
Monica's badge see all 22 unresolved opportunities instead of the 2 attributed
to her.

The page also has no other way to scope by rep, so even after the deep-link is
fixed it is not possible to look up a specific rep's queue without going through
the leaderboard.

## Goal

Make `/admin/unmatched-opportunities` a first-class rep-scoped queue:

1. The leaderboard's deep-link arrives correctly filtered.
2. Admins can also filter by rep on the page directly via the existing filter
   bar, without having to navigate through the leaderboard.
3. The active rep filter is visible and removable like any other filter chip.

## Non-Goals

- Changing how rep attribution is computed (kept identical to
  `getUnmatchedCountsByRep` in `src/lib/unmatched-counts.ts`).
- Adding rep filtering to the public/non-admin views.
- Persisting the rep filter choice across sessions.
- Building a generic "saved view" mechanism.

## Background

`unmatched_opportunities` has no rep column. Rep attribution lives in the
sibling `opportunities` table and is reached by joining on `id`:

```sql
SELECT o.sales_rep_email
FROM unmatched_opportunities u
JOIN opportunities o ON o.id = u.id
```

This is the same join `getUnmatchedCountsByRep` uses to compute the leaderboard
badge counts.

The leaderboard URL passes `UserProfile.id` (UUID), not the email, because
`userId` is the primary identity used elsewhere in the app and emails in URLs
are uglier and slightly leakier.

## Architecture

Three layers, all in-place edits — no new endpoints, no new components.

### 1. API — `src/app/api/admin/unmatched-opportunities/route.ts`

Add support for a new optional `rep` query param (UUID).

When `rep` is present:

1. `prisma.userProfile.findUnique({ where: { id: rep }, select: { email: true } })`.
2. If no profile is found, or the profile's `email` is null/empty: return an
   empty page (`items: []`, `pagination.total: 0`). The chip should remain
   visible so the user can clear it; do not 4xx.
3. Otherwise: `SELECT id FROM opportunities WHERE sales_rep_email = $1` →
   array of opportunity ids.
4. Add `id: { in: ids }` to the existing Prisma `where` object. The empty-array
   case is fine — Prisma's `in: []` matches nothing, which is the desired
   "no rows for this rep" behavior.

This composes with all existing filters (`resolved`, `state`, `stage`, etc.)
because we are intersecting on `id`, not replacing `where`.

### 2. Page — `src/app/admin/unmatched-opportunities/page.tsx`

- Read `?rep=` via `useSearchParams()` once on mount.
- If present, seed the `filters` state with `{ column: "rep", operator: "eq", value: <id> }`
  alongside the existing default `resolved=false` filter.
- Use existing `useUsers()` hook (`src/features/shared/lib/queries.ts:160`) to
  populate the rep dropdown — no new data fetch.
- Forward the rep filter to the API by extending `fetchOpportunities`'s param
  shape with `rep?: string` and the URLSearchParams build.
- Add `rep` (serialized) to the TanStack Query key so changing the rep
  retriggers the fetch. **Stable-keys rule**: pass the rep id as a string,
  never an object.
- When the user clicks `×` on the Rep chip, also `router.replace()` to drop
  `?rep=` from the URL. This keeps refresh state consistent (refreshing after
  clearing should stay cleared).

### 3. Filter bar — `src/app/admin/unmatched-opportunities/AdminFilterBar.tsx` + `columns.ts`

- Add a virtual "rep" column to `unmatchedOpportunityColumns` with
  `filterType: "enum"` and a `label: "Rep"`.
- Hydrate the column's `enumValues` from `useUsers()` data, the same way
  `stage` and `reason` are hydrated from the facets endpoint
  (`page.tsx:1199-1206`).
- Extend `enumValues` typing from `string[]` to `Array<string | { value: string; label: string }>`
  in `src/features/shared/components/DataGrid/types.ts`. Normalize at the
  consumption sites (today only `AdminFilterBar.tsx:353`):
  ```ts
  const opts = colDef.enumValues.map((v) =>
    typeof v === "string" ? { value: v, label: v } : v
  );
  ```
- Update `formatFilterLabel` (`AdminFilterBar.tsx:59-69`) so when the column
  has object-form `enumValues`, the chip looks up the matching label rather
  than rendering the raw UUID. Result: chip reads `Rep is "Monica Sherwood"`.

The "rep" virtual column is filterable but is not a row field, so it must be
excluded from the table and from the column picker's toggle list. Add a new
`isFilterOnly?: boolean` flag to `ColumnDef` and gate two places:

- `AdminColumnPicker` skips columns where `isFilterOnly === true` so users
  cannot toggle the column on.
- `DataGrid` (or its column-resolution path) skips them as well so the column
  cannot accidentally render even if `visibleColumns` somehow contains the key.

The `AdminFilterBar` already iterates all columns with a `filterType`, so the
rep column appears in the "+ Filter" picker without special-casing.

## Data Flow

```
Leaderboard badge click
  └─> /admin/unmatched-opportunities?rep=619f3009-...
      └─> page.tsx mounts
          ├─ useSearchParams() reads "rep"
          ├─ filters seeded with [{rep, eq, "619f..."}, {resolved, is_false, …}]
          ├─ useUsers() — cached or fetched once for the picker + chip label
          └─ fetchOpportunities({ rep: "619f...", resolved: "false", … })
              └─> GET /api/admin/unmatched-opportunities?rep=619f...&resolved=false
                  ├─ UserProfile.findUnique → email
                  ├─ SELECT id FROM opportunities WHERE sales_rep_email = email
                  └─ prisma.unmatchedOpportunity.findMany({
                       where: { resolved: false, id: { in: ids } }, …
                     })
```

User clicks `×` on the chip:

```
filters state ← filters.filter(f => f.column !== "rep")
router.replace("/admin/unmatched-opportunities")  // strip ?rep=
TanStack Query refetches with new key
```

## Edge Cases

| Case | Handling |
|------|----------|
| `?rep=<unknown-uuid>` | API returns 0 rows. Chip stays visible so user can clear. |
| Rep has 0 unmatched opps | Empty table, "no rows" message, chip remains. |
| User opens picker before `useUsers()` resolves | Show disabled placeholder per CLAUDE.md "Show loading state, don't hide UI". |
| User removes Rep chip then reloads | URL was cleared by `router.replace`, so reload stays unfiltered. |
| User combines Rep + State + Stage filters | All three intersect via Prisma `where`. The rep filter narrows `id`, the others narrow other columns. |
| `?rep=<valid-uuid>` but profile has no email | Treated same as unknown UUID — 0 rows. |
| Two browser tabs, one filtered, one not | Each tab owns its own `filters` state and URL. No cross-tab effect. |

## Performance

- Two extra DB queries when `rep` is set (profile lookup + opportunity-id
  fan-out). Both are indexed: `user_profiles.id` is PK, `opportunities.sales_rep_email`
  is filterable in existing leaderboard code without complaint.
- The opportunity-id list is bounded by a single rep's lifetime opportunity
  count — typically hundreds, not tens of thousands. `id: { in: [...] }` with
  this size is fine.
- `useUsers()` is already 10-minute-cached and reused elsewhere; no additional
  network cost in the common case.
- TanStack Query key uses the rep id string, satisfying the project's stable-key
  rule (CLAUDE.md § Performance).

## Testing

### API route (`route.test.ts` co-located)

- `rep=<valid-uuid>` filters to that rep's unmatched opportunities.
- `rep=<unknown-uuid>` returns `items: []`, `total: 0`, status 200.
- `rep=<uuid>` combines correctly with `resolved=false` (existing behavior preserved).
- `rep=<uuid>` combines correctly with `state=NY`.
- Without `rep`, results are unchanged from current behavior (regression guard).

### Page (`page.test.tsx` if patterns exist; otherwise integration via existing
fetch mocks)

- Mounting with `?rep=<id>` seeds the filter state and renders the Rep chip.
- Removing the Rep chip clears `filters` AND updates the URL via `router.replace`.
- Picking a rep from the filter bar also adds the chip and triggers a refetch.

### Filter bar

- `enumValues` accepting `{value, label}` form renders the label in the chip
  (regression test for the existing `string[]` form remains green).

## Out of Scope (Explicitly)

- Migrating other admin pages to use the same rep filter pattern (could be a
  follow-up if it works well here).
- Adding a `rep` field directly to `unmatched_opportunities` (would denormalize
  and require a backfill; the join is fast enough).
- Multi-select rep filter ("show me Monica AND Mike"). Current scope is
  single rep at a time.
