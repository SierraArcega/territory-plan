-- Drop legacy Plan Activities tables
-- Run this AFTER running migrate_plan_activities_to_activities.sql
-- and AFTER verifying the data was migrated correctly

-- Drop the junction table first (foreign key constraints)
DROP TABLE IF EXISTS plan_activity_contacts;

-- Drop the main activities table
DROP TABLE IF EXISTS plan_activities;

-- Verification: These should return 0 rows
-- SELECT COUNT(*) FROM plan_activity_contacts;
-- SELECT COUNT(*) FROM plan_activities;
