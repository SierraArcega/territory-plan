import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Running Goals System Migration...");

  // Step 1: Add fiscal_year column (nullable first)
  console.log("1. Adding fiscal_year column...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "territory_plans" ADD COLUMN IF NOT EXISTS "fiscal_year" INTEGER
  `);

  // Step 2: Backfill existing plans
  console.log("2. Backfilling fiscal_year based on created_at...");
  await prisma.$executeRawUnsafe(`
    UPDATE "territory_plans"
    SET "fiscal_year" = CASE
      WHEN "created_at" < '2025-07-01' THEN 2025
      WHEN "created_at" >= '2025-07-01' AND "created_at" < '2026-07-01' THEN 2026
      WHEN "created_at" >= '2026-07-01' AND "created_at" < '2027-07-01' THEN 2027
      ELSE 2026
    END
    WHERE "fiscal_year" IS NULL
  `);

  // Step 3: Make fiscal_year NOT NULL
  console.log("3. Making fiscal_year NOT NULL...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "territory_plans" ALTER COLUMN "fiscal_year" SET NOT NULL
  `);

  // Step 4: Create index
  console.log("4. Creating index...");
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "territory_plans_user_id_fiscal_year_idx"
    ON "territory_plans"("user_id", "fiscal_year")
  `);

  // Step 5: Add target columns to territory_plan_districts
  console.log("5. Adding target columns to territory_plan_districts...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "revenue_target" DECIMAL(15, 2)
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "pipeline_target" DECIMAL(15, 2)
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "notes" TEXT
  `);

  // Step 6: Create territory_plan_district_services junction table
  console.log("6. Creating territory_plan_district_services table...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "territory_plan_district_services" (
      "plan_id" TEXT NOT NULL,
      "district_leaid" VARCHAR(7) NOT NULL,
      "service_id" INTEGER NOT NULL,
      CONSTRAINT "territory_plan_district_services_pkey" PRIMARY KEY ("plan_id","district_leaid","service_id")
    )
  `);

  // Step 7: Add foreign keys
  console.log("7. Adding foreign keys...");
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "territory_plan_district_services"
      ADD CONSTRAINT "territory_plan_district_services_plan_id_district_leaid_fkey"
      FOREIGN KEY ("plan_id", "district_leaid")
      REFERENCES "territory_plan_districts"("plan_id", "district_leaid")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  } catch (e) {
    console.log("   FK already exists or skipped");
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "territory_plan_district_services"
      ADD CONSTRAINT "territory_plan_district_services_service_id_fkey"
      FOREIGN KEY ("service_id")
      REFERENCES "services"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  } catch (e) {
    console.log("   FK already exists or skipped");
  }

  console.log("\nMigration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
