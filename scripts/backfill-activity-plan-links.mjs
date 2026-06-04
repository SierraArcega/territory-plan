/**
 * Backfill: auto-link existing activities to territory plans via their districts.
 *
 * The live feature (see Docs/superpowers/specs/2026-05-28-auto-link-activities-
 * to-plans-via-district-design.md) attaches an activity to every plan that
 * contains any of its districts, going forward. This one-time backfill applies
 * the same rule to activities that already exist.
 *
 * Scope matches the live feature exactly: ALL plans (any owner / status /
 * fiscal year). It is ADDITIVE and IDEMPOTENT — it only inserts missing
 * ActivityPlan rows, never removes existing links.
 *
 * DRY-RUN BY DEFAULT (read-only). Reports how many activities and new links
 * would be created, broken down by plan owner. Pass --apply to actually write.
 *
 *   Dry run (read-only):   node --env-file=.env scripts/backfill-activity-plan-links.mjs
 *   Apply for real:        node --env-file=.env scripts/backfill-activity-plan-links.mjs --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const log = (...a) => console.log(...a);

async function main() {
  log(
    `\n=== Activity→Plan backfill via district  (${
      APPLY ? "APPLY — WILL WRITE" : "DRY RUN — read-only"
    }) ===\n`,
  );

  // 1. Every district attached to an activity.
  const activityDistricts = await prisma.activityDistrict.findMany({
    select: { activityId: true, districtLeaid: true },
  });
  log(`Activity↔district rows:            ${activityDistricts.length}`);

  // 2. Every plan membership, keyed by district → planIds.
  const planDistricts = await prisma.territoryPlanDistrict.findMany({
    select: { planId: true, districtLeaid: true },
  });
  const plansByDistrict = new Map(); // leaid -> Set(planId)
  for (const { planId, districtLeaid } of planDistricts) {
    if (!plansByDistrict.has(districtLeaid)) plansByDistrict.set(districtLeaid, new Set());
    plansByDistrict.get(districtLeaid).add(planId);
  }
  log(`District→plan memberships:         ${planDistricts.length}`);

  // 3. Existing activity↔plan links (so we only count what's missing).
  const existingLinks = await prisma.activityPlan.findMany({
    select: { activityId: true, planId: true },
  });
  const existing = new Set(existingLinks.map((l) => `${l.activityId}|${l.planId}`));
  log(`Existing activity↔plan links:      ${existingLinks.length}\n`);

  // 4. Compute the set of NEW (activityId, planId) links the rule implies.
  const newLinks = new Set(); // "activityId|planId"
  const activitiesTouched = new Set();
  for (const { activityId, districtLeaid } of activityDistricts) {
    const planIds = plansByDistrict.get(districtLeaid);
    if (!planIds) continue;
    for (const planId of planIds) {
      const key = `${activityId}|${planId}`;
      if (existing.has(key) || newLinks.has(key)) continue;
      newLinks.add(key);
      activitiesTouched.add(activityId);
    }
  }

  log(`Activities that would gain links:  ${activitiesTouched.size}`);
  log(`New activity↔plan links to insert: ${newLinks.size}\n`);

  if (newLinks.size === 0) {
    log("Nothing to backfill. ✅");
    return;
  }

  // 5. Breakdown by plan owner (so "any plan, anyone's" blast radius is visible).
  const linkRows = [...newLinks].map((k) => {
    const [activityId, planId] = k.split("|");
    return { activityId, planId };
  });
  const planIdsInvolved = [...new Set(linkRows.map((r) => r.planId))];
  const plans = await prisma.territoryPlan.findMany({
    where: { id: { in: planIdsInvolved } },
    select: {
      id: true,
      name: true,
      status: true,
      ownerUser: { select: { fullName: true } },
    },
  });
  const planMeta = new Map(plans.map((p) => [p.id, p]));

  const byOwner = new Map(); // ownerName -> link count
  for (const { planId } of linkRows) {
    const owner = planMeta.get(planId)?.ownerUser?.fullName || "(no owner)";
    byOwner.set(owner, (byOwner.get(owner) || 0) + 1);
  }
  log("New links by plan owner:");
  for (const [owner, count] of [...byOwner.entries()].sort((a, b) => b[1] - a[1])) {
    log(`  ${String(count).padStart(6)}  ${owner}`);
  }
  log("");

  if (!APPLY) {
    log("Dry run complete — no rows written. Re-run with --apply to write.");
    return;
  }

  // 6. Apply: insert missing links in batches (idempotent via skipDuplicates).
  const BATCH = 1000;
  let written = 0;
  for (let i = 0; i < linkRows.length; i += BATCH) {
    const batch = linkRows.slice(i, i + BATCH);
    const res = await prisma.activityPlan.createMany({ data: batch, skipDuplicates: true });
    written += res.count;
    log(`  inserted ${written}/${linkRows.length}…`);
  }
  log(`\nDone. Inserted ${written} new activity↔plan links. ✅`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
