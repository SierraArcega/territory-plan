# Territory Plan Builder - Data Model

This document explains the database schema and how data flows through the application.

## Overview

The application uses a PostgreSQL database with PostGIS extension for geospatial data. The core entity is **districts** - approximately 13,000 US school district records that contain all district-related data in a single consolidated table.

## Database Tables

### `districts` - The Core Table

The main table containing all district data. Each row represents one school district.

**Table size:** ~13,000 rows

**Key columns by data source:**

#### Core District Info
Source: NCES EDGE Shapefiles

| Column | Type | Description |
|--------|------|-------------|
| `leaid` | VARCHAR(7) | Primary key - LEA (Local Education Agency) ID |
| `name` | VARCHAR(255) | District name |
| `state_fips` | VARCHAR(2) | State FIPS code |
| `state_abbrev` | VARCHAR(2) | State abbreviation (e.g., "CA") |
| `enrollment` | INT | Total enrollment |
| `lograde` | VARCHAR(2) | Lowest grade served (e.g., "PK", "KG", "01") |
| `higrade` | VARCHAR(2) | Highest grade served |
| `phone` | VARCHAR(20) | District phone number |
| `street_location` | VARCHAR(255) | Street address |
| `city_location` | VARCHAR(100) | City |
| `state_location` | VARCHAR(2) | State |
| `zip_location` | VARCHAR(10) | ZIP code |
| `county_name` | VARCHAR(100) | County name |
| `urban_centric_locale` | INT | Locale code (11-43, see NCES locale codes) |
| `number_of_schools` | INT | Number of schools in district |
| `spec_ed_students` | INT | Special education student count |
| `ell_students` | INT | English Language Learner count |

#### Fullmind CRM Data
Source: Fullmind CSV import via ETL

| Column | Type | Description |
|--------|------|-------------|
| `account_name` | VARCHAR(255) | Account name in Fullmind CRM |
| `sales_executive` | VARCHAR(100) | Assigned sales rep |
| `lmsid` | VARCHAR(50) | LMS ID |
| `is_customer` | BOOLEAN | Has current/past revenue |
| `has_open_pipeline` | BOOLEAN | Has open pipeline opportunities |
| `fy25_sessions_revenue` | DECIMAL | FY25 sessions revenue |
| `fy25_sessions_take` | DECIMAL | FY25 sessions take |
| `fy25_sessions_count` | INT | FY25 session count |
| `fy26_sessions_revenue` | DECIMAL | FY26 sessions revenue |
| `fy26_sessions_take` | DECIMAL | FY26 sessions take |
| `fy26_sessions_count` | INT | FY26 session count |
| `fy25_closed_won_opp_count` | INT | FY25 closed won opportunities |
| `fy25_closed_won_net_booking` | DECIMAL | FY25 closed won net bookings |
| `fy25_net_invoicing` | DECIMAL | FY25 net invoicing |
| `fy26_closed_won_opp_count` | INT | FY26 closed won opportunities |
| `fy26_closed_won_net_booking` | DECIMAL | FY26 closed won net bookings |
| `fy26_net_invoicing` | DECIMAL | FY26 net invoicing |
| `fy26_open_pipeline_opp_count` | INT | FY26 open pipeline opportunity count |
| `fy26_open_pipeline` | DECIMAL | FY26 open pipeline value |
| `fy26_open_pipeline_weighted` | DECIMAL | FY26 weighted pipeline |
| `fy27_open_pipeline_opp_count` | INT | FY27 open pipeline opportunity count |
| `fy27_open_pipeline` | DECIMAL | FY27 open pipeline value |
| `fy27_open_pipeline_weighted` | DECIMAL | FY27 weighted pipeline |

#### Finance Data
Source: Urban Institute API (finance endpoint)

| Column | Type | Description |
|--------|------|-------------|
| `total_revenue` | DECIMAL | Total revenue |
| `federal_revenue` | DECIMAL | Federal revenue |
| `state_revenue` | DECIMAL | State revenue |
| `local_revenue` | DECIMAL | Local revenue |
| `total_expenditure` | DECIMAL | Total expenditure |
| `expenditure_per_pupil` | DECIMAL | Per-pupil expenditure |
| `finance_data_year` | INT | Year of finance data (e.g., 2020) |

#### Poverty Data
Source: Urban Institute API (SAIPE endpoint)

| Column | Type | Description |
|--------|------|-------------|
| `children_poverty_count` | INT | Children in poverty |
| `children_poverty_percent` | DECIMAL | Poverty rate |
| `median_household_income` | DECIMAL | Median household income |
| `saipe_data_year` | INT | Year of SAIPE data |

#### Graduation Data
Source: Urban Institute API

| Column | Type | Description |
|--------|------|-------------|
| `graduation_rate_total` | DECIMAL | Overall graduation rate |
| `graduation_rate_male` | DECIMAL | Male graduation rate |
| `graduation_rate_female` | DECIMAL | Female graduation rate |
| `graduation_data_year` | INT | Year of graduation data |

#### Staffing & Salaries
Source: Urban Institute API

| Column | Type | Description |
|--------|------|-------------|
| `salaries_total` | DECIMAL | Total salaries |
| `salaries_instruction` | DECIMAL | Instructional salaries |
| `teachers_fte` | DECIMAL | Total teacher FTE |
| `admin_fte` | DECIMAL | Admin FTE |
| `guidance_counselors_fte` | DECIMAL | Counselor FTE |
| `staff_total_fte` | DECIMAL | Total staff FTE |
| `staff_data_year` | INT | Year of staffing data |

#### Demographics
Source: Urban Institute API (enrollment endpoint)

| Column | Type | Description |
|--------|------|-------------|
| `enrollment_white` | INT | White student enrollment |
| `enrollment_black` | INT | Black student enrollment |
| `enrollment_hispanic` | INT | Hispanic student enrollment |
| `enrollment_asian` | INT | Asian student enrollment |
| `enrollment_american_indian` | INT | American Indian enrollment |
| `enrollment_pacific_islander` | INT | Pacific Islander enrollment |
| `enrollment_two_or_more` | INT | Two or more races enrollment |
| `total_enrollment` | INT | Total demographic enrollment |
| `demographics_data_year` | INT | Year of demographics data |

#### User Edits
Source: App users (shared across team)

| Column | Type | Description |
|--------|------|-------------|
| `notes` | TEXT | Free-form notes about the district |
| `owner` | VARCHAR(100) | Assigned owner |
| `notes_updated_at` | TIMESTAMP | When notes were last updated |

---

### `tags` - Tag Definitions

Reusable tags that can be applied to districts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR(50) | Tag name (unique) |
| `color` | VARCHAR(7) | Hex color code |

**Auto-tags:** The system automatically manages certain tags based on data:
- `Customer` - Districts with `is_customer = true`
- `Pipeline` - Districts with `has_open_pipeline = true`
- `Prospect` - Districts in a territory plan without pipeline
- `VIP` - Districts with >$100k current year revenue
- `Win Back Target` - Past customers with no current revenue
- `City`, `Suburb`, `Town`, `Rural` - Based on locale code

---

### `district_tags` - District-Tag Associations

Many-to-many junction table linking districts to tags.

| Column | Type | Description |
|--------|------|-------------|
| `district_leaid` | VARCHAR(7) | Foreign key to districts |
| `tag_id` | INT | Foreign key to tags |

---

### `contacts` - District Contacts

Contact information for people at each district.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `leaid` | VARCHAR(7) | Foreign key to districts |
| `name` | VARCHAR(255) | Contact name |
| `title` | VARCHAR(100) | Job title |
| `email` | VARCHAR(255) | Email address |
| `phone` | VARCHAR(50) | Phone number |
| `is_primary` | BOOLEAN | Primary contact flag |

---

### `territory_plans` - Saved Territory Plans

User-created plans grouping districts together.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR(255) | Plan name |
| `description` | TEXT | Plan description |
| `owner` | VARCHAR(100) | Plan owner |
| `color` | VARCHAR(7) | Display color |
| `status` | VARCHAR(20) | draft, active, archived |
| `start_date` | TIMESTAMP | Plan start date |
| `end_date` | TIMESTAMP | Plan end date |
| `user_id` | UUID | Supabase user ID (for RLS) |

---

### `territory_plan_districts` - Plan-District Associations

Many-to-many junction table linking plans to districts.

| Column | Type | Description |
|--------|------|-------------|
| `plan_id` | UUID | Foreign key to territory_plans |
| `district_leaid` | VARCHAR(7) | Foreign key to districts |
| `added_at` | TIMESTAMP | When district was added |

---

### `unmatched_accounts` - Unmatched CRM Accounts

Fullmind CRM accounts that couldn't be matched to a district.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `account_name` | VARCHAR(255) | Account name |
| `sales_executive` | VARCHAR(100) | Assigned sales rep |
| `state_abbrev` | VARCHAR(2) | State |
| `match_failure_reason` | VARCHAR(100) | Why matching failed |
| `is_customer` | BOOLEAN | Customer flag |
| `has_open_pipeline` | BOOLEAN | Pipeline flag |

---

### `data_refresh_logs` - ETL Audit Trail



Records of ETL runs for tracking data freshness.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `data_source` | VARCHAR(50) | Which ETL ran |
| `data_year` | INT | Year of data loaded |
| `records_updated` | INT | Count of records updated |
| `records_failed` | INT | Count of failures |
| `status` | VARCHAR(20) | success, failed, etc. |
| `started_at` | TIMESTAMP | When ETL started |
| `completed_at` | TIMESTAMP | When ETL finished |

---

## Data Sources & Refresh Schedule

| Data Type | Source | Typical Refresh | Year Tracking Column |
|-----------|--------|-----------------|---------------------|
| District boundaries | NCES EDGE Shapefiles | Annually | `urban_institute_year` |
| Enrollment | Urban Institute API | Annually | `urban_institute_year` |
| Finance | Urban Institute API | Annually (lag) | `finance_data_year` |
| Poverty/SAIPE | Urban Institute API | Annually | `saipe_data_year` |
| Graduation | Urban Institute API | Annually | `graduation_data_year` |
| Staffing | Urban Institute API | Annually | `staff_data_year` |
| Demographics | Urban Institute API | Annually | `demographics_data_year` |
| Fullmind CRM | CSV import | As needed | N/A |

---

## Common Query Patterns

### Fetch a district with all related data

```typescript
const district = await prisma.district.findUnique({
  where: { leaid },
  include: {
    districtTags: { include: { tag: true } },
    contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
    territoryPlans: { select: { planId: true } },
  },
});
```

### Filter districts by customer status

```typescript
const customers = await prisma.district.findMany({
  where: { isCustomer: true },
});
```

### Filter districts by state and pipeline

```typescript
const utahPipeline = await prisma.district.findMany({
  where: {
    stateAbbrev: "UT",
    hasOpenPipeline: true,
  },
});
```

### Get districts in a territory plan

```typescript
const planDistricts = await prisma.territoryPlanDistrict.findMany({
  where: { planId },
  include: { district: true },
});
```

---

### `activities` - Sales Activities

Meetings, outreach, and events that reps perform as part of their territory plans.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `type` | VARCHAR(50) | Activity type (e.g., discovery_call, demo, conference) |
| `title` | VARCHAR(255) | Activity title |
| `notes` | TEXT | Free-form notes |
| `start_date` | TIMESTAMP | When the activity starts |
| `end_date` | TIMESTAMP | When the activity ends |
| `status` | VARCHAR(20) | planned, completed, cancelled |
| `source` | VARCHAR(20) | manual or calendar_sync |
| `outcome` | TEXT | Free-text note about what happened |
| `outcome_type` | VARCHAR(50) | Structured outcome (e.g., positive_progress, meeting_booked) |
| `google_event_id` | VARCHAR(255) | Linked Google Calendar event ID (unique, nullable) |
| `created_by_user_id` | UUID | Supabase user ID |

**Junction tables:** `activity_plans`, `activity_districts`, `activity_contacts`, `activity_states`

---

### `tasks` - Follow-Up Tasks

Kanban-style tasks linked to activities, plans, districts, and contacts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `title` | VARCHAR(255) | Task title |
| `description` | TEXT | Task description |
| `status` | VARCHAR(20) | todo, in_progress, blocked, done |
| `priority` | VARCHAR(10) | low, medium, high, urgent |
| `due_date` | TIMESTAMP | When the task is due |
| `position` | INT | Ordering within kanban column |
| `created_by_user_id` | UUID | Supabase user ID |

**Junction tables:** `task_plans`, `task_districts`, `task_activities`, `task_contacts`

---

### `calendar_connections` - Google Calendar OAuth

Stores OAuth tokens for Google Calendar integration. One connection per user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | CUID | Primary key |
| `user_id` | UUID | FK to user_profiles (unique) |
| `google_account_email` | VARCHAR(255) | Connected Google account |
| `access_token` | TEXT | OAuth access token |
| `refresh_token` | TEXT | OAuth refresh token |
| `token_expires_at` | TIMESTAMP | Token expiration |
| `company_domain` | VARCHAR(255) | e.g., "fullmindlearning.com" — filters internal attendees |
| `sync_enabled` | BOOLEAN | Toggle sync on/off |
| `last_sync_at` | TIMESTAMP | Last successful sync |
| `status` | VARCHAR(20) | connected, disconnected, error |

---

### `calendar_events` - Staged Calendar Events (Inbox)

Events pulled from Google Calendar that haven't been confirmed as Activities yet.

| Column | Type | Description |
|--------|------|-------------|
| `id` | CUID | Primary key |
| `user_id` | UUID | FK to user_profiles |
| `google_event_id` | VARCHAR(255) | Google's event ID (unique per user) |
| `title` | VARCHAR(500) | Event title from Google |
| `description` | TEXT | Event description |
| `start_time` | TIMESTAMP | Event start |
| `end_time` | TIMESTAMP | Event end |
| `location` | TEXT | Event location |
| `attendees` | JSON | Array of {email, displayName, responseStatus, self} |
| `status` | VARCHAR(20) | pending, confirmed, dismissed |
| `suggested_activity_type` | VARCHAR(50) | Auto-detected type |
| `suggested_district_leaid` | VARCHAR(7) | Best-match district |
| `suggested_contact_ids` | JSON | Matched contact IDs |
| `suggested_plan_id` | UUID | Best-match plan |
| `match_confidence` | VARCHAR(10) | high, medium, low, none |
| `activity_id` | UUID | FK to activities (populated on confirm) |

---

## Schema Evolution Notes

**January 2026:** Consolidated schema migration
- Merged `fullmind_data`, `district_education_data`, `district_enrollment_demographics`, and `district_edits` tables into the main `districts` table
- Simplifies queries (no JOINs needed for district data)
- All data for a district is now in a single row
- Notes are now shared across all users (previously per-user isolation)

**February 2026:** Close the Loop feature set
- Added `activities` table with junction tables for plans, districts, contacts, and states
- Added `tasks` table with junction tables for plans, districts, activities, and contacts
- Added `calendar_connections` and `calendar_events` tables for Google Calendar sync
- Added outcome tracking fields (`outcome`, `outcome_type`) and calendar sync fields (`google_event_id`, `source`) to activities
- Added `user_profiles` and `user_goals` tables for user settings and fiscal year targets
