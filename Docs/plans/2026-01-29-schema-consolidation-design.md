# Schema Consolidation Design

**Date:** 2026-01-29
**Status:** Ready for implementation

## Goal

Consolidate four 1:1 tables into the main `districts` table to:
1. Reduce query complexity (one query instead of three)
2. Improve performance (no JOINs for district data)
3. Simplify mental model (one table = one district with all data)

## Tables Being Consolidated

| Table | Columns | Purpose |
|-------|---------|---------|
| `fullmind_data` | 24 | CRM revenue, pipeline, bookings |
| `district_education_data` | 38 | Finance, graduation, staffing, poverty |
| `district_enrollment_demographics` | 10 | Enrollment by race/ethnicity |
| `district_edits` | 4 | User notes and owner assignment |

**Result:** All columns merge into `districts` (~75 total columns)

## Schema Design

### Column Groups in Consolidated `districts` Table

**Core District Info (existing):**
- `leaid`, `name`, `state_fips`, `state_abbrev`, `enrollment`
- `lograde`, `higrade`, `mtfcc`, `sdtyp`, `funcstat`
- Address: `phone`, `street_location`, `city_location`, `state_location`, `zip_location`
- `county_name`, `urban_centric_locale`, `number_of_schools`
- `spec_ed_students`, `ell_students`, `urban_institute_year`

**Fullmind CRM Data (from fullmind_data):**
- `account_name`, `sales_executive`, `lmsid`
- FY25: `fy25_sessions_revenue`, `fy25_sessions_take`, `fy25_sessions_count`
- FY25: `fy25_closed_won_opp_count`, `fy25_closed_won_net_booking`, `fy25_net_invoicing`
- FY26: `fy26_sessions_revenue`, `fy26_sessions_take`, `fy26_sessions_count`
- FY26: `fy26_closed_won_opp_count`, `fy26_closed_won_net_booking`, `fy26_net_invoicing`
- FY26 Pipeline: `fy26_open_pipeline_opp_count`, `fy26_open_pipeline`, `fy26_open_pipeline_weighted`
- FY27 Pipeline: `fy27_open_pipeline_opp_count`, `fy27_open_pipeline`, `fy27_open_pipeline_weighted`
- Flags: `is_customer`, `has_open_pipeline`

**Finance Data (from district_education_data):**
- `total_revenue`, `federal_revenue`, `state_revenue`, `local_revenue`
- `total_expenditure`, `expenditure_per_pupil`
- `finance_data_year`

**Poverty Data (from district_education_data):**
- `children_poverty_count`, `children_poverty_percent`
- `median_household_income`
- `saipe_data_year`

**Graduation Data (from district_education_data):**
- `graduation_rate_total`, `graduation_rate_male`, `graduation_rate_female`
- `graduation_data_year`

**Staffing & Salaries (from district_education_data):**
- `salaries_total`, `salaries_instruction`, `salaries_teachers_regular`
- `salaries_teachers_special_ed`, `salaries_teachers_vocational`, `salaries_teachers_other`
- `salaries_support_admin`, `salaries_support_instructional`, `benefits_total`
- `teachers_fte`, `teachers_elementary_fte`, `teachers_secondary_fte`
- `admin_fte`, `guidance_counselors_fte`, `instructional_aides_fte`
- `support_staff_fte`, `staff_total_fte`
- `staff_data_year`

**Absenteeism (from district_education_data):**
- `chronic_absenteeism_count`, `chronic_absenteeism_rate`
- `absenteeism_data_year`

**Demographics (from district_enrollment_demographics):**
- `enrollment_white`, `enrollment_black`, `enrollment_hispanic`
- `enrollment_asian`, `enrollment_american_indian`, `enrollment_pacific_islander`
- `enrollment_two_or_more`, `total_enrollment`
- `demographics_data_year`

**User Edits (from district_edits):**
- `notes`, `owner`
- `notes_updated_at`

**Note:** `district_edits.user_id` is dropped. Notes become shared across the team.

## Migration Strategy

### Step 1: Backup
```bash
./scripts/db-backup.sh backup before-consolidation
```

### Step 2: Add Columns to Districts
Add all new columns as nullable. Non-destructive change.

### Step 3: Migrate Data
```sql
-- Copy fullmind_data
UPDATE districts d SET
  account_name = f.account_name,
  sales_executive = f.sales_executive,
  lmsid = f.lmsid,
  fy25_sessions_revenue = f.fy25_sessions_revenue,
  -- ... all columns
  is_customer = f.is_customer,
  has_open_pipeline = f.has_open_pipeline
FROM fullmind_data f WHERE d.leaid = f.leaid;

-- Copy district_education_data
UPDATE districts d SET
  total_revenue = e.total_revenue,
  -- ... all columns
FROM district_education_data e WHERE d.leaid = e.leaid;

-- Copy district_enrollment_demographics
UPDATE districts d SET
  enrollment_white = dem.enrollment_white,
  -- ... all columns
FROM district_enrollment_demographics dem WHERE d.leaid = dem.leaid;

-- Copy district_edits
UPDATE districts d SET
  notes = ed.notes,
  owner = ed.owner,
  notes_updated_at = ed.updated_at
FROM district_edits ed WHERE d.leaid = ed.leaid;
```

### Step 4: Verify Data Integrity
- Count rows match
- Spot-check several districts
- Verify customer counts, totals

### Step 5: Update Application Code
- Update `prisma/schema.prisma`
- Simplify API routes
- Update any components using old table names

### Step 6: Drop Old Tables
```sql
DROP TABLE fullmind_data;
DROP TABLE district_education_data;
DROP TABLE district_enrollment_demographics;
DROP TABLE district_edits;
```

### Step 7: Update RLS Policies
- Remove policies from dropped tables
- `districts` remains read-only for authenticated users

## API Changes

### Before (district detail endpoint)
```typescript
// 3 queries, ~200 lines of code
const district = await prisma.district.findUnique({
  include: { fullmindData: true, edits: true, ... }
});
const eduResult = await prisma.$queryRaw`SELECT * FROM district_education_data...`;
const demoResult = await prisma.$queryRaw`SELECT * FROM district_enrollment_demographics...`;
// Manual transformation...
```

### After
```typescript
// 1 query, ~30 lines of code
const district = await prisma.district.findUnique({
  where: { leaid },
  include: {
    districtTags: { include: { tag: true } },
    contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
    territoryPlans: { select: { planId: true } },
  },
});

return NextResponse.json({
  ...district,
  tags: district.districtTags.map(dt => dt.tag),
  territoryPlanIds: district.territoryPlans.map(tp => tp.planId),
});
```

## ETL Updates

Each ETL script updates only its own column group:

| ETL Command | Target Columns |
|-------------|----------------|
| `--boundaries` | Core district info |
| `--enrollment` | `enrollment` field |
| `--fullmind` | Fullmind CRM columns |
| `--finance` | Finance columns + `finance_data_year` |
| `--poverty` | Poverty columns + `saipe_data_year` |
| `--graduation` | Graduation columns + `graduation_data_year` |
| `--staff` | Staffing columns + `staff_data_year` |
| `--demographics` | Demographics columns + `demographics_data_year` |

Data year columns track when each data type was last refreshed.

## Tables After Consolidation

| Table | Purpose | Relationship to Districts |
|-------|---------|---------------------------|
| `districts` | All district data | — |
| `tags` | Tag definitions | — |
| `district_tags` | District-tag links | Many-to-many |
| `contacts` | District contacts | One-to-many |
| `territory_plans` | Saved plans | — |
| `territory_plan_districts` | Plan-district links | Many-to-many |
| `unmatched_accounts` | CRM accounts without district match | Standalone |
| `data_refresh_logs` | ETL audit trail | Standalone |

## Deliverables

1. Updated `prisma/schema.prisma`
2. SQL migration script
3. Simplified API routes
4. Updated ETL scripts
5. `Docs/data-model.md` documentation
6. Updated `supabase/rls-policies.sql`

## Risk Mitigation

- **Backup before any changes**
- **Verify data integrity** before dropping old tables
- **Keep backup for 30 days** after migration
- **Test locally first** before applying to Supabase
