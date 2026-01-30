-- =====================================================
-- GOALS SYSTEM MIGRATION
-- Run this SQL in the Supabase Dashboard SQL Editor
-- (Project > SQL Editor > New Query)
-- =====================================================

-- Step 1: Add fiscal_year column (nullable first)
ALTER TABLE "territory_plans" ADD COLUMN IF NOT EXISTS "fiscal_year" INTEGER;

-- Step 2: Backfill existing plans based on created_at date
UPDATE "territory_plans"
SET "fiscal_year" = CASE
    WHEN "created_at" < '2025-07-01' THEN 2025
    WHEN "created_at" >= '2025-07-01' AND "created_at" < '2026-07-01' THEN 2026
    WHEN "created_at" >= '2026-07-01' AND "created_at" < '2027-07-01' THEN 2027
    ELSE 2027
END
WHERE "fiscal_year" IS NULL;

-- Step 3: Make fiscal_year NOT NULL
ALTER TABLE "territory_plans" ALTER COLUMN "fiscal_year" SET NOT NULL;

-- Step 4: Create index for user + fiscal year queries
CREATE INDEX IF NOT EXISTS "territory_plans_user_id_fiscal_year_idx"
ON "territory_plans"("user_id", "fiscal_year");

-- Step 5: Add target columns to territory_plan_districts
ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "revenue_target" DECIMAL(15, 2);
ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "pipeline_target" DECIMAL(15, 2);
ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Step 6: Create junction table for plan-district-services
CREATE TABLE IF NOT EXISTS "territory_plan_district_services" (
    "plan_id" TEXT NOT NULL,
    "district_leaid" VARCHAR(7) NOT NULL,
    "service_id" INTEGER NOT NULL,
    CONSTRAINT "territory_plan_district_services_pkey" PRIMARY KEY ("plan_id","district_leaid","service_id"),
    CONSTRAINT "territory_plan_district_services_plan_id_district_leaid_fkey"
        FOREIGN KEY ("plan_id", "district_leaid")
        REFERENCES "territory_plan_districts"("plan_id", "district_leaid") ON DELETE CASCADE,
    CONSTRAINT "territory_plan_district_services_service_id_fkey"
        FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE
);

-- Verify the migration
SELECT
    'territory_plans.fiscal_year' as check_item,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='territory_plans' AND column_name='fiscal_year') as exists;
