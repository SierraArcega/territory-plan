/**
 * One-shot backfill: retroactively trim charters + District 75 from plans
 * that were auto-migrated via `expandPlanRollups` before the charter pseudo-
 * rollup existed. Those plans were silently expanded to 309 children when
 * the user really meant the 32 Geographic CSDs.
 *
 * Safety:
 *   - Only touches rows whose leaid is in the "should not have been added"
 *     set: the 276 charters (now under parent_leaid='3600000') plus
 *     District 75 (leaid='3600135').
 *   - Only removes rows whose `addedAt` is at or after the earliest
 *     `system_migration / rollup-expanded` activity on that plan for
 *     rollup 3620580. Rows that predate the auto-migrate (i.e., explicitly
 *     added by the user before the rollup was ever expanded) are preserved.
 *   - Logs a `system_migration / rollup-charter-cleanup` activity per plan
 *     with the removed leaid list for auditability.
 *   - Transactional per-plan: either the deletion + activity land together,
 *     or neither does.
 *
 * Idempotent: re-running finds no more rows to remove (the criteria no
 * longer match) and skips the activity log write.
 *
 * Run: `npx tsx prisma/backfill-trim-rollup-charter-expansion.ts`
 */
import prisma from "@/lib/prisma";

const NYC_DOE_LEAID = "3620580";
const CHARTER_PSEUDO_LEAID = "3600000";
const DISTRICT_75_LEAID = "3600135";

async function main() {
  // 1) List of leaids that should NOT be present if a plan was auto-migrated:
  //    the 276 charters (now parented under 3600000) + District 75.
  const chartersRows = await prisma.district.findMany({
    where: { parentLeaid: CHARTER_PSEUDO_LEAID },
    select: { leaid: true },
  });
  const removable = new Set<string>([
    ...chartersRows.map((r) => r.leaid),
    DISTRICT_75_LEAID,
  ]);
  console.log(`Removable leaid set size: ${removable.size} (${chartersRows.length} charters + 1 District 75)`);

  // 2) Find plans that have an expansion activity for NYC DOE + the earliest one
  const activities = await prisma.$queryRaw<
    { planId: string; firstExpansion: Date }[]
  >`
    SELECT ap.plan_id AS "planId",
           MIN(a.created_at) AS "firstExpansion"
    FROM activities a
    JOIN activity_plans ap ON ap.activity_id = a.id
    WHERE a.type = 'system_migration'
      AND a.metadata->>'subtype' = 'rollup-expanded'
      AND a.metadata->>'rollupLeaid' = ${NYC_DOE_LEAID}
    GROUP BY ap.plan_id;
  `;
  console.log(`Found ${activities.length} plan(s) with rollup-expanded history for ${NYC_DOE_LEAID}`);

  if (activities.length === 0) {
    console.log("Nothing to do. Exiting.");
    return;
  }

  let totalRemoved = 0;
  let plansTouched = 0;

  for (const { planId, firstExpansion } of activities) {
    // A 10-second grace window handles clock skew / tx timestamps
    const windowStart = new Date(firstExpansion.getTime() - 10_000);

    await prisma.$transaction(async (tx) => {
      // Collect the rows this run would delete (for the activity log)
      const candidates = await tx.territoryPlanDistrict.findMany({
        where: {
          planId,
          districtLeaid: { in: Array.from(removable) },
          addedAt: { gte: windowStart },
        },
        select: { districtLeaid: true },
      });

      if (candidates.length === 0) {
        return;
      }

      const leaids = candidates.map((c) => c.districtLeaid);
      const deleted = await tx.territoryPlanDistrict.deleteMany({
        where: {
          planId,
          districtLeaid: { in: leaids },
        },
      });

      await tx.activity.create({
        data: {
          type: "system_migration",
          title: "Rollup charter cleanup — removed 276+ charters + D75",
          status: "completed",
          source: "system",
          createdByUserId: null,
          metadata: {
            subtype: "rollup-charter-cleanup",
            rollupLeaid: NYC_DOE_LEAID,
            removedLeaids: leaids,
            removedCount: deleted.count,
            windowStart: windowStart.toISOString(),
            rationale:
              "charters + District 75 were silently added by an earlier rollup expansion; post-split, they no longer belong under NYC DOE's rollup",
          },
          plans: { create: { planId } },
        },
      });

      totalRemoved += deleted.count;
      plansTouched += 1;
      console.log(`  plan=${planId} removed=${deleted.count}`);
    });
  }

  console.log(`\nCleanup complete. ${plansTouched} plan(s) touched, ${totalRemoved} row(s) removed total.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
