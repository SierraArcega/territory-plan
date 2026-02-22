-- CreateTable
CREATE TABLE "map_views" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_views_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "map_views" ADD CONSTRAINT "map_views_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
