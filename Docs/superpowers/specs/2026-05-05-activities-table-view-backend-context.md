# Activities Table View — Backend Context

Discovery doc for the Activities page "Table" view that replaces the existing
"Quarter" calendar option in `ViewToggle.tsx`. Captures the data model, API
shape, hook surface, filter store, auth/scope, CSV utility, and bulk-update
patterns the implementer needs to land the feature.

Worktree path: `/Users/sierraarcega/territory-plan/.claude/worktrees/activities-table-view`.

---

## Activities Data Model

The Activity model lives in `prisma/schema.prisma:581` as `model Activity`,
mapped to the `activities` table. All relations are many-to-many through
junction tables; there is **no direct FK from Activity to District/Contact** —
the table view must join through `ActivityDistrict` / `ActivityContact`.

### Activity (core fields)

```
id                  String    @default(uuid())   // PK
type                String    @db.VarChar(30)    // ActivityType (see types.ts)
title               String    @db.VarChar(255)
notes               String?
startDate           DateTime? @map("start_date")
endDate             DateTime? @map("end_date")
status              String    @default("planned")
createdByUserId     String?   @map("created_by_user_id") @db.Uuid  // owner / rep
createdAt           DateTime  @default(now())
updatedAt           DateTime  @updatedAt

// Calendar / sync provenance
googleEventId       String?   @unique
source              String    @default("manual")    // manual | calendar_sync | gmail_sync | slack_sync | system
gmailMessageId      String?   @unique
slackChannelId      String?
slackMessageTs      String?
integrationMeta     Json?

// Mixmax campaign enrichment (sometimes shown in list rows)
mixmaxSequenceName, mixmaxSequenceStep, mixmaxSequenceTotal,
mixmaxStatus, mixmaxOpenCount, mixmaxClickCount

// Outcome tracking (Wave 1 redesign)
outcome             String?   // free-text
outcomeType         String?   // legacy
rating              Int?      // 1-5
sentiment           String?   // positive | neutral | negative
nextStep            String?
followUpDate        DateTime?
dealImpact          String    @default("none")   // none | progressed | won | lost
outcomeDisposition  String?   // completed | no_show | rescheduled | cancelled

// Location (promoted out of metadata)
address             String?
addressLat          Float?
addressLng          Float?
inPerson            Boolean?

metadata            Json?
```

### Indexes already present on `activities`

```
@@index([createdByUserId])
@@index([type])
@@index([startDate])
@@index([type, startDate])
@@index([followUpDate])
```

There is **no full-text or trigram index on `title` / `notes`**. Existing
search uses Prisma `contains` with `mode: "insensitive"`, which compiles to
`ILIKE '%term%'` — sequential scan. See "Gaps + Risks" below.

### Junctions (all M:N)

```
ActivityPlan         (activity_id, plan_id)
ActivityDistrict     (activity_id, district_leaid, position, visitDate, visitEndDate, notes, warningDismissed)
ActivityContact      (activity_id, contact_id)
ActivityState        (activity_id, state_fips, isExplicit)
ActivityOpportunity  (activity_id, opportunity_id)
ActivityAttendee     (activity_id, user_id)
ActivityRelation     (activity_id, related_activity_id, relationType)
ActivityNote         (id, activity_id, author_id, body)         // threaded log
ActivityAttachment   (Supabase Storage blob refs)
ActivityExpense      (id, activity_id, description, amount, category, incurredOn)
TaskActivity         (task → activity link)
```

### Related top-level models

- `District` (PK `leaid` String; has `name`, `stateAbbrev`)
- `Contact` (PK `id` Int; `leaid`, `name`, `title`, `email`, `phone`)
- `UserProfile` (PK `id` Uuid; `email`, `fullName`, `avatarUrl`, `role`)

### Activity Types & Statuses

Defined in `src/features/activities/types.ts` (NOT Prisma enums — string
columns with app-level validation):

```
ACTIVITY_CATEGORIES = {
  events:             [conference, road_trip, dinner, happy_hour, school_site_visit, fun_and_games],
  campaigns:          [mixmax_campaign],
  meetings:           [discovery_call, program_check_in, proposal_review, renewal_conversation],
  gift_drop:          [gift_drop],
  sponsorships:       [booth_exhibit, conference_sponsor, meal_reception, charity_event],
  thought_leadership: [webinar, speaking_engagement, professional_development, course],
}

VALID_ACTIVITY_STATUSES = [
  planned, requested, planning, in_progress, wrapping_up, completed, cancelled
]
```

`ALL_ACTIVITY_TYPES`, `ACTIVITY_TYPE_LABELS`, `ACTIVITY_STATUS_CONFIG`,
`getCategoryForType()`, and `formatStatusLabel()` are exported from the same
file and are reusable.

---

## Existing Activities API Routes

Routes under `src/app/api/activities/`. The file `route.ts` is the list
endpoint; `[id]/route.ts` is the detail. Sub-resource routes (notes, expenses,
attachments, etc.) exist in nested folders but the table view should not need
them directly — they're invoked via the drawer.

### `GET /api/activities` — list (needed by table view)

File: `src/app/api/activities/route.ts:22-324`

Query params (all optional, multi-value via CSV `?key=a,b` or repeats):

```
search             string                  // ⚠ matches title only (see Gaps)
type               string | string[]
category           ActivityCategory | string[]
status             string | string[]
state              string | string[]       // 2-letter abbrev list (legacy aliases: stateAbbrev, stateCode)
owner              string | string[]       // user UUIDs (multi-select)
ownerId            string | "all"          // single-value path; "all" = team scope
attendeeIds        string | string[]
inPerson           "yes" | "no" | both
territory          string | string[]       // territory plan names
tags               string | string[]       // accepted but no-op (see route.ts:163)
dealKinds          string | string[]       // accepted but no-op
districtLeaid      string                  // single
districtLeaids     string | string[]       // multi
planId             string                  // when set, owner filter is ignored — shows all in plan
needsPlanAssociation  bool
hasUnlinkedDistricts  bool
startDate          ISO date
endDate            ISO date
unscheduled        bool                    // null startDate
source             string
limit              number    default=100
offset             number    default=0
```

Response (`ActivitiesResponse` in `src/features/shared/types/api-types.ts:592`):

```
{
  activities: ActivityListItem[],   // see api-types.ts:569
  total:      number,               // count after computed-flag filter
  totalInDb:  number                // count matching base where (for pagination)
}
```

`ActivityListItem` is a slim row (id, type, category, title, startDate,
endDate, status, source, outcomeType, needsPlanAssociation,
hasUnlinkedDistricts, planCount, districtCount, stateAbbrevs). It does **NOT
contain district/contact names** or the owner's name — only counts/IDs.

Server-side ordering: `orderBy: { startDate: { sort: "desc", nulls: "last" } }`
(`route.ts:229`). Matches the table-view default.

### `POST /api/activities` — create

File: `src/app/api/activities/route.ts:327-652`. Not directly used by the
table view, but reused by the existing `useCreateActivity` hook.

### `GET /api/activities/[id]` — detail (needed for drawer prev/next)

File: `src/app/api/activities/[id]/route.ts:18-236`. Returns the full
`Activity` shape (`api-types.ts:514`) including all join data: plans,
districts, contacts, states, expenses, attendees, opportunities, related
activities, plus `createdByUser` (id/fullName/avatarUrl).

### `PATCH /api/activities/[id]` — update

File: `[id]/route.ts:239-538`. Accepts the full editable surface (type, title,
status, dates, outcome fields, address, expenses, contacts, attendees,
districts, opportunities). The table view's status/owner inline edits could
hit this per-row, but that's N requests for N rows — see bulk patterns below.

**Note:** the route currently has no path for changing `createdByUserId`
(owner). Reassign-bulk needs a new path or a server-side handler that admits
this field with the right permission check.

### `DELETE /api/activities/[id]` — delete

File: `[id]/route.ts:541-583`.

### Sub-resource routes (drawer-only, listed for completeness)

```
/api/activities/[id]/plans                      POST, DELETE /[planId]
/api/activities/[id]/districts                  POST, DELETE /[leaid]
/api/activities/[id]/contacts                   (not seen in queries.ts; verify if needed)
/api/activities/[id]/expenses                   POST, DELETE /[expenseId]
/api/activities/[id]/notes                      POST, DELETE /[noteId]
/api/activities/[id]/attachments                POST upload, DELETE, GET signed URL
/api/activities/[id]/calendar-attendees         GET
/api/activities/unlinked                        GET (separate route, source != manual, no district links)
```

### What the list route already supports for the table view

✓ Search (title only) — `?search=`
✓ Multi-type / multi-status / multi-owner / multi-state / multi-district
✓ Date range — `?startDate=&endDate=`
✓ Pagination — `?limit=&offset=` plus `totalInDb` for banners
✓ Default sort by `startDate DESC`
✓ Owner scope: `ownerId="all"` for team, current user otherwise
✓ Attendee filter — `?attendeeIds=`

### Gaps in the list route for the table view

✗ Search does **not** cover notes / district name / contact name (see Gaps)
✗ Contact filter — no `?contactIds=` parameter exists. Junction table
  `ActivityContact` is queryable but not wired through the route.
✗ Response omits district names, contact names, and owner name — the table UI
  needs at least one display label per relation. Either extend the `select`
  or accept that the table renders "3 districts / 2 contacts" badges and
  defers names to the drawer.
✗ `tags` and `dealKinds` accept the param but no-op.

---

## Existing TanStack Query Hooks

File: `src/features/activities/lib/queries.ts`. Query keys are stable strings
generated by `buildActivitiesQueryString()` (sorted, URL-encoded) — this is
the pattern the table view should reuse.

### Reusable as-is

| Hook | Returns | Query key | Notes |
|---|---|---|---|
| `useActivities(params)` | `ActivitiesResponse` | `["activities", queryString]` | Reuse for the table list. Bumping `limit` to 50, paging via `offset`. `staleTime: 2min`. |
| `useActivity(id)` | full `Activity` | `["activity", id]` | Drives the drawer when a row is clicked. Already has `placeholderData: keepPreviousData`. |
| `usePrefetchActivity()` | `(id) => void` | — | Warm cache for adjacent rows on hover. |
| `useUpdateActivity()` | mutation | invalidates `["activities"]` and `["activity", id]` | Optimistic update on scalar fields. Per-row inline edits use this. |
| `useDeleteActivity()` | mutation | invalidates `["activities"]` | If table view supports row-level delete. |
| `useProfile()` | current `UserProfile` | (in `src/features/shared/lib/queries.ts:168`) | Default owner scope. |

### Need new hooks for table view

| Need | Why | Suggested signature |
|---|---|---|
| `useBulkUpdateActivities()` | Reassign owner / change status across selected rows in one request | `mutationFn({ ids: string[], updates: { ownerId?, status? } })` → invalidates `["activities"]` |
| `useExportActivitiesCsv()` (optional) | If we want server-rendered CSV (recommended only when result count > limit). Otherwise client-side via `rowsToCsv()`. | See "CSV export" below |

### Mutation invalidation note

Every existing mutation invalidates `["activities"]` (the prefix), so any
future `useActivities` call automatically refetches. The table-view query key
remains under that prefix as long as we use `useActivities(...)`.

---

## Existing Filter Logic (Zustand store)

File: `src/features/activities/lib/filters-store.ts`. Persisted in
`localStorage` under key `"cal"`, partialized to view/grain/savedViewId/
railCollapsed (filters themselves are NOT persisted — they reset on reload,
seeded by `useDefaultOwnerHydration()`).

### `ActivitiesFilters` shape

```ts
{
  categories:  ActivityCategory[];
  types:       ActivityType[];
  dealKinds:   DealKind[];          // accepted client-side, not server-applied
  dealStages:  string[];
  dealMin:     number;
  dealMax:     number | null;
  statuses:    string[];
  owners:      string[];            // user IDs; empty = team scope
  attendeeIds: string[];
  districts:   string[];            // leaids
  inPerson:    ("yes"|"no")[];
  states:      string[];
  territories: string[];            // plan IDs
  tags:        string[];
  text:        string;              // free-text search
}
```

### `ChromeState` (calendar chrome)

```ts
view: "schedule" | "month" | "week" | "map";   // ← extend with "table"
grain: "day" | "week" | "month" | "quarter";
anchorIso: string;
savedViewId: string | null;
railCollapsed: boolean;
syncState: "connected" | "stale" | "disconnected";
filters: ActivitiesFilters;
```

### `deriveActivitiesParams({ filters, anchorIso, grain })`

`filters-store.ts:189-218`. Translates store → API params. Uses single-value
short-circuits when only one option is selected, otherwise the multi-value
`owner` / `attendeeIds` / `districtLeaids` arrays. **It always sets
`startDateFrom` and `startDateTo` derived from anchor+grain** — for a Table
view that defaults to *all-time*, the implementer must:

1. Add a new helper (e.g. `deriveTableActivitiesParams`) that omits the date
   range when no explicit date range is set, OR
2. Add a `dateMode: "all" | "range"` field to filters and branch in the
   existing helper, OR
3. Bypass the helper entirely for the table view and build params from
   `filters` directly.

### What's already covered for the table view

✓ Text search — `filters.text` → `params.search`
✓ Type / category / status (multi)
✓ Owner — single short-circuits to `ownerId`; multi sends `owner[]`. Empty
  list defaults to `ownerId: "all"`.
✓ District — `filters.districts` → `params.districtLeaids`
✓ Scope toggle (My / All) — handled by `ScopeToggle` (`page/ScopeToggle.tsx`)
  which mutates `filters.owners` (`ActivitiesPageShell.tsx:116-119`).

### What's missing for the table view

✗ **Contact filter** — no `contacts: number[]` field in `ActivitiesFilters`.
  Add it to the store + extend `deriveActivitiesParams` + extend the API.
✗ **Date range that's not anchored to a calendar window.** Today's helper
  always derives from anchor+grain. Table view needs free-form
  `dateFrom` / `dateTo` (or "all time" sentinel).
✗ **Sort** — currently fixed to `startDate DESC` server-side. If the table
  needs user-controlled sort, add a `?sort=` parameter.

### Recommendation: keep one store, add fields

The table view should **not** fork its own filter state. Reasons:

1. The scope toggle (My / All Fullmind) and the owner default-hydration are
   already global — copy/paste invites bugs.
2. Saved views (`saved-views.ts`) round-trip through this store; future
   "saved table-view filters" will want to reuse them.
3. CLAUDE.md's "stable query keys" rule already applies via
   `buildActivitiesQueryString`.

Add `contacts`, `dateFrom`, `dateTo`, `dateMode` to `ActivitiesFilters` and
extend `deriveActivitiesParams` to honor them. The Quarter view goes away,
so no migration of view persistence is needed beyond mapping the legacy
`{ view: "month", grain: "quarter" }` to the new `view: "table"` (or just
falling back to the new default when `grain === "quarter"`).

---

## Auth + Scope

### Server-side

Every activities route calls:

```ts
import { getUser } from "@/lib/supabase/server";
const user = await getUser();
if (!user) return 401;
```

`getUser()` (`src/lib/supabase/server.ts`) wraps Supabase SSR auth and
respects the `impersonate_uid` cookie if the real user is admin. The
returned user has `id` (UUID) and `isImpersonating: boolean`.

`isAdmin(userId)` (same file, line 92) hits `prisma.userProfile` and checks
`role === "admin"`. Used to allow viewing/editing other users' activities.

### "My activities" vs "All Fullmind"

Enforced **in the route, not by Postgres RLS** (see `route.ts:69-87`):

```ts
if (planId) {
  where.plans = { some: { planId } };           // plan scope wins
} else if (owners.length > 0) {
  where.createdByUserId = { in: owners };       // multi-owner
} else if (ownerId === "all") {
  // no createdByUserId filter — team scope
} else if (ownerId) {
  where.createdByUserId = ownerId;              // specific user
} else {
  where.createdByUserId = user.id;              // default: my activities
}
```

For PATCH/DELETE/[id] GET, the route checks `createdByUserId === user.id` OR
linked to a plan (for view) OR `isAdmin(user.id)` (for edit). The bulk
endpoint must apply the same rule **per row** — not a blanket pass.

### `system` source filter

Every list query forces `where.source = { not: "system" }` (`route.ts:70`)
to hide system-generated activities. The bulk endpoint should keep this rule
so we never reassign / restate a system row.

---

## CSV Export

File: `src/features/reports/lib/csv.ts` — already production-quality, used by
the Reports tab and the Low Hanging Fruit view. **Reuse, do not duplicate.**

```ts
// Shape:
function rowsToCsv(columns: string[], rows: Array<Record<string, unknown>>): string
function slugifyForFilename(s: string): string
function downloadCsv(filename: string, csv: string): void
```

Cells are escaped for `,`, `"`, `\r`, `\n`. `Date` → ISO; objects →
`JSON.stringify`. `downloadCsv` builds a `Blob`, creates an anchor, triggers
download, and revokes the URL after the click. Tests live at
`src/features/reports/lib/__tests__/csv.test.ts`.

### Recommended call site for the Table view

```ts
import { rowsToCsv, slugifyForFilename, downloadCsv } from "@/features/reports/lib/csv";
const csv = rowsToCsv(
  ["title","type","status","startDate","owner","districts","contacts"],
  selectedRows.map(toCsvRow),
);
downloadCsv(slugifyForFilename(`activities-${new Date().toISOString().slice(0,10)}`), csv);
```

The reps need *names*, not IDs (per user memory note "No ID strings in
output"). The list endpoint returns counts/IDs only — for export we either:

1. Hit `GET /api/activities/[id]` for each selected row to get names (slow
   for 50+ rows), or
2. Ask the bulk-export endpoint to return enriched rows (`POST
   /api/activities/export`), or
3. Extend the list endpoint to include district names + owner name when an
   `?include=names` flag is set.

Option 3 is cheapest; add it to the list route.

---

## Bulk Update Patterns

### What exists in the codebase

A search across `src/app/api/**` for `bulk` finds:

- `POST /api/territory-plans/[id]/contacts/bulk-enrich` — kicks a Clay
  enrichment for the plan's principals. Wrong shape for activities (it
  scopes to a single plan and is a job-launcher, not a CRUD bulk).
- `POST /api/vacancies/scan-bulk` — also a job-launcher.
- `POST /api/territory-plans/[id]/expand-rollup` — internal.

**There is no `PATCH /api/activities/bulk` or any other bulk-update CRUD
endpoint for activities.** The implementer must build it.

### Proposed endpoint: `PATCH /api/activities/bulk`

```
Request:  { ids: string[], updates: { ownerId?: string; status?: string } }
Response: { updated: number, skipped: number, skippedIds: string[] }
```

Behavior:

1. Authenticate via `getUser()` → 401 if missing.
2. Validate `updates.status ∈ VALID_ACTIVITY_STATUSES` and `updates.ownerId`
   is a known UUID (verify via `prisma.userProfile.findUnique`).
3. Load the candidate rows: `prisma.activity.findMany({ where: { id: { in: ids } }, select: { id, createdByUserId, source } })`.
4. For each row, verify the user can edit:
   - row's `createdByUserId === user.id`, OR
   - `await isAdmin(user.id)` (cache the result).
   Skip rows that fail with their IDs returned in `skippedIds`.
5. Skip rows where `source === "system"`.
6. `prisma.activity.updateMany({ where: { id: { in: allowedIds } }, data: <updates> })`.
   - For owner reassign, only admins should be allowed (rep can't reassign
     a teammate's activity to a third user). Confirm with PM if rep can
     reassign their own activities to anyone.
7. Best-effort: trigger calendar updates for affected rows
   (`updateActivityOnCalendar` per ID, fire-and-forget).
8. Return counts.

### Existing `PATCH /api/activities/[id]` does not accept `createdByUserId`

Today `[id]/route.ts:267-273` destructures only the editable surface and
omits `createdByUserId`. The bulk route is the **right place** to introduce
owner-reassign rather than expanding the per-row PATCH (cleaner permission
model, single audit log entry).

### Bulk export endpoint (optional)

If client-side CSV from selected rows is sufficient, skip this. If the user
flow includes "export current filtered set (could be 1000+ rows)":

```
POST /api/activities/export
Request:  ActivitiesParams + { columns: string[] }
Response: text/csv stream
```

Reuses the same `where` builder as `GET /api/activities`. Server-side
streaming so we don't OOM on 10k-row exports.

---

## Testing Patterns

Framework: **Vitest + Testing Library + jsdom**. Configured in `vitest.config.ts`
(default; not inspected). Co-located in `__tests__/`.

### Example 1 — API route test

`src/app/api/activities/__tests__/route.test.ts`

Conventions:

- Mocks `@/lib/supabase/server` → `getUser` (always called) + `isAdmin`.
- Mocks `@/lib/prisma` with hand-rolled `vi.fn()` for each model touched
  (e.g. `activity: { count, findMany, findUnique, create, update, delete }`,
  `activityPlan: { findFirst }`, `territoryPlanDistrict: { findMany }`).
- Mocks `@/features/calendar/lib/push` — fire-and-forget calendar sync hooks.
- Helpers `makeListActivity()` / `makeDetailActivity()` build rows in the
  shape Prisma returns from the matching include shape.
- Builds `NextRequest` via:
  ```ts
  function makeRequest(url: string, init?: RequestInit) {
    return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
  }
  ```
- Imports the route handler directly: `import { GET, POST } from "../route"`.
- Cases cover 401, default scope, multi-value filters, planId, status,
  category translation, etc.

The bulk endpoint test should follow the same pattern: 401 case, ownership
check (skip foreign rows for non-admin), system-source skip, status validation.

### Example 2 — Store / hook test

`src/features/activities/lib/__tests__/filters-store.test.ts`

Conventions:

- Mocks `@/features/shared/lib/queries` to stub `useProfile()`.
- Wraps hooks in a `QueryClientProvider` factory (no network in jsdom).
- Resets the Zustand store between tests via
  `useActivitiesChrome.getState().resetFilters()`.
- Asserts `getRangeForChrome` semantics by computing day spans rather than
  literal ISO strings (timezone-portable).
- Uses `renderHook`, `waitFor`, `act` from `@testing-library/react`.

### Other useful patterns

`src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`
covers a bulk-launch endpoint and demonstrates the auth guards / Prisma
mocks for a multi-row write. Use it as a reference shape.

---

## Gaps + Risks

### APIs to create

1. **`PATCH /api/activities/bulk`** — new route. Owner reassign + status change
   on a list of IDs. Permission rules per the table above (admin or own
   row; never `system` source). See proposal above for shape.
2. **(Optional) `POST /api/activities/export`** — only if we expect users to
   export sets > 50 rows. Otherwise client-side CSV from the selected rows
   is fine.

### Existing APIs that need extension

1. **`GET /api/activities` — `search` param.** Currently `where.title = { contains, mode: "insensitive" }`. The table view spec says search must cover
   title + district name + contact name + notes. Options:
   - Extend the `where` to an `OR` against `notes`, `districts.some.district.name`, `contacts.some.contact.name` — easiest, but four `ILIKE` joins on a non-indexed column scan is slow once activities exceed ~10k rows.
   - Add a Postgres `tsvector` column populated by trigger (title + notes + district names + contact names) and a GIN index. Best long-term, but a migration. Out of scope for first ship if dataset is small (<5k rows today).
   - Compromise: extend `OR` to title + notes initially, add district/contact name search as a second wave once we measure query time.
2. **`GET /api/activities` — `contactIds` param.** Add `contactIds = readMulti(searchParams, "contactIds")` and `where.contacts = { some: { contactId: { in: idsAsInt } } }`. Mirror the existing `attendeeIds` / `districtLeaids` handling.
3. **`GET /api/activities` — date range without a calendar anchor.** Already supported via `?startDate=&endDate=`. The store helper just needs to stop forcing them; the route is fine.
4. **`GET /api/activities` — response enrichment for table display.** Add `?include=names` (or always include) to the list route to surface:
   - first 1-2 district names (or just the first + count)
   - first contact name
   - owner's `fullName`
   Without this, the table renders "3 districts" and "(unknown)" for the owner column unless the implementer fans out to per-row detail fetches.
5. **`GET /api/activities` — sort param** (only if the table needs user sort beyond `startDate DESC`). Add `?sort=startDate|title|status|updatedAt&order=asc|desc`.

### Schema changes

None required for v1. If text-search performance becomes a problem, consider:

- A migration adding `search_tsv tsvector` to `activities` with a GIN index
  and a Postgres trigger to keep it populated from `title`, `notes`, plus
  the latest district/contact names rolled in by the application layer (or
  a materialized view of district/contact names by activity).

The existing indexes (`createdByUserId`, `type`, `startDate`,
`(type, startDate)`, `followUpDate`) already cover the dominant table-view
filter combos. No new index needed for filtering itself.

### Performance concerns

1. **Text search seq-scan.** `ILIKE '%term%'` is O(N) on `activities`. If the
   tenant has 50k+ rows, the search will hit ~hundreds of ms. Mitigation:
   start with title-only (current behavior), measure, then add tsvector if
   needed.
2. **Computed flag filtering happens after the page is sliced.** The route
   slices via `take/skip`, then drops rows that don't match
   `needsPlanAssociation` / `hasUnlinkedDistricts`. So `total` (the post-slice
   filtered count) ≠ `totalInDb`. The table-view banner trigger ("200+
   filtered results") should read `totalInDb` for an accurate count, not
   `total`.
3. **Per-row detail fetch on bulk export** would cause N round-trips.
   Server-side enrichment (the `?include=names` extension above) avoids it.
4. **Drawer prefetch + table virtualization.** The page caps server returns
   at `limit: 50` per CLAUDE.md, with "Show more" or scroll loading. Don't
   blanket-prefetch every row — prefetch on hover only. Existing
   `usePrefetchActivity` is the helper.
5. **CSV export of large sets.** Client-side `rowsToCsv()` over a few hundred
   rows is fine. Exporting filter sets in the thousands warrants
   server-side streaming (see "Bulk export endpoint" above).
6. **Bulk update deadlock risk.** `prisma.activity.updateMany` on a long ID
   list is one statement, so no row-level deadlocks. But if the request
   passes 1000+ IDs, validation/auth checks scale linearly and the round
   trip can exceed 30s. Cap the request to e.g. 500 IDs and have the client
   chunk if a user selects more.

---

## Summary

The table view can ship by:

1. Adding a `view: "table"` option to the chrome store and `ViewToggle`,
   removing the `quarter` option.
2. Extending `ActivitiesFilters` with `contacts: number[]`, plus optional
   free-form date range fields, and updating `deriveActivitiesParams` to
   omit the calendar-window dates when in table mode.
3. Reusing `useActivities()`, `useActivity()`, `useUpdateActivity()`,
   `useDeleteActivity()`, and `usePrefetchActivity()` as-is.
4. Adding a `PATCH /api/activities/bulk` route for status/owner reassign
   with the same auth rules as `[id] PATCH`.
5. Extending the list route's `search` to include `notes` (and ideally
   district + contact names) and adding `contactIds`. Optionally adding
   `?include=names` for table-display enrichment.
6. Reusing `rowsToCsv` / `downloadCsv` from `src/features/reports/lib/csv.ts`
   for client-side CSV export of selected rows.
7. Following the Vitest + Prisma-mock + Supabase-mock pattern in
   `src/app/api/activities/__tests__/route.test.ts` for the new bulk route
   and updated list route, plus the store-test pattern in
   `src/features/activities/lib/__tests__/filters-store.test.ts` for any
   helper changes.

No schema migrations required for v1.
