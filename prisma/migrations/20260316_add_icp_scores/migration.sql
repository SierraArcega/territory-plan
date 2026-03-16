-- Add ICP scoring columns to districts
ALTER TABLE "districts"
  ADD COLUMN "icp_composite_score" INTEGER,
  ADD COLUMN "icp_fit_score" INTEGER,
  ADD COLUMN "icp_value_score" INTEGER,
  ADD COLUMN "icp_readiness_score" INTEGER,
  ADD COLUMN "icp_state_score" INTEGER,
  ADD COLUMN "icp_tier" VARCHAR(10);

-- Add state-level ICP aggregates
ALTER TABLE "states"
  ADD COLUMN "icp_avg_score" REAL,
  ADD COLUMN "icp_t1_count" INTEGER DEFAULT 0,
  ADD COLUMN "icp_t2_count" INTEGER DEFAULT 0,
  ADD COLUMN "icp_churn_penalty" INTEGER DEFAULT 0;

-- Index for tier-based queries
CREATE INDEX "idx_districts_icp_tier" ON "districts" ("icp_tier");
CREATE INDEX "idx_districts_icp_composite" ON "districts" ("icp_composite_score" DESC);
