-- View: rep_session_actuals
-- Aggregates the sessions table by (rep, district, session_fy(start_time)).
-- Used by the leaderboard to bucket session revenue by when the session
-- actually happened, not by the parent opportunity's school_yr tag.
-- Subscriptions are NOT in this view — they continue to come from
-- district_opportunity_actuals (Choice A in the design spec).
--
-- Spec: Docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md

DROP VIEW IF EXISTS rep_session_actuals;

CREATE VIEW rep_session_actuals AS
SELECT
  o.sales_rep_email,
  o.sales_rep_name,
  COALESCE(o.district_lea_id, '_NOMAP') AS district_lea_id,
  o.state,
  session_fy(s.start_time) AS school_yr,
  SUM(s.session_price) AS session_revenue,
  COUNT(*)::int AS session_count
FROM sessions s
JOIN opportunities o ON o.id = s.opportunity_id
WHERE s.status NOT IN ('cancelled', 'canceled')
  AND s.session_price IS NOT NULL
  AND session_fy(s.start_time) IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;

COMMENT ON VIEW rep_session_actuals IS
  'Sessions aggregated by session-date FY (not opp.school_yr). Replaces district_opportunity_actuals as the leaderboard''s source for session revenue. Spec: 2026-04-30-leaderboard-fy-attribution-fix-design.md';
