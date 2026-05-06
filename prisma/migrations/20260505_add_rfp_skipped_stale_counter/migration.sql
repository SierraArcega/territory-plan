ALTER TABLE "rfp_ingest_runs"
  ADD COLUMN "records_skipped_stale" INTEGER NOT NULL DEFAULT 0;
