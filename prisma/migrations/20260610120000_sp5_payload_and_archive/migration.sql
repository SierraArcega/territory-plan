-- SP5: deal payload + promoted report columns + executed-PDF archive fields.
-- 'rendered' = non-eSign outputs (BOCES quotes recorded at render time).
ALTER TYPE "signature_status" ADD VALUE 'rendered';
ALTER TABLE "generated_documents"
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "order_total" DECIMAL(12,2),
  ADD COLUMN "payment_type" TEXT,
  ADD COLUMN "start_date" DATE,
  ADD COLUMN "end_date" DATE,
  ADD COLUMN "school_year" TEXT,
  ADD COLUMN "quote_number" TEXT,
  ADD COLUMN "executed_pdf_url" TEXT,
  ADD COLUMN "executed_pdf_file_id" TEXT;
-- One row per BOCES quote number per rep — re-renders update in place.
CREATE UNIQUE INDEX "generated_documents_boces_quote_owner_key"
  ON "generated_documents" ("quote_number", "owner_profile_id")
  WHERE "doc_type" = 'boces_quote';
