-- Add admin fields to seasons table
ALTER TABLE "seasons" ADD COLUMN "season_uid" VARCHAR(30);
ALTER TABLE "seasons" ADD COLUMN "show_name" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "seasons" ADD COLUMN "show_dates" BOOLEAN NOT NULL DEFAULT true;

-- Make end_date nullable
ALTER TABLE "seasons" ALTER COLUMN "end_date" DROP NOT NULL;

-- Add unique constraint on season_uid
CREATE UNIQUE INDEX "seasons_season_uid_key" ON "seasons"("season_uid");

-- Add weight to season_metrics
ALTER TABLE "season_metrics" ADD COLUMN "weight" DECIMAL(4,2) NOT NULL DEFAULT 1.0;

-- Create metric_registry table
CREATE TABLE "metric_registry" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "category" VARCHAR(50) NOT NULL,

    CONSTRAINT "metric_registry_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on action
CREATE UNIQUE INDEX "metric_registry_action_key" ON "metric_registry"("action");
