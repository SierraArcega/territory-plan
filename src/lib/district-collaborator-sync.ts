import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { RESOLVE_OPP_REP, LIVE_STAGE_REGEX } from "@/lib/opp-rep-sql";

/**
 * Candidate auto-collaborators per district:
 *  - non-owner reps with a live (numbered-stage) open opp on the district, and
 *  - non-owner owners of a territory plan that targets the district
 *    (a territory_plan_districts row with a non-null target).
 * The district's current owner is always excluded (owner != collaborator).
 */
const VALID_CANDIDATES = Prisma.sql`
  WITH candidates AS (
    SELECT o.district_lea_id AS lea, ${RESOLVE_OPP_REP} AS uid
    FROM opportunities o
    WHERE o.stage ~ ${LIVE_STAGE_REGEX} AND o.district_lea_id IS NOT NULL
    UNION
    SELECT tpd.district_leaid AS lea, tp.owner_id AS uid
    FROM territory_plan_districts tpd
    JOIN territory_plans tp ON tp.id = tpd.plan_id
    WHERE tp.owner_id IS NOT NULL
      AND (tpd.renewal_target IS NOT NULL OR tpd.winback_target IS NOT NULL
           OR tpd.expansion_target IS NOT NULL OR tpd.new_business_target IS NOT NULL)
  ),
  valid AS (
    SELECT DISTINCT c.lea, c.uid
    FROM candidates c
    JOIN districts d ON d.leaid = c.lea
    WHERE c.uid IS NOT NULL
      AND (d.owner_id IS NULL OR d.owner_id <> c.uid)
  )
`;

/**
 * Reconcile auto-managed district collaborators.
 *
 * - Adds candidate (district, user) pairs as source='auto' (no-op if the row
 *   already exists, so manually-added collaborators are never downgraded).
 * - Removes source='auto' rows that are no longer candidates (opp/target gone)
 *   or whose user has become the district owner.
 * - Never touches source='manual' rows.
 *
 * Runs in the hourly cron after syncDistrictOwners() so owner exclusion is
 * computed against fresh owners. Idempotent.
 */
export async function syncDistrictCollaborators(): Promise<{
  added: number;
  removed: number;
}> {
  const [removed, added] = await prisma.$transaction([
    prisma.$executeRaw`
      ${VALID_CANDIDATES}
      DELETE FROM district_collaborators dc
      WHERE dc.source = 'auto'
        AND NOT EXISTS (
          SELECT 1 FROM valid v
          WHERE v.lea = dc.district_leaid AND v.uid = dc.user_id
        )
    `,
    prisma.$executeRaw`
      ${VALID_CANDIDATES}
      INSERT INTO district_collaborators (district_leaid, user_id, source)
      SELECT v.lea, v.uid, 'auto' FROM valid v
      ON CONFLICT (district_leaid, user_id) DO NOTHING
    `,
  ]);

  return { added, removed };
}
