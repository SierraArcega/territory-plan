-- Replace user_id-only PK with composite (user_id, report_id).
-- report_id = 0 is the sentinel for a fresh/unsaved session (no FK — see spec).
-- Existing rows (if any) keep report_id = 0 via the DEFAULT.

ALTER TABLE "report_drafts" DROP CONSTRAINT "report_drafts_pkey";

ALTER TABLE "report_drafts"
  ADD COLUMN "report_id" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "report_drafts"
  ADD CONSTRAINT "report_drafts_pkey" PRIMARY KEY ("user_id", "report_id");
