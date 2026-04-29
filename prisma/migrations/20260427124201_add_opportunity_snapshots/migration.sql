-- Migration: add_opportunity_snapshots
--
-- Creates the opportunity_snapshots table used by /api/cron/pipeline-snapshot
-- to capture daily point-in-time copies of each opportunity's key fields.
-- One row per (opportunity_id, snapshot_date) — the unique constraint plus
-- ON CONFLICT DO UPDATE in the cron route makes same-day re-runs idempotent.
--
-- Uses IF NOT EXISTS clauses because this table was already created out-of-band
-- in production prior to this migration landing. Fresh databases will create
-- it; production no-ops.

CREATE TABLE IF NOT EXISTS "opportunity_snapshots" (
  "id"                      BIGSERIAL PRIMARY KEY,
  "snapshot_date"           DATE NOT NULL,
  "opportunity_id"          TEXT NOT NULL,
  "stage"                   TEXT,
  "net_booking_amount"      DECIMAL(15, 2),
  "minimum_purchase_amount" DECIMAL(15, 2),
  "maximum_budget"          DECIMAL(15, 2),
  "school_yr"               TEXT,
  "sales_rep_id"            UUID,
  "district_lea_id"         VARCHAR(7),
  "close_date"              TIMESTAMPTZ,
  "expiration"              TIMESTAMPTZ,
  "captured_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunity_snapshots_opportunity_id_snapshot_date_key'
  ) THEN
    ALTER TABLE "opportunity_snapshots"
      ADD CONSTRAINT "opportunity_snapshots_opportunity_id_snapshot_date_key"
      UNIQUE ("opportunity_id", "snapshot_date");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "opportunity_snapshots_snapshot_date_idx"
  ON "opportunity_snapshots"("snapshot_date");
CREATE INDEX IF NOT EXISTS "opportunity_snapshots_school_yr_snapshot_date_idx"
  ON "opportunity_snapshots"("school_yr", "snapshot_date");
CREATE INDEX IF NOT EXISTS "opportunity_snapshots_opportunity_id_idx"
  ON "opportunity_snapshots"("opportunity_id");
