import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Returns the distinct planIds of every territory plan that contains any of the
 * given district leaids. No owner/status/fiscal-year filtering — auto-linking
 * attaches the activity to all of them.
 *
 * Accepts an optional transaction client so it can run inside a $transaction.
 */
export async function findPlanIdsForDistricts(
  leaids: string[],
  db: Db = prisma,
): Promise<string[]> {
  if (leaids.length === 0) return [];
  const rows = await db.territoryPlanDistrict.findMany({
    where: { districtLeaid: { in: leaids } },
    select: { planId: true },
    distinct: ["planId"],
  });
  return rows.map((r) => r.planId);
}
