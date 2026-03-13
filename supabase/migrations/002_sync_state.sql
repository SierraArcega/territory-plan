-- Sync state table for incremental sync tracking
CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Composite index for pipeline aggregate queries (R3 from audit)
CREATE INDEX IF NOT EXISTS idx_opps_district_yr_stage
    ON opportunities (district_lea_id, school_yr, stage);
