-- Migration: Copy data from old PlanActivity system to new Activity system
-- Run this BEFORE removing the old tables/code

-- Step 1: Copy activities (single date becomes startDate, endDate same as startDate)
INSERT INTO activities (id, type, title, notes, start_date, end_date, status, created_by_user_id, created_at, updated_at)
SELECT
  pa.id,
  pa.type,
  pa.title,
  pa.notes,
  pa.activity_date,
  pa.activity_date,  -- endDate same as startDate for legacy single-date activities
  pa.status,
  tp.user_id,
  pa.created_at,
  pa.updated_at
FROM plan_activities pa
JOIN territory_plans tp ON pa.plan_id = tp.id
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create plan links
INSERT INTO activity_plans (activity_id, plan_id)
SELECT id, plan_id FROM plan_activities
ON CONFLICT DO NOTHING;

-- Step 3: Create district links (where district was specified)
INSERT INTO activity_districts (activity_id, district_leaid, warning_dismissed)
SELECT id, district_leaid, false FROM plan_activities
WHERE district_leaid IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 4: Migrate contacts
INSERT INTO activity_contacts (activity_id, contact_id)
SELECT activity_id, contact_id FROM plan_activity_contacts
ON CONFLICT DO NOTHING;

-- Step 5: Derive states from districts
INSERT INTO activity_states (activity_id, state_fips, is_explicit)
SELECT DISTINCT ad.activity_id, d.state_fips, false
FROM activity_districts ad
JOIN districts d ON ad.district_leaid = d.leaid
ON CONFLICT DO NOTHING;

-- Verification queries (run these to confirm migration):
-- SELECT COUNT(*) as old_count FROM plan_activities;
-- SELECT COUNT(*) as new_count FROM activities WHERE id IN (SELECT id FROM plan_activities);
-- SELECT COUNT(*) as plan_links FROM activity_plans;
-- SELECT COUNT(*) as district_links FROM activity_districts;
-- SELECT COUNT(*) as contact_links FROM activity_contacts;
