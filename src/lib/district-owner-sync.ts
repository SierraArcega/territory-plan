import prisma from "@/lib/prisma";
import { RESOLVE_OPP_REP, LIVE_STAGE_REGEX } from "@/lib/opp-rep-sql";

/**
 * Auto-assign district owners from live opportunity pipeline.
 *
 * Rule (see docs / chore(scripts) territory-owner tooling):
 * - "Open opp" = a numbered sales-pipeline stage ("0 - Meeting Booked" ..
 *   "5 - Commitment"). Post-sale fulfillment stages and Closed Won/Lost are
 *   excluded.
 * - Rep resolution: a valid `sales_rep_id` wins; otherwise fall back to matching
 *   `sales_rep_email` -> user_profiles (handles orphan rep IDs).
 * - Owner = the rep with the largest summed open pipeline for the district
 *   (auto-resolves multi-rep conflicts; rep id breaks exact ties for determinism).
 * - FILL-EMPTY ONLY: never overwrites an existing owner. Manual assignments and
 *   deliberate clears are preserved; only districts with a NULL owner are filled.
 *
 * Idempotent: running repeatedly only fills districts that are still unowned.
 */
export async function syncDistrictOwners(): Promise<{
  filled: number;
  districts: { leaid: string; ownerId: string }[];
}> {
  const rows = await prisma.$queryRaw<{ leaid: string; owner_id: string }[]>`
    WITH live AS (
      SELECT
        o.district_lea_id AS lea,
        ${RESOLVE_OPP_REP} AS rep,
        COALESCE(o.net_booking_amount, 0) AS amt
      FROM opportunities o
      WHERE o.stage ~ ${LIVE_STAGE_REGEX}
        AND o.district_lea_id IS NOT NULL
    ),
    by_rep AS (
      SELECT lea, rep, SUM(amt) AS pipeline
      FROM live
      WHERE rep IS NOT NULL
      GROUP BY lea, rep
    ),
    winner AS (
      SELECT DISTINCT ON (lea) lea, rep
      FROM by_rep
      ORDER BY lea, pipeline DESC, rep
    )
    UPDATE districts d
    SET owner_id = w.rep
    FROM winner w
    WHERE d.leaid = w.lea
      AND d.owner_id IS NULL
    RETURNING d.leaid AS leaid, w.rep AS owner_id
  `;

  return {
    filled: rows.length,
    districts: rows.map((r) => ({ leaid: r.leaid, ownerId: r.owner_id })),
  };
}
