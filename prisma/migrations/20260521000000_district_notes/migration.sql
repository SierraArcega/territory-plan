-- Migration: district_notes
-- District-scoped rich-text note log. One row per author entry, shown as a
-- chronological feed in the Saved Views grid popover. body_json is the TipTap
-- ProseMirror document (source of truth); body_text is the flattened plaintext
-- used for the grid cell snippet. Mentions land in Phase 2.

-- CreateTable
CREATE TABLE "district_notes" (
    "id" TEXT NOT NULL,
    "district_leaid" VARCHAR(7) NOT NULL,
    "author_id" UUID NOT NULL,
    "body_json" JSONB NOT NULL,
    "body_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "district_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "district_notes_district_leaid_created_at_idx" ON "district_notes" ("district_leaid", "created_at" DESC);

-- CreateIndex
CREATE INDEX "district_notes_author_id_idx" ON "district_notes" ("author_id");

-- AddForeignKey
ALTER TABLE "district_notes" ADD CONSTRAINT "district_notes_district_leaid_fkey" FOREIGN KEY ("district_leaid") REFERENCES "districts" ("leaid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_notes" ADD CONSTRAINT "district_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
