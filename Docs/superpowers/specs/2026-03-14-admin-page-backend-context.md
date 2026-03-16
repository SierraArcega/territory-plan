# Admin Page Backend Context

> Backend discovery for the admin page feature. Generated 2026-03-14.

---

## 1. Data Models Summary

### UserProfile

- **Table**: `user_profiles`
- **PK**: `id` (UUID, matches Supabase `auth.users.id`)
- **Key fields**: `email` (unique), `fullName`, `avatarUrl`, `jobTitle`, `location`, `locationLat/Lng`, `phone`, `slackUrl`, `bio`, `hasCompletedSetup`, `lastLoginAt`
- **Relations**: `CalendarConnection` (1:1), `ownedPlans` (1:N TerritoryPlan), `collaboratingOn` (N:M via TerritoryPlanCollaborator), `savedMapViews` (1:N)
- **Notes**: Stub profiles can be pre-provisioned before login (POST /api/admin/users). A null `lastLoginAt` identifies a stub profile that has never logged in.
- **File**: `prisma/schema.prisma` line 643

### DataRefreshLog

- **Table**: `data_refresh_logs`
- **PK**: `id` (autoincrement Int)
- **Fields**: `dataSource` (varchar 50), `dataYear` (nullable Int), `recordsUpdated` (Int), `recordsFailed` (Int, default 0), `status` (varchar 20), `errorMessage` (nullable), `startedAt` (DateTime), `completedAt` (DateTime, default now)
- **Index**: `(dataSource, completedAt)` for querying latest refresh per source
- **Known data sources** (from ETL scripts):
  - `urban_institute_finance`
  - `urban_institute_saipe` (poverty)
  - `urban_institute_demographics`
  - `urban_institute_graduation`
  - `urban_institute_absenteeism`
  - `urban_institute_assessments`
  - `urban_institute_title1`
  - `competitor_spend`
- **Usage pattern**: Each ETL loader calls `log_refresh()` at completion with source name, year, counts, status (`success`/`partial`/`failed`), and optional error message. See `scripts/etl/loaders/urban_institute_finance.py` lines 396-430 for the canonical pattern.
- **File**: `prisma/schema.prisma` line 393

### CalendarConnection

- **Table**: `calendar_connections`
- **PK**: `id` (UUID)
- **Unique constraint**: `userId` (one connection per user)
- **Fields**: `googleAccountEmail`, `accessToken`, `refreshToken`, `tokenExpiresAt`, `companyDomain` (filters internal attendees), `syncEnabled` (bool, default true), `lastSyncAt`, `status` (`connected`/`disconnected`/`error`)
- **Relations**: `user` (UserProfile), `events` (1:N CalendarEvent)
- **File**: `prisma/schema.prisma` line 831

### UnmatchedOpportunity

- **Table**: `unmatched_opportunities`
- **PK**: `id` (Text, maps to Salesforce opportunity ID)
- **Fields**: `name`, `stage`, `schoolYr`, `accountName`, `accountLmsId`, `accountType`, `state`, `netBookingAmount` (Decimal 15,2), `reason` (nullable text), `resolved` (bool, default false), `resolvedDistrictLeaid` (nullable text), `syncedAt`
- **Indexes**: `resolved`, `schoolYr`
- **Valid reason values**: `"Needs Review"`, `"Missing District"`, `"Remove Child Opp"`, `"Organization"`, `"University"`, `"Private/Charter"`
- **Lifecycle**: Created by the scheduler sync when an opportunity cannot be matched to a district. Resolved via PATCH `/api/admin/unmatched-opportunities/[id]` which bulk-resolves all opportunities with the same `accountName`.
- **File**: `prisma/schema.prisma` line 1099

### UnmatchedAccount

- **Table**: `unmatched_accounts`
- **PK**: `id` (autoincrement Int)
- **Fields**: `accountName`, `salesExecutive`, `stateAbbrev`, `lmsid`, `leaidRaw`, `matchFailureReason`, `fy25NetInvoicing`, `fy26NetInvoicing`, `fy26OpenPipeline`, `fy27OpenPipeline`, `isCustomer`, `hasOpenPipeline`, `createdAt`
- **Index**: `stateAbbrev`
- **Notes**: Different from UnmatchedOpportunity -- this tracks unmatched *accounts* (from CRM import), not individual opportunities (from scheduler sync).
- **File**: `prisma/schema.prisma` line 373

---

## 2. Existing API Route Patterns

### Auth Check Pattern

Every admin route follows the same auth check:

```ts
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}
```

- `getUser()` is imported from `@/lib/supabase/server`
- Creates a Supabase server client using cookies, calls `supabase.auth.getUser()`
- Returns the Supabase `User` object or `null`
- No role-based access control exists -- any authenticated user can hit admin routes

### Request/Response Format

- **All routes export** `export const dynamic = "force-dynamic"` to prevent Next.js caching
- **Imports**: `NextRequest`/`NextResponse` from `next/server`, `prisma` from `@/lib/prisma`, `getUser` from `@/lib/supabase/server`
- **JSON responses**: Always `NextResponse.json(data)` or `NextResponse.json(data, { status: code })`
- **Error format**: `{ error: "Human readable message" }` with appropriate HTTP status
- **Paginated lists**: Return `{ items: [...], pagination: { page, pageSize, total } }`
- **Non-paginated lists**: Return `{ items: [...] }` or bare arrays
- **Success on create**: Status 201 with the created entity
- **Success on update**: Status 200 with the updated entity or summary
- **Success on delete**: Status 200 with `{ success: true }`

### Error Handling Pattern

```ts
try {
  // auth check
  // validation
  // business logic
  return NextResponse.json(result);
} catch (error) {
  console.error("Descriptive context:", error);
  return NextResponse.json({ error: "User-facing message" }, { status: 500 });
}
```

### Validation Pattern

- Manual validation (no schema library like Zod)
- Type assertions on request body: `const { field } = body as { field?: string }`
- Return 400 with descriptive error for invalid input
- Return 409 for duplicates
- Return 404 for not-found entities
- Whitelist-based sorting: sortable columns defined in a `Set`, falling back to default

### Existing Admin Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/districts` | POST | Create a new district (7-digit LEAID, name, state required) |
| `/api/admin/districts/search` | GET | Search districts by name/LEAID/state for resolution picker |
| `/api/admin/districts/suggestions` | GET | Fuzzy-match district suggestions by name + state |
| `/api/admin/unmatched-opportunities` | GET | List with filters, sorting, search, pagination |
| `/api/admin/unmatched-opportunities/[id]` | PATCH | Resolve (assign to district) or update reason |
| `/api/admin/unmatched-opportunities/facets` | GET | Distinct stages/reasons for filter dropdowns |
| `/api/admin/unmatched-opportunities/summary` | GET | Aggregate KPI stats (raw SQL via `$queryRaw`) |
| `/api/admin/users` | POST | Pre-provision a stub user profile before first login |

### Calendar Routes (non-admin, per-user)

| Route | Method | Purpose |
|---|---|---|
| `/api/calendar/callback` | GET | Google OAuth redirect handler, upserts CalendarConnection |
| `/api/calendar/connect` | GET/POST | Initiates Google OAuth flow |
| `/api/calendar/disconnect` | POST | Removes calendar connection |
| `/api/calendar/status` | GET | Returns connection status + pending event count |
| `/api/calendar/status` | PATCH | Toggle syncEnabled, update companyDomain |
| `/api/calendar/sync` | POST | Trigger manual calendar sync |
| `/api/calendar/events` | GET | List calendar events (inbox) |
| `/api/calendar/events/[id]` | POST | Confirm event (creates Activity) |
| `/api/calendar/events/[id]` | PATCH | Dismiss event |
| `/api/calendar/events/batch-confirm` | POST | Bulk confirm high-confidence events |

---

## 3. Scheduler/Sync Architecture

### Opportunity Sync Scheduler (Python)

- **Location**: `scheduler/`
- **Runtime**: Standalone Python process (containerized), runs hourly via `schedule` library
- **Entry point**: `scheduler/run_scheduler.py` -- runs `safe_sync()` with retry (3 attempts, exponential backoff)
- **Core logic**: `scheduler/run_sync.py` -- `run_sync()` executes a full cycle

#### Sync Pipeline

1. **Phase 1**: Fetch opportunities from OpenSearch (`sync/opensearch_client.py`, `sync/queries.py`)
2. **Phase 2**: Fetch associated sessions (both changed and full sets)
3. **Phase 3**: Fetch district mappings from OpenSearch
4. **Phase 4**: Compute metrics via `sync/compute.py` → `build_opportunity_record()`
5. **Phase 5**: Write to Supabase PostgreSQL via `sync/supabase_writer.py`
   - `upsert_opportunities()` -- matched records
   - `upsert_unmatched()` -- records that couldn't match to a district (preserves manual resolutions)
   - `remove_matched_from_unmatched()` -- cleanup newly matched
   - `update_district_pipeline_aggregates()` -- recompute FY26/FY27 pipeline on districts table
   - `refresh_map_features()` -- refresh materialized view

#### State Tracking

- Incremental sync via `sync_state` table (key-value: `last_synced_at`)
- Heartbeat file at `logs/heartbeat` (updated every 5 minutes)
- Structured state file at `logs/sync_state.json` with: `last_sync_at`, `last_sync_status`, `last_error`, `opps_synced`, `unmatched_count`, `consecutive_failures`, `heartbeat_at`
- Append-only history at `logs/sync_history.jsonl`
- Health monitoring via `scheduler/monitor.py`

#### Manual Resolution Flow

The sync respects manual resolutions from the admin UI:
- `_load_manual_resolutions()` reads `unmatched_opportunities WHERE resolved = true AND resolved_district_leaid IS NOT NULL`
- If an opp was manually resolved, the resolution is applied during sync
- `upsert_unmatched()` includes `WHERE resolved = false` to avoid overwriting manual resolutions

### ETL Scripts (Python)

- **Location**: `scripts/etl/loaders/`
- **Pattern**: Each loader fetches from an external API (Urban Institute, vendor data), transforms, bulk-upserts to PostgreSQL via psycopg2, and logs to `data_refresh_logs`
- **Direct DB writes**: Uses raw SQL via psycopg2 (not Prisma), typically temp-table bulk update pattern
- **Log function**: `log_refresh(conn_string, data_source, data_year, records_updated, records_failed, status, error_message, started_at)`
- **State-by-state fetching**: `scripts/etl/loaders/state_by_state_loader.py` orchestrates Urban Institute loaders per-state to avoid API crashes

---

## 4. Auth Architecture

### Middleware (`src/middleware.ts`)

- Delegates to `updateSession()` in `src/lib/supabase/middleware.ts`
- Refreshes the Supabase auth token on every request
- **Protected routes**: Everything except `/login`, `/signup`, `/auth` redirects to `/login` if no user
- **Auth pages**: Redirects authenticated users away from `/login` and `/signup` to `/`
- **Excluded from middleware**: `_next/static`, `_next/image`, `favicon.ico`, image files, `api/tiles`
- **Maintenance mode**: `MAINTENANCE_MODE=true` env var returns 503 HTML page

### Supabase Server Client (`src/lib/supabase/server.ts`)

- `createClient()`: Creates server-side Supabase client using cookies from `next/headers`
- `getUser()`: Calls `supabase.auth.getUser()`, returns `User | null`
- Cookie-based session management via `@supabase/ssr`

### No Role/Admin Checks

There is currently no role-based access control. All authenticated users have identical permissions. Admin routes are protected only by authentication, not authorization.

---

## 5. Prisma Client (`src/lib/prisma.ts`)

- Singleton pattern using `globalThis` to prevent hot-reload issues
- Dev mode enables `query`, `error`, `warn` logging
- Prod mode only logs errors
- PostgreSQL with PostGIS extension
- Uses `@prisma/client` with `postgresqlExtensions` preview feature

---

## 6. Testing Conventions

### Framework

- **Vitest** with jsdom environment (`vitest.config.ts`)
- **Setup file**: `src/test/setup.ts` -- imports `@testing-library/jest-dom`, mocks global `fetch`, clears mocks between tests
- **Path aliases**: `@/` resolves to `./src/`
- **Globals**: `true` (no need to import `describe`, `it`, `expect`)

### API Route Test Pattern

Tests live in `__tests__/route.test.ts` adjacent to the route file. The established pattern:

1. **Mock dependencies at module level** (hoisted via `vi.mock`):
   - `@/lib/supabase/server` -- mock `getUser()` returning `{ id: "user-1" }`
   - `@/lib/prisma` -- mock the Prisma client with specific model methods
   - Any side-effect modules (auto-tags, rollup-sync, calendar push)

2. **Import route handlers after mocks**: `import { GET, POST } from "../route"`

3. **Get typed mocks**: `const mockPrisma = vi.mocked(prisma)`

4. **Test structure** (per HTTP method):
   - Auth test: mock `getUser` returning null, assert 401
   - Validation tests: missing/invalid fields, assert 400
   - Happy path: mock Prisma return values, assert response body
   - Not found: mock Prisma returning null, assert 404
   - Ownership: mock different userId, assert 403
   - Error: mock Prisma rejection, assert 500

5. **Request construction**: `new NextRequest("http://localhost/path", { method, body: JSON.stringify(data) })`

6. **Dynamic route params**: `{ params: Promise.resolve({ id: "value" }) }` (Next.js 16 pattern)

### Existing Test Files (API routes)

- `src/app/api/activities/__tests__/route.test.ts` -- comprehensive CRUD tests
- `src/app/api/territory-plans/__tests__/route.test.ts` -- CRUD + district management
- `src/app/api/districts/similar/__tests__/route.test.ts`
- `src/app/api/districts/summary/__tests__/route.test.ts`
- `src/app/api/tasks/__tests__/route.test.ts`
- `src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts`

### No Admin Route Tests Yet

There are no test files under `src/app/api/admin/` currently.

---

## 7. Key File References

| Category | Path |
|---|---|
| Prisma schema | `prisma/schema.prisma` |
| Prisma client singleton | `src/lib/prisma.ts` |
| Supabase server auth | `src/lib/supabase/server.ts` |
| Supabase middleware | `src/lib/supabase/middleware.ts` |
| Root middleware | `src/middleware.ts` |
| Admin: districts POST | `src/app/api/admin/districts/route.ts` |
| Admin: districts search | `src/app/api/admin/districts/search/route.ts` |
| Admin: districts suggestions | `src/app/api/admin/districts/suggestions/route.ts` |
| Admin: unmatched opps list | `src/app/api/admin/unmatched-opportunities/route.ts` |
| Admin: unmatched opps resolve | `src/app/api/admin/unmatched-opportunities/[id]/route.ts` |
| Admin: unmatched opps facets | `src/app/api/admin/unmatched-opportunities/facets/route.ts` |
| Admin: unmatched opps summary | `src/app/api/admin/unmatched-opportunities/summary/route.ts` |
| Admin: users create | `src/app/api/admin/users/route.ts` |
| Calendar: OAuth callback | `src/app/api/calendar/callback/route.ts` |
| Calendar: status | `src/app/api/calendar/status/route.ts` |
| Calendar: sync trigger | `src/app/api/calendar/sync/route.ts` |
| Calendar: TanStack hooks | `src/features/calendar/lib/queries.ts` |
| Shared API types | `src/features/shared/types/api-types.ts` |
| Scheduler entry point | `scheduler/run_scheduler.py` |
| Scheduler sync logic | `scheduler/run_sync.py` |
| Scheduler DB writer | `scheduler/sync/supabase_writer.py` |
| ETL finance loader | `scripts/etl/loaders/urban_institute_finance.py` |
| Test: territory plans API | `src/app/api/territory-plans/__tests__/route.test.ts` |
| Test: activities API | `src/app/api/activities/__tests__/route.test.ts` |
| Vitest config | `vitest.config.ts` |
| Test setup | `src/test/setup.ts` |
