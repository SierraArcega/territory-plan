-- CreateTable
CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" TIMESTAMPTZ NOT NULL,
    "end_date" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "soft_reset_tiers" INTEGER NOT NULL DEFAULT 1,
    "season_weight" DECIMAL(3,2) NOT NULL DEFAULT 0.6,
    "pipeline_weight" DECIMAL(3,2) NOT NULL DEFAULT 0.2,
    "take_weight" DECIMAL(3,2) NOT NULL DEFAULT 0.2,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_metrics" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "point_value" INTEGER NOT NULL,
    "label" VARCHAR(100) NOT NULL,

    CONSTRAINT "season_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_scores" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "tier" VARCHAR(20) NOT NULL DEFAULT 'iron_3',
    "rank" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "season_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_tier_thresholds" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "tier" VARCHAR(20) NOT NULL,
    "min_points" INTEGER NOT NULL,

    CONSTRAINT "season_tier_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "season_metrics_season_id_idx" ON "season_metrics"("season_id");

-- CreateIndex
CREATE UNIQUE INDEX "season_scores_season_id_user_id_key" ON "season_scores"("season_id", "user_id");

-- CreateIndex
CREATE INDEX "season_scores_season_id_total_points_idx" ON "season_scores"("season_id", "total_points" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "season_tier_thresholds_season_id_tier_key" ON "season_tier_thresholds"("season_id", "tier");

-- CreateIndex
CREATE INDEX "season_tier_thresholds_season_id_idx" ON "season_tier_thresholds"("season_id");

-- AddForeignKey
ALTER TABLE "season_metrics" ADD CONSTRAINT "season_metrics_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_scores" ADD CONSTRAINT "season_scores_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_scores" ADD CONSTRAINT "season_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_tier_thresholds" ADD CONSTRAINT "season_tier_thresholds_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
