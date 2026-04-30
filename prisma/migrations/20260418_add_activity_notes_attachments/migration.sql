-- Migration: add_activity_notes_attachments
-- Adds threaded note log + file/photo attachment tables for the redesigned
-- activity detail drawer. Activity.notes (free-form description) is unchanged.

-- ===== ActivityNote: chronological author log =====
CREATE TABLE IF NOT EXISTS "activity_notes" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "activity_id" TEXT NOT NULL,
  "author_id"   UUID NOT NULL,
  "body"        TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_notes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "activity_notes"
  ADD CONSTRAINT "activity_notes_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE;

ALTER TABLE "activity_notes"
  ADD CONSTRAINT "activity_notes_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "user_profiles"("id") ON DELETE NO ACTION;

CREATE INDEX IF NOT EXISTS "activity_notes_activity_id_idx" ON "activity_notes"("activity_id");
CREATE INDEX IF NOT EXISTS "activity_notes_author_id_idx" ON "activity_notes"("author_id");

-- ===== ActivityAttachment: file / photo uploads =====
-- Blob lives in Supabase Storage bucket `activity-attachments`. The
-- storage_path column is bucket-relative; signed URLs are minted at read time.
CREATE TABLE IF NOT EXISTS "activity_attachments" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "activity_id"    TEXT NOT NULL,
  "kind"           VARCHAR(10) NOT NULL,
  "name"           VARCHAR(255) NOT NULL,
  "size_bytes"     INTEGER NOT NULL,
  "mime"           VARCHAR(100) NOT NULL,
  "storage_path"   VARCHAR(500) NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "uploaded_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_attachments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "activity_attachments"
  ADD CONSTRAINT "activity_attachments_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE;

ALTER TABLE "activity_attachments"
  ADD CONSTRAINT "activity_attachments_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "user_profiles"("id") ON DELETE NO ACTION;

CREATE INDEX IF NOT EXISTS "activity_attachments_activity_id_idx" ON "activity_attachments"("activity_id");
CREATE INDEX IF NOT EXISTS "activity_attachments_uploaded_by_id_idx" ON "activity_attachments"("uploaded_by_id");
