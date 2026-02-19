// scripts/import-customer-book.ts
//
// Imports district rows from the Customer Book Consolidation CSV:
//   1. Creates missing districts (minimal records)
//   2. Creates or matches territory plans by name + fiscal year
//   3. Sets per-district targets (renewal, expansion, winback, new business)
//   4. Updates FY27 pipeline on the district record
//
// Usage:
//   npx tsx scripts/import-customer-book.ts                          # live run
//   npx tsx scripts/import-customer-book.ts --dry-run                # preview only
//   npx tsx scripts/import-customer-book.ts --file path/to/file.csv  # custom path

import { readFileSync } from "fs";
import { createHash } from "crypto";
import prisma from "../src/lib/prisma";

// ── Synthetic LEA ID generator ─────────────────────────────────────
// For accounts without a real NCES ID (marked "ADD" in the CSV).
// Generates a deterministic 7-char ID from name + state so re-runs
// produce the same ID. Prefix "A" guarantees no collision with real
// numeric NCES IDs.
function generateSyntheticLeaid(name: string, state: string): string {
  const hash = createHash("md5")
    .update(`${name}|${state}`)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
  return `A${hash}`;
}

// ── CSV line parser ────────────────────────────────────────────────
// Handles quoted fields that contain commas (e.g., "$1,234.56")
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ── Dollar string parser ───────────────────────────────────────────
// Converts "$1,080,674.00" or "$0.00" or "$200,000" → number
// Returns 0 for empty/unparseable values
function parseDollar(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,"]/g, "").trim();
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

// ── Row type ───────────────────────────────────────────────────────
interface CSVRow {
  accountName: string;
  leaid: string;
  stateAbbrev: string;
  planName: string;
  fiscalYear: number;
  owner: string;
  renewalTarget: number;
  expansionTarget: number;
  winbackTarget: number;
  newBusinessTarget: number;
  fy27Pipeline: number;
}

// ── Parse all rows from CSV ────────────────────────────────────────
function parseCSV(filePath: string): CSVRow[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Skip row 1 (summary/totals) and row 2 (headers) — data starts at row 3
  const rows: CSVRow[] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const leaid = fields[1]?.trim();

    // Skip rows with missing LEA ID
    if (!leaid) continue;

    // Validate fiscal year
    const fiscalYear = parseInt(fields[4]?.trim() || "0", 10);
    if (!fiscalYear || fiscalYear < 2020) {
      console.warn(`  Skipping row ${i + 1}: invalid fiscal year "${fields[4]?.trim()}" for "${fields[0]?.trim()}"`);
      continue;
    }

    // Generate synthetic ID for accounts without a real NCES ID
    const accountName = fields[0]?.trim() || "";
    const stateAbbrev = fields[2]?.trim() || "";
    const resolvedLeaid =
      leaid === "ADD"
        ? generateSyntheticLeaid(accountName, stateAbbrev)
        : leaid;

    rows.push({
      accountName,
      leaid: resolvedLeaid,
      stateAbbrev,
      planName: fields[3]?.trim() || "",
      fiscalYear,
      owner: fields[5]?.trim() || "",
      renewalTarget: parseDollar(fields[7] || ""),
      expansionTarget: parseDollar(fields[8] || ""),
      winbackTarget: parseDollar(fields[9] || ""),
      newBusinessTarget: parseDollar(fields[10] || ""),
      fy27Pipeline: parseDollar(fields[11] || ""),
    });
  }

  return rows;
}

// ── Main import logic ──────────────────────────────────────────────
async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArgIdx = args.indexOf("--file");
  const filePath =
    fileArgIdx >= 0 && args[fileArgIdx + 1]
      ? args[fileArgIdx + 1]
      : "./data/customer-book.csv";

  if (dryRun) {
    console.log("🔍 DRY RUN MODE — no database changes will be made\n");
  }

  // Step 1: Parse CSV
  console.log(`Reading CSV from: ${filePath}`);
  const rows = parseCSV(filePath);
  console.log(`Parsed ${rows.length} data rows\n`);

  // Step 2: Build state abbreviation → FIPS lookup from database
  const states = await prisma.state.findMany({
    select: { fips: true, abbrev: true },
  });
  const stateLookup = new Map(states.map((s) => [s.abbrev, s.fips]));
  // Map non-standard abbreviations from the CSV to real state abbreviations
  const stateAliases: Record<string, string> = { INT: "IT" };
  console.log(`Loaded ${stateLookup.size} state mappings\n`);

  // Step 3: Identify unique plans and existing districts
  const uniquePlans = new Map<string, { name: string; fiscalYear: number; stateAbbrev: string }>();
  for (const row of rows) {
    const key = `${row.planName}|${row.fiscalYear}`;
    if (!uniquePlans.has(key)) {
      uniquePlans.set(key, {
        name: row.planName,
        fiscalYear: row.fiscalYear,
        stateAbbrev: row.stateAbbrev,
      });
    }
  }
  console.log(`Found ${uniquePlans.size} unique territory plans in CSV\n`);

  // Counters for summary
  let plansCreated = 0;
  let plansMatched = 0;
  let districtsCreated = 0;
  let targetsUpserted = 0;
  let pipelineUpdated = 0;
  let ownersSet = 0;
  const errors: string[] = [];

  // Step 4: Create or match territory plans
  // Maps "PlanName|FY" → plan ID (either existing or newly created)
  const planIdMap = new Map<string, string>();

  for (const [key, plan] of uniquePlans) {
    const stateFips = stateLookup.get(stateAliases[plan.stateAbbrev] || plan.stateAbbrev);
    if (!stateFips) {
      errors.push(`Unknown state "${plan.stateAbbrev}" for plan "${plan.name}" — skipping plan`);
      continue;
    }

    // Check if plan already exists by name + fiscal year
    const existing = await prisma.territoryPlan.findFirst({
      where: { name: plan.name, fiscalYear: plan.fiscalYear },
      select: { id: true },
    });

    if (existing) {
      planIdMap.set(key, existing.id);
      plansMatched++;
      // Ensure the state association exists for matched plans
      if (!dryRun) {
        await prisma.territoryPlanState.upsert({
          where: { planId_stateFips: { planId: existing.id, stateFips } },
          create: { planId: existing.id, stateFips },
          update: {},
        });
      }
      console.log(`  ✓ Matched existing plan: "${plan.name}" (${existing.id})`);
    } else if (!dryRun) {
      const created = await prisma.territoryPlan.create({
        data: {
          name: plan.name,
          fiscalYear: plan.fiscalYear,
          status: "planning",
          states: {
            create: { stateFips },
          },
        },
      });
      planIdMap.set(key, created.id);
      plansCreated++;
      console.log(`  + Created new plan: "${plan.name}" (${created.id})`);
    } else {
      console.log(`  [dry-run] Would create plan: "${plan.name}" (FY${plan.fiscalYear})`);
      planIdMap.set(key, "dry-run-id");
      plansCreated++;
    }
  }
  console.log(`\nPlans: ${plansMatched} matched, ${plansCreated} created\n`);

  // Step 5: Process each row — create district if needed, upsert targets, update pipeline
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const planKey = `${row.planName}|${row.fiscalYear}`;
    const planId = planIdMap.get(planKey);

    if (!planId) {
      errors.push(`Row ${i + 3}: No plan found for "${row.planName}" — skipping`);
      continue;
    }

    const resolvedStateAbbrev = stateAliases[row.stateAbbrev] || row.stateAbbrev;
    const stateFips = stateLookup.get(resolvedStateAbbrev);
    if (!stateFips) {
      errors.push(`Row ${i + 3}: Unknown state "${row.stateAbbrev}" for district "${row.accountName}" — skipping`);
      continue;
    }

    if (dryRun) {
      // In dry-run mode, just check existence and log what would happen
      const exists = await prisma.district.findUnique({
        where: { leaid: row.leaid },
        select: { leaid: true, owner: true },
      });

      if (!exists) {
        console.log(`  [dry-run] Would create district: ${row.leaid} "${row.accountName}"`);
        districtsCreated++;
      }
      if (row.owner && (!exists || !exists.owner)) {
        ownersSet++;
      }
      targetsUpserted++;
      if (row.fy27Pipeline > 0) pipelineUpdated++;
      continue;
    }

    try {
      // 5a. Ensure district exists
      const existingDistrict = await prisma.district.findUnique({
        where: { leaid: row.leaid },
        select: { leaid: true, owner: true },
      });

      if (!existingDistrict) {
        // Create minimal district record (include owner if available)
        await prisma.district.create({
          data: {
            leaid: row.leaid,
            name: row.accountName,
            stateFips,
            stateAbbrev: resolvedStateAbbrev,
            accountType: "district",
            owner: row.owner || undefined,
          },
        });
        districtsCreated++;
        if (row.owner) ownersSet++;
      } else if (row.owner && !existingDistrict.owner) {
        // 5b. Set district owner if CSV has one and existing district doesn't
        await prisma.district.update({
          where: { leaid: row.leaid },
          data: { owner: row.owner },
        });
        ownersSet++;
      }

      // 5c. Upsert plan-district link with targets
      await prisma.territoryPlanDistrict.upsert({
        where: {
          planId_districtLeaid: { planId, districtLeaid: row.leaid },
        },
        create: {
          planId,
          districtLeaid: row.leaid,
          renewalTarget: row.renewalTarget,
          expansionTarget: row.expansionTarget,
          winbackTarget: row.winbackTarget,
          newBusinessTarget: row.newBusinessTarget,
        },
        update: {
          renewalTarget: row.renewalTarget,
          expansionTarget: row.expansionTarget,
          winbackTarget: row.winbackTarget,
          newBusinessTarget: row.newBusinessTarget,
        },
      });
      targetsUpserted++;

      // 5d. Update FY27 pipeline on the district if CSV value > 0
      if (row.fy27Pipeline > 0) {
        await prisma.district.update({
          where: { leaid: row.leaid },
          data: { fy27OpenPipeline: row.fy27Pipeline },
        });
        pipelineUpdated++;
      }
    } catch (err) {
      errors.push(`Row ${i + 3}: DB error for "${row.accountName}" (${row.leaid}) — ${err instanceof Error ? err.message : String(err)}`);
    }

    // Progress log every 100 rows
    if ((i + 1) % 100 === 0) {
      console.log(`  Processed ${i + 1}/${rows.length} rows...`);
    }
  }

  // Step 6: Print summary
  console.log("\n═══════════════════════════════════════");
  console.log("  IMPORT SUMMARY");
  console.log("═══════════════════════════════════════");
  console.log(`  Plans matched:      ${plansMatched}`);
  console.log(`  Plans created:      ${plansCreated}`);
  console.log(`  Districts created:  ${districtsCreated}`);
  console.log(`  Targets upserted:   ${targetsUpserted}`);
  console.log(`  Pipeline updated:   ${pipelineUpdated}`);
  console.log(`  Owners set:         ${ownersSet}`);
  console.log(`  Errors:             ${errors.length}`);
  console.log("═══════════════════════════════════════\n");

  if (errors.length > 0) {
    console.log("Errors:");
    for (const err of errors) {
      console.log(`  ⚠ ${err}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
