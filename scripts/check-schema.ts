import { Client } from "pg";
import { config } from "dotenv";

config();

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  await client.connect();
  console.log("Connected to database\n");

  // Check territory_plans columns
  console.log("=== territory_plans columns ===");
  const tpCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'territory_plans'
    ORDER BY ordinal_position
  `);
  tpCols.rows.forEach((row) => {
    console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
  });

  // Check territory_plan_districts columns
  console.log("\n=== territory_plan_districts columns ===");
  const tpdCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'territory_plan_districts'
    ORDER BY ordinal_position
  `);
  tpdCols.rows.forEach((row) => {
    console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
  });

  // Check if services table exists
  console.log("\n=== services table ===");
  const servicesExists = await client.query(`
    SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'services'
  `);
  if (servicesExists.rows[0].count > 0) {
    const services = await client.query(`SELECT * FROM services ORDER BY sort_order`);
    console.log(`  ${services.rows.length} services found:`);
    services.rows.forEach((row) => {
      console.log(`    ${row.id}. ${row.name} (${row.slug})`);
    });
  } else {
    console.log("  Table does not exist");
  }

  // Check if junction table exists
  console.log("\n=== territory_plan_district_services table ===");
  const junctionExists = await client.query(`
    SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'territory_plan_district_services'
  `);
  console.log(`  Exists: ${junctionExists.rows[0].count > 0 ? 'Yes' : 'No'}`);

  // Check existing plans
  console.log("\n=== Existing territory_plans ===");
  const plans = await client.query(`SELECT id, name, fiscal_year, created_at FROM territory_plans LIMIT 5`);
  if (plans.rows.length === 0) {
    console.log("  No plans found");
  } else {
    plans.rows.forEach((row) => {
      console.log(`  ${row.name}: FY${row.fiscal_year || 'NULL'} (created ${row.created_at})`);
    });
  }

  await client.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
