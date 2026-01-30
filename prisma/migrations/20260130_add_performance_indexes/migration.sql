-- Add missing indexes for performance optimization

-- District indexes for common query patterns
CREATE INDEX IF NOT EXISTS "districts_state_abbrev_idx" ON "districts"("state_abbrev");
CREATE INDEX IF NOT EXISTS "districts_state_abbrev_is_customer_idx" ON "districts"("state_abbrev", "is_customer");
CREATE INDEX IF NOT EXISTS "districts_state_abbrev_has_open_pipeline_idx" ON "districts"("state_abbrev", "has_open_pipeline");
CREATE INDEX IF NOT EXISTS "districts_sales_executive_idx" ON "districts"("sales_executive");

-- Contact index for FK lookups
CREATE INDEX IF NOT EXISTS "contacts_leaid_idx" ON "contacts"("leaid");
