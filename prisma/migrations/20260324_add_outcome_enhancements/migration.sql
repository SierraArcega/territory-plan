-- Activity outcome rating
ALTER TABLE "activities" ADD COLUMN "rating" INTEGER;

-- Activity-Opportunity junction table
CREATE TABLE "activity_opportunities" (
    "activity_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_opportunities_pkey" PRIMARY KEY ("activity_id","opportunity_id")
);

CREATE INDEX "activity_opportunities_opportunity_id_idx" ON "activity_opportunities"("opportunity_id");

ALTER TABLE "activity_opportunities" ADD CONSTRAINT "activity_opportunities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_opportunities" ADD CONSTRAINT "activity_opportunities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task assignment
ALTER TABLE "tasks" ADD COLUMN "assigned_to_user_id" UUID;

CREATE INDEX "tasks_assigned_to_user_id_idx" ON "tasks"("assigned_to_user_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
