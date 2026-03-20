# Plan Detail Panel — Backend Context

> Discovery date: 2026-03-20
> Scope: Data models, API routes, auth patterns, query conventions, and reuse analysis for the Plan Detail Panel feature.

---

## 1. Data Model Summary

### 1.1 TerritoryPlan (primary model)

**Table:** `territory_plans` | **PK:** `id` (UUID)

| Field | Type | Notes |
|---|---|---|
| `name` | varchar(255) | Required |
| `description` | text | Optional |
| `ownerId` | uuid | FK to `user_profiles.id` via `ownerUser` relation |
| `color` | varchar(7) | Hex color, defaults `#403770` |
| `status` | varchar(20) | `planning`, `working`, `stale`, `archived` |
| `fiscalYear` | int | Required; 2024-2030 |
| `startDate` / `endDate` | timestamp | Optional |
| `userId` | uuid | Creator user (distinct from owner) |
| **Denormalized rollups** | | |
| `districtCount` | int | Auto-synced via `syncPlanRollups()` |
| `stateCount` | int | Auto-synced |
| `renewalRollup` | decimal(15,2) | SUM of district renewal targets |
| `expansionRollup` | decimal(15,2) | SUM of district expansion targets |
| `winbackRollup` | decimal(15,2) | SUM of district winback targets |
| `newBusinessRollup` | decimal(15,2) | SUM of district new business targets |

**Relations:**
- `districts` -> `TerritoryPlanDistrict[]` (plan membership + targets)
- `states` -> `TerritoryPlanState[]` (which states the plan covers)
- `collaborators` -> `TerritoryPlanCollaborator[]` (team members)
- `activityLinks` -> `ActivityPlan[]` (many-to-many with Activity)
- `taskLinks` -> `TaskPlan[]` (many-to-many with Task)
- `ownerUser` -> `UserProfile` (plan owner)

**Indexes:** `[userId]`, `[userId, fiscalYear]`, `[ownerId]`

### 1.2 TerritoryPlanDistrict (plan membership + per-district targets)

**Table:** `territory_plan_districts` | **PK:** `(planId, districtLeaid)` (composite)

| Field | Type | Notes |
|---|---|---|
| `planId` | uuid | FK to territory_plans |
| `districtLeaid` | varchar(7) | FK to districts |
| `addedAt` | timestamp | When district was added |
| `renewalTarget` | decimal(15,2) | Per-district dollar target |
| `winbackTarget` | decimal(15,2) | Per-district dollar target |
| `expansionTarget` | decimal(15,2) | Per-district dollar target |
| `newBusinessTarget` | decimal(15,2) | Per-district dollar target |
| `notes` | text | Per-district notes within this plan |

**Relations:**
- `district` -> `District`
- `plan` -> `TerritoryPlan` (onDelete: Cascade)
- `targetServices` -> `TerritoryPlanDistrictService[]`

**Key insight:** Targets are stored **per district per plan** with four category columns (renewal, expansion, winback, newBusiness). There is no separate target model -- they are columns on the junction table.

### 1.3 TerritoryPlanDistrictService (service targeting)

**Table:** `territory_plan_district_services` | **PK:** `(planId, districtLeaid, serviceId, category)` (composite)

| Field | Type | Notes |
|---|---|---|
| `category` | enum | `return_services` or `new_services` |
| `serviceId` | int | FK to services catalog |

Links a plan-district to specific Fullmind service offerings, tagged as either "return" or "new" services.

### 1.4 TerritoryPlanState

**Table:** `territory_plan_states` | **PK:** `(planId, stateFips)`

Simple junction table associating plans with their geographic state scope.

### 1.5 TerritoryPlanCollaborator

**Table:** `territory_plan_collaborators` | **PK:** `(planId, userId)`

Team members who collaborate on a plan. Linked to `UserProfile`.

### 1.6 District (core entity)

**Table:** `districts` | **PK:** `leaid` (varchar(7), NCES district ID)

Massive consolidated model (~290 columns) containing:
- **Core info:** name, state, enrollment, grades, location, urbanicity
- **CRM data:** salesExecutive, isCustomer, hasOpenPipeline, FY25/FY26 revenue/bookings/pipeline fields
- **Finance:** total/federal/state/local revenue, expenditure per pupil
- **Demographics:** enrollment by race, poverty data
- **Staffing:** FTE counts, salary data, student-teacher ratios
- **Academic:** graduation rates, math/read proficiency, chronic absenteeism
- **Trends:** 3-year trends, state/national comparison deltas, within-state quartile flags
- **ICP scoring:** composite, fit, value, readiness, state scores + tier
- **User edits:** notes, owner
- **PostGIS geometry:** polygon boundary, centroid, point location

### 1.7 Activity (many-to-many with plans/districts/contacts)

**Table:** `activities` | **PK:** `id` (UUID)

| Key Fields | Notes |
|---|---|
| `type` | varchar(30) — conference, road_trip, email_campaign, etc. |
| `title`, `notes` | Event info |
| `startDate`, `endDate` | Scheduling |
| `status` | planned, completed, cancelled |
| `outcome`, `outcomeType` | Completion tracking |
| `metadata` | JSON blob for type-specific fields |
| `createdByUserId` | User-scoped |

**Junction tables:**
- `ActivityPlan` (activity_plans) — links activities to plans
- `ActivityDistrict` (activity_districts) — links activities to districts (has `visitDate`, `warningDismissed`)
- `ActivityContact` (activity_contacts) — links activities to contacts
- `ActivityState` (activity_states) — derived + explicit state links

### 1.8 Task (many-to-many with plans/districts/activities/contacts)

**Table:** `tasks` | **PK:** `id` (UUID)

Kanban-style task tracking. Junction tables: `TaskPlan`, `TaskDistrict`, `TaskActivity`, `TaskContact`.

### 1.9 Contact

**Table:** `contacts` | **PK:** `id` (autoincrement int)

Belongs to a district via `leaid`. Has name, title, email, phone, isPrimary, persona, seniorityLevel, linkedinUrl.

### 1.10 Opportunity (synced from OpenSearch)

**Table:** `opportunities` | **PK:** `id` (text, external ID)

Contains per-opportunity financials: net booking amount, total/completed/scheduled revenue and take, stage, school year, service types (JSON), sales rep info.

**Materialized view:** `district_opportunity_actuals` aggregates opportunities by district + school year for fast lookups. Columns: `district_lea_id`, `school_yr`, `sales_rep_email`, `total_revenue`, `completed_revenue`, `scheduled_revenue`, `total_take`, `completed_take`, `scheduled_take`, `weighted_pipeline`, `open_pipeline`, `bookings`, `invoiced`, `credited`, `opp_count`.

### 1.11 Vacancy

**Table:** `vacancies` | **PK:** `id` (cuid)

Job postings scraped from district job boards. Has category (SPED, ELL, etc.), fullmindRelevant flag, relevanceReason, source URL, hiring manager, linked school and contact.

### 1.12 Service

**Table:** `services` | **PK:** `id` (autoincrement int)

Catalog of Fullmind service offerings: name, slug, color, sortOrder.

---

## 2. Existing API Routes

### 2.1 Territory Plan CRUD

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/territory-plans` | List all plans with district counts, enrollment, pipeline totals, task counts, rollup targets, states, collaborators, owner. All plans visible to team. |
| `POST` | `/api/territory-plans` | Create plan. Accepts name, description, ownerId, color, status, fiscalYear, startDate, endDate, stateFips[], collaboratorIds[]. |
| `GET` | `/api/territory-plans/[id]` | Full plan detail with all districts, per-district targets, services, tags, and batch-fetched actuals from `district_opportunity_actuals` view. |
| `PUT` | `/api/territory-plans/[id]` | Update plan metadata. Uses transaction to replace states/collaborators atomically. |
| `DELETE` | `/api/territory-plans/[id]` | Delete plan (user-scoped to creator via `userId`). Cascades to districts. |

### 2.2 Plan District Management

| Method | Route | What it does |
|---|---|---|
| `POST` | `/api/territory-plans/[id]/districts` | Add district(s) to plan. Supports explicit `leaids[]` OR server-side `filters[]`. Handles single-district with targets/services or batch createMany. Calls `syncClassificationTagsForDistrict()` and `syncPlanRollups()`. |
| `GET` | `/api/territory-plans/[id]/districts/[leaid]` | Get single district-in-plan detail: targets, services, actuals (current + prior FY), and individual opportunities list. |
| `PUT` | `/api/territory-plans/[id]/districts/[leaid]` | Update per-district targets, notes, and service assignments. Deletes/recreates services atomically. Calls `syncPlanRollups()`. |
| `DELETE` | `/api/territory-plans/[id]/districts/[leaid]` | Remove district from plan. Calls `syncClassificationTagsForDistrict()` and `syncPlanRollups()`. |

### 2.3 Plan Contacts & Vacancies

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/territory-plans/[id]/contacts` | All contacts across all districts in the plan. |
| `GET` | `/api/territory-plans/[id]/vacancies` | All open vacancies across plan districts. Returns vacancies + summary (by category, by district, fullmind-relevant count). |

### 2.4 District Detail

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/districts/[leaid]` | Full district detail: core info, CRM data, edits, tags, contacts, territory plan IDs, education data, demographics, trends. Uses single Prisma query + PostGIS centroid query. |
| `PUT` | `/api/districts/[leaid]/edits` | Update district notes and owner. |
| `GET` | `/api/districts/[leaid]/vacancies` | Vacancies for a single district. |
| `GET` | `/api/districts/[leaid]/competitor-spend` | Competitor spend data. |
| `GET` | `/api/districts/[leaid]/tags` | District tags. |
| `GET` | `/api/districts/summary` | Aggregated district stats by Fullmind category, with vendor breakdowns. Uses raw SQL via `pg` pool. |

### 2.5 Activities

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/activities` | List with filters: category, planId, districtLeaid, stateAbbrev, status, date range, unscheduled, search. User-scoped. Computes `needsPlanAssociation` and `hasUnlinkedDistricts` flags. |
| `POST` | `/api/activities` | Create with relations: plans, districts (with visit dates), contacts, states, expenses, attendees, related activities. |
| `GET/PATCH/DELETE` | `/api/activities/[id]` | Single activity CRUD. |
| `POST/DELETE` | `/api/activities/[id]/plans/[planId]` | Link/unlink plan. |
| `POST/DELETE` | `/api/activities/[id]/districts/[leaid]` | Link/unlink district. |

### 2.6 Tasks

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/tasks` | List with filters: status, priority, planId, activityId, leaid, contactId, search, due dates. |
| `POST` | `/api/tasks` | Create with plan/activity/district/contact links. |
| `GET/PATCH/DELETE` | `/api/tasks/[id]` | Single task CRUD. |
| Link endpoints | `/api/tasks/[id]/plans/`, `/api/tasks/[id]/districts/`, etc. | Link/unlink relations. |

### 2.7 Progress (plan engagement metrics)

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/progress/plans` | Per-plan stats: total districts, districts with activity, last activity date, activity count. Filters to user's "working" plans. |

---

## 3. Auth & Permission Patterns

### 3.1 Authentication
- **Supabase Auth** via `getUser()` from `@/lib/supabase/server`.
- `getUser()` returns the effective user (handles admin impersonation via `impersonate_uid` cookie).
- `getRealUser()` bypasses impersonation for admin checks.
- `getAdminUser()` verifies admin role via `UserProfile.role`.

### 3.2 Authorization Model
- **Team-shared visibility:** All authenticated users can see all plans. The `GET /territory-plans` endpoint uses `where: {}` (no user filter).
- **Creator-scoped deletion:** `DELETE /territory-plans/[id]` checks `userId: user?.id`.
- **User-scoped activities:** `GET /activities` filters by `createdByUserId: user.id`.
- **No per-plan permission checks:** Any authenticated user can update any plan's metadata, districts, or targets. This is a deliberate team-sharing design decision.

### 3.3 Standard Auth Pattern in Routes
```typescript
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}
```

---

## 4. Query Patterns & Conventions

### 4.1 Prisma Client
- **Singleton:** `@/lib/prisma` exports a global singleton with dev logging.
- **Raw pg Pool:** `@/lib/db` exports a `pg.Pool` singleton for raw SQL (used by summary/aggregate endpoints where Prisma is insufficient).
- **Raw queries via Prisma:** `prisma.$queryRaw` used for PostGIS, materialized views, and complex aggregations.

### 4.2 Response Formatting
- Dates: Always `.toISOString()`.
- Decimals: Always `Number(value)` (Prisma returns `Decimal` objects).
- Null handling: `toNumber()` helper converts `Decimal | null` to `number | null`.
- No shared response serializer -- each endpoint manually maps fields.

### 4.3 Actuals / Opportunity Data
- `getDistrictActuals(leaid, schoolYr)` — aggregate from `district_opportunity_actuals` materialized view.
- `getDistrictOpportunities(leaid, schoolYr)` — individual opportunities from `opportunities` table.
- `getPlanDistrictActuals(leaids[], schoolYr)` — batch aggregate for plan rollups.
- `fiscalYearToSchoolYear(fy)` — converts e.g. `2026` to `"2025-26"`.
- `safeQueryRaw()` — catches PostgreSQL 42P01 (undefined_table) errors for missing views.

### 4.4 Rollup Sync Pattern
- `syncPlanRollups(planId)` in `@/features/plans/lib/rollup-sync.ts`.
- Called after every district add/remove/target-update.
- Aggregates district count, state count, and four target sums; writes to `TerritoryPlan`.

### 4.5 Auto-Tag Sync Pattern
- `syncClassificationTagsForDistrict(leaid)` in `@/features/shared/lib/auto-tags.ts`.
- Called after adding/removing districts from plans.
- Computes tags based on Fullmind + EK12 revenue data.

### 4.6 Filter System
- `@/features/explore/lib/filters.ts` exports `FilterDef`, `FilterOp`, `buildWhereClause()`, and `DISTRICT_FIELD_MAP`.
- Used by `POST /territory-plans/[id]/districts` to resolve districts from filters server-side.
- Allow-list pattern: external column keys mapped to Prisma field names.

---

## 5. TanStack Query Conventions

### 5.1 Query Keys
| Query Key | Used For |
|---|---|
| `["territoryPlans"]` | Plan list |
| `["territoryPlan", planId]` | Single plan detail |
| `["planDistrict", planId, leaid]` | Single district-in-plan detail |
| `["planContacts", planId]` | Plan contacts |
| `["district", leaid]` | District detail modal |
| `["districts", params]` | District list |
| `["activities", params]` | Activity list |
| `["activity", activityId]` | Single activity |
| `["tasks", params]` | Task list |
| `["task", taskId]` | Single task |
| `["services"]` | Service catalog |
| `["goalDashboard"]` | Goals dashboard |
| `["explore"]` | Explore table data |

### 5.2 Stale Times
- Plans: 2 minutes
- District detail: 10 minutes
- District list: 5 minutes
- Activities/Tasks: 2 minutes

### 5.3 Mutation → Invalidation Pattern
Standard pattern: mutations call `queryClient.invalidateQueries()` for affected keys in `onSuccess`.

### 5.4 Optimistic Updates
`useUpdateDistrictTargets()` is the exemplar:
1. `onMutate`: cancels outgoing queries, snapshots old data, patches cache with new values.
2. `onError`: rolls back to snapshot.
3. `onSettled`: invalidates the single district detail (lightweight background refresh). Also invalidates `goalDashboard`.

Key detail: The optimistic update resolves service IDs to service objects using the cached `["services"]` query data.

### 5.5 API Client
- `fetchJson<T>(url, options?)` from `@/features/shared/lib/api-client.ts`.
- Adds `Content-Type: application/json`.
- Throws on non-OK responses with error detail extraction.
- Detects HTML responses (session expiry redirects).
- `API_BASE = "/api"`.

---

## 6. TypeScript Types (Client-Side)

All in `@/features/shared/types/api-types.ts`:

| Type | Description |
|---|---|
| `TerritoryPlan` | Plan list item shape |
| `TerritoryPlanDetail` | Extends TerritoryPlan with `districts: TerritoryPlanDistrict[]` |
| `TerritoryPlanDistrict` | District-in-plan with targets, services, tags, actuals |
| `PlanDistrictDetail` | Full district-in-plan detail (targets, actuals, opportunities) |
| `PlanDistrictActuals` | Revenue/take/pipeline actuals for a district |
| `PlanDistrictOpportunity` | Individual opportunity record |
| `DistrictDetail` | Full district detail (district, fullmindData, edits, tags, contacts, educationData, demographics, trends) |
| `Contact` | Contact record |
| `Service` | Service catalog item |
| `Tag` | Tag record |

---

## 7. What Existing Endpoints Can Be Reused

The Plan Detail Panel will need to display plan-level summaries and per-district details. Many endpoints already exist:

| Need | Existing Endpoint | Reusable? |
|---|---|---|
| Plan metadata + all districts | `GET /api/territory-plans/[id]` | **Yes** — already returns full plan with all districts, targets, services, tags, and batch actuals |
| Per-district detail (targets + actuals + opps) | `GET /api/territory-plans/[id]/districts/[leaid]` | **Yes** — returns targets, services, actuals (current + prior FY + YoY), and individual opportunities |
| Update district targets/services | `PUT /api/territory-plans/[id]/districts/[leaid]` | **Yes** — already supports partial updates with optimistic caching |
| Plan contacts | `GET /api/territory-plans/[id]/contacts` | **Yes** |
| Plan vacancies | `GET /api/territory-plans/[id]/vacancies` | **Yes** |
| Activities for a plan | `GET /api/activities?planId=X` | **Yes** — already supports planId filter |
| Tasks for a plan | `GET /api/tasks?planId=X` | **Yes** — already supports planId filter |
| Update plan metadata | `PUT /api/territory-plans/[id]` | **Yes** — name, description, status, owner, dates, states, collaborators |
| Add districts to plan | `POST /api/territory-plans/[id]/districts` | **Yes** — supports filters or explicit leaids |
| Remove district from plan | `DELETE /api/territory-plans/[id]/districts/[leaid]` | **Yes** |
| District detail (for "view district" link) | `GET /api/districts/[leaid]` | **Yes** |
| Plan engagement metrics | `GET /api/progress/plans` | **Partial** — user-scoped to "working" plans; may need plan-specific variant |

### TanStack Query Hooks Already Available
| Hook | Location |
|---|---|
| `useTerritoryPlan(planId)` | `@/features/plans/lib/queries.ts` |
| `usePlanDistrictDetail(planId, leaid)` | `@/features/plans/lib/queries.ts` |
| `useUpdateDistrictTargets()` | `@/features/plans/lib/queries.ts` (with optimistic updates) |
| `usePlanContacts(planId)` | `@/features/plans/lib/queries.ts` |
| `useUpdateTerritoryPlan()` | `@/features/plans/lib/queries.ts` |
| `useAddDistrictsToPlan()` | `@/features/plans/lib/queries.ts` |
| `useRemoveDistrictFromPlan()` | `@/features/plans/lib/queries.ts` |
| `useActivities({ planId })` | `@/features/activities/lib/queries.ts` |
| `useTasks({ planId })` | `@/features/tasks/lib/queries.ts` |
| `useDistrictDetail(leaid)` | `@/features/districts/lib/queries.ts` |

---

## 8. What New Endpoints Might Be Needed

Based on common Plan Detail Panel requirements, these gaps exist:

### 8.1 Plan-Level Aggregated Actuals
**Current gap:** The plan list endpoint returns `revenueActual: 0, takeActual: 0, priorFyRevenue: 0` (deferred). The plan detail endpoint batch-fetches per-district actuals but does not return a plan-level total.

**Potential endpoint:** `GET /api/territory-plans/[id]/actuals` OR extend the plan detail response to include plan-level sums. The utility `getPlanDistrictActuals(leaids[], schoolYr)` in `@/lib/opportunity-actuals.ts` already exists and can compute this.

### 8.2 Plan Activity Timeline / Summary
**Current gap:** `GET /api/activities?planId=X` returns a flat list. For a detail panel "activity timeline" view, a more compact summary (recent activities, next upcoming, counts by status) would reduce payload.

**Option:** Could be computed client-side from existing data, or add a lightweight `GET /api/territory-plans/[id]/activity-summary` endpoint.

### 8.3 Plan Task Summary
**Current gap:** Task counts are returned in the plan list endpoint (via `taskLinks`), but not in the plan detail endpoint. No plan-specific task summary exists.

**Option:** The plan list already computes `taskCount` and `completedTaskCount`. Could add these to the detail response or use `useTasks({ planId })`.

### 8.4 Plan-Level District Performance Breakdown
**Current gap:** No endpoint returns an aggregated "how are the plan's districts performing" summary (e.g., revenue by category, target vs actual comparison across all districts).

**Option:** Could be computed client-side from the district data in `useTerritoryPlan()`, or add a dedicated summary endpoint.

---

## 9. Key Architectural Notes

1. **Two DB clients coexist:** Prisma for ORM queries, raw `pg.Pool` for complex SQL (summaries, materialized views). Both use singletons.

2. **Denormalized rollups pattern:** Plan-level totals are stored on `TerritoryPlan` and synced via `syncPlanRollups()` after every mutation. This avoids expensive aggregation on list views.

3. **Materialized view for actuals:** `district_opportunity_actuals` pre-aggregates opportunity data by district + school year. Queried via `prisma.$queryRaw`. Falls back gracefully if the view doesn't exist (`safeQueryRaw`).

4. **No REST consistency layer:** Each route manually constructs its response object. There is no shared serializer or response builder.

5. **Activities are user-scoped; plans are team-shared.** Activities belong to `createdByUserId`; plans are visible to all authenticated users.

6. **Fiscal year drives data bucketing:** The plan's `fiscalYear` determines which school year's actuals/pipeline to fetch (via `fiscalYearToSchoolYear()`).

7. **Cascade deletes:** Deleting a plan cascades to `TerritoryPlanDistrict`, `TerritoryPlanState`, `TerritoryPlanCollaborator`, `ActivityPlan`, and `TaskPlan`.

8. **Service assignments use delete-and-recreate:** When updating services for a plan-district, all existing services are deleted and the new set is created. This is a deliberate simplification.
