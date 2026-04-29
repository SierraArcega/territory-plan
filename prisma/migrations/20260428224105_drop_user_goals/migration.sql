-- Drop the user_goals table and its dependent objects (audit trigger from
-- 20260420_add_audit_log_and_snapshots, FK from user_profiles, indexes).
DROP TABLE IF EXISTS "user_goals" CASCADE;
