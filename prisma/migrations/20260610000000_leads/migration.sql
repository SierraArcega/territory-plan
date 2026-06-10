-- Migration: leads
-- BDR lead-management pipeline. Core invariant: engagement activity is never
-- owned by a lead — it lives on the durable records (contact, school,
-- district) via the activity junctions, so history survives disqualification
-- or deletion. Only lifecycle events live on the lead.
--  - leads: the pipeline object referencing contact + school + district;
--    status: new | working | meeting_scheduled | sales_qualified | unqualified.
--    opportunity_id points at the native Stage 0 opportunity created when the
--    lead reaches meeting_scheduled (or one linked manually).
--  - lead_events: lifecycle-only event log (created / accepted / restaged /
--    opp_created / opp_advanced / disqualified / note); cascade-deletes with
--    the lead. Engagement never lands here.
--  - activity_schools: school-keyed engagement junction, mirroring
--    activity_districts / activity_contacts.
--  - contacts.school_ncessch: nullable workplace-school FK (null = district
--    office). Coexists with the school_contacts junction used elsewhere.

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "school_ncessch" VARCHAR(12);

-- CreateTable
CREATE TABLE "activity_schools" (
    "activity_id" TEXT NOT NULL,
    "ncessch" VARCHAR(12) NOT NULL,

    CONSTRAINT "activity_schools_pkey" PRIMARY KEY ("activity_id","ncessch")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "school_ncessch" VARCHAR(12),
    "leaid" VARCHAR(7) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "score" INTEGER NOT NULL DEFAULT 0,
    "lead_type" VARCHAR(30),
    "sequence" VARCHAR(100),
    "marketing_owner" VARCHAR(255),
    "assigned_bdr_id" UUID,
    "unqualified_reason" VARCHAR(255),
    "opportunity_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_events" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "payload" JSONB,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_schools_ncessch_idx" ON "activity_schools"("ncessch");

-- CreateIndex
CREATE INDEX "leads_assigned_bdr_id_status_idx" ON "leads"("assigned_bdr_id", "status");

-- CreateIndex
CREATE INDEX "leads_leaid_idx" ON "leads"("leaid");

-- CreateIndex
CREATE INDEX "leads_contact_id_idx" ON "leads"("contact_id");

-- CreateIndex
CREATE INDEX "lead_events_lead_id_idx" ON "lead_events"("lead_id");

-- CreateIndex
CREATE INDEX "contacts_school_ncessch_idx" ON "contacts"("school_ncessch");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_school_ncessch_fkey" FOREIGN KEY ("school_ncessch") REFERENCES "schools"("ncessch") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_schools" ADD CONSTRAINT "activity_schools_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_schools" ADD CONSTRAINT "activity_schools_ncessch_fkey" FOREIGN KEY ("ncessch") REFERENCES "schools"("ncessch") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_school_ncessch_fkey" FOREIGN KEY ("school_ncessch") REFERENCES "schools"("ncessch") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_bdr_id_fkey" FOREIGN KEY ("assigned_bdr_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
