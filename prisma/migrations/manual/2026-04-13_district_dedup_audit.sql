-- 2026-04-13_district_dedup_audit.sql
-- Read-only audit view: same-state districts whose normalized name collides
-- across multiple leaids AND where more than one of those leaids has Fullmind
-- revenue in district_financials. These are candidates for a cleanup pattern
-- similar to the Onamia case in 2026-04-13_onamia_cleanup.sql.
--
-- State is included in the dedup key because "Cambridge" is a common city
-- name across multiple states (WI/NY/VT/MA/etc.) and those are legitimately
-- separate districts, not duplicates. The Onamia bug was two MN rows both
-- named "Onamia Public School District" — same state, same normalized name,
-- same full name, different leaids.
--
-- Nothing auto-runs — the view exists so operators can query
-- `SELECT * FROM district_dedup_audit` on demand.

CREATE OR REPLACE VIEW district_dedup_audit AS
WITH grouped AS (
  SELECT
    normalize_district_name(d.name) AS norm_name,
    d.leaid,
    d.name,
    d.state_abbrev,
    d.is_customer,
    COALESCE((
      SELECT SUM(total_revenue)
      FROM district_financials df
      WHERE df.leaid = d.leaid AND df.vendor = 'fullmind'
    ), 0) AS fullmind_lifetime_revenue
  FROM districts d
  WHERE d.name IS NOT NULL
),
dupes AS (
  SELECT norm_name, state_abbrev
  FROM grouped
  WHERE fullmind_lifetime_revenue > 0
  GROUP BY norm_name, state_abbrev
  HAVING COUNT(*) > 1
)
SELECT g.*
FROM grouped g
JOIN dupes x USING (norm_name, state_abbrev)
ORDER BY g.state_abbrev, g.norm_name, g.fullmind_lifetime_revenue DESC;

COMMENT ON VIEW district_dedup_audit IS
  'Same-state duplicate-name districts with Fullmind revenue on >1 leaid.
   Run SELECT * FROM district_dedup_audit when triaging bug (c) cleanups.';
