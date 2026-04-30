-- Wave 1 backend foundations: extend Activity with handoff outcome fields.
-- Existing `outcome` text + `outcome_type` legacy enum stay untouched; the new
-- columns layer the redesigned Outcome panel data on top (sentiment, next-step
-- prompt, follow-up reminder, deal impact, and the 4-way disposition enum).

ALTER TABLE "activities" ADD COLUMN "sentiment" VARCHAR(10);
ALTER TABLE "activities" ADD COLUMN "next_step" TEXT;
ALTER TABLE "activities" ADD COLUMN "follow_up_date" TIMESTAMP(3);
ALTER TABLE "activities" ADD COLUMN "deal_impact" VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE "activities" ADD COLUMN "outcome_disposition" VARCHAR(20);

CREATE INDEX "activities_follow_up_date_idx"
  ON "activities" ("follow_up_date")
  WHERE "follow_up_date" IS NOT NULL;
