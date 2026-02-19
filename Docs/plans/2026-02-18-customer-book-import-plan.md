# Customer Book CSV Import — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a TypeScript seed script that imports ~970 districts from a Customer Book CSV into the database — creating missing districts, matching/creating territory plans, setting targets, and updating FY27 pipeline.

**Architecture:** Single script (`scripts/import-customer-book.ts`) using Prisma client directly. Parses CSV line-by-line with a quoted-field-aware splitter (no external CSV library needed). Processes in three passes: (1) build state lookup, (2) create/match plans, (3) upsert districts + targets. Includes `--dry-run` flag for safe preview.

**Tech Stack:** TypeScript, Prisma Client, Node.js `fs` module, `tsx` runner

---

### Task 1: Create the import script with CSV parsing utilities

**Files:**
- Create: `scripts/import-customer-book.ts`

**Step 1: Write the script with CSV parsing, dollar parsing, and state lookup**

```typescript
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
import prisma from "../src/lib/prisma";

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

    rows.push({
      accountName: fields[0]?.trim() || "",
      leaid,
      stateAbbrev: fields[2]?.trim() || "",
      planName: fields[3]?.trim() || "",
      fiscalYear: parseInt(fields[4]?.trim() || "0", 10),
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
    const stateFips = stateLookup.get(plan.stateAbbrev);
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

    const stateFips = stateLookup.get(row.stateAbbrev);
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

    // 5a. Ensure district exists
    const existingDistrict = await prisma.district.findUnique({
      where: { leaid: row.leaid },
      select: { leaid: true, owner: true },
    });

    if (!existingDistrict) {
      // Create minimal district record
      await prisma.district.create({
        data: {
          leaid: row.leaid,
          name: row.accountName,
          stateFips,
          stateAbbrev: row.stateAbbrev,
          accountType: "district",
        },
      });
      districtsCreated++;
    }

    // 5b. Set district owner if CSV has one and district doesn't already have one
    if (row.owner && (!existingDistrict || !existingDistrict.owner)) {
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
```

**Step 2: Copy the CSV to the project's data directory**

```bash
mkdir -p data
cp "/Users/sierraholstad/Downloads/Customer Book Consolidation - Combined Targets + Pipeline (1).csv" data/customer-book.csv
```

**Step 3: Run in dry-run mode to verify parsing**

```bash
npx tsx scripts/import-customer-book.ts --dry-run
```

Expected: Summary showing ~970 rows parsed, plans identified, districts that would be created. No database changes.

**Step 4: Run the live import**

```bash
npx tsx scripts/import-customer-book.ts
```

Expected: All districts, plans, targets, and pipeline values created/updated in the database.

**Step 5: Commit**

```bash
git add scripts/import-customer-book.ts data/customer-book.csv
git commit -m "feat(etl): import customer book CSV — plans, targets, pipeline"
```

---

### Task 2: Verify in the app

**Step 1: Start the dev server and check the results**

```bash
npm run dev
```

- Open the Explore table — new districts should appear
- Open a territory plan (e.g., "Texas 2027") — districts should be listed with targets
- Check a district's FY27 pipeline value in the side panel

**Step 2: Spot-check a few rows against the CSV**

Pick 3-5 rows from the CSV and verify:
- District exists with correct name and state
- District is in the correct plan
- Targets match the CSV values
- FY27 pipeline matches (if > 0)
