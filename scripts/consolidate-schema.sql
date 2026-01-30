-- Schema Consolidation Migration
-- Consolidates fullmind_data, district_education_data, district_enrollment_demographics,
-- and district_edits into the districts table
--
-- Run with: npx prisma db execute --file scripts/consolidate-schema.sql

-- =============================================
-- STEP 1: Add new columns to districts table
-- =============================================

-- Fullmind CRM columns
ALTER TABLE districts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS sales_executive VARCHAR(100);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS lmsid VARCHAR(50);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy25_sessions_revenue DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy25_sessions_take DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy25_sessions_count INTEGER DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_sessions_revenue DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_sessions_take DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_sessions_count INTEGER DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy25_closed_won_opp_count INTEGER DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy25_closed_won_net_booking DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy25_net_invoicing DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_closed_won_opp_count INTEGER DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_closed_won_net_booking DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_net_invoicing DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_open_pipeline_opp_count INTEGER DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_open_pipeline DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy26_open_pipeline_weighted DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy27_open_pipeline_opp_count INTEGER DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy27_open_pipeline DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS fy27_open_pipeline_weighted DECIMAL(15,2) DEFAULT 0;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS is_customer BOOLEAN DEFAULT FALSE;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS has_open_pipeline BOOLEAN DEFAULT FALSE;

-- Finance columns
ALTER TABLE districts ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS federal_revenue DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS state_revenue DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS local_revenue DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS total_expenditure DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS expenditure_per_pupil DECIMAL(12,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS finance_data_year INTEGER;

-- Poverty columns
ALTER TABLE districts ADD COLUMN IF NOT EXISTS children_poverty_count INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS children_poverty_percent DECIMAL(5,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS median_household_income DECIMAL(12,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS saipe_data_year INTEGER;

-- Graduation columns
ALTER TABLE districts ADD COLUMN IF NOT EXISTS graduation_rate_total DECIMAL(5,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS graduation_rate_male DECIMAL(5,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS graduation_rate_female DECIMAL(5,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS graduation_data_year INTEGER;

-- Staffing & Salaries columns
ALTER TABLE districts ADD COLUMN IF NOT EXISTS salaries_total DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS salaries_instruction DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS salaries_teachers_regular DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS salaries_teachers_special_ed DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS salaries_teachers_vocational DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS salaries_teachers_other DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS salaries_support_admin DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS salaries_support_instructional DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS benefits_total DECIMAL(15,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS teachers_fte DECIMAL(10,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS teachers_elementary_fte DECIMAL(10,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS teachers_secondary_fte DECIMAL(10,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS admin_fte DECIMAL(10,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS guidance_counselors_fte DECIMAL(10,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS instructional_aides_fte DECIMAL(10,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS support_staff_fte DECIMAL(10,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS staff_total_fte DECIMAL(10,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS staff_data_year INTEGER;

-- Absenteeism columns
ALTER TABLE districts ADD COLUMN IF NOT EXISTS chronic_absenteeism_count INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS chronic_absenteeism_rate DECIMAL(5,2);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS absenteeism_data_year INTEGER;

-- Demographics columns
ALTER TABLE districts ADD COLUMN IF NOT EXISTS enrollment_white INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS enrollment_black INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS enrollment_hispanic INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS enrollment_asian INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS enrollment_american_indian INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS enrollment_pacific_islander INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS enrollment_two_or_more INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS total_enrollment INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS demographics_data_year INTEGER;

-- User edits columns
ALTER TABLE districts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS owner VARCHAR(100);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMP;

-- =============================================
-- STEP 2: Copy data from old tables
-- =============================================

-- Copy from fullmind_data
UPDATE districts d SET
  account_name = f.account_name,
  sales_executive = f.sales_executive,
  lmsid = f.lmsid,
  fy25_sessions_revenue = f.fy25_sessions_revenue,
  fy25_sessions_take = f.fy25_sessions_take,
  fy25_sessions_count = f.fy25_sessions_count,
  fy26_sessions_revenue = f.fy26_sessions_revenue,
  fy26_sessions_take = f.fy26_sessions_take,
  fy26_sessions_count = f.fy26_sessions_count,
  fy25_closed_won_opp_count = f.fy25_closed_won_opp_count,
  fy25_closed_won_net_booking = f.fy25_closed_won_net_booking,
  fy25_net_invoicing = f.fy25_net_invoicing,
  fy26_closed_won_opp_count = f.fy26_closed_won_opp_count,
  fy26_closed_won_net_booking = f.fy26_closed_won_net_booking,
  fy26_net_invoicing = f.fy26_net_invoicing,
  fy26_open_pipeline_opp_count = f.fy26_open_pipeline_opp_count,
  fy26_open_pipeline = f.fy26_open_pipeline,
  fy26_open_pipeline_weighted = f.fy26_open_pipeline_weighted,
  fy27_open_pipeline_opp_count = f.fy27_open_pipeline_opp_count,
  fy27_open_pipeline = f.fy27_open_pipeline,
  fy27_open_pipeline_weighted = f.fy27_open_pipeline_weighted,
  is_customer = f.is_customer,
  has_open_pipeline = f.has_open_pipeline
FROM fullmind_data f
WHERE d.leaid = f.leaid;

-- Copy from district_education_data
UPDATE districts d SET
  total_revenue = e.total_revenue,
  federal_revenue = e.federal_revenue,
  state_revenue = e.state_revenue,
  local_revenue = e.local_revenue,
  total_expenditure = e.total_expenditure,
  expenditure_per_pupil = e.expenditure_per_pupil,
  finance_data_year = e.finance_data_year,
  children_poverty_count = e.children_poverty_count,
  children_poverty_percent = e.children_poverty_percent,
  median_household_income = e.median_household_income,
  saipe_data_year = e.saipe_data_year,
  graduation_rate_total = e.graduation_rate_total,
  graduation_rate_male = e.graduation_rate_male,
  graduation_rate_female = e.graduation_rate_female,
  graduation_data_year = e.graduation_data_year,
  salaries_total = e.salaries_total,
  salaries_instruction = e.salaries_instruction,
  salaries_teachers_regular = e.salaries_teachers_regular,
  salaries_teachers_special_ed = e.salaries_teachers_special_ed,
  salaries_teachers_vocational = e.salaries_teachers_vocational,
  salaries_teachers_other = e.salaries_teachers_other,
  salaries_support_admin = e.salaries_support_admin,
  salaries_support_instructional = e.salaries_support_instructional,
  benefits_total = e.benefits_total,
  teachers_fte = e.teachers_fte,
  teachers_elementary_fte = e.teachers_elementary_fte,
  teachers_secondary_fte = e.teachers_secondary_fte,
  admin_fte = e.admin_fte,
  guidance_counselors_fte = e.guidance_counselors_fte,
  instructional_aides_fte = e.instructional_aides_fte,
  support_staff_fte = e.support_staff_fte,
  staff_total_fte = e.staff_total_fte,
  staff_data_year = e.staff_data_year,
  chronic_absenteeism_count = e.chronic_absenteeism_count,
  chronic_absenteeism_rate = e.chronic_absenteeism_rate,
  absenteeism_data_year = e.absenteeism_data_year
FROM district_education_data e
WHERE d.leaid = e.leaid;

-- Copy from district_enrollment_demographics
UPDATE districts d SET
  enrollment_white = dem.enrollment_white,
  enrollment_black = dem.enrollment_black,
  enrollment_hispanic = dem.enrollment_hispanic,
  enrollment_asian = dem.enrollment_asian,
  enrollment_american_indian = dem.enrollment_american_indian,
  enrollment_pacific_islander = dem.enrollment_pacific_islander,
  enrollment_two_or_more = dem.enrollment_two_or_more,
  total_enrollment = dem.total_enrollment,
  demographics_data_year = dem.demographics_data_year
FROM district_enrollment_demographics dem
WHERE d.leaid = dem.leaid;

-- Copy from district_edits
UPDATE districts d SET
  notes = ed.notes,
  owner = ed.owner,
  notes_updated_at = ed.updated_at
FROM district_edits ed
WHERE d.leaid = ed.leaid;

-- =============================================
-- STEP 3: Add index for customer/pipeline queries
-- =============================================

CREATE INDEX IF NOT EXISTS idx_districts_customer_pipeline ON districts(is_customer, has_open_pipeline);

-- =============================================
-- STEP 4: Verify data migration
-- =============================================

-- Output verification counts
SELECT 'districts' as table_name, COUNT(*) as count FROM districts
UNION ALL
SELECT 'fullmind_data' as table_name, COUNT(*) as count FROM fullmind_data
UNION ALL
SELECT 'district_education_data' as table_name, COUNT(*) as count FROM district_education_data
UNION ALL
SELECT 'district_enrollment_demographics' as table_name, COUNT(*) as count FROM district_enrollment_demographics
UNION ALL
SELECT 'district_edits' as table_name, COUNT(*) as count FROM district_edits;

-- Verify fullmind data was copied (should match fullmind_data count)
SELECT 'districts with is_customer set' as check_name,
       COUNT(*) as count
FROM districts
WHERE is_customer IS NOT NULL;

-- Verify education data was copied
SELECT 'districts with finance_data_year' as check_name,
       COUNT(*) as count
FROM districts
WHERE finance_data_year IS NOT NULL;

-- Verify demographics was copied
SELECT 'districts with demographics_data_year' as check_name,
       COUNT(*) as count
FROM districts
WHERE demographics_data_year IS NOT NULL;

-- =============================================
-- NOTE: Do NOT drop old tables yet!
-- Run the app, verify everything works, then
-- run drop-old-tables.sql separately
-- =============================================
