-- Rename plan statuses: draft → planning, active → working, add stale
-- archived stays as-is

-- Migrate existing data
UPDATE territory_plans SET status = 'planning' WHERE status = 'draft';
UPDATE territory_plans SET status = 'working' WHERE status = 'active';

-- Update the column default
ALTER TABLE territory_plans ALTER COLUMN status SET DEFAULT 'planning';
