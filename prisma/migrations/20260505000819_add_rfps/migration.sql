-- Drop the empty PascalCase tables created by the prior incarnation of this migration.
-- They were created in the same commit (6f48c699) and have no data.
DROP TABLE IF EXISTS "Rfp" CASCADE;
DROP TABLE IF EXISTS "RfpIngestRun" CASCADE;

-- CreateTable
CREATE TABLE "rfps" (
    "id" SERIAL NOT NULL,
    "external_id" TEXT NOT NULL,
    "version_key" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'highergov',
    "title" TEXT NOT NULL,
    "solicitation_number" TEXT,
    "opp_type" TEXT,
    "description" TEXT,
    "ai_summary" TEXT,
    "agency_key" INTEGER NOT NULL,
    "agency_name" TEXT NOT NULL,
    "agency_path" TEXT,
    "state_abbrev" VARCHAR(2),
    "state_fips" VARCHAR(2),
    "pop_city" TEXT,
    "pop_zip" TEXT,
    "leaid" VARCHAR(7),
    "naics_code" TEXT,
    "psc_code" TEXT,
    "set_aside" TEXT,
    "value_low" DECIMAL(15,2),
    "value_high" DECIMAL(15,2),
    "primary_contact_name" TEXT,
    "primary_contact_email" TEXT,
    "primary_contact_phone" TEXT,
    "posted_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "captured_date" TIMESTAMP(3) NOT NULL,
    "highergov_url" TEXT,
    "source_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "raw_payload" JSONB NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfp_ingest_runs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'highergov',
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "watermark" TIMESTAMP(3),
    "records_seen" INTEGER NOT NULL DEFAULT 0,
    "records_new" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_resolved" INTEGER NOT NULL DEFAULT 0,
    "records_unresolved" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "rfp_ingest_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rfps_external_id_key" ON "rfps"("external_id");

-- CreateIndex
CREATE INDEX "rfps_leaid_due_date_idx" ON "rfps"("leaid", "due_date");

-- CreateIndex
CREATE INDEX "rfps_state_fips_due_date_idx" ON "rfps"("state_fips", "due_date");

-- CreateIndex
CREATE INDEX "rfps_agency_key_idx" ON "rfps"("agency_key");

-- CreateIndex
CREATE INDEX "rfps_captured_date_idx" ON "rfps"("captured_date");

-- CreateIndex
CREATE INDEX "rfps_status_due_date_idx" ON "rfps"("status", "due_date");

-- CreateIndex
CREATE INDEX "rfp_ingest_runs_source_status_started_at_idx" ON "rfp_ingest_runs"("source", "status", "started_at");

-- CreateIndex
CREATE INDEX "rfp_ingest_runs_source_finished_at_idx" ON "rfp_ingest_runs"("source", "finished_at");

-- AddForeignKey
ALTER TABLE "rfps" ADD CONSTRAINT "rfps_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE SET NULL ON UPDATE CASCADE;
