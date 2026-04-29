-- Migration: add_audit_log_and_snapshots
--
-- Creates:
--   1. audit_log            — column-level change tracking, driven by triggers
--   2. opportunity_snapshots — weekly point-in-time copies of key opp fields
--   3. trigger function + per-table triggers on opportunities,
--      territory_plan_districts, user_goals
--
-- Design notes:
--   • changed_by is populated from current_setting('app.user_id', true), which
--     returns NULL if the session variable isn't set. App code should call
--     SET LOCAL app.user_id = '<uuid>' inside a transaction before mutations
--     when it wants to attribute changes. v1 leaves it nullable so migrations
--     and ETL writes still work.
--   • We only audit columns we actually care about — keeps storage bounded.
--     Add or remove entries from the arrays below to change tracked fields.
--   • Snapshots are dropped and rewritten for the same (opp, date) pair via
--     an INSERT ... ON CONFLICT in the cron route, so re-running the cron is safe.

-- ===== audit_log =====
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id"          BIGSERIAL PRIMARY KEY,
  "table_name"  VARCHAR(64) NOT NULL,
  "row_pk"      TEXT NOT NULL,
  "column_name" VARCHAR(64) NOT NULL,
  "old_value"   TEXT,
  "new_value"   TEXT,
  "changed_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changed_by"  UUID
);

CREATE INDEX IF NOT EXISTS "audit_log_table_name_row_pk_idx"
  ON "audit_log"("table_name", "row_pk");
CREATE INDEX IF NOT EXISTS "audit_log_table_name_column_name_changed_at_idx"
  ON "audit_log"("table_name", "column_name", "changed_at");
CREATE INDEX IF NOT EXISTS "audit_log_changed_at_idx"
  ON "audit_log"("changed_at");

-- ===== opportunity_snapshots =====
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

ALTER TABLE "opportunity_snapshots"
  ADD CONSTRAINT "opportunity_snapshots_opportunity_id_snapshot_date_key"
  UNIQUE ("opportunity_id", "snapshot_date");

CREATE INDEX IF NOT EXISTS "opportunity_snapshots_snapshot_date_idx"
  ON "opportunity_snapshots"("snapshot_date");
CREATE INDEX IF NOT EXISTS "opportunity_snapshots_school_yr_snapshot_date_idx"
  ON "opportunity_snapshots"("school_yr", "snapshot_date");
CREATE INDEX IF NOT EXISTS "opportunity_snapshots_opportunity_id_idx"
  ON "opportunity_snapshots"("opportunity_id");

-- ===== Generic audit trigger function =====
-- Takes the tracked columns as its first TG_ARGV entry (comma-separated) and
-- the primary-key column name(s) as the second (colon-separated for composites).
CREATE OR REPLACE FUNCTION audit_track_changes() RETURNS TRIGGER AS $$
DECLARE
  tracked_cols TEXT[];
  pk_cols      TEXT[];
  col_name     TEXT;
  pk_col       TEXT;
  old_json     JSONB;
  new_json     JSONB;
  old_val      TEXT;
  new_val      TEXT;
  pk_value     TEXT := '';
  pk_part      TEXT;
  changed_by   UUID;
BEGIN
  tracked_cols := string_to_array(TG_ARGV[0], ',');
  pk_cols := string_to_array(TG_ARGV[1], ':');

  old_json := row_to_json(OLD)::jsonb;
  new_json := row_to_json(NEW)::jsonb;

  -- Build the PK string (single or composite, colon-joined for composites)
  FOREACH pk_col IN ARRAY pk_cols LOOP
    pk_part := new_json->>pk_col;
    IF pk_value = '' THEN
      pk_value := pk_part;
    ELSE
      pk_value := pk_value || ':' || pk_part;
    END IF;
  END LOOP;

  -- Pull user id from session var; NULL if app didn't set it
  BEGIN
    changed_by := nullif(current_setting('app.user_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    changed_by := NULL;
  END;

  FOREACH col_name IN ARRAY tracked_cols LOOP
    old_val := old_json->>col_name;
    new_val := new_json->>col_name;
    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO audit_log (table_name, row_pk, column_name, old_value, new_value, changed_by)
      VALUES (TG_TABLE_NAME, pk_value, col_name, old_val, new_val, changed_by);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== Triggers per tracked table =====

DROP TRIGGER IF EXISTS opportunities_audit_trigger ON opportunities;
CREATE TRIGGER opportunities_audit_trigger
  AFTER UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION audit_track_changes(
    'net_booking_amount,minimum_purchase_amount,maximum_budget,stage,school_yr,close_date,expiration,sales_rep_id',
    'id'
  );

DROP TRIGGER IF EXISTS territory_plan_districts_audit_trigger ON territory_plan_districts;
CREATE TRIGGER territory_plan_districts_audit_trigger
  AFTER UPDATE ON territory_plan_districts
  FOR EACH ROW
  EXECUTE FUNCTION audit_track_changes(
    'renewal_target,winback_target,expansion_target,new_business_target,notes',
    'plan_id:district_leaid'
  );

DROP TRIGGER IF EXISTS user_goals_audit_trigger ON user_goals;
CREATE TRIGGER user_goals_audit_trigger
  AFTER UPDATE ON user_goals
  FOR EACH ROW
  EXECUTE FUNCTION audit_track_changes(
    'earnings_target,take_target,take_rate_percent,renewal_target,winback_target,expansion_target,new_business_target,new_districts_target',
    'id'
  );
