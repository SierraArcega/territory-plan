-- Add assigned_to_user_id to activities table.
-- This enables assigning activities to specific team members rather than
-- only tracking who created them. Defaults to the creator for all existing rows.

ALTER TABLE activities ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID;

-- Backfill: existing activities are assigned to their creator.
-- This preserves current behavior — each person still sees their own activities
-- by default, now via the assignee field rather than the creator field.
UPDATE activities
SET assigned_to_user_id = created_by_user_id
WHERE assigned_to_user_id IS NULL
  AND created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activities_assigned_to_user_id_idx
  ON activities (assigned_to_user_id);
