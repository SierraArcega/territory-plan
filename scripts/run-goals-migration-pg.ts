import { Client } from "pg";
import { config } from "dotenv";

// Load environment variables
config();

async function main() {
  console.log("Connecting to:", process.env.DIRECT_URL?.replace(/:[^:@]+@/, ":****@"));

  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  await client.connect();
  console.log("Connected to database");

  // Set a longer statement timeout
  await client.query("SET statement_timeout = '60s'");
  console.log("Set statement timeout to 60s");

  try {
    // Step 1: Add fiscal_year column (nullable first)
    console.log("1. Adding fiscal_year column...");
    await client.query(`
      ALTER TABLE "territory_plans" ADD COLUMN IF NOT EXISTS "fiscal_year" INTEGER
    `);
    console.log("   Done");

    // Step 2: Backfill existing plans
    console.log("2. Backfilling fiscal_year based on created_at...");
    await client.query(`
      UPDATE "territory_plans"
      SET "fiscal_year" = CASE
        WHEN "created_at" < '2025-07-01' THEN 2025
        WHEN "created_at" >= '2025-07-01' AND "created_at" < '2026-07-01' THEN 2026
        WHEN "created_at" >= '2026-07-01' AND "created_at" < '2027-07-01' THEN 2027
        ELSE 2026
      END
      WHERE "fiscal_year" IS NULL
    `);
    console.log("   Done");

    // Step 3: Make fiscal_year NOT NULL
    console.log("3. Making fiscal_year NOT NULL...");
    await client.query(`
      ALTER TABLE "territory_plans" ALTER COLUMN "fiscal_year" SET NOT NULL
    `);
    console.log("   Done");

    // Step 4: Create index
    console.log("4. Creating index...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS "territory_plans_user_id_fiscal_year_idx"
      ON "territory_plans"("user_id", "fiscal_year")
    `);
    console.log("   Done");

    // Step 5: Add target columns to territory_plan_districts
    console.log("5. Adding target columns to territory_plan_districts...");
    await client.query(`
      ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "revenue_target" DECIMAL(15, 2)
    `);
    await client.query(`
      ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "pipeline_target" DECIMAL(15, 2)
    `);
    await client.query(`
      ALTER TABLE "territory_plan_districts" ADD COLUMN IF NOT EXISTS "notes" TEXT
    `);
    console.log("   Done");

    // Step 6: Create territory_plan_district_services junction table
    console.log("6. Creating territory_plan_district_services table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "territory_plan_district_services" (
        "plan_id" TEXT NOT NULL,
        "district_leaid" VARCHAR(7) NOT NULL,
        "service_id" INTEGER NOT NULL,
        CONSTRAINT "territory_plan_district_services_pkey" PRIMARY KEY ("plan_id","district_leaid","service_id")
      )
    `);
    console.log("   Done");

    // Step 7: Add foreign keys
    console.log("7. Adding foreign keys...");
    try {
      await client.query(`
        ALTER TABLE "territory_plan_district_services"
        ADD CONSTRAINT "territory_plan_district_services_plan_id_district_leaid_fkey"
        FOREIGN KEY ("plan_id", "district_leaid")
        REFERENCES "territory_plan_districts"("plan_id", "district_leaid")
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log("   FK to territory_plan_districts added");
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === "42710") {
        console.log("   FK to territory_plan_districts already exists");
      } else {
        throw e;
      }
    }

    try {
      await client.query(`
        ALTER TABLE "territory_plan_district_services"
        ADD CONSTRAINT "territory_plan_district_services_service_id_fkey"
        FOREIGN KEY ("service_id")
        REFERENCES "services"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log("   FK to services added");
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === "42710") {
        console.log("   FK to services already exists");
      } else {
        throw e;
      }
    }

    console.log("\nMigration complete!");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
