-- Migration: add_title1_frpl_demographics
-- Adds Title I status, FRPL, and demographics fields to schools table,
-- and Title I aggregate fields to districts table.

-- ===== School: Title I Data =====
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "title_i_status" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "title_i_eligible" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "title_i_schoolwide" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "title_i_data_year" INTEGER;

-- ===== School: Free/Reduced Price Lunch =====
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "free_lunch" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "reduced_price_lunch" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "frpl_total" INTEGER;

-- ===== School: Demographics =====
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "enrollment_white" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "enrollment_black" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "enrollment_hispanic" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "enrollment_asian" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "enrollment_american_indian" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "enrollment_pacific_islander" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "enrollment_two_or_more" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "demographics_data_year" INTEGER;

-- ===== District: Title I Aggregates =====
ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "title_i_school_count" INTEGER;
ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "title_i_schoolwide_count" INTEGER;
ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "total_school_count" INTEGER;
ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "frpl_total_count" INTEGER;
ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "frpl_rate" DECIMAL(5, 2);
ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "title_i_revenue" DECIMAL(15, 2);
