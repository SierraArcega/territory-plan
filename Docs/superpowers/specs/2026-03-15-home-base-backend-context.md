# Backend Context: Home Base Feature

> Generated 2026-03-15 via backend-discovery skill.
> Scope: backend architecture relevant to building/enhancing the Home Base (dashboard) feature.

---

## 1. Relevant Data Models

### UserProfile (`user_profiles`)
The logged-in user's identity and preferences. Created/updated on every login via upsert from Supabase Auth.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Matches Supabase `user.id` |
| `email` | String (unique) | From Supabase auth |
| `fullName` | String? | Synced from auth metadata |
| `avatarUrl` | String? | Synced from auth metadata |
| `jobTitle` | String? | User-editable |
| `location` | String? | User-editable (free text) |
| `locationLat/Lng` | Decimal? | Geocoded from location |
| `phone`, `slackUrl`, `bio` | String? | User-editable profile fields |
| `hasCompletedSetup` | Boolean | Onboarding wizard flag |
| `lastLoginAt` | DateTime? | Updated each login |

**Key relations:**
- `goals` -> `UserGoal[]` (fiscal-year targets)
- `ownedPlans` -> `TerritoryPlan[]` (plans they own)
- `collaboratingOn` -> `TerritoryPlanCollaborator[]`
- `calendarConnection` -> `CalendarConnection?`
- `savedMapViews` -> `MapView[]`

---

### UserGoal (`user_goals`)
One row per user per fiscal year. Stores targets; actuals are computed at query time.

| Field | Type | Notes |
|---|---|---|
| `userId` + `fiscalYear` | Composite unique | One goal per user per FY |
| `earningsTarget` | Decimal? | Total earnings goal |
| `takeTarget` | Decimal? | Take revenue target |
| `takeRatePercent` | Decimal? | Target take rate |
| `renewalTarget` | Decimal? | Renewal revenue target |
| `winbackTarget` | Decimal? | Winback revenue target |
| `expansionTarget` | Decimal? | Expansion revenue target |
| `newBusinessTarget` | Decimal? | New business revenue target |
| `newDistrictsTarget` | Int? | Count of new districts |

**Pattern:** Goals are upserted via `POST /api/profile/goals`. Actuals are computed on the fly from `district_opportunity_actuals` materialized view and plan district data.

---

### TerritoryPlan (`territory_plans`)
The core planning unit. Each plan covers a fiscal year and contains districts with per-district targets.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `name` | String | |
| `ownerId` | UUID? | FK to UserProfile |
| `userId` | UUID? | Creator (legacy, both used) |
| `color` | String | Hex color for UI chips |
| `status` | String | `planning`, `working`, `stale`, `archived` |
| `fiscalYear` | Int | Required (2025-2030) |
| `startDate`, `endDate` | DateTime? | Optional date range |
| Rollup columns | Decimal | `renewalRollup`, `expansionRollup`, `winbackRollup`, `newBusinessRollup` |

**Key relations:**
- `districts` -> `TerritoryPlanDistrict[]` (with per-district targets + services)
- `states` -> `TerritoryPlanState[]`
- `collaborators` -> `TerritoryPlanCollaborator[]`
- `activityLinks` -> `ActivityPlan[]`
- `taskLinks` -> `TaskPlan[]`

---

### Activity (`activities`)
Sales activities (conferences, calls, demos, road trips, etc.) that can link to multiple plans, districts, contacts, and states.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `type` | String(30) | `conference`, `road_trip`, `email_campaign`, `call`, `demo`, etc. |
| `title` | String | |
| `status` | String | `planned`, `completed`, `cancelled` |
| `startDate`, `endDate` | DateTime? | When it occurs |
| `createdByUserId` | UUID? | Owner |
| `source` | String | `manual` or `calendar_sync` |
| `outcome` | String? | Free-text outcome note |
| `outcomeType` | String? | `positive_progress`, `neutral`, `negative`, `follow_up_needed` |
| `googleEventId` | String? (unique) | Calendar sync link |

**Key relations:** All many-to-many via junction tables:
- `ActivityPlan`, `ActivityDistrict`, `ActivityContact`, `ActivityState`
- `TaskActivity` (links activities to tasks)

---

### Task (`tasks`)
User-created action items with kanban-style workflow and multi-entity linking.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `title` | String | |
| `status` | String | `todo`, `in_progress`, `blocked`, `done` |
| `priority` | String | `low`, `medium`, `high`, `urgent` |
| `dueDate` | DateTime? | |
| `position` | Int | Ordering within kanban column |
| `createdByUserId` | UUID | Always scoped to current user |

**Key relations:** All many-to-many via junction tables:
- `TaskDistrict`, `TaskPlan`, `TaskActivity`, `TaskContact`

---

### District (`districts`)
Massive model (~120 columns) with education data, CRM data, financial metrics, demographics, trends, and comparison deltas. Key fields for Home Base:

- **Identity:** `leaid` (PK), `name`, `stateAbbrev`, `enrollment`
- **CRM:** `isCustomer`, `hasOpenPipeline`, `salesExecutive`, `accountName`
- **Pipeline:** `fy26OpenPipeline`, `fy27OpenPipeline`, `fy26NetInvoicing`, etc.
- **Sessions:** `fy25SessionsRevenue/Take/Count`, `fy26SessionsRevenue/Take/Count`

---

### CalendarConnection & CalendarEvent
Google Calendar OAuth integration for syncing meetings into activities.

- `CalendarConnection`: One per user, stores OAuth tokens and sync state
- `CalendarEvent`: Staged events from Google Calendar, pending user confirmation
  - `status`: `pending`, `confirmed`, `dismissed`, `cancelled`
  - Smart matching: `suggestedActivityType`, `suggestedDistrictId`, `suggestedPlanId`

---

### Materialized View: `district_opportunity_actuals`
Not in Prisma schema (managed via raw SQL). Aggregates opportunity data per district per school year per rep.

| Column | Notes |
|---|---|
| `district_lea_id` | District FK |
| `school_yr` | e.g., "2025-26" |
| `sales_rep_email` | Rep scoping |
| `total_revenue`, `total_take`, `completed_take`, `scheduled_take` | Revenue metrics |
| `weighted_pipeline`, `open_pipeline` | Pipeline metrics |
| `bookings`, `invoiced`, `credited` | Financial metrics |
| `opp_count` | Count of opportunities |

**Queried via:** `src/lib/opportunity-actuals.ts` using `prisma.$queryRaw`.

---

## 2. API Route Patterns & Conventions

### Route Structure
Standard Next.js App Router route handlers in `src/app/api/`. No tRPC, no server actions (`"use server"` not used anywhere).

```
src/app/api/
  [resource]/
    route.ts          # GET (list), POST (create)
    [id]/
      route.ts        # GET (detail), PATCH/PUT (update), DELETE
      [sub]/
        route.ts      # Nested resource operations
```

### Convention Pattern (every route follows this):

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // Always present

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse params from URL searchParams
    const { searchParams } = new URL(request.url);

    // 3. Build Prisma where clause (always scoped to user.id)
    const where = { createdByUserId: user.id, ... };

    // 4. Query with Prisma (often parallel queries via Promise.all)
    const [count, data] = await Promise.all([
      prisma.model.count({ where }),
      prisma.model.findMany({ where, select: {...}, orderBy: {...} }),
    ]);

    // 5. Transform response (manual mapping, no DTOs)
    const transformed = data.map(item => ({
      ...item,
      dates: item.date?.toISOString() ?? null,
      decimals: Number(item.decimal),
    }));

    // 6. Return JSON
    return NextResponse.json({ items: transformed, total: count });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed to ..." }, { status: 500 });
  }
}
```

### Key Conventions
- **No middleware-level auth on API routes** -- each handler calls `getUser()` explicitly
- **`export const dynamic = "force-dynamic"`** on every route
- **User scoping:** Most queries filter by `createdByUserId: user.id` or `userId: user.id`
- **Exception:** Territory plans list (`GET /api/territory-plans`) shows ALL plans (team visibility), not scoped to user
- **Decimal handling:** Prisma `Decimal` -> `Number()` or `.toNumber()` in response mapping
- **Date handling:** `.toISOString()` with null coalescing `?? null`
- **Error responses:** `{ error: "message" }` with appropriate HTTP status
- **Validation:** Manual field validation in each handler (no Zod or shared validation lib)
- **Performance:** `Promise.all` for parallel queries; `select` over `include` for list endpoints

---

## 3. Auth Approach

### Authentication: Supabase Auth (SSR)
- **Provider:** `@supabase/ssr` with cookie-based sessions
- **Server-side:** `createClient()` in `src/lib/supabase/server.ts` reads cookies
- **`getUser()`:** Convenience wrapper that returns `user` or `null`
- **Middleware:** `src/middleware.ts` calls `updateSession()` which:
  - Refreshes auth tokens on every request
  - Redirects unauthenticated users to `/login` (except auth pages)
  - Redirects authenticated users away from `/login` and `/signup`
- **Maintenance mode:** Toggle via `MAINTENANCE_MODE` env var

### Authorization
- **No role-based access control** -- all authenticated users have equal access
- **User scoping:** Each API route filters data by the authenticated user's ID
- **Ownership checks:** Detail/update/delete endpoints verify `createdByUserId === user.id`
- **Exception:** Territory plans are team-visible (no user filter on list endpoint)

---

## 4. Data Fetching Patterns

### Client-Side: TanStack Query + Custom Hooks
Every feature module has a `lib/queries.ts` file with TanStack Query hooks:

```
src/features/[feature]/lib/queries.ts   # useQuery / useMutation hooks
src/features/shared/lib/queries.ts      # Cross-cutting hooks (tags, contacts, profile, users)
src/features/shared/lib/api-client.ts   # fetchJson helper + API_BASE constant
```

**Pattern:**
```typescript
// Read: useQuery with queryKey array
export function useTerritoryPlans() {
  return useQuery({
    queryKey: ["territoryPlans"],
    queryFn: () => fetchJson<TerritoryPlan[]>(`${API_BASE}/territory-plans`),
    staleTime: 2 * 60 * 1000, // 2 minutes typical
  });
}

// Write: useMutation with cache invalidation
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => fetchJson(`${API_BASE}/tasks`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
```

**staleTime conventions:**
- High-frequency data (plans, tasks, activities): 2 minutes
- Dashboard/progress data: 5 minutes
- Reference data (tags, services, sales executives): 1 hour

### Server-Side Components
The app uses a **single-page client-side approach**. The root `src/app/page.tsx` is `"use client"` and renders different views based on a `?tab=` URL parameter via Zustand state. There are no server components fetching data -- all data fetching happens client-side via TanStack Query hooks.

### Barrel Export
`src/lib/api.ts` re-exports all query hooks and types from feature modules. Components can import from `@/lib/api` or directly from feature modules.

---

## 5. Existing Queries & Utilities Reusable for Home Base

### Already Used by HomeView
The existing `HomeView.tsx` (at `src/features/shared/components/views/HomeView.tsx`) already fetches:

| Hook | Source | Purpose |
|---|---|---|
| `useProfile()` | `shared/lib/queries.ts` | User name, setup status |
| `useGoalDashboard(fiscalYear)` | `goals/lib/queries.ts` | Goal targets vs actuals with donut charts |
| `useTerritoryPlans()` | `plans/lib/queries.ts` | Plan list for "My Plans" cards |
| `useTasks({})` | `tasks/lib/queries.ts` | All tasks for upcoming/overdue/completed tabs |
| `useActivities({ startDateFrom, startDateTo })` | `activities/lib/queries.ts` | Calendar month activities |
| `useUpdateTask()` | `tasks/lib/queries.ts` | Toggle task complete from dashboard |
| `useCreateTerritoryPlan()` | `plans/lib/queries.ts` | Create plan modal |

### Available but Not Yet Used in HomeView

| Hook | Source | Could power |
|---|---|---|
| `useActivityMetrics(period)` | `progress/lib/queries.ts` | Activity trend cards (by category, source, status) |
| `useOutcomeMetrics(period)` | `progress/lib/queries.ts` | Outcome distribution, funnel, engagement ratio |
| `usePlanEngagement()` | `progress/lib/queries.ts` | Per-plan district coverage and recency |
| `useTeamProgress(fiscalYear)` | `progress/lib/queries.ts` | Team-wide targets vs actuals by category |
| `useCalendarConnection()` | `calendar/lib/queries.ts` | Calendar connection status badge |
| `useCalendarInbox("pending")` | `calendar/lib/queries.ts` | Pending calendar events count |
| `useCalendarInboxCount()` | `calendar/lib/queries.ts` | Badge count (select transform) |
| `useUsers()` | `shared/lib/queries.ts` | Team member list |
| `useSalesExecutives()` | `shared/lib/queries.ts` | Sales exec dropdown |

### Server-Side Utilities

| Utility | Location | Purpose |
|---|---|---|
| `getUser()` | `src/lib/supabase/server.ts` | Auth check in route handlers |
| `prisma` | `src/lib/prisma.ts` | Singleton Prisma client |
| `pool` | `src/lib/db.ts` | Raw `pg` Pool for direct SQL (used by tiles API) |
| `getRepActuals()` | `src/lib/opportunity-actuals.ts` | Rep-scoped revenue/take/pipeline from materialized view |
| `getNewDistrictsCount()` | `src/lib/opportunity-actuals.ts` | Count of new districts (no prior year revenue) |
| `getPlanDistrictActuals()` | `src/lib/opportunity-actuals.ts` | Actuals for a set of district IDs |
| `getDistrictActuals()` | `src/lib/opportunity-actuals.ts` | Single district actuals |
| `fiscalYearToSchoolYear()` | `src/lib/opportunity-actuals.ts` | FY number -> school year string (e.g., 2026 -> "2025-26") |

### Shared Types
All API response types are defined in `src/features/shared/types/api-types.ts`:
- `UserProfile`, `UserGoal`, `GoalDashboard`
- `TerritoryPlan`, `TerritoryPlanDetail`, `TerritoryPlanDistrict`
- `Activity`, `ActivityListItem`, `ActivitiesResponse`
- `TaskItem`, `TasksResponse`
- `ActivityMetrics`, `OutcomeMetrics`, `PlanEngagement`
- `CalendarStatusResponse`, `CalendarEvent`, `CalendarInboxResponse`

### UI Components Already in HomeView
- `DonutChart` (goal progress visualization)
- `FlippablePlanCard` (plan summary cards)
- `PlanCardFilters` (sort/filter for plan cards)
- `CalendarInboxWidget` (pending calendar events)
- `LeadingIndicatorsPanel` / `LaggingIndicatorsPanel` (progress panels)
- `GoalEditorModal`, `TaskDetailModal`, `PlanFormModal` (action modals)
- `MiniCalendar` (inline month calendar with activity dots)

---

## 6. Testing Patterns

### Framework
- **Vitest** with `vi.mock()` for module mocking
- Tests colocated with routes: `src/app/api/[resource]/__tests__/route.test.ts`

### Pattern
```typescript
// Mock auth
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getUser: (...args) => mockGetUser(...args) }));

// Mock Prisma (mock each model method individually)
vi.mock("@/lib/prisma", () => ({
  default: {
    task: { count: vi.fn(), findMany: vi.fn(), create: vi.fn(), ... },
    $transaction: vi.fn(),
  },
}));

// Import route handlers after mocks
import { GET, POST } from "../route";

// Helper to create NextRequest
function makeRequest(url: string, options?) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// Test structure: 401 check, 400 validation, happy path, 500 error
```

### Existing Test Files
- `src/app/api/tasks/__tests__/route.test.ts` (comprehensive: CRUD + reorder)
- `src/app/api/activities/__tests__/route.test.ts`
- `src/app/api/territory-plans/__tests__/route.test.ts`
- `src/app/api/districts/similar/__tests__/route.test.ts`
- `src/app/api/districts/summary/__tests__/route.test.ts`
- `src/app/api/tiles/[z]/[x]/[y]/__tests__/route.test.ts`

---

## 7. Recommendations for Home Base Backend

### What Already Exists (No New Backend Needed)
The existing HomeView already has a functional backend surface. All the data it currently displays comes from existing API endpoints:
- Goal dashboard: `GET /api/profile/goals/[fiscalYear]/dashboard`
- Plans list: `GET /api/territory-plans`
- Tasks list: `GET /api/tasks`
- Activities list: `GET /api/activities`
- Profile: `GET /api/profile`
- Calendar status: `GET /api/calendar/status`
- Progress metrics: `GET /api/progress/activities`, `/outcomes`, `/plans`

### If New API Endpoints Are Needed

**Potential: `GET /api/home/summary`** -- A single aggregated endpoint to reduce waterfall requests from HomeView. Could combine:
- Profile greeting data
- Goal dashboard summary (current FY)
- Task counts (upcoming/overdue/completed)
- Plan summaries (count, top 3 by recent update)
- Calendar inbox pending count
- Activity count for today

**Pattern to follow:**
1. Create `src/app/api/home/summary/route.ts`
2. Use `getUser()` for auth
3. Run all queries in `Promise.all` for parallelism
4. Create a corresponding `useHomeSummary()` hook in `src/features/home/lib/queries.ts` (or add to shared queries)
5. Define response type in `src/features/shared/types/api-types.ts`
6. Add tests in `src/app/api/home/summary/__tests__/route.test.ts`

### Query Optimization Notes
- The current HomeView makes ~6 parallel API calls on mount. This is acceptable with TanStack Query's caching (staleTime prevents re-fetching on tab switches).
- The `GET /api/territory-plans` endpoint is the heaviest -- it loads ALL plans with district data and computes actuals per plan. For Home Base, consider a lighter endpoint that only returns plan summaries.
- The `GET /api/profile/goals/[fiscalYear]/dashboard` endpoint runs 3-4 raw SQL queries against the materialized view. It's well-optimized with `Promise.all`.

### Architecture Alignment
- **No server actions** -- stick with route handlers
- **No server components for data** -- keep the client-side pattern with TanStack Query
- **Prisma for ORM queries, raw SQL for materialized views** -- follow existing pattern in `opportunity-actuals.ts`
- **Manual response mapping** -- no DTO framework; transform in route handler
- **Cache invalidation** -- use `queryClient.invalidateQueries` with granular query keys
