-- Migration: saved_report_row_count_description
--
-- Adds two nullable columns to saved_reports for the Reports tab redesign:
--   description       — optional free-text description shown alongside the title
--                       in the library list and save modal
--   row_count         — cached result row count from the most recent execution,
--                       displayed in the library row meta line ("9 rows")
--
-- Both are nullable; existing rows get NULL and will display without the new
-- fields until they're next saved or rerun.

ALTER TABLE "saved_reports"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "row_count" INTEGER;
