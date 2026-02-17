-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "job_title" VARCHAR(255),
ADD COLUMN     "location" VARCHAR(255),
ADD COLUMN     "phone" VARCHAR(50),
ADD COLUMN     "slack_url" VARCHAR(500);
