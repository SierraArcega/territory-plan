import prisma from "@/lib/prisma";

export interface UnmatchedSummary {
  count: number;
  revenue: number;
}

/**
 * Count + sum-revenue of unresolved unmatched_opportunities, grouped by sales rep.
 * Joins to the opportunities table by id to pick up the rep email and total_revenue
 * (unmatched_opportunities itself doesn't carry rep attribution).
 *
 * Returns an empty Map for an empty input list — never queries the DB in that case.
 *
 * Used by the leaderboard to surface a per-rep badge linking to the admin
 * unmatched-resolution queue. See:
 * Docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md
 */
export async function getUnmatchedCountsByRep(
  repEmails: string[]
): Promise<Map<string, UnmatchedSummary>> {
  if (repEmails.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    { sales_rep_email: string; unmatched_count: number; unmatched_revenue: number }[]
  >`
    SELECT
      o.sales_rep_email,
      COUNT(*)::int AS unmatched_count,
      COALESCE(SUM(o.total_revenue), 0)::float AS unmatched_revenue
    FROM unmatched_opportunities u
    JOIN opportunities o ON o.id = u.id
    WHERE u.resolved = false
      AND o.sales_rep_email = ANY(${repEmails})
    GROUP BY o.sales_rep_email
  `;

  const map = new Map<string, UnmatchedSummary>();
  for (const row of rows) {
    map.set(row.sales_rep_email, {
      count: Number(row.unmatched_count),
      revenue: Number(row.unmatched_revenue),
    });
  }
  return map;
}
