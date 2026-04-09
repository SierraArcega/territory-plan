-- Calendar Backfill Fields — DDL Changes
-- Adds two nullable DateTime columns to calendar_connections for the
-- first-connect backfill wizard + auto-sync enhancement (see
-- docs/superpowers/specs/2026-04-09-google-calendar-sync-spec.md).
--
-- Run this BEFORE deploying the updated Prisma schema. All changes are
-- additive (nullable columns, no drops, no defaults to backfill).

BEGIN;

ALTER TABLE calendar_connections
  ADD COLUMN IF NOT EXISTS backfill_start_date   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS backfill_completed_at TIMESTAMP(3);

COMMIT;
