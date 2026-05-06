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
 * Priority order: active > recently_won (<=18mo) > recently_lost (<=12mo)
 *   > in_plan (in any FY27 territory plan) > cold
 *
 * Also maintains two date-relative flags:
 *   - is_new    = first_seen_at within last 7 days
 *   - is_urgent = due_date within next 7 days (and not past)
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
),
in_plan AS (
  SELECT DISTINCT tpd.district_leaid AS leaid
  FROM territory_plan_districts tpd
  JOIN territory_plans tp ON tp.id = tpd.plan_id
  WHERE tp.fiscal_year = 2027
)
UPDATE rfps r
SET
  district_pipeline_state = CASE
    WHEN r.leaid IS NULL                             THEN NULL
    WHEN COALESCE(s.has_active, false)               THEN 'active'
    WHEN s.last_won  >= now() - interval '18 months' THEN 'recently_won'
    WHEN s.last_lost >= now() - interval '12 months' THEN 'recently_lost'
    WHEN ip.leaid IS NOT NULL                        THEN 'in_plan'
    ELSE 'cold'
  END,
  is_new = (r.first_seen_at >= now() - interval '7 days'),
  is_urgent = (
    r.due_date IS NOT NULL
    AND r.due_date >= now()
    AND r.due_date <= now() + interval '7 days'
  ),
  signals_refreshed_at = now()
FROM rfps r2
LEFT JOIN opp_state s ON s.leaid = r2.leaid
LEFT JOIN in_plan ip  ON ip.leaid = r2.leaid
WHERE r.id = r2.id;
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
