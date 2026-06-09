-- CreateEnum
CREATE TYPE "signature_status" AS ENUM ('sent', 'viewed', 'signed', 'declined', 'canceled', 'error');

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" SERIAL NOT NULL,
    "doc_type" TEXT NOT NULL,
    "doc_url" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "signature_request_id" TEXT,
    "recipient_email" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "status" "signature_status" NOT NULL DEFAULT 'sent',
    "error_message" TEXT,
    "district_lea_id" VARCHAR(7),
    "owner_profile_id" UUID NOT NULL,
    "opportunity_id" TEXT,
    "sent_at" TIMESTAMPTZ,
    "signed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generated_documents_signature_request_id_key" ON "generated_documents"("signature_request_id");

-- CreateIndex
CREATE INDEX "generated_documents_owner_profile_id_idx" ON "generated_documents"("owner_profile_id");
