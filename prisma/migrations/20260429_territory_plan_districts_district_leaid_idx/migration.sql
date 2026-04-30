-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "territory_plan_districts_district_leaid_idx"
    ON "territory_plan_districts"("district_leaid");
