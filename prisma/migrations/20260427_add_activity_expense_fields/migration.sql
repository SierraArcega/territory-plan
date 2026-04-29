-- Wave 1 backend foundations: enrich ActivityExpense with category, date, and
-- receipt fields the redesigned Expenses panel needs. Existing rows are
-- backfilled to category='other' (DEFAULT) and incurred_on=created_at, then
-- incurred_on is locked to NOT NULL.

ALTER TABLE "activity_expenses" ADD COLUMN "category" VARCHAR(20) NOT NULL DEFAULT 'other';
ALTER TABLE "activity_expenses" ADD COLUMN "incurred_on" TIMESTAMP(3);
UPDATE "activity_expenses" SET "incurred_on" = "created_at" WHERE "incurred_on" IS NULL;
ALTER TABLE "activity_expenses" ALTER COLUMN "incurred_on" SET NOT NULL;
ALTER TABLE "activity_expenses" ADD COLUMN "receipt_storage_path" VARCHAR(500);
ALTER TABLE "activity_expenses" ADD COLUMN "created_by_id" UUID REFERENCES "user_profiles"("id");

CREATE INDEX "activity_expenses_category_idx" ON "activity_expenses" ("category");
