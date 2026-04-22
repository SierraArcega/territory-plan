import prisma from "@/lib/prisma";
import { getChildren, getRollupLeaids } from "./rollup";

export interface ExpandResult {
  rollupsExpanded: string[];
  expandedCount: number;
}

/**
 * Within a single transaction:
 *   1. Finds rollup leaids currently in the plan's districts.
 *   2. Replaces each rollup row with rows for its children (dedup).
 *   3. Writes one activity-log entry per expansion for traceability.
 *
 * Idempotent: a plan whose rollups have all been expanded returns zero-op.
 * Called on every plan GET as well as explicit PATCH /expand-rollup.
 *
 * Note: `getChildren` and `getRollupLeaids` use the `prisma` singleton, not
 * `tx`. The `parent_leaid` data they read is stable within a request, so the
 * minor isolation gap is acceptable here.
 */
export async function expandPlanRollups(
  planId: string,
  actorUserId: string | null
): Promise<ExpandResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.territoryPlanDistrict.findMany({
      where: { planId },
      select: { districtLeaid: true },
    });
    const existingLeaids = existing.map((r) => r.districtLeaid);
    const rollupsPresent = await getRollupLeaids(existingLeaids);
    if (rollupsPresent.length === 0) {
      return { rollupsExpanded: [], expandedCount: 0 };
    }

    let expandedCount = 0;
    const expanded: string[] = [];

    for (const rollupLeaid of rollupsPresent) {
      const children = await getChildren(rollupLeaid);
      const existingSet = new Set(existingLeaids);
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
