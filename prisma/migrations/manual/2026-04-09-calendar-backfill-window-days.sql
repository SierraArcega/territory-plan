-- Calendar Backfill Window Days — DDL Changes
-- Adds a nullable integer column to calendar_connections storing the
-- symmetric backfill window size in days (7/30/60/90). Used to drive both
-- timeMin and timeMax in the sync engine so that the forward-looking window
-- matches the user's chosen backfill window.
--
-- Run this BEFORE deploying the updated Prisma schema. Additive and
-- idempotent — no drops, no defaults to backfill.

BEGIN;

ALTER TABLE calendar_connections
  ADD COLUMN IF NOT EXISTS backfill_window_days INTEGER;

COMMIT;
