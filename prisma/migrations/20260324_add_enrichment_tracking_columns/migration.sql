-- AlterTable
ALTER TABLE "territory_plans" ADD COLUMN "enrichment_started_at" TIMESTAMP(3);
ALTER TABLE "territory_plans" ADD COLUMN "enrichment_queued" INTEGER;
ALTER TABLE "territory_plans" ADD COLUMN "enrichment_activity_id" UUID;
