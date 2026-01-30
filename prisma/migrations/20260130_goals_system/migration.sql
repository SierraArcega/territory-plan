-- CreateTable: services
CREATE TABLE IF NOT EXISTS "services" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "services_name_key" ON "services"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "services_slug_key" ON "services"("slug");

-- Seed services
INSERT INTO "services" ("name", "slug", "color", "sort_order") VALUES
    ('Homebound', 'homebound', '#6EA3BE', 1),
    ('Whole Class Virtual Instruction', 'wcvi', '#8AA891', 2),
    ('Credit Recovery', 'credit-recovery', '#D4A84B', 3),
    ('Suspension Alternatives', 'suspension-alt', '#F37167', 4),
    ('Tutoring', 'tutoring', '#403770', 5),
    ('Resource Rooms', 'resource-rooms', '#7C6FA0', 6),
    ('Test Prep', 'test-prep', '#5EADB0', 7),
    ('Homework Help', 'homework-help', '#E8926B', 8),
    ('Hybrid Staffing', 'hybrid-staffing', '#9B7EDE', 9)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order;

-- Add fiscal_year column to territory_plans (nullable first for backfill)
ALTER TABLE "territory_plans" ADD COLUMN IF NOT EXISTS "fiscal_year" INTEGER;

-- Backfill fiscal_year based on created_at date
-- Fiscal year runs Jul 1 - Jun 30
-- Created before Jul 2025 -> FY25 (2025)
-- Created Jul 2025 - Jun 2026 -> FY26 (2026)
-- Created Jul 2026 - Jun 2027 -> FY27 (2027)
-- etc.
UPDATE "territory_plans"
SET "fiscal_year" = CASE
    WHEN "created_at" < '2025-07-01' THEN 2025
    WHEN "created_at" >= '2025-07-01' AND "created_at" < '2026-07-01' THEN 2026
    WHEN "created_at" >= '2026-07-01' AND "created_at" < '2027-07-01' THEN 2027
    WHEN "created_at" >= '2027-07-01' AND "created_at" < '2028-07-01' THEN 2028
    WHEN "created_at" >= '2028-07-01' AND "created_at" < '2029-07-01' THEN 2029
    ELSE EXTRACT(YEAR FROM "created_at")::INTEGER
END
WHERE "fiscal_year" IS NULL;

-- Now make fiscal_year NOT NULL and default to current FY
ALTER TABLE "territory_plans" ALTER COLUMN "fiscal_year" SET NOT NULL;

-- Add index for userId + fiscalYear
CREATE INDEX IF NOT EXISTS "territory_plans_user_id_fiscal_year_idx" ON "territory_plans"("user_id", "fiscal_year");

-- Add target columns to territory_plan_districts
ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "revenue_target" DECIMAL(15, 2);
ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "pipeline_target" DECIMAL(15, 2);
ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- CreateTable: territory_plan_district_services
CREATE TABLE IF NOT EXISTS "territory_plan_district_services" (
    "plan_id" TEXT NOT NULL,
    "district_leaid" VARCHAR(7) NOT NULL,
    "service_id" INTEGER NOT NULL,

    CONSTRAINT "territory_plan_district_services_pkey" PRIMARY KEY ("plan_id","district_leaid","service_id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'territory_plan_district_services_plan_id_district_leaid_fkey'
    ) THEN
        ALTER TABLE "territory_plan_district_services" ADD CONSTRAINT "territory_plan_district_services_plan_id_district_leaid_fkey"
            FOREIGN KEY ("plan_id", "district_leaid") REFERENCES "territory_plan_districts"("plan_id", "district_leaid") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'territory_plan_district_services_service_id_fkey'
    ) THEN
        ALTER TABLE "territory_plan_district_services" ADD CONSTRAINT "territory_plan_district_services_service_id_fkey"
            FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
