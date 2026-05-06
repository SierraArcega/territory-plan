import { Pool } from "pg";

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

type Querier = (
  sql: string,
  params?: unknown[]
) => Promise<{ rows: unknown[] }>;

/**
 * Single set-based UPDATE that derives district_pipeline_state for every RFP
 * with a resolved leaid.
 *
 * Priority order: active > recently_won (<=18mo) > recently_lost (<=12mo) > cold
 *
 * Closed-won/closed-lost stage detection mirrors the
 * district_opportunity_actuals matview's canonical predicates.
 *
 * RFPs with leaid = NULL are not touched (neither state nor signals_refreshed_at).
 */
const REFRESH_SQL = `
WITH opp_state AS (
  SELECT
    o.district_lea_id AS leaid,
    bool_or(
      lower(o.stage) NOT IN (
        'closed won', 'closed lost', 'active', 'position purchased',
        'requisition received', 'return position pending',
        'complete - full length', 'complete - early cancellation',
        'position cancelled'
      )
      AND o.stage IS NOT NULL
    ) AS has_active,
    max(o.close_date) FILTER (
      WHERE lower(o.stage) IN (
        'closed won', 'active', 'position purchased',
        'requisition received', 'return position pending'
      )
    ) AS last_won,
    max(o.close_date) FILTER (
      WHERE lower(o.stage) = 'closed lost'
    ) AS last_lost
  FROM opportunities o
  WHERE o.district_lea_id IS NOT NULL
  GROUP BY o.district_lea_id
)
UPDATE rfps r
SET
  district_pipeline_state = CASE
    WHEN COALESCE(s.has_active, false)               THEN 'active'
    WHEN s.last_won  >= now() - interval '18 months' THEN 'recently_won'
    WHEN s.last_lost >= now() - interval '12 months' THEN 'recently_lost'
    ELSE 'cold'
  END,
  signals_refreshed_at = now()
FROM districts d
LEFT JOIN opp_state s ON s.leaid = d.leaid
WHERE r.leaid IS NOT NULL
  AND r.leaid = d.leaid;
`;

/**
 * Refresh district_pipeline_state on every RFP with a resolved leaid.
 *
 * @param queryFn Optional override (used by tests to run inside a tx).
 *                If omitted, uses a connection from the module pool.
 * @returns number of rows updated
 */
export async function refreshRfpSignals(queryFn?: Querier): Promise<number> {
  const q = queryFn ?? ((sql, params) => getPool().query(sql, params));
  const result = await q(REFRESH_SQL);
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
