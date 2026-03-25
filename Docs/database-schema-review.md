# Database Schema Review & Documentation

**Date:** 2026-03-18
**Schema:** Prisma + PostgreSQL (Supabase) with PostGIS
**Models:** 34 Prisma models, 3 materialized views, 1 enum

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Entity Relationship Map](#entity-relationship-map)
3. [Model Inventory](#model-inventory)
4. [Materialized Views](#materialized-views)
5. [Data Access Patterns](#data-access-patterns)
6. [Row-Level Security (RLS) Review](#row-level-security-review)
7. [Issues & Improvements](#issues--improvements)

---

## Architecture Overview

| Component | Technology |
|-----------|-----------|
| Database | PostgreSQL (Supabase-hosted) |
| ORM | Prisma Client (TypeScript) |
| Raw SQL | `pg` Pool (for PostGIS queries, materialized view refreshes) |
| Spatial | PostGIS (`geometry(MultiPolygon, 4326)`, `geometry(Point, 4326)`) |
| Auth | Supabase Auth (RLS via `auth.uid()`) |
| Sync | OpenSearch (opportunities/sessions), Google Calendar (activities) |
| ETL | Python scripts + Urban Institute API + CSV imports |

**Dual client pattern:** The app uses both Prisma (for typed CRUD) and a raw `pg` Pool (for PostGIS queries and materialized view refreshes). Connection pooling is configured for serverless (Vercel) with `max: 2` in production.

---

## Entity Relationship Map

```
                          ┌──────────────┐
                          │    State     │
                          │  (fips PK)   │
                          └──────┬───────┘
                    1:N          │          1:N
           ┌─────────────────────┼──────────────────────┐
           ▼                     ▼                      ▼
   ┌───────────────┐   ┌─────────────────┐    ┌────────────────┐
   │   District    │   │ StateAssessment │    │ ActivityState  │
   │ (leaid PK)   │   └─────────────────┘    └────────────────┘
   │ ~150 columns  │
   └───────┬───────┘
           │ 1:N relationships
     ┌─────┼─────┬──────┬───────┬────────┬──────────┬──────────┐
     ▼     ▼     ▼      ▼       ▼        ▼          ▼          ▼
  Contact School  Tag  Vacancy  Vendor   Competitor DataHistory GradeEnroll
     │            (M:M)  │     Financials  Spend
     │                   │
     ▼                   ▼
  SchoolContact     VacancyScan

   ┌──────────────────┐        ┌──────────────┐
   │  TerritoryPlan   │◄───────│  UserProfile  │
   │  (uuid PK)       │ owner  │  (uuid PK)    │
   └────────┬─────────┘        └───────┬───────┘
            │ M:N                      │ 1:N
    ┌───────┼────────┐          ┌──────┼──────┐
    ▼       ▼        ▼          ▼      ▼      ▼
  PlanDist PlanState Collab   Goals  CalConn MapView
    │                                  │
    ▼                                  ▼
  PlanDistService                CalendarEvent

   ┌──────────────┐
   │   Activity   │   M:N junction tables:
   │  (uuid PK)   │──► ActivityPlan, ActivityDistrict,
   └──────┬───────┘    ActivityContact, ActivityState,
          │            ActivityAttendee, ActivityRelation
    ┌─────┼─────┐
    ▼     ▼     ▼
  Expense Task  Relation

   ┌──────────────┐
   │     Task     │   M:N junction tables:
   │  (uuid PK)   │──► TaskDistrict, TaskPlan,
   └──────────────┘    TaskActivity, TaskContact

   ┌──────────────────┐   ┌──────────────┐
   │   Opportunity     │   │   Session    │
   │ (text id PK)      │   │ (text id PK) │
   │ synced from       │   │ linked by    │
   │ OpenSearch        │   │ opp_id (no FK)│
   └──────────────────┘   └──────────────┘

   Standalone tables:
   - UnmatchedAccount, UnmatchedOpportunity, DataRefreshLog, VacancyKeywordConfig
```

---

## Model Inventory

### Core Domain Models

| Model | PK | Rows (est.) | Purpose |
|-------|-----|-------------|---------|
| **District** | `leaid` (VarChar 7) | ~13,000 | Central entity — US school districts with 150+ columns spanning CRM, finance, demographics, education metrics, trends, ICP scores |
| **State** | `fips` (VarChar 2) | 51 | State reference with denormalized district aggregates |
| **School** | `ncessch` (VarChar 12) | ~100,000+ | Schools within districts — charter/public with Title I, FRPL, demographics |
| **Contact** | `id` (autoincrement) | Variable | District contacts with persona, seniority, LinkedIn |
| **Opportunity** | `id` (Text) | Variable | Synced from OpenSearch — sales opportunities with financial metrics |
| **Session** | `id` (Text) | Variable | Individual session records linked to opportunities |

### Territory Planning

| Model | PK | Purpose |
|-------|-----|---------|
| **TerritoryPlan** | `uuid` | Sales territory plans with fiscal year, owner, rollup columns |
| **TerritoryPlanDistrict** | `(planId, districtLeaid)` | Plan-district assignments with per-district revenue targets |
| **TerritoryPlanState** | `(planId, stateFips)` | Plan-state associations |
| **TerritoryPlanCollaborator** | `(planId, userId)` | Shared plan access |
| **TerritoryPlanDistrictService** | `(planId, districtLeaid, serviceId, category)` | Target services per plan-district |
| **Service** | `id` (autoincrement) | Service catalog (return vs. new) |

### Activity System

| Model | PK | Purpose |
|-------|-----|---------|
| **Activity** | `uuid` | Flexible activities (conferences, road trips, emails, etc.) with calendar sync |
| **ActivityPlan** | `(activityId, planId)` | M:N activity-plan links |
| **ActivityDistrict** | `(activityId, districtLeaid)` | M:N with visit dates and warning flags |
| **ActivityContact** | `(activityId, contactId)` | M:N activity-contact links |
| **ActivityState** | `(activityId, stateFips)` | M:N with explicit/implicit flag |
| **ActivityExpense** | `uuid` | Line-item expenses per activity |
| **ActivityAttendee** | `(activityId, userId)` | Internal team attendees |
| **ActivityRelation** | `uuid` | Directed graph of related activities |

### Task System

| Model | PK | Purpose |
|-------|-----|---------|
| **Task** | `uuid` | Kanban tasks with priority, status, due date, position |
| **TaskDistrict/TaskPlan/TaskActivity/TaskContact** | Composite | M:N junction tables |

### User & Auth

| Model | PK | Purpose |
|-------|-----|---------|
| **UserProfile** | `uuid` (Supabase auth.users.id) | User preferences, role, location, setup wizard state |
| **UserGoal** | `id` (autoincrement) | Fiscal year revenue/pipeline targets per user |
| **CalendarConnection** | `uuid` | Google Calendar OAuth tokens (access + refresh) |
| **CalendarEvent** | `uuid` | Staged calendar events pending rep confirmation |
| **MapView** | `uuid` | Saved map state snapshots |

### Analytics & Competitive Intel

| Model | PK | Purpose |
|-------|-----|---------|
| **CompetitorSpend** | `id` (autoincrement) | GovSpend PO data by district/competitor/FY |
| **VendorFinancials** | `id` (autoincrement) | Normalized financial metrics across all vendors |
| **DistrictDataHistory** | `id` (autoincrement) | Time-series for trend analysis |
| **DistrictGradeEnrollment** | `id` (autoincrement) | Grade-level enrollment by year |
| **SchoolEnrollmentHistory** | `id` (autoincrement) | School enrollment by year |
| **StateAssessment** | `id` (autoincrement) | State standardized test reference data |

### Vacancy Scanner

| Model | PK | Purpose |
|-------|-----|---------|
| **VacancyScan** | `cuid` | Job board scan audit log |
| **Vacancy** | `cuid` | Individual job postings with relevance scoring |
| **VacancyKeywordConfig** | `id` (autoincrement) | Admin-configurable relevance/exclusion keywords |

### Unmatched / Staging

| Model | PK | Purpose |
|-------|-----|---------|
| **UnmatchedAccount** | `id` (autoincrement) | CRM accounts that couldn't match to a district |
| **UnmatchedOpportunity** | `id` (Text) | Opportunities without district match |
| **DataRefreshLog** | `id` (autoincrement) | ETL run audit trail |

---

## Materialized Views

| View | Refresh Trigger | Purpose |
|------|----------------|---------|
| **district_opportunity_actuals** | After scheduler sync (~hourly) | Aggregates opportunities by district/FY/rep/category with weighted pipeline |
| **district_map_features** | After ETL or data changes | Pre-computed vendor categories, signals, and geometries for vector tiles |
| **district_vendor_comparison** | After ETL | Dominant vendor per district for map overlays |

All views support `REFRESH CONCURRENTLY` via unique indexes.

---

## Data Access Patterns

| Pattern | Client | Used For |
|---------|--------|----------|
| Typed CRUD | Prisma | Activities, tasks, plans, contacts, user profiles |
| PostGIS queries | `pg` Pool | Map tile generation, spatial queries, geometry operations |
| Materialized view refresh | `pg` Pool | Scheduled after ETL/sync runs |
| Supabase Auth | Supabase Client | Login, session management, RLS enforcement |

---

## Row-Level Security Review

### Current State

RLS is defined in `supabase/rls-policies.sql` but has several issues:

1. **Stale table references** — policies reference `district_edits`, `district_education_data`, `district_enrollment_demographics` which no longer exist in the Prisma schema (likely consolidated into the District model)
2. **Duplicate policy definitions** — `opportunities` and `unmatched_opportunities` have RLS enabled and policies defined twice in the same file
3. **Missing RLS on newer tables** — The following tables have no RLS policies:
   - `activities`, `activity_*` junction tables
   - `tasks`, `task_*` junction tables
   - `user_profiles`, `user_goals`
   - `calendar_connections`, `calendar_events`
   - `schools`, `school_*` junction tables
   - `map_views`
   - `services`, `territory_plan_district_services`
   - `vacancy_scans`, `vacancies`, `vacancy_keyword_config`
   - `vendor_financials`, `competitor_spend`
   - `district_data_history`, `district_grade_enrollment`
   - `state_assessments`, `states`
4. **No collaborator-aware policies** — Territory plan RLS only checks `user_id`, but the schema supports collaborators. Collaborators likely can't see plans they're invited to via RLS.
5. **No role-based differentiation** — The `UserRole` enum (admin/manager/rep) exists but RLS doesn't use it. Admins and managers have no elevated privileges at the database level.

---

## Issues & Improvements

### CRITICAL — Security

| # | Issue | Impact | Recommendation |
|---|-------|--------|---------------|
| S1 | **OAuth tokens stored as plain text** | `CalendarConnection.accessToken` and `refreshToken` are stored as `String` with a comment "encrypted at rest" — but there's no evidence of application-level encryption. Supabase TDE may cover disk-level but not query-level exposure. | Encrypt tokens at the application layer before storage. Use a KMS-backed encryption function. Add a `tokenEncryptionVersion` column for key rotation. |
| S2 | **RLS gaps on sensitive tables** | `calendar_connections` (OAuth tokens), `user_profiles`, `user_goals` have no RLS. Any authenticated user with Supabase client access could read all users' tokens. | Add RLS policies for all user-scoped tables. At minimum: `calendar_connections`, `user_profiles`, `user_goals`, `map_views`. |
| S3 | **RLS references deleted tables** | Policies for `district_edits`, `district_education_data`, `district_enrollment_demographics` will fail on apply. | Clean up `rls-policies.sql` to match current schema. |

### HIGH — Data Integrity

| # | Issue | Impact | Recommendation |
|---|-------|--------|---------------|
| D1 | **No FK between Session and Opportunity** | `Session.opportunityId` is a `Text` field with no foreign key. Orphaned sessions will accumulate if opportunities are deleted. | Add a FK constraint, or add a periodic cleanup job. The current "no FK" design is intentional for sync flexibility, but consider at least a loose index + validation. |
| D2 | **Fiscal year as string vs int inconsistency** | `TerritoryPlan.fiscalYear` is `Int` (2026), but `CompetitorSpend.fiscalYear` and `VendorFinancials.fiscalYear` are `VarChar(4)` ("FY26"). The materialized views hard-code string FY comparisons. | Standardize on one format. Since materialized views already use string format extensively, consider an enum or consistent `VarChar(4)` everywhere. Alternatively, add computed columns. |
| D3 | **District model is a mega-table (~150 columns)** | All education, finance, CRM, demographic, trend, quartile, and ICP data lives in one row. Column additions require migrations touching the busiest table. | This is a conscious denormalization trade-off for query simplicity. However, consider extracting the following into satellite tables for cleaner ETL boundaries: (a) `district_financials` — finance, staffing, ESSER fields, (b) `district_benchmarks` — vs_state, vs_national, quartile columns, (c) `district_trends` — 3yr trend columns. Each would be 1:1 with districts and JOINed only when needed. |
| D4 | **No CHECK constraints on status/enum-like string fields** | Fields like `Activity.status`, `Task.status`, `Task.priority`, `CalendarEvent.status`, `Vacancy.status` use `VarChar` with comments listing valid values but no DB-level enforcement. | Add CHECK constraints or migrate to Prisma enums. Example: `@@check(status IN ('planned','completed','cancelled'))`. Prisma doesn't natively support CHECK, so add via raw SQL migration. |
| D5 | **`TerritoryPlan` has both `ownerId` and `userId`** | Both are `@db.Uuid` and seem to serve the same purpose. `ownerId` has a relation to `UserProfile`, `userId` does not. | Consolidate to a single column. If `userId` is legacy, migrate data to `ownerId` and drop `userId`. |

### MEDIUM — Performance

| # | Issue | Impact | Recommendation |
|---|-------|--------|---------------|
| P1 | **Missing indexes on junction table FK columns** | `ActivityContact` has no index on `contactId`. `TaskContact` has an index on `contactId` but `ActivityContact` doesn't. Pattern is inconsistent across junction tables. | Audit all junction tables and add missing indexes on FK columns used in JOINs. Specifically: `activity_contacts.contact_id`, `activity_attendees.user_id`. |
| P2 | **No index on `Activity.createdByUserId` + `type` combo** | Activity queries likely filter by user AND type simultaneously. | Add composite index `@@index([createdByUserId, type])`. |
| P3 | **`Opportunity.id` and `Session.id` are `@db.Text`** | Text PKs are slower to index and compare than UUID or VarChar. | If IDs have a known max length, switch to `VarChar(N)`. If they're truly unbounded, keep Text but be aware of index bloat. |
| P4 | **Materialized view `district_map_features` is very wide** | 40+ columns with complex CTE chains across 4 fiscal years x 5 vendors. Refresh time may be significant. | Monitor refresh duration. Consider splitting into per-FY or per-vendor views if refresh exceeds acceptable window. Add `CONCURRENTLY` to all refresh calls. |
| P5 | **No partial indexes on boolean flags** | `District.isCustomer` and `District.hasOpenPipeline` have a composite index but not partial indexes. Queries like `WHERE is_customer = true` scan the full index. | Add `@@index([leaid]) WHERE is_customer = true` via raw SQL for queries that only need customers. |

### LOW — Schema Hygiene

| # | Issue | Impact | Recommendation |
|---|-------|--------|---------------|
| H1 | **Inconsistent PK strategies** | Districts use `leaid` (natural key), plans/activities/tasks use `uuid`, tags/services use `autoincrement`, opportunities use `text`. | Document the rationale for each. Natural keys (`leaid`, `ncessch`, `fips`) are appropriate for externally-defined IDs. UUIDs are correct for app-generated entities. Autoincrement is fine for small reference tables. |
| H2 | **`UnmatchedOpportunity.resolved` is a Boolean** | No tracking of WHO resolved it or WHEN. | Add `resolvedAt DateTime?` and `resolvedByUserId String?`. |
| H3 | **No `updatedAt` on several models** | `CompetitorSpend`, `DistrictDataHistory`, `DistrictGradeEnrollment`, `SchoolEnrollmentHistory`, `UnmatchedAccount` only have `createdAt` or `lastUpdated` (not Prisma `@updatedAt`). | Add `@updatedAt` to models that can be modified after creation. |
| H4 | **`District.owner` is a free-text `VarChar(100)`** | Not a FK to `UserProfile`. Can't enforce who "owns" a district or query by owner reliably. | If ownership should be enforced, change to a FK reference to `UserProfile.id`. If it's a display name from CRM import, keep as-is but document. |
| H5 | **`Vacancy.scanId` type mismatch** | `VacancyScan.id` is `@default(cuid())` (String) but `Vacancy.scanId` is `@db.VarChar(30)`. CUIDs are 25 chars but this is fragile. | Either remove the `VarChar(30)` constraint or increase to `VarChar(50)` for safety. |
| H6 | **Hardcoded competitor names in materialized views** | `district_map_features` and `district_vendor_comparison` hardcode `'Proximity Learning', 'Elevate K12', 'Tutored By Teachers', 'Educere'`. Adding a new competitor requires editing SQL. | Consider a `competitor_config` reference table or a function parameter. |
| H7 | **No audit trail for district edits** | `District.notes`, `District.owner`, `District.notesUpdatedAt` track the latest state but not history. The old `district_edits` table in RLS suggests this was removed. | If edit history matters, add a `district_edit_history` table or use Supabase's audit log extension. |
| H8 | **`ActivityDistrict` has visit scheduling fields** | `visitDate` and `visitEndDate` on a junction table is unusual. This puts scheduling data on the M:N relationship rather than on the activity. | If visits always have one date per district, this is fine. If you need richer visit modeling (multi-day, time slots), consider a separate `Visit` model. |

### Data Experience Improvements

| # | Suggestion | Benefit |
|---|-----------|---------|
| E1 | **Add a `district_summary` materialized view** | Pre-compute the most-queried dashboard fields (enrollment, customer status, pipeline, ICP tier, top contact, vacancy count, last activity date) into a single flat view. Eliminates N+1 JOINs on list pages. |
| E2 | **Add full-text search index on District** | `CREATE INDEX idx_district_fts ON districts USING GIN(to_tsvector('english', name || ' ' || COALESCE(account_name, '') || ' ' || COALESCE(city_location, '')))` — enables fast typeahead search across name variants. |
| E3 | **Add `lastActivityAt` and `nextActivityAt` to District** | Denormalized timestamps showing when the district was last engaged and when the next planned activity is. Enables "cold account" detection without JOINing activities. |
| E4 | **Add `activityCount` rollup to TerritoryPlanDistrict** | Similar to the existing revenue rollups on TerritoryPlan, track activity engagement per plan-district for pipeline health dashboards. |
| E5 | **Create a `timeline` view** | UNION activities, tasks, opportunities, and vacancy scans into a single chronological feed per district. Enables a unified "district history" UI without client-side merging. |
| E6 | **Add `deletedAt` soft-delete to Activity and Task** | Enables undo, audit trails, and "recently deleted" recovery. Currently, deletes cascade through junction tables with no recovery path. |
| E7 | **Normalize fiscal year to a reference table** | A `fiscal_years` table (`id: 'FY26', startDate, endDate, isCurrent`) would centralize FY logic, support FY rollover, and eliminate hardcoded year references in views. |

---

## Summary

The schema is well-designed for its purpose — a territory planning CRM with rich education data. The denormalized District model is a deliberate trade-off that simplifies map rendering and list queries. The activity and task systems use clean M:N patterns with proper cascading deletes.

**Top 3 priorities:**
1. **Fix RLS gaps** (S2, S3) — sensitive tables are exposed
2. **Audit token storage** (S1) — OAuth tokens need application-level encryption verification
3. **Consolidate `ownerId`/`userId` on TerritoryPlan** (D5) — dual columns create confusion

The data experience suggestions (E1-E7) are additive and can be implemented incrementally as the product grows.
