/**
 * Apply state-level churn penalty to district ICP scores.
 *
 * Computes churn from Fullmind + Elevate K12 vendor_financials
 * (FY24-25 → FY26-27), blends customer churn rate (30%) with
 * revenue churn rate (70%), and applies a 0 to -15 point penalty
 * on each district's state_score. Recomputes composite + tier.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const prisma = new PrismaClient();

// ── Config ──────────────────────────────────────────────────────────────────

const CUSTOMER_CHURN_WEIGHT = 0.3;
const REVENUE_CHURN_WEIGHT = 0.7;
const MAX_PENALTY = 15; // max points subtracted from state_score
const MIN_PRIOR_CUSTOMERS = 3; // skip states with too few data points

// Composite weights (must match original methodology)
const COMPOSITE_WEIGHTS = { fit: 0.30, value: 0.25, readiness: 0.25, state: 0.20 };

// Tier rules (must match original methodology)
function assignTier(fit, value, composite) {
  if (fit >= 60 && value >= 60 && composite >= 60) return "Tier 1";
  if (composite >= 40) return "Tier 2";
  if (composite >= 25) return "Tier 3";
  return "Tier 4";
}

// ── Compute state churn from DB ─────────────────────────────────────────────

async function computeStateChurn() {
  const rows = await prisma.$queryRaw`
    WITH fy_prior AS (
      SELECT d.state_abbrev, vf.leaid, SUM(vf.total_revenue) AS rev
      FROM vendor_financials vf JOIN districts d ON d.leaid = vf.leaid
      WHERE vf.vendor IN ('fullmind', 'elevate')
        AND vf.fiscal_year IN ('FY24','FY25') AND vf.total_revenue > 0
      GROUP BY d.state_abbrev, vf.leaid
    ),
    fy_current AS (
      SELECT d.state_abbrev, vf.leaid, SUM(vf.total_revenue) AS rev
      FROM vendor_financials vf JOIN districts d ON d.leaid = vf.leaid
      WHERE vf.vendor IN ('fullmind', 'elevate')
        AND vf.fiscal_year IN ('FY26','FY27') AND vf.total_revenue > 0
      GROUP BY d.state_abbrev, vf.leaid
    )
    SELECT
      a.state_abbrev,
      COUNT(DISTINCT a.leaid)::int AS prior_customers,
      COUNT(DISTINCT b.leaid)::int AS retained_customers,
      ROUND(SUM(a.rev)::numeric, 0)::bigint AS prior_rev,
      ROUND(COALESCE(SUM(b.rev), 0)::numeric, 0)::bigint AS retained_rev
    FROM fy_prior a
    LEFT JOIN fy_current b ON a.state_abbrev = b.state_abbrev AND a.leaid = b.leaid
    GROUP BY a.state_abbrev
  `;

  const churnMap = {};
  for (const row of rows) {
    const prior = Number(row.prior_customers);
    if (prior < MIN_PRIOR_CUSTOMERS) continue;

    const retained = Number(row.retained_customers);
    const priorRev = Number(row.prior_rev);
    const retainedRev = Number(row.retained_rev);

    const customerChurnRate = (prior - retained) / prior;
    const revenueChurnRate = priorRev > 0 ? (priorRev - retainedRev) / priorRev : 0;

    // Blended churn rate (0-1)
    const blended = customerChurnRate * CUSTOMER_CHURN_WEIGHT + revenueChurnRate * REVENUE_CHURN_WEIGHT;

    // Penalty: 0 at 0% churn, MAX_PENALTY at 100% churn
    const penalty = Math.round(blended * MAX_PENALTY);

    churnMap[row.state_abbrev] = {
      priorCustomers: prior,
      retainedCustomers: retained,
      customerChurnPct: Math.round(customerChurnRate * 1000) / 10,
      revenueChurnPct: Math.round(revenueChurnRate * 1000) / 10,
      blendedChurnPct: Math.round(blended * 1000) / 10,
      penalty,
    };
  }
  return churnMap;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Computing state churn from Fullmind + Elevate K12 data...\n");
  const churnMap = await computeStateChurn();

  // Print churn table
  const sorted = Object.entries(churnMap).sort((a, b) => b[1].penalty - a[1].penalty);
  console.log("State  | Prior | Retained | Cust Churn | Rev Churn | Blended | Penalty");
  console.log("-------|-------|----------|------------|-----------|---------|--------");
  for (const [state, c] of sorted) {
    console.log(
      `${state.padEnd(6)} | ${String(c.priorCustomers).padStart(5)} | ${String(c.retainedCustomers).padStart(8)} | ${String(c.customerChurnPct + "%").padStart(10)} | ${String(c.revenueChurnPct + "%").padStart(9)} | ${String(c.blendedChurnPct + "%").padStart(7)} | -${c.penalty}`
    );
  }

  // Load existing scores
  const scoresPath = join(ROOT, "public", "district_scores.json");
  const districts = JSON.parse(readFileSync(scoresPath, "utf-8"));
  console.log(`\nLoaded ${districts.length} districts from ${scoresPath}`);

  // Apply penalties
  let penalized = 0;
  let tierChanges = 0;
  for (const d of districts) {
    const churn = churnMap[d.state];
    if (!churn || churn.penalty === 0) continue;

    const oldStateScore = d.state_score;
    const oldComposite = d.composite_score;
    const oldTier = d.tier;

    // Apply penalty (floor at 0)
    d.state_score = Math.max(0, d.state_score - churn.penalty);

    // Update state_details
    const details = typeof d.state_details === "string" ? JSON.parse(d.state_details) : d.state_details;
    details.churn_penalty = -churn.penalty;
    details.customer_churn_pct = churn.customerChurnPct;
    details.revenue_churn_pct = churn.revenueChurnPct;
    d.state_details = details;

    // Recompute composite
    d.composite_score = Math.round(
      d.fit_score * COMPOSITE_WEIGHTS.fit +
      d.value_score * COMPOSITE_WEIGHTS.value +
      d.readiness_score * COMPOSITE_WEIGHTS.readiness +
      d.state_score * COMPOSITE_WEIGHTS.state
    );

    // Reassign tier
    d.tier = assignTier(d.fit_score, d.value_score, d.composite_score);

    penalized++;
    if (d.tier !== oldTier) tierChanges++;
  }

  console.log(`\nApplied churn penalty to ${penalized} districts across ${Object.keys(churnMap).length} states`);
  console.log(`Tier changes: ${tierChanges} districts moved to a lower tier`);

  // Tier summary
  const tierCounts = {};
  for (const d of districts) {
    tierCounts[d.tier] = (tierCounts[d.tier] || 0) + 1;
  }
  console.log("\nUpdated tier distribution:");
  for (const tier of ["Tier 1", "Tier 2", "Tier 3", "Tier 4"]) {
    console.log(`  ${tier}: ${tierCounts[tier] || 0}`);
  }

  // Write updated scores
  writeFileSync(scoresPath, JSON.stringify(districts));
  console.log(`\nWrote updated scores to ${scoresPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
