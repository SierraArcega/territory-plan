-- Drop five dead aggregate views. None are referenced in app code, scheduler,
-- scripts, or docs (audited 2026-04-28). They are kept alive only because
-- 20260411_add_opportunity_session_fk drops + recreates them around an
-- opportunities column-type change.
--
-- Canonical aggregate sources going forward:
--   * district_financials (table, refreshed by refresh_fullmind_financials())
--   * district_opportunity_actuals (matview, rep + category grain)
--   * district_map_features (matview, vector-tile features)
--
-- district_health_view in particular used SUM(DISTINCT ...) to paper over
-- join fan-out from joining opportunities, activities, contacts, sessions, and
-- tasks in a single query — the math was suspect even when it was wired up.

DROP VIEW IF EXISTS district_health_view;
DROP VIEW IF EXISTS district_opportunities_view;
DROP VIEW IF EXISTS opportunity_sessions_view;
DROP VIEW IF EXISTS plan_district_engagement_view;
DROP VIEW IF EXISTS district_map_data;
