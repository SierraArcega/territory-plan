# Feed Task Pagination - Backend Context

> Research document for the Feed feature iteration (task/activity pagination).
> Date: 2026-03-19

---

## 1. Data Models

### Task Model (`prisma/schema.prisma`, line 837)

```
model Task {
  id              String    @id @default(uuid())
  title           String    @db.VarChar(255)
  description     String?
  status          String    @default("todo") @db.VarChar(20)   // todo, in_progress, blocked, done
  priority        String    @default("medium") @db.VarChar(10) // low, medium, high, urgent
  dueDate         DateTime? @map("due_date")
  position        Int       @default(0)                        // ordering within kanban column
  createdByUserId String    @map("created_by_user_id") @db.Uuid
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Junction tables (many-to-many)
  districts  TaskDistrict[]
  plans      TaskPlan[]
  activities TaskActivity[]
  contacts   TaskContact[]

  @@index([createdByUserId])
  @@index([status])
  @@index([dueDate])
  @@map("tasks")
}
```

**Key points:**
- UUID primary key, scoped to `createdByUserId`.
- DB indexes on `createdByUserId`, `status`, and `dueDate` -- date-based filtering is already indexed.
- Four junction tables link tasks to districts, plans, activities, and contacts.
- `position` field supports kanban drag-and-drop ordering.

### Activity Model (`prisma/schema.prisma`, line 577)

```
model Activity {
  id              String    @id @default(uuid())
  type            String    @db.VarChar(30)  // conference, road_trip, email_campaign, etc.
  title           String    @db.VarChar(255)
  notes           String?
  startDate       DateTime? @map("start_date")
  endDate         DateTime? @map("end_date")
  status          String    @default("planned") @db.VarChar(20) // planned, completed, cancelled
  createdByUserId String?   @map("created_by_user_id") @db.Uuid
  source          String    @default("manual") @db.VarChar(20)  // manual, calendar_sync
  outcomeType     String?   @map("outcome_type") @db.VarChar(30)
  googleEventId   String?   @unique @map("google_event_id")
  metadata        Json?

  // Junction tables
  plans     ActivityPlan[]
  districts ActivityDistrict[]
  contacts  ActivityContact[]
  states    ActivityState[]
  taskLinks TaskActivity[]
  expenses  ActivityExpense[]
  attendees ActivityAttendee[]
  relations ActivityRelation[]
  relatedTo ActivityRelation[]

  @@index([createdByUserId])
  @@index([type])
  @@index([startDate])
  @@map("activities")
}
```

**Key points:**
- Indexed on `createdByUserId`, `type`, and `startDate`.
- `ActivityDistrict` junction has `visitDate` and `visitEndDate` fields for per-district scheduling.
- `outcomeType` tracks whether an activity has had its outcome recorded (used by Feed to show "needs next steps").

### Calendar Events

Calendar events are stored in a `CalendarEvent` model (not shown above but referenced via `CalendarInboxResponse`). These are staged events from Google Calendar that can be confirmed into Activities.

---

## 2. API Routes

### Tasks API (`src/app/api/tasks/`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/tasks` | GET | List tasks with filtering |
| `/api/tasks` | POST | Create a new task |
| `/api/tasks/[id]` | GET | Get task detail |
| `/api/tasks/[id]` | PATCH | Update task fields |
| `/api/tasks/[id]` | DELETE | Delete task |
| `/api/tasks/reorder` | PATCH | Batch update status + position (kanban drag-and-drop) |
| `/api/tasks/[id]/plans` | POST/DELETE | Link/unlink plans |
| `/api/tasks/[id]/districts` | POST/DELETE | Link/unlink districts |
| `/api/tasks/[id]/activities` | POST/DELETE | Link/unlink activities |
| `/api/tasks/[id]/contacts` | POST/DELETE | Link/unlink contacts |

#### GET /api/tasks - Current Query Params

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status (todo, in_progress, blocked, done) |
| `priority` | string | Filter by priority (low, medium, high, urgent) |
| `planId` | string | Filter by linked plan |
| `activityId` | string | Filter by linked activity |
| `leaid` | string | Filter by linked district |
| `contactId` | string | Filter by linked contact |
| `search` | string | Search by title (case-insensitive contains) |
| `dueBefore` | ISO date | Tasks due on or before this date |
| `dueAfter` | ISO date | Tasks due on or after this date |

**IMPORTANT: No pagination exists on the tasks API.** The endpoint fetches ALL matching tasks in a single query with no `limit`/`offset` or cursor support. The response shape is `{ tasks: TaskItem[], totalCount: number }`.

Current ordering: `position ASC`, then `dueDate ASC NULLS LAST`, then `createdAt DESC`.

### Activities API (`src/app/api/activities/`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/activities` | GET | List activities with filtering |
| `/api/activities` | POST | Create activity |
| `/api/activities/[id]` | GET/PATCH/DELETE | CRUD on single activity |
| `/api/activities/[id]/plans` | POST/DELETE | Link/unlink plans |
| `/api/activities/[id]/districts` | POST/DELETE | Link/unlink districts |

#### GET /api/activities - Current Query Params

| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by category (events, campaigns, meetings, gift_drop) |
| `planId` | string | Filter by linked plan |
| `districtLeaid` | string | Filter by linked district |
| `stateAbbrev` | string | Filter by state |
| `status` | string | Filter by status |
| `startDate` | ISO date | Activities starting on or after |
| `endDate` | ISO date | Activities ending on or before |
| `unscheduled` | boolean | Only activities with no startDate |
| `needsPlanAssociation` | boolean | Only activities with no linked plans |
| `hasUnlinkedDistricts` | boolean | Only activities with districts not in any linked plan |
| `search` | string | Search by title |
| `limit` | number | Default 100 |
| `offset` | number | Default 0 |

**Activities API already has limit/offset pagination.** Response shape: `{ activities: ActivityListItem[], total: number, totalInDb: number }`.

Ordering: `startDate DESC NULLS LAST`.

---

## 3. How the Feed/Home Page Fetches Data

### Component hierarchy

```
page.tsx (tab router)
  -> HomeView (src/features/home/components/HomeView.tsx)
    -> HomeTabBar (feed | plans tabs)
    -> FeedTab (src/features/home/components/FeedTab.tsx)
      -> FeedSummaryCards
      -> FeedSection (overdue tasks)
      -> FeedSection (activities need next steps)
      -> FeedSection (meetings to log)
```

### FeedTab data fetching (line 51-53)

```typescript
const { data: allTasksData } = useTasks({});          // ALL tasks, no filters
const { data: activitiesData } = useActivities({});    // ALL activities, no filters
const { data: calendarData } = useCalendarInbox("pending");
```

**Critical finding: FeedTab fetches ALL tasks and ALL activities (up to the 100 default limit for activities) with no filters, then filters client-side:**

- **Overdue tasks**: `tasks.filter(t => t.status !== "done" && t.dueDate !== null && t.dueDate < today)`
- **Activities needing next steps**: `activities.filter(a => a.status === "completed" && !a.outcomeType)`
- **Meetings to log**: calendar events with "pending" status (fetched server-side)

This is the primary target for optimization -- the Feed should push these filters to the server and paginate results.

### Client-side query hooks

**useTasks** (`src/features/tasks/lib/queries.ts`):
- Uses TanStack Query (React Query) with `queryKey: ["tasks", params]`
- `staleTime: 2 * 60 * 1000` (2 minutes)
- No pagination params supported

**useActivities** (`src/features/activities/lib/queries.ts`):
- Uses TanStack Query with `queryKey: ["activities", params]`
- `staleTime: 2 * 60 * 1000` (2 minutes)
- Supports `limit` and `offset` params

**useCalendarInbox** (`src/features/calendar/lib/queries.ts`):
- Uses TanStack Query with `queryKey: ["calendarEvents", status]`
- `staleTime: 2 * 60 * 1000` (2 minutes)

### Shared API client

All hooks use `fetchJson` from `src/features/shared/lib/api-client.ts` and the barrel export at `src/lib/api.ts`.

---

## 4. Auth Patterns

### getUser() (`src/lib/supabase/server.ts`)

Every API route calls `getUser()` as the first step:

```typescript
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

`getUser()` does:
1. Creates a Supabase server client using cookies
2. Calls `supabase.auth.getUser()` to get the authenticated user
3. Checks for an `impersonate_uid` cookie (admin impersonation feature)
4. If impersonating, verifies the real user is an admin, then returns a synthetic user with the impersonated ID

All task/activity queries are scoped by `createdByUserId: user.id` -- there is no team-level or shared access pattern for tasks.

### Ownership enforcement

- **Tasks**: `createdByUserId` checked on list (where clause), detail (403 if mismatch), update, and delete
- **Activities**: `createdByUserId` in the where clause on list; individual endpoints verify ownership

---

## 5. Existing Date-Based Filtering and Sorting

### Tasks

- **Query params**: `dueBefore` (lte) and `dueAfter` (gte) on `dueDate` field
- **DB index**: `@@index([dueDate])` exists
- **Default sort**: `position ASC, dueDate ASC NULLS LAST, createdAt DESC`
- **Feed client-side filter**: Compares `dueDate < today` for overdue (string comparison on ISO dates)

### Activities

- **Query params**: `startDate` (gte) and `endDate` (lte) with overlap logic
- **DB index**: `@@index([startDate])` exists
- **Default sort**: `startDate DESC NULLS LAST`
- **Feed client-side filter**: Checks `status === "completed" && !outcomeType` for "needs next steps"
- **Progress API** (`/api/progress/activities`): Uses `createdAt` (not `startDate`) with period-based ranges (month/quarter/fiscal_year)

---

## 6. Testing Patterns

### Framework

- **Vitest** with jsdom environment (`vitest.config.ts`)
- **@vitejs/plugin-react** for JSX transform
- **@testing-library/jest-dom** for DOM matchers (`src/test/setup.ts`)
- Path alias `@` -> `./src`
- Tests live in `__tests__/` directories adjacent to the code they test

### API route test pattern (see `src/app/api/tasks/__tests__/route.test.ts`)

1. **Mock `getUser`** via `vi.mock("@/lib/supabase/server")`
2. **Mock Prisma** via `vi.mock("@/lib/prisma")` with individual method mocks (count, findMany, create, etc.)
3. **Helper**: `makeRequest(url, options)` creates a `NextRequest` for testing route handlers
4. **Helper**: `makeTaskRow(overrides)` creates a mock Prisma task row with default values
5. **Test structure**: `describe("METHOD /api/path")` -> individual `it()` cases for auth, validation, success, error
6. **Assertions**: Check HTTP status, response JSON, and verify Prisma was called with expected args (`expect.objectContaining`)

### Existing test files (relevant subset)

| Path | Covers |
|------|--------|
| `src/app/api/tasks/__tests__/route.test.ts` | Tasks CRUD + reorder |
| `src/app/api/activities/__tests__/route.test.ts` | Activities CRUD |
| `src/app/api/territory-plans/__tests__/route.test.ts` | Plans CRUD |
| `src/app/api/districts/similar/__tests__/route.test.ts` | Similar districts |
| `src/app/api/districts/summary/__tests__/route.test.ts` | District summary |

### Running tests

```bash
npx vitest run                    # all tests
npx vitest run src/app/api/tasks  # task tests only
```

---

## 7. Pagination Opportunity Summary

### Current state

| Data source | Server pagination | Client filtering | Items fetched |
|---|---|---|---|
| Tasks (GET /api/tasks) | None | Overdue filter in FeedTab | All user tasks |
| Activities (GET /api/activities) | limit/offset (default 100) | "Needs next steps" filter in FeedTab | Up to 100 |
| Calendar events | Status filter (server) | None | All pending |

### Recommended changes for Feed pagination

1. **Tasks API**: Add `limit`/`offset` params (matching the activities pattern). Consider adding a server-side `overdue=true` filter so the Feed can request only overdue tasks directly.

2. **Activities API**: Add a server-side filter for "needs next steps" (i.e., `status=completed&outcomeType=null`) so the Feed doesn't need to fetch all activities and filter client-side.

3. **FeedTab**: Replace the three unbounded `useTasks({})` / `useActivities({})` calls with targeted queries that include server-side filters and pagination params. Consider `useInfiniteQuery` from TanStack Query for "load more" UX.

4. **Response shape consistency**: Tasks returns `{ tasks, totalCount }`, activities returns `{ activities, total, totalInDb }`. Standardize if adding pagination to tasks.
