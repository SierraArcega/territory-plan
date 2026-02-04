-- Create flexible activities tables
-- Activities can now link to multiple plans, districts, contacts, and states

-- Main activities table
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'planned',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- Junction table: activities <-> territory_plans
CREATE TABLE "activity_plans" (
    "activity_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,

    CONSTRAINT "activity_plans_pkey" PRIMARY KEY ("activity_id","plan_id")
);

-- Junction table: activities <-> districts
CREATE TABLE "activity_districts" (
    "activity_id" TEXT NOT NULL,
    "district_leaid" VARCHAR(7) NOT NULL,
    "warning_dismissed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "activity_districts_pkey" PRIMARY KEY ("activity_id","district_leaid")
);

-- Junction table: activities <-> contacts
CREATE TABLE "activity_contacts" (
    "activity_id" TEXT NOT NULL,
    "contact_id" INTEGER NOT NULL,

    CONSTRAINT "activity_contacts_pkey" PRIMARY KEY ("activity_id","contact_id")
);

-- Junction table: activities <-> states
CREATE TABLE "activity_states" (
    "activity_id" TEXT NOT NULL,
    "state_fips" VARCHAR(2) NOT NULL,
    "is_explicit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "activity_states_pkey" PRIMARY KEY ("activity_id","state_fips")
);

-- Indexes for activities table
CREATE INDEX "activities_created_by_user_id_idx" ON "activities"("created_by_user_id");
CREATE INDEX "activities_type_idx" ON "activities"("type");
CREATE INDEX "activities_start_date_idx" ON "activities"("start_date");

-- Foreign key constraints for activity_plans
ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "territory_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key constraints for activity_districts
ALTER TABLE "activity_districts" ADD CONSTRAINT "activity_districts_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_districts" ADD CONSTRAINT "activity_districts_district_leaid_fkey" FOREIGN KEY ("district_leaid") REFERENCES "districts"("leaid") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key constraints for activity_contacts
ALTER TABLE "activity_contacts" ADD CONSTRAINT "activity_contacts_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_contacts" ADD CONSTRAINT "activity_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key constraints for activity_states
ALTER TABLE "activity_states" ADD CONSTRAINT "activity_states_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_states" ADD CONSTRAINT "activity_states_state_fips_fkey" FOREIGN KEY ("state_fips") REFERENCES "states"("fips") ON DELETE CASCADE ON UPDATE CASCADE;
