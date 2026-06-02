-- Migration: district_collaborators_watchers
-- Per-district membership beyond the single owner_id:
--  - district_collaborators: people who actively work the account. source='auto'
--    rows are maintained by the owner/collaborator sync (non-owner reps with an
--    open opp on, or a territory-plan target for, the district); source='manual'
--    rows are user-added and never removed by the sync.
--  - district_watchers: people who want progress updates (no edit/owner rights).
--    Notification delivery is deferred; this stores the subscription only.

-- CreateTable
CREATE TABLE "district_collaborators" (
    "district_leaid" VARCHAR(7) NOT NULL,
    "user_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "district_collaborators_pkey" PRIMARY KEY ("district_leaid", "user_id")
);

-- CreateTable
CREATE TABLE "district_watchers" (
    "district_leaid" VARCHAR(7) NOT NULL,
    "user_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "district_watchers_pkey" PRIMARY KEY ("district_leaid", "user_id")
);

-- CreateIndex
CREATE INDEX "district_collaborators_user_id_idx" ON "district_collaborators" ("user_id");

-- CreateIndex
CREATE INDEX "district_watchers_user_id_idx" ON "district_watchers" ("user_id");

-- AddForeignKey
ALTER TABLE "district_collaborators" ADD CONSTRAINT "district_collaborators_district_leaid_fkey" FOREIGN KEY ("district_leaid") REFERENCES "districts" ("leaid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_collaborators" ADD CONSTRAINT "district_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_watchers" ADD CONSTRAINT "district_watchers_district_leaid_fkey" FOREIGN KEY ("district_leaid") REFERENCES "districts" ("leaid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_watchers" ADD CONSTRAINT "district_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
