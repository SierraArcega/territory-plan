/**
 * Backfill ICP scores from district_scores.json into the database.
 * Updates districts table with per-district scores/tier,
 * and states table with aggregated state-level metrics.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const prisma = new PrismaClient();

async function main() {
  const scoresPath = join(ROOT, "public", "district_scores.json");
  const districts = JSON.parse(readFileSync(scoresPath, "utf-8"));
  console.log(`Loaded ${districts.length} districts from ${scoresPath}`);

  // ── Batch update districts ──────────────────────────────────────────────

  const BATCH_SIZE = 500;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < districts.length; i += BATCH_SIZE) {
    const batch = districts.slice(i, i + BATCH_SIZE);

    // Build a single UPDATE with CASE expressions for each column
    const leaids = batch.map((d) => d.leaid);
    const composites = batch.map((d) => d.composite_score != null ? Math.round(d.composite_score) : null);
    const fits = batch.map((d) => d.fit_score != null ? Math.round(d.fit_score) : null);
    const values = batch.map((d) => d.value_score != null ? Math.round(d.value_score) : null);
    const readiness = batch.map((d) => d.readiness_score != null ? Math.round(d.readiness_score) : null);
    const states = batch.map((d) => d.state_score != null ? Math.round(d.state_score) : null);
    const tiers = batch.map((d) => d.tier ?? null);

    const result = await prisma.$executeRaw`
      UPDATE districts SET
        icp_composite_score = data.composite,
        icp_fit_score = data.fit,
        icp_value_score = data.value,
        icp_readiness_score = data.readiness,
        icp_state_score = data.state_sc,
        icp_tier = data.tier
      FROM (
        SELECT
          unnest(${leaids}::text[]) AS leaid,
          unnest(${composites}::int[]) AS composite,
          unnest(${fits}::int[]) AS fit,
          unnest(${values}::int[]) AS value,
          unnest(${readiness}::int[]) AS readiness,
          unnest(${states}::int[]) AS state_sc,
          unnest(${tiers}::text[]) AS tier
      ) AS data
      WHERE districts.leaid = data.leaid
    `;

    updated += result;
    if ((i / BATCH_SIZE) % 5 === 0) {
      console.log(`  ... ${updated} districts updated (batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(districts.length / BATCH_SIZE)})`);
    }
  }

  console.log(`\nUpdated ${updated} districts with ICP scores`);

  // ── Aggregate state-level metrics ───────────────────────────────────────

  console.log("\nComputing state aggregates...");

  const stateAggs = await prisma.$queryRaw`
    SELECT
      state_abbrev,
      ROUND(AVG(icp_composite_score)::numeric, 1)::real AS avg_score,
      COUNT(*) FILTER (WHERE icp_tier = 'Tier 1')::int AS t1_count,
      COUNT(*) FILTER (WHERE icp_tier = 'Tier 2')::int AS t2_count
    FROM districts
    WHERE icp_composite_score IS NOT NULL
    GROUP BY state_abbrev
  `;

  // Get churn penalties from the scored data
  const churnByState = {};
  for (const d of districts) {
    if (!churnByState[d.state]) {
      const details = typeof d.state_details === "string" ? JSON.parse(d.state_details) : d.state_details;
      churnByState[d.state] = details?.churn_penalty ?? 0;
    }
  }

  let statesUpdated = 0;
  for (const row of stateAggs) {
    const penalty = churnByState[row.state_abbrev] ?? 0;
    await prisma.$executeRaw`
      UPDATE states SET
        icp_avg_score = ${row.avg_score},
        icp_t1_count = ${row.t1_count},
        icp_t2_count = ${row.t2_count},
        icp_churn_penalty = ${Math.abs(penalty)}
      WHERE abbrev = ${row.state_abbrev}
    `;
    statesUpdated++;
  }

  console.log(`Updated ${statesUpdated} states with ICP aggregates`);

  // Print top states
  console.log("\nTop states by T1 count:");
  const sorted = [...stateAggs].sort((a, b) => b.t1_count - a.t1_count).slice(0, 10);
  for (const s of sorted) {
    const penalty = churnByState[s.state_abbrev] ?? 0;
    console.log(`  ${s.state_abbrev}: ${s.t1_count} T1, ${s.t2_count} T2, avg ${s.avg_score}, churn penalty ${penalty}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
