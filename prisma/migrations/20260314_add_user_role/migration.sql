-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'user');

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'user';
