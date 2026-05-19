-- Backfill companyDomains array on existing Google Calendar integrations
-- Adds companyDomains to any user_integrations row that doesn't have it yet.
--
-- Background: the sync engine previously filtered internal attendees using only
-- a single companyDomain scalar. elevatek12.com is also an internal Fullmind
-- domain, so Pipeline Review-style meetings were slipping through for users
-- whose metadata was written before multi-domain support was added.
--
-- New connections set companyDomains automatically via the OAuth callback.
-- This script backfills existing connected rows so they get the same filter.
--
-- Safe to re-run: the WHERE clause skips rows that already have companyDomains.

BEGIN;

UPDATE user_integrations
SET metadata = metadata || '{"companyDomains": ["fullmindlearning.com", "elevatek12.com"]}'::jsonb
WHERE service = 'google_calendar'
  AND (metadata->>'companyDomains') IS NULL;

COMMIT;
