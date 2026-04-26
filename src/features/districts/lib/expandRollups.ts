import prisma from "@/lib/prisma";
import { getChildren, getRollupLeaids } from "./rollup";

export interface ExpandResult {
  rollupsExpanded: string[];
  expandedCount: number;
}

/**
 * Auto-migrate any rollup leaids in a plan to their children.
 *
 *   1. Finds rollup leaids currently in the plan's districts.
 *   2. Replaces each rollup row with rows for its children (dedup).
 *   3. Writes one activity-log entry per expansion for traceability.
 *
 * Called on every plan GET as well as explicit PATCH /expand-rollup.
 *
 * Hot-path shape: the no-rollup case costs exactly one read-only query and
 * opens no transaction. We only enter `$transaction` when there is actual
 * work to do.
 *
 * Concurrency: under the transaction we take a `SELECT ... FOR UPDATE` lock
 * on the plan's district rows. If two requests race, the second blocks until
 * the first commits, then re-reads state under the lock and sees the rollup
 * is gone, so it exits zero-op. Without the lock both requests would double-
 * write an activity-log entry (the DB-level `skipDuplicates` silently
 * drops the second createMany, but the activity row still falsely claims
 * `insertedCount > 0`).
 *
 * Note: `getChildren` and `getRollupLeaids` use the `prisma` singleton, not
 * `tx`. The `parent_leaid` data they read is stable within a request, so the
 * minor isolation gap is acceptable here.
 */
export async function expandPlanRollups(
  planId: string,
  actorUserId: string | null
): Promise<ExpandResult> {
  // Read-only pre-check (no transaction needed).
  // Plans without rollups — the common case — exit here after 1 round-trip.
  const existing = await prisma.territoryPlanDistrict.findMany({
    where: { planId },
    select: { districtLeaid: true },
  });
  const existingLeaids = existing.map((r) => r.districtLeaid);
  const rollupsPresent = await getRollupLeaids(existingLeaids);
  if (rollupsPresent.length === 0) {
    return { rollupsExpanded: [], expandedCount: 0 };
  }

  // Real work — open the transaction with a row-level lock.
  return prisma.$transaction(async (tx) => {
    // Lock this plan's district rows against concurrent modification.
    // If another request is already expanding, we wait here; by the time
    // we get the lock the rollup is gone, so the re-check below exits zero-op.
    await tx.$executeRaw`
      SELECT 1 FROM territory_plan_districts
      WHERE plan_id = ${planId}
      FOR UPDATE
    `;

    // Re-read under lock — state may have changed while we waited.
    const lockedExisting = await tx.territoryPlanDistrict.findMany({
      where: { planId },
      select: { districtLeaid: true },
    });
    const lockedLeaids = lockedExisting.map((r) => r.districtLeaid);
    const lockedRollups = await getRollupLeaids(lockedLeaids);
    if (lockedRollups.length === 0) {
      // Another request got there first — exit cleanly.
      return { rollupsExpanded: [], expandedCount: 0 };
    }

    let expandedCount = 0;
    const expanded: string[] = [];
    const existingSet = new Set(lockedLeaids);

    for (const rollupLeaid of lockedRollups) {
      const children = await getChildren(rollupLeaid);
      const toInsert = children.filter((c) => !existingSet.has(c));

      // Remove the rollup row
      await tx.territoryPlanDistrict.deleteMany({
        where: { planId, districtLeaid: rollupLeaid },
      });

      // Insert children (dedup via createMany + skipDuplicates)
      if (toInsert.length > 0) {
        await tx.territoryPlanDistrict.createMany({
          data: toInsert.map((leaid) => ({ planId, districtLeaid: leaid })),
          skipDuplicates: true,
        });
      }

      // Activity log entry
      await tx.activity.create({
        data: {
          type: "system_migration",
          title: "Rollup district auto-expanded",
          status: "completed",
          source: "system",
          createdByUserId: actorUserId,
          metadata: {
            subtype: "rollup-expanded",
            rollupLeaid,
            childLeaids: children,
            childCount: children.length,
            insertedCount: toInsert.length,
            dedupedCount: children.length - toInsert.length,
          },
          plans: { create: { planId } },
        },
      });

      expandedCount += toInsert.length;
      expanded.push(rollupLeaid);
    }

    return { rollupsExpanded: expanded, expandedCount };
  });
}
