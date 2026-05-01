-- Convert rep_session_actuals from a plain view to a materialized view, and
-- include EK12 subscription revenue (bucketed by opp.school_yr) alongside
-- session revenue (bucketed by session_fy(start_time)).
--
-- Why this exists:
--   The original rep_session_actuals (added in PR #154) was a plain view that
--   re-ran a 170k-session join on every leaderboard load. getRepActuals calls
--   it 3× per rep × ~30 reps = 90 invocations, each ~1.7s. Many timed out and
--   the rep-level catch in src/features/leaderboard/lib/fetch-leaderboard.ts
--   silently returned $0 — surfacing as missing revenue for Kris, Hayley,
--   Joy, Jenn, Liz, Lauren, Phil, Melodie, Rachel on the leaderboard.
--
-- Why subscriptions are now included:
--   EK12 reps' revenue is subscription-only (no sessions). Putting subs
--   alongside sessions keyed on the same (rep, district, state, school_yr)
--   grain means a single index lookup gives total revenue for any rep —
--   and downstream consumers can read total_revenue from one place rather
--   than summing rep_session_actuals.session_revenue + doa.sub_revenue.
--
-- Refresh: scheduler/sync/supabase_writer.py:refresh_opportunity_actuals
-- now refreshes both this matview and district_opportunity_actuals on every
-- sync cycle, so a stale matview never feeds the leaderboard.

DROP MATERIALIZED VIEW IF EXISTS rep_session_actuals;
DROP VIEW IF EXISTS rep_session_actuals;

CREATE MATERIALIZED VIEW rep_session_actuals AS
WITH sessions_by_fy AS (
  -- Sessions: bucket by session_fy(start_time) so a session that started in
  -- FY26 contributes to FY26 even if its parent opp is tagged FY25.
  SELECT
    o.sales_rep_email,
    o.sales_rep_name,
    COALESCE(o.district_lea_id, '_NOMAP'::character varying) AS district_lea_id,
    o.state,
    session_fy(s.start_time) AS school_yr,
    SUM(s.session_price) AS session_revenue,
    COUNT(*)::integer AS session_count
  FROM sessions s
  JOIN opportunities o ON o.id = s.opportunity_id
  WHERE s.status NOT IN ('cancelled', 'canceled')
    AND s.session_price IS NOT NULL
    AND session_fy(s.start_time) IS NOT NULL
  GROUP BY
    o.sales_rep_email, o.sales_rep_name,
    COALESCE(o.district_lea_id, '_NOMAP'::character varying),
    o.state, session_fy(s.start_time)
),
subs_by_fy AS (
  -- Subscriptions (EK12 revenue): no per-row date, so bucket by opp.school_yr.
  SELECT
    o.sales_rep_email,
    o.sales_rep_name,
    COALESCE(o.district_lea_id, '_NOMAP'::character varying) AS district_lea_id,
    o.state,
    o.school_yr,
    SUM(sub.net_total) AS sub_revenue,
    COUNT(*)::integer AS sub_count
  FROM subscriptions sub
  JOIN opportunities o ON o.id = sub.opportunity_id
  WHERE o.school_yr IS NOT NULL
  GROUP BY
    o.sales_rep_email, o.sales_rep_name,
    COALESCE(o.district_lea_id, '_NOMAP'::character varying),
    o.state, o.school_yr
),
merged AS (
  SELECT
    sales_rep_email, sales_rep_name, district_lea_id, state, school_yr,
    session_revenue, session_count,
    0::numeric AS sub_revenue, 0 AS sub_count
  FROM sessions_by_fy
  UNION ALL
  SELECT
    sales_rep_email, sales_rep_name, district_lea_id, state, school_yr,
    0::numeric AS session_revenue, 0 AS session_count,
    sub_revenue, sub_count
  FROM subs_by_fy
)
SELECT
  sales_rep_email,
  MAX(sales_rep_name) AS sales_rep_name,
  district_lea_id,
  state,
  school_yr,
  COALESCE(SUM(session_revenue), 0) AS session_revenue,
  COALESCE(SUM(session_count), 0)::integer AS session_count,
  COALESCE(SUM(sub_revenue), 0) AS sub_revenue,
  COALESCE(SUM(sub_count), 0)::integer AS sub_count,
  COALESCE(SUM(session_revenue), 0) + COALESCE(SUM(sub_revenue), 0) AS total_revenue
FROM merged
GROUP BY sales_rep_email, district_lea_id, state, school_yr;

CREATE UNIQUE INDEX idx_rsa_unique
  ON rep_session_actuals (sales_rep_email, district_lea_id, state, school_yr);
CREATE INDEX idx_rsa_rep_yr ON rep_session_actuals (sales_rep_email, school_yr);
CREATE INDEX idx_rsa_district_yr ON rep_session_actuals (district_lea_id, school_yr);

ANALYZE rep_session_actuals;
