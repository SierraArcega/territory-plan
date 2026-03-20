-- Migrate CalendarEvent from CalendarConnection → UserIntegration (userId-based)
-- PREREQUISITE: Run scripts/migrate-calendar-tokens.ts first to copy tokens to user_integrations

-- Step 1: Drop FK constraint from calendar_events → calendar_connections
ALTER TABLE "calendar_events" DROP CONSTRAINT IF EXISTS "calendar_events_connection_id_fkey";

-- Step 2: Drop the old unique constraint (connection_id, google_event_id)
ALTER TABLE "calendar_events" DROP CONSTRAINT IF EXISTS "calendar_events_connection_id_google_event_id_key";

-- Step 3: Drop the connection_id column from calendar_events
ALTER TABLE "calendar_events" DROP COLUMN IF EXISTS "connection_id";

-- Step 4: Add new unique constraint on (user_id, google_event_id)
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_google_event_id_key" UNIQUE ("user_id", "google_event_id");

-- Step 5: Drop the calendar_connections table
DROP TABLE IF EXISTS "calendar_connections";
