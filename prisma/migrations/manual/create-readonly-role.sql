-- =============================================================================
-- Create the query_tool_readonly Postgres role for MAP-5 (Claude Query Tool),
-- MAP-3 (Agentic Actions), and MAP-4 (MCP Server).
-- =============================================================================
--
-- This script is run ONCE by a database admin in the Supabase SQL editor.
-- It is NOT managed by Prisma — Prisma cannot grant permissions to a role it
-- isn't connected as.
--
-- See spec: Docs/superpowers/specs/2026-04-11-db-readiness-query-tool.md
--
-- OPS CHECKLIST:
--   1. Replace 'CHANGE_ME' below with a strong password before running.
--   2. Run this script in the Supabase SQL editor as the postgres superuser.
--   3. Construct the connection string using the Supabase pooler URL, but
--      substitute the new role name + password for the postgres credentials.
--   4. Set DATABASE_READONLY_URL in .env.local (dev) and Vercel env (prod).
--   5. Verify connectivity:
--      psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM districts;"
--      → should succeed
--   6. Verify exclusion:
--      psql $DATABASE_READONLY_URL -c "SELECT count(*) FROM user_profiles;"
--      → should fail with "permission denied for table user_profiles"
--   7. Verify timeout:
--      psql $DATABASE_READONLY_URL -c "SELECT pg_sleep(10);"
--      → should fail with "canceling statement due to statement timeout" after 5s
--
-- =============================================================================

CREATE ROLE query_tool_readonly LOGIN PASSWORD 'CHANGE_ME';

-- Connection-level guardrails (defense in depth with the app-level 5s timeout
-- in src/lib/db-readonly.ts)
ALTER ROLE query_tool_readonly SET statement_timeout = '5s';
ALTER ROLE query_tool_readonly SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE query_tool_readonly SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE postgres TO query_tool_readonly;
GRANT USAGE ON SCHEMA public TO query_tool_readonly;

-- =============================================================================
-- Whitelist: explicit GRANT SELECT on every queryable table.
-- Keep this list in sync with TABLE_REGISTRY in src/lib/district-column-metadata.ts.
-- =============================================================================
GRANT SELECT ON
  -- Districts & education data
  districts, district_financials,
  states, state_assessments, schools,
  -- People (user_profiles included so we can join sales_rep_email → rep profile)
  contacts, user_profiles,
  -- Territory plans
  territory_plans,
  -- Activities & tasks
  activities, tasks,
  -- Rep goals
  user_goals,
  -- Revenue sources — raw + aggregated
  opportunities, sessions, subscriptions,
  district_opportunity_actuals,
  unmatched_accounts,
  -- Vacancies
  vacancies,
  -- Query tool internal
  query_log, saved_reports
TO query_tool_readonly;

-- =============================================================================
-- Defense in depth: explicit REVOKE on excluded tables.
-- No grant exists, so this is symbolic — but makes intent obvious if a future
-- migration blanket-grants the schema.
-- =============================================================================
REVOKE ALL ON
  user_integrations, calendar_events,
  map_views, data_refresh_logs, report_drafts,
  initiatives, initiative_metrics, initiative_scores, initiative_tier_thresholds,
  metric_registry, vacancy_keyword_config,
  -- Junctions & ancillary tables excluded from the query tool surface
  tags, district_tags, school_tags, school_contacts,
  activity_districts, activity_plans, activity_states, activity_contacts,
  activity_opportunities, activity_expenses, activity_attendees, activity_relations,
  task_districts, task_plans, task_activities, task_contacts,
  territory_plan_districts, territory_plan_states,
  territory_plan_collaborators, territory_plan_district_services,
  vacancy_scans, district_data_history, school_enrollment_history,
  district_grade_enrollment, services, unmatched_opportunities
FROM query_tool_readonly;
