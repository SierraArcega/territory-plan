-- Add FK relation Opportunity → District. Cleans up 355 orphaned opportunity
-- rows whose district_lea_id doesn't reference an existing district.
--
-- See plan: Docs/superpowers/plans/2026-04-11-opportunity-session-fk.md
--
-- IMPORTANT: The original plan also added a Session → Opportunity FK, but
-- production has 95,345 orphaned sessions (33.1%) whose opportunity_id values
-- reference real Salesforce opportunities that aren't in our local
-- opportunities table because the Railway opportunity sync filters by recency
-- while the session sync doesn't. NULLing those would lose real data linkages.
-- We make sessions.opportunity_id nullable (so the Prisma model matches the
-- DB) but skip the FK constraint. Tracked as a follow-up:
-- Docs/superpowers/followups/2026-04-11-opportunity-sync-historical-gap.md
--
-- We also have to drop and recreate 5 views (1 materialized, 4 regular) that
-- reference opportunities.district_lea_id, since Postgres won't allow ALTER
-- COLUMN TYPE while views depend on the column.

-- Step 1: Clean up orphaned opportunity → district references (355 known rows)
UPDATE opportunities
SET district_lea_id = NULL
WHERE district_lea_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM districts WHERE leaid = opportunities.district_lea_id
);

-- Step 2: Drop dependent views (4 regular + 1 materialized)
DROP VIEW IF EXISTS district_health_view CASCADE;
DROP VIEW IF EXISTS district_opportunities_view CASCADE;
DROP VIEW IF EXISTS opportunity_sessions_view CASCADE;
DROP VIEW IF EXISTS plan_district_engagement_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS district_opportunity_actuals CASCADE;

-- Step 3: Change opportunities.district_lea_id from TEXT to VARCHAR(7)
ALTER TABLE "opportunities" ALTER COLUMN "district_lea_id" TYPE VARCHAR(7);

-- Step 4: Make sessions.opportunity_id nullable (no FK; see header comment)
ALTER TABLE "sessions" ALTER COLUMN "opportunity_id" DROP NOT NULL;

-- Step 5: Add the opportunities → districts FK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_district_lea_id_fkey'
  ) THEN
    ALTER TABLE "opportunities"
      ADD CONSTRAINT "opportunities_district_lea_id_fkey"
      FOREIGN KEY ("district_lea_id") REFERENCES "districts"("leaid")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 6: Recreate district_health_view (definition pulled from production 2026-04-11)
CREATE VIEW district_health_view AS
SELECT d.leaid,
    d.name AS district_name,
    d.state_abbrev AS district_state,
    d.city_location AS district_city,
    d.enrollment,
    d.is_customer,
    d.has_open_pipeline,
    count(DISTINCT o.id) AS opportunity_count,
    count(DISTINCT o.id) FILTER (WHERE o.stage = 'Closed Won'::text) AS won_opportunity_count,
    count(DISTINCT o.id) FILTER (WHERE o.stage <> ALL (ARRAY['Closed Lost'::text, 'Closed Won'::text])) AS open_opportunity_count,
    COALESCE(sum(DISTINCT o.net_booking_amount) FILTER (WHERE o.stage = 'Closed Won'::text), 0::numeric) AS won_bookings,
    COALESCE(sum(DISTINCT o.net_booking_amount) FILTER (WHERE o.stage <> ALL (ARRAY['Closed Lost'::text, 'Closed Won'::text])), 0::numeric) AS open_pipeline,
    count(DISTINCT ad.activity_id) AS activity_count,
    count(DISTINCT ad.activity_id) FILTER (WHERE a.status::text = 'completed'::text) AS completed_activity_count,
    max(a.start_date) AS last_activity_date,
    count(DISTINCT c.id) AS contact_count,
    count(DISTINCT c.id) FILTER (WHERE c.is_primary = true) AS primary_contact_count,
    count(DISTINCT s.id) AS session_count,
    COALESCE(sum(s.session_price), 0::numeric) AS total_session_revenue,
    COALESCE(sum(ae.amount), 0::numeric) AS total_expenses,
    count(DISTINCT td.task_id) AS task_count
   FROM districts d
     LEFT JOIN opportunities o ON o.district_lea_id::text = d.leaid::text
     LEFT JOIN activity_districts ad ON ad.district_leaid::text = d.leaid::text
     LEFT JOIN activities a ON a.id = ad.activity_id
     LEFT JOIN activity_expenses ae ON ae.activity_id = a.id
     LEFT JOIN contacts c ON c.leaid::text = d.leaid::text
     LEFT JOIN sessions s ON s.opportunity_id = o.id
     LEFT JOIN task_districts td ON td.district_leaid::text = d.leaid::text
  GROUP BY d.leaid;

-- Step 7: Recreate district_opportunities_view
CREATE VIEW district_opportunities_view AS
SELECT d.leaid,
    d.name AS district_name,
    d.state_abbrev AS district_state,
    d.city_location AS district_city,
    d.enrollment,
    d.is_customer,
    d.has_open_pipeline,
    count(o.id) AS opportunity_count,
    count(o.id) FILTER (WHERE o.stage <> ALL (ARRAY['Closed Lost'::text, 'Closed Won'::text])) AS open_opportunity_count,
    count(o.id) FILTER (WHERE o.stage = 'Closed Won'::text) AS won_opportunity_count,
    COALESCE(sum(o.net_booking_amount), 0::numeric) AS total_bookings,
    COALESCE(sum(o.net_booking_amount) FILTER (WHERE o.stage = 'Closed Won'::text), 0::numeric) AS won_bookings,
    COALESCE(sum(o.net_booking_amount) FILTER (WHERE o.stage <> ALL (ARRAY['Closed Lost'::text, 'Closed Won'::text])), 0::numeric) AS open_pipeline,
    max(o.close_date) AS latest_close_date,
    min(o.created_at) AS first_opportunity_date
   FROM districts d
     LEFT JOIN opportunities o ON o.district_lea_id::text = d.leaid::text
  GROUP BY d.leaid;

-- Step 8: Recreate opportunity_sessions_view
CREATE VIEW opportunity_sessions_view AS
SELECT o.id AS opportunity_id,
    o.name AS opportunity_name,
    o.school_yr,
    o.contract_type,
    o.stage,
    o.sales_rep_name,
    o.district_name,
    o.district_lea_id AS leaid,
    o.state,
    o.net_booking_amount,
    o.close_date,
    count(s.id) AS session_count,
    COALESCE(sum(s.session_price), 0::numeric) AS total_session_revenue,
    COALESCE(sum(s.educator_price), 0::numeric) AS total_educator_cost,
    min(s.start_time) AS first_session_date,
    max(s.start_time) AS last_session_date
   FROM opportunities o
     LEFT JOIN sessions s ON s.opportunity_id = o.id
  GROUP BY o.id;

-- Step 9: Recreate plan_district_engagement_view
CREATE VIEW plan_district_engagement_view AS
SELECT tpd.plan_id,
    tpd.district_leaid AS leaid,
    tp.name AS plan_name,
    tp.fiscal_year,
    d.name AS district_name,
    d.state_abbrev AS district_state,
    d.city_location AS district_city,
    d.enrollment,
    d.is_customer,
    COALESCE(tpd.renewal_target, 0::numeric) + COALESCE(tpd.winback_target, 0::numeric) + COALESCE(tpd.expansion_target, 0::numeric) + COALESCE(tpd.new_business_target, 0::numeric) AS target_revenue,
    count(DISTINCT o.id) AS opportunity_count,
    COALESCE(sum(o.net_booking_amount) FILTER (WHERE o.stage <> ALL (ARRAY['Closed Lost'::text, 'Closed Won'::text])), 0::numeric) AS open_pipeline,
    COALESCE(sum(o.net_booking_amount) FILTER (WHERE o.stage = 'Closed Won'::text), 0::numeric) AS won_bookings,
    count(DISTINCT ad.activity_id) AS activity_count,
    max(a.start_date) AS last_activity_date,
    count(DISTINCT c.id) AS contact_count,
    COALESCE(sum(ae.amount), 0::numeric) AS total_expenses
   FROM territory_plan_districts tpd
     JOIN territory_plans tp ON tp.id = tpd.plan_id
     JOIN districts d ON d.leaid::text = tpd.district_leaid::text
     LEFT JOIN opportunities o ON o.district_lea_id::text = d.leaid::text
     LEFT JOIN activity_districts ad ON ad.district_leaid::text = d.leaid::text
     LEFT JOIN activities a ON a.id = ad.activity_id
     LEFT JOIN activity_expenses ae ON ae.activity_id = a.id
     LEFT JOIN contacts c ON c.leaid::text = d.leaid::text
  GROUP BY tpd.plan_id, tpd.district_leaid, tp.name, tp.fiscal_year, d.leaid, tpd.renewal_target, tpd.winback_target, tpd.expansion_target, tpd.new_business_target;

-- Step 10: Recreate the district_opportunity_actuals materialized view
CREATE MATERIALIZED VIEW district_opportunity_actuals AS
WITH stage_weights AS (
  SELECT unnest(ARRAY[0, 1, 2, 3, 4, 5]) AS prefix,
         unnest(ARRAY[0.05, 0.10, 0.25, 0.50, 0.75, 0.90]) AS weight
), categorized_opps AS (
  SELECT o.id, o.name, o.school_yr, o.contract_type, o.state,
         o.sales_rep_name, o.sales_rep_email,
         o.district_name, o.district_lms_id, o.district_nces_id, o.district_lea_id,
         o.created_at, o.close_date, o.brand_ambassador, o.stage,
         o.net_booking_amount, o.contract_through, o.funding_through,
         o.payment_type, o.payment_terms, o.lead_source,
         o.invoiced, o.credited,
         o.completed_revenue, o.completed_take, o.scheduled_sessions,
         o.scheduled_revenue, o.scheduled_take, o.total_revenue, o.total_take,
         o.average_take_rate, o.synced_at,
         CASE
           WHEN lower(o.contract_type) LIKE '%renewal%' THEN 'renewal'::text
           WHEN lower(o.contract_type) LIKE '%winback%' OR lower(o.contract_type) LIKE '%win back%' THEN 'winback'::text
           WHEN lower(o.contract_type) LIKE '%expansion%' THEN 'expansion'::text
           ELSE 'new_business'::text
         END AS category,
         CASE
           WHEN o.stage ~ '^\d' THEN (regexp_match(o.stage, '^(\d+)'))[1]::integer
           ELSE NULL::integer
         END AS stage_prefix
    FROM opportunities o
   WHERE o.district_lea_id IS NOT NULL
)
SELECT co.district_lea_id, co.school_yr, co.sales_rep_email, co.category,
       COALESCE(sum(co.net_booking_amount) FILTER (WHERE co.stage_prefix >= 6), 0::numeric) AS bookings,
       COALESCE(sum(co.net_booking_amount) FILTER (WHERE co.stage_prefix >= 0 AND co.stage_prefix <= 5), 0::numeric) AS open_pipeline,
       COALESCE(sum(co.net_booking_amount * sw.weight) FILTER (WHERE co.stage_prefix >= 0 AND co.stage_prefix <= 5), 0::numeric) AS weighted_pipeline,
       COALESCE(sum(co.total_revenue), 0::numeric) AS total_revenue,
       COALESCE(sum(co.completed_revenue), 0::numeric) AS completed_revenue,
       COALESCE(sum(co.scheduled_revenue), 0::numeric) AS scheduled_revenue,
       COALESCE(sum(co.total_take), 0::numeric) AS total_take,
       COALESCE(sum(co.completed_take), 0::numeric) AS completed_take,
       COALESCE(sum(co.scheduled_take), 0::numeric) AS scheduled_take,
       CASE WHEN sum(co.total_revenue) > 0::numeric THEN sum(co.total_take) / sum(co.total_revenue) ELSE NULL::numeric END AS avg_take_rate,
       COALESCE(sum(co.invoiced), 0::numeric) AS invoiced,
       COALESCE(sum(co.credited), 0::numeric) AS credited,
       count(*)::integer AS opp_count
  FROM categorized_opps co
  LEFT JOIN stage_weights sw ON sw.prefix = co.stage_prefix
 GROUP BY co.district_lea_id, co.school_yr, co.sales_rep_email, co.category;

-- Step 11: Recreate the materialized view's indexes
CREATE INDEX idx_doa_district ON public.district_opportunity_actuals USING btree (district_lea_id);
CREATE INDEX idx_doa_school_yr ON public.district_opportunity_actuals USING btree (school_yr);
CREATE INDEX idx_doa_rep ON public.district_opportunity_actuals USING btree (sales_rep_email);
CREATE INDEX idx_doa_category ON public.district_opportunity_actuals USING btree (category);
CREATE INDEX idx_doa_district_yr ON public.district_opportunity_actuals USING btree (district_lea_id, school_yr);
CREATE INDEX idx_doa_district_yr_rep ON public.district_opportunity_actuals USING btree (district_lea_id, school_yr, sales_rep_email);
CREATE UNIQUE INDEX idx_doa_unique ON public.district_opportunity_actuals USING btree (district_lea_id, school_yr, sales_rep_email, category);
