-- Migration: saved_report_summary
--
-- Adds two columns to saved_reports:
--   summary        — chip-render payload for the query tool UI (JSONB)
--   conversation_id — links a saved report to its originating conversation (UUID)

ALTER TABLE "saved_reports"
  ADD COLUMN IF NOT EXISTS "summary" JSONB,
  ADD COLUMN IF NOT EXISTS "conversation_id" UUID;
