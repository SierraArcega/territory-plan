-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "service_type" TEXT,
    "session_price" DECIMAL(15,2),
    "educator_price" DECIMAL(15,2),
    "educator_approved_price" DECIMAL(15,2),
    "start_time" TIMESTAMPTZ,
    "synced_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_opportunity_id_idx" ON "sessions"("opportunity_id");

-- CreateIndex
CREATE INDEX "sessions_opportunity_id_service_type_idx" ON "sessions"("opportunity_id", "service_type");

-- CreateIndex
CREATE INDEX "sessions_start_time_idx" ON "sessions"("start_time");

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN "service_types" JSONB NOT NULL DEFAULT '[]';
