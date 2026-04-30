import pool from "@/lib/db";

export interface RollingBatchRow {
  leaid: string;
  name: string;
  cityLocation: string | null;
  stateAbbrev: string | null;
  tier: 1 | 2 | 3;
}

/**
 * Pulls the next batch of districts to fetch news for, ordered by tier and
 * staleness against per-tier SLAs.
 *
 * Tiers (computed live from current state, no stored column):
 *   T1 — customer or has_open_pipeline      → re-fetch every 6h
 *   T2 — in any territory plan, or has activity in last 30d → every 24h
 *   T3 — everything else                    → every 30d
 *
 * Rows whose last_fetched_at is fresher than their tier's SLA are excluded,
 * so a fully-caught-up queue returns an empty array (and the cron run is a
 * cheap no-op).
 */
export async function selectNextRollingBatch(
  batchSize: number
): Promise<RollingBatchRow[]> {
  const sql = `
    WITH ranked AS (
      SELECT
        f.leaid,
        f.last_fetched_at,
        d.name,
        d.city_location,
        d.state_abbrev,
        CASE
          WHEN d.is_customer OR d.has_open_pipeline THEN 1
          WHEN EXISTS (
            SELECT 1 FROM territory_plan_districts tpd
            WHERE tpd.district_leaid = f.leaid
          )
            OR EXISTS (
              SELECT 1
              FROM activity_districts ad
              JOIN activities a ON a.id = ad.activity_id
              WHERE ad.district_leaid = f.leaid
                AND a.created_at > NOW() - INTERVAL '30 days'
            )
          THEN 2
          ELSE 3
        END AS tier
      FROM district_news_fetch f
      JOIN districts d ON d.leaid = f.leaid
    )
    SELECT leaid, tier, name, city_location, state_abbrev
    FROM ranked
    WHERE last_fetched_at IS NULL
       OR last_fetched_at < NOW() - (
            CASE tier
              WHEN 1 THEN INTERVAL '6 hours'
              WHEN 2 THEN INTERVAL '24 hours'
              ELSE INTERVAL '30 days'
            END
          )
    ORDER BY tier ASC, last_fetched_at NULLS FIRST
    LIMIT $1
  `;

  const client = await pool.connect();
  try {
    const result = await client.query(sql, [batchSize]);
    return result.rows.map((r) => ({
      leaid: r.leaid,
      name: r.name,
      cityLocation: r.city_location,
      stateAbbrev: r.state_abbrev,
      tier: r.tier as 1 | 2 | 3,
    }));
  } finally {
    client.release();
  }
}
