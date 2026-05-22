-- Migration: district_note_type
-- Adds a single-select type to district notes (default general_update).
ALTER TABLE "district_notes"
  ADD COLUMN "note_type" VARCHAR(20) NOT NULL DEFAULT 'general_update';

ALTER TABLE "district_notes"
  ADD CONSTRAINT "district_notes_note_type_check"
  CHECK ("note_type" IN ('general_update','good_news','risk_flag','next_step','meeting_recap'));
