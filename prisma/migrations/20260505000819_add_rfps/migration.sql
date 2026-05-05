-- CreateTable
CREATE TABLE "Rfp" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "versionKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'highergov',
    "title" TEXT NOT NULL,
    "solicitationNumber" TEXT,
    "oppType" TEXT,
    "description" TEXT,
    "aiSummary" TEXT,
    "agencyKey" INTEGER NOT NULL,
    "agencyName" TEXT NOT NULL,
    "agencyPath" TEXT,
    "stateAbbrev" VARCHAR(2),
    "stateFips" VARCHAR(2),
    "popCity" TEXT,
    "popZip" TEXT,
    "leaid" VARCHAR(7),
    "naicsCode" TEXT,
    "pscCode" TEXT,
    "setAside" TEXT,
    "valueLow" DECIMAL(15,2),
    "valueHigh" DECIMAL(15,2),
    "primaryContactName" TEXT,
    "primaryContactEmail" TEXT,
    "primaryContactPhone" TEXT,
    "postedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "capturedDate" TIMESTAMP(3) NOT NULL,
    "highergovUrl" TEXT,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "rawPayload" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpIngestRun" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'highergov',
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "watermark" TIMESTAMP(3),
    "recordsSeen" INTEGER NOT NULL DEFAULT 0,
    "recordsNew" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsResolved" INTEGER NOT NULL DEFAULT 0,
    "recordsUnresolved" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "RfpIngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rfp_externalId_key" ON "Rfp"("externalId");

-- CreateIndex
CREATE INDEX "Rfp_leaid_dueDate_idx" ON "Rfp"("leaid", "dueDate");

-- CreateIndex
CREATE INDEX "Rfp_stateFips_dueDate_idx" ON "Rfp"("stateFips", "dueDate");

-- CreateIndex
CREATE INDEX "Rfp_agencyKey_idx" ON "Rfp"("agencyKey");

-- CreateIndex
CREATE INDEX "Rfp_capturedDate_idx" ON "Rfp"("capturedDate");

-- CreateIndex
CREATE INDEX "Rfp_status_dueDate_idx" ON "Rfp"("status", "dueDate");

-- CreateIndex
CREATE INDEX "RfpIngestRun_source_status_startedAt_idx" ON "RfpIngestRun"("source", "status", "startedAt");

-- CreateIndex
CREATE INDEX "RfpIngestRun_source_finishedAt_idx" ON "RfpIngestRun"("source", "finishedAt");

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE SET NULL ON UPDATE CASCADE;
