ALTER TABLE "rfp_ingest_runs"
  ADD COLUMN "records_resolved_by_override" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "records_resolved_by_name"     INTEGER NOT NULL DEFAULT 0;
