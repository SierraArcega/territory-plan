-- Drop calendar_connections, migrate calendar-specific settings into
-- user_integrations.metadata (JSON), and re-point calendar_events.connection_id
-- from calendar_connections.id → user_integrations.id.
--
-- See plan: Docs/superpowers/plans/2026-04-11-calendar-connection-migration.md
--
-- Production state at migration time:
--   * 2 calendar_connections rows (sierra, melodie)
--   * 2 user_integrations rows where service='google_calendar' (same 2 users)
--   * 12 calendar_events rows still tied to calendar_connections.id (sierra)
--
-- Migration order is critical: we must remap calendar_events BEFORE dropping
-- calendar_connections, otherwise the FK cascade would delete the events.

-- Step 1: Backfill any missing user_integrations rows from calendar_connections.
-- Both production rows already exist in user_integrations, but this is defensive
-- so the migration is replayable on any environment.
INSERT INTO user_integrations (
  id,
  user_id,
  service,
  account_email,
  access_token,
  refresh_token,
  token_expires_at,
  metadata,
  sync_enabled,
  status,
  last_sync_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  cc.user_id,
  'google_calendar',
  cc.google_account_email,
  cc.access_token,
  cc.refresh_token,
  cc.token_expires_at,
  jsonb_build_object(
    'companyDomain', cc.company_domain,
    'syncDirection', cc.sync_direction,
    'syncedActivityTypes', cc.synced_activity_types,
    'reminderMinutes', cc.reminder_minutes,
    'secondReminderMinutes', cc.second_reminder_minutes,
    'backfillStartDate', cc.backfill_start_date,
    'backfillCompletedAt', cc.backfill_completed_at,
    'backfillWindowDays', cc.backfill_window_days
  ),
  cc.sync_enabled,
  cc.status,
  cc.last_sync_at,
  cc.created_at,
  cc.updated_at
FROM calendar_connections cc
WHERE NOT EXISTS (
  SELECT 1 FROM user_integrations ui
  WHERE ui.user_id = cc.user_id AND ui.service = 'google_calendar'
);

-- Step 2: For existing user_integrations rows, merge calendar-specific settings
-- into the metadata JSON. Preserve any existing metadata keys (e.g. companyDomain
-- already set by the OAuth callback) by spreading the existing metadata last.
UPDATE user_integrations ui
SET metadata = jsonb_build_object(
    'companyDomain', cc.company_domain,
    'syncDirection', cc.sync_direction,
    'syncedActivityTypes', cc.synced_activity_types,
    'reminderMinutes', cc.reminder_minutes,
    'secondReminderMinutes', cc.second_reminder_minutes,
    'backfillStartDate', cc.backfill_start_date,
    'backfillCompletedAt', cc.backfill_completed_at,
    'backfillWindowDays', cc.backfill_window_days
  ) || COALESCE(ui.metadata, '{}'::jsonb)
FROM calendar_connections cc
WHERE ui.user_id = cc.user_id AND ui.service = 'google_calendar';

-- Step 3: Drop the old FK constraint on calendar_events.connection_id BEFORE
-- we re-point the connection_ids — otherwise the UPDATE fails because the new
-- ui.id values don't exist in calendar_connections yet.
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_connection_id_fkey;

-- Step 4: Re-point calendar_events.connection_id from calendar_connections.id
-- to the matching user_integrations.id. Map by user_id since each user has at
-- most one row in each table for calendar.
UPDATE calendar_events ce
SET connection_id = ui.id
FROM calendar_connections cc, user_integrations ui
WHERE ce.connection_id = cc.id
AND cc.user_id = ui.user_id
AND ui.service = 'google_calendar';

-- Step 5: Drop calendar_connections table.
DROP TABLE IF EXISTS calendar_connections CASCADE;

-- Step 6: Add the new FK constraint pointing at user_integrations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_connection_id_fkey'
  ) THEN
    ALTER TABLE calendar_events
      ADD CONSTRAINT calendar_events_connection_id_fkey
      FOREIGN KEY (connection_id) REFERENCES user_integrations(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
