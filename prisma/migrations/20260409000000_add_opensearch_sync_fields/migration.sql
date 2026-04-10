-- AlterTable: opportunities — add 6 new OpenSearch sync fields
ALTER TABLE "opportunities"
  ADD COLUMN "minimum_purchase_amount" DECIMAL(15,2),
  ADD COLUMN "maximum_budget" DECIMAL(15,2),
  ADD COLUMN "details_link" TEXT,
  ADD COLUMN "stage_history" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "start_date" TIMESTAMPTZ,
  ADD COLUMN "expiration" TIMESTAMPTZ;

-- AlterTable: sessions — add 3 new OpenSearch sync fields
ALTER TABLE "sessions"
  ADD COLUMN "type" TEXT,
  ADD COLUMN "status" TEXT,
  ADD COLUMN "service_name" TEXT;
