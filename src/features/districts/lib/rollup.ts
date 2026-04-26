import prisma from "@/lib/prisma";

/**
 * A "rollup" district has at least one other district pointing to it via
 * parent_leaid. Rollups have zero directly-attached schools; their children
 * hold the actual school-level data.
 */
export async function isRollup(leaid: string): Promise<boolean> {
  const count = await prisma.district.count({ where: { parentLeaid: leaid } });
  return count > 0;
}

/**
 * Returns the leaids of all districts whose parent_leaid equals the given
 * rollup leaid. Empty array for non-rollups.
 */
export async function getChildren(rollupLeaid: string): Promise<string[]> {
  const rows = await prisma.district.findMany({
    where: { parentLeaid: rollupLeaid },
    select: { leaid: true },
    orderBy: { leaid: "asc" },
  });
  return rows.map((r) => r.leaid);
}

/**
 * Given a list of leaids, returns just the ones that are rollups (have
 * children). Useful for pre-checks on plan-level endpoints that receive a
 * mixed list of potentially-rollup districts.
 */
export async function getRollupLeaids(leaids: string[]): Promise<string[]> {
  if (leaids.length === 0) return [];
  const rows = await prisma.district.findMany({
    where: { parentLeaid: { in: leaids } },
    select: { parentLeaid: true },
    distinct: ["parentLeaid"],
  });
  return rows
    .map((r) => r.parentLeaid)
    .filter((l): l is string => l !== null);
}
