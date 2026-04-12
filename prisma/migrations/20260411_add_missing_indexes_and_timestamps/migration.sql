-- Add missing indexes and updatedAt timestamps for MCP query support and incremental sync.
-- See plan: Docs/superpowers/plans/2026-04-11-schema-quick-wins.md

-- Indexes for MCP query support
CREATE INDEX IF NOT EXISTS "districts_icp_tier_idx" ON "districts"("icp_tier");
CREATE INDEX IF NOT EXISTS "districts_account_type_idx" ON "districts"("account_type");
CREATE INDEX IF NOT EXISTS "activities_type_start_date_idx" ON "activities"("type", "start_date");
CREATE INDEX IF NOT EXISTS "district_financials_fiscal_year_idx" ON "district_financials"("fiscal_year");

-- Timestamps for incremental sync support
ALTER TABLE "district_data_history" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "district_grade_enrollment" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "district_grade_enrollment" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "unmatched_accounts" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
