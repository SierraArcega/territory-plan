-- AlterTable
ALTER TABLE "calendar_connections" ADD COLUMN "sync_direction" VARCHAR(20) NOT NULL DEFAULT 'two_way';
ALTER TABLE "calendar_connections" ADD COLUMN "synced_activity_types" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "calendar_connections" ADD COLUMN "reminder_minutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "calendar_connections" ADD COLUMN "second_reminder_minutes" INTEGER;
