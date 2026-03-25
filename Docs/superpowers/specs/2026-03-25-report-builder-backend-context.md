# Report Builder — Backend Context

> Backend discovery for the Report Builder feature.
> Generated 2026-03-25.

---

## 1. Supabase Setup

### Client Configuration

Three Supabase client files live under `src/lib/supabase/`:

| File | Purpose | Client Factory |
|------|---------|----------------|
| `server.ts` | Server-side (API routes, Server Components) | `createServerClient` from `@supabase/ssr` |
| `client.ts` | Browser-side (React components) | `createBrowserClient` from `@supabase/ssr` |
| `middleware.ts` | Edge middleware (session refresh) | `createServerClient` from `@supabase/ssr` |

All three use the same two env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Cookie-based auth: the server client reads/writes cookies via Next.js `cookies()` API. The browser client manages cookies automatically.

### Auth Flow

1. **Middleware** (`src/middleware.ts`) calls `updateSession()` on every request (except static assets, tiles, cron, webhooks). This refreshes the Supabase auth token and redirects unauthenticated users to `/login`.

2. **API route auth** uses helpers from `src/lib/supabase/server.ts`:
   - `getUser()` — returns the effective user (respects admin impersonation via `impersonate_uid` cookie). Most API routes use this.
   - `getRealUser()` — returns the actual authenticated user, bypassing impersonation. Used for admin-only checks.
   - `getAdminUser()` — returns user + profile only if they have the `admin` role.

3. **Impersonation**: Admins can set an `impersonate_uid` cookie. `getUser()` checks the real user's role via Prisma, then returns a synthetic user object with the impersonated user's ID.

### Supabase vs Prisma vs Raw SQL

Supabase is used **only for auth** (session management, user identity). All data access goes through:

- **Prisma** (`src/lib/prisma.ts`) — primary ORM for all CRUD operations. Singleton `PrismaClient`, dev logging enabled.
- **Raw SQL via Prisma** (`prisma.$queryRaw`, `prisma.$executeRaw`) — used for PostGIS operations, materialized view queries, and complex aggregations.
- **Raw SQL via pg Pool** (`src/lib/db.ts`) — singleton `pg.Pool`, used sparingly (geospatial queries in the map tile pipeline). Max 2 connections in production, 12 in dev.

---

## 2. Database Schema — All Models

### Core Data Models

| Model | Table | Primary Key | Description |
|-------|-------|-------------|-------------|
| **District** | `districts` | `leaid` (VarChar 7) | Main entity. ~100+ columns: core info, CRM data (FY25/FY26/FY27 revenue, sessions, pipeline, bookings), education data (finance, poverty, graduation, staffing, demographics, absenteeism, assessments, Title I, FRPL), trends (3yr), state/national deltas, quartile flags, ICP scores, PostGIS geometry. |
| **School** | `schools` | `ncessch` (VarChar 12) | School-level data. Linked to district via `leaid`. Includes Title I, FRPL, demographics, CRM fields (owner, notes). |
| **Contact** | `contacts` | `id` (autoincrement Int) | People at districts. Fields: name, title, email, phone, persona, seniority. Linked to district. |
| **Opportunity** | `opportunities` | `id` (Text) | Synced from OpenSearch. Financial metrics per deal: revenue, take, bookings, invoiced, credited, sessions. Linked to district via `district_lea_id`. |
| **Session** | `sessions` | `id` (Text) | Individual session records. Linked to opportunity. Fields: service_type, prices, start_time. |
| **State** | `states` | `fips` (VarChar 2) | State-level aggregates: district counts, enrollment, customer counts, pipeline, education averages, ICP scoring, territory owner. |
| **TerritoryPlan** | `territory_plans` | `id` (UUID) | Sales plans. Fields: name, owner, color, status, fiscal_year, denormalized rollups (renewal/expansion/winback/new_business). |
| **Activity** | `activities` | `id` (UUID) | CRM activities: conferences, road trips, emails, etc. Rich metadata, outcome tracking, calendar/Gmail/Slack sync fields. |
| **Task** | `tasks` | `id` (UUID) | Kanban-style tasks with priority, status, due date. |
| **UserProfile** | `user_profiles` | `id` (UUID, matches Supabase auth) | User data, role (admin/manager/rep), setup status, location. |

### Supporting / Reference Models

| Model | Table | Description |
|-------|-------|-------------|
| **Tag** | `tags` | Named tags with colors for categorizing districts/schools |
| **Service** | `services` | Fullmind service catalog (name, slug, color) |
| **CompetitorSpend** | `competitor_spend` | GovSpend PO data by district/competitor/fiscal year |
| **VendorFinancials** | `vendor_financials` | Normalized financials for all vendors (Fullmind + competitors) |
| **UserGoal** | `user_goals` | Per-user fiscal year targets (revenue, take, pipeline, new districts) |
| **MapView** | `map_views` | Saved map state snapshots |
| **StateAssessment** | `state_assessments` | Which standardized tests each state uses |
| **VacancyScan** | `vacancy_scans` | Job board scan audit records |
| **Vacancy** | `vacancies` | Scraped job postings from district job boards |
| **VacancyKeywordConfig** | `vacancy_keyword_config` | Relevance/exclusion keyword rules |
| **DataRefreshLog** | `data_refresh_logs` | ETL run audit log |
| **UnmatchedAccount** | `unmatched_accounts` | CRM accounts that failed district matching |
| **UnmatchedOpportunity** | `unmatched_opportunities` | Opportunities that failed district matching |
| **CalendarConnection** | `calendar_connections` | Google Calendar OAuth per user |
| **CalendarEvent** | `calendar_events` | Staging table for incoming calendar events |
| **UserIntegration** | `user_integrations` | OAuth tokens for Gmail, Calendar, Slack, Mixmax |

### Junction / Link Tables

| Model | Table | Links |
|-------|-------|-------|
| **DistrictTag** | `district_tags` | District <-> Tag |
| **SchoolTag** | `school_tags` | School <-> Tag |
| **SchoolContact** | `school_contacts` | School <-> Contact |
| **TerritoryPlanDistrict** | `territory_plan_districts` | Plan <-> District (with per-district targets) |
| **TerritoryPlanDistrictService** | `territory_plan_district_services` | Plan-District <-> Service (with category) |
| **TerritoryPlanState** | `territory_plan_states` | Plan <-> State |
| **TerritoryPlanCollaborator** | `territory_plan_collaborators` | Plan <-> User |
| **ActivityPlan** | `activity_plans` | Activity <-> Plan |
| **ActivityDistrict** | `activity_districts` | Activity <-> District (with visit dates, position) |
| **ActivityContact** | `activity_contacts` | Activity <-> Contact |
| **ActivityState** | `activity_states` | Activity <-> State |
| **ActivityOpportunity** | `activity_opportunities` | Activity <-> Opportunity |
| **ActivityExpense** | `activity_expenses` | Activity expenses |
| **ActivityAttendee** | `activity_attendees` | Activity <-> User |
| **ActivityRelation** | `activity_relations` | Activity <-> Activity (related, follow_up, part_of) |
| **TaskDistrict** | `task_districts` | Task <-> District |
| **TaskPlan** | `task_plans` | Task <-> Plan |
| **TaskActivity** | `task_activities` | Task <-> Activity |
| **TaskContact** | `task_contacts` | Task <-> Contact |

### Historical / Time-Series

| Model | Table | Description |
|-------|-------|-------------|
| **DistrictDataHistory** | `district_data_history` | Year-over-year metrics per district per source |
| **DistrictGradeEnrollment** | `district_grade_enrollment` | Grade-level enrollment by district/year |
| **SchoolEnrollmentHistory** | `school_enrollment_history` | School enrollment by year |

### Materialized Views (not in Prisma schema)

| View | Description |
|------|-------------|
| **`district_opportunity_actuals`** | Aggregates opportunities by (district_lea_id, school_yr, sales_rep_email, category). Columns: total_revenue, completed_revenue, scheduled_revenue, total_take, completed_take, scheduled_take, weighted_pipeline, open_pipeline, bookings, invoiced, credited, opp_count. Refreshed hourly. |
| **`district_customer_categories`** | Categorizes districts as multi_year, new, lapsed, pipeline, or target based on revenue data. Used for map dot rendering. |

---

## 3. Existing API Patterns

### Pattern 1: No Auth (Public-ish)
**File:** `src/app/api/districts/route.ts`

```typescript
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // ... parse params
    const districts = await prisma.district.findMany({ where, select, take, skip, orderBy });
    return NextResponse.json({ districts, total });
  } catch (error) {
    console.error("Error fetching districts:", error);
    return NextResponse.json({ error: "Failed to fetch districts" }, { status: 500 });
  }
}
```
- No explicit auth check in the handler (relies on middleware redirect).
- Uses Prisma `findMany` with explicit `select` for field trimming.
- Response: `{ districts: [...], total: number }`.

### Pattern 2: With Auth
**File:** `src/app/api/opportunities/route.ts`, `src/app/api/activities/route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ... query scoped to user.id
  } catch (error) {
    return NextResponse.json({ error: "Failed to ..." }, { status: 500 });
  }
}
```
- Auth check at the top of the handler via `getUser()`.
- Activities are scoped to `createdByUserId: user.id`.
- 401 for unauthenticated, 500 for server errors.
- Error responses: `{ error: string }`.
- Optional dev-only error details: `{ error, details, stack }`.

### Pattern 3: With Validation
**File:** `src/app/api/accounts/route.ts`

- POST requests validate required fields and return 400: `{ error: "Name is required" }`.
- Uses `prisma.$queryRaw` for sequences and PostGIS operations alongside standard Prisma CRUD.
- Success: 201 status for creation.

### Common Conventions
- All routes export `const dynamic = "force-dynamic"` to disable caching.
- Response envelope: `{ data, total }` or `{ entity: [...] }` (not wrapped in a generic `data` key).
- Prisma Decimal values are manually converted to `Number()` before JSON response.
- Date values converted via `.toISOString()`.
- Parallel queries via `Promise.all()` for count + data.

---

## 4. Data Access Patterns

### TanStack Query Hooks

**Location:** `src/features/{name}/lib/queries.ts` (13 files)

**Shared fetch helper** (`src/features/shared/lib/api-client.ts`):
```typescript
export const API_BASE = "/api";
export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T>
```
- Sets `Content-Type: application/json`.
- Throws on non-ok responses (extracts `body.error` from JSON).
- Detects HTML responses (session expiry redirects) and throws descriptive error.

**Standard query hook pattern:**
```typescript
export function useDistricts(params: { state?: string; ... }) {
  const searchParams = new URLSearchParams();
  // ... build params
  return useQuery({
    queryKey: ["districts", params],
    queryFn: () => fetchJson<ResponseType>(`${API_BASE}/districts?${searchParams}`),
    staleTime: 5 * 60 * 1000,
  });
}
```

**Standard mutation pattern:**
```typescript
export function useUpdateDistrictEdits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaid, notes, owner }) =>
      fetchJson(`${API_BASE}/districts/${leaid}/edits`, { method: "PUT", body: JSON.stringify({ notes, owner }) }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["district", vars.leaid] });
    },
  });
}
```

**Barrel export:** `src/lib/api.ts` re-exports all feature query hooks and `fetchJson`.

### Dynamic Query Builder (Explore Feature)

The explore feature has a **full dynamic query builder** at `src/features/explore/lib/filters.ts`:

**`FilterDef` type:**
```typescript
interface FilterDef {
  column: string;  // client-facing column key
  op: FilterOp;    // eq, neq, in, contains, gt, gte, lt, lte, between, is_true, is_false, is_empty, is_not_empty
  value?: unknown;
}
```

**`buildWhereClause(filters, fieldMap)`** — converts `FilterDef[]` into a Prisma `where` object:
- Uses a field map (client key -> Prisma field name) as an allowlist.
- Groups filters by field, merges `in` values, ANDs other conditions.
- Two field maps exist: `DISTRICT_FIELD_MAP` (155+ entries) and `PLANS_FIELD_MAP` (11 entries).

**Explore API** (`src/app/api/explore/[entity]/route.ts`):
- Supports entities: `districts`, `plans` (extensible pattern).
- Accepts JSON-encoded filters, multi-sort, pagination, and column selection via query params.
- Response: `{ data: T[], aggregates: Record<string, number>, pagination: { page, pageSize, total } }`.
- Has a 30-second TTL in-memory cache (50 entries max) to avoid redundant queries.
- Handles relation filters (tags, planNames, competitor spend) separately from scalar filters.
- Supports competitor spend sorting via raw SQL fallback.
- Column-aware `select` — only fetches requested columns from the database.
- Reshapes Prisma field names back to client column keys in the response.

**Explore query hook** (`src/features/explore/lib/queries.ts`):
```typescript
export function useExploreData<T>(entity: string, params: {
  filters?: FilterDef[];
  sorts?: { column: string; direction: "asc" | "desc" }[];
  page?: number;
  pageSize?: number;
  columns?: string[];
})
```

### Opportunity Actuals (Raw SQL Module)

`src/lib/opportunity-actuals.ts` — a shared module for querying the `district_opportunity_actuals` materialized view:

- `getDistrictActuals(districtLeaId, schoolYr)` — aggregate for one district
- `getRepActuals(salesRepEmail, schoolYr)` — aggregate for one rep across all districts
- `getNewDistrictsCount(salesRepEmail, currentSchoolYr, priorSchoolYr)` — count new districts
- `getRepLeaderboardRank(salesRepEmail, schoolYr)` — ranking by total take
- `getPlanDistrictActuals(districtLeaIds[], schoolYr)` — aggregate for a set of districts
- `getDistrictOpportunities(districtLeaId, schoolYr)` — individual opportunity rows

All use `prisma.$queryRaw` with a `safeQueryRaw` wrapper that gracefully handles missing tables (returns fallback on PostgreSQL 42P01 errors).

---

## 5. Table Metadata / Schema Introspection

### Existing Mechanisms

1. **`scripts/check-schema.ts`** — a utility script that queries `information_schema.columns` to introspect table columns at runtime:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'territory_plans'
   ORDER BY ordinal_position
   ```
   Also checks `information_schema.tables` for table existence. Uses a direct `pg.Client` connection via `DIRECT_URL`.

2. **`DISTRICT_FIELD_MAP`** in `src/features/explore/lib/filters.ts` — a static 155+ entry mapping from client-facing column keys to Prisma field names. This is the closest thing to a "column registry" for districts. It serves as both a whitelist and a bidirectional mapping.

3. **`PLANS_FIELD_MAP`** — similar static map for territory plan fields (11 entries).

4. **Prisma generated types** — `@prisma/client` generates TypeScript types from the schema. The `Prisma` namespace exposes model metadata like `Prisma.DistrictScalarFieldEnum`, `Prisma.DistrictWhereInput`, etc.

### No Dynamic Introspection API

There is **no existing API endpoint** that exposes table schemas or column metadata to the frontend. The closest pattern is the explore API's column-aware select, which relies on the static field maps.

**For the Report Builder**, the recommended approach would be:
- Extend the existing field map pattern (static column registries per entity) rather than building runtime introspection.
- The existing `DISTRICT_FIELD_MAP` already covers all district columns. Similar maps can be created for other entities (opportunities, activities, contacts, etc.).
- The `information_schema` query pattern from `check-schema.ts` could be adapted into an admin API endpoint if truly dynamic introspection is needed.
- Prisma's generated types provide compile-time safety, but for runtime column discovery, field maps are the established pattern.

---

## Key Files Reference

| Area | Path |
|------|------|
| Supabase server client | `src/lib/supabase/server.ts` |
| Supabase browser client | `src/lib/supabase/client.ts` |
| Supabase middleware | `src/lib/supabase/middleware.ts` |
| Next.js middleware | `src/middleware.ts` |
| Prisma client singleton | `src/lib/prisma.ts` |
| pg Pool singleton | `src/lib/db.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Shared fetch helper | `src/features/shared/lib/api-client.ts` |
| API type definitions | `src/features/shared/types/api-types.ts` |
| Explore filters/query builder | `src/features/explore/lib/filters.ts` |
| Explore API route | `src/app/api/explore/[entity]/route.ts` |
| Explore query hook | `src/features/explore/lib/queries.ts` |
| Opportunity actuals module | `src/lib/opportunity-actuals.ts` |
| Materialized view SQL | `scripts/district-opportunity-actuals-view.sql` |
| Schema check script | `scripts/check-schema.ts` |
| Query hooks barrel export | `src/lib/api.ts` |
