-- Saved Views — Plans & Lists Sidebar
--
-- Adds the three tables that back the unified "My views" sidebar:
--   * saved_lists           — per-rep filtered queries over one of six sources
--   * saved_list_hidden     — per-user hide for a SavedList (shared lists)
--   * territory_plan_hidden — per-user hide for a TerritoryPlan
--
-- The filter tree is stored as opaque JSONB; its shape is validated by Zod at
-- the API boundary (src/lib/saved-views/schema.ts) and compiled to read-only
-- SQL via the @/lib/db-readonly pool for previews / list fetches.
--
-- Note re: A1 risk-mitigation index on Opportunity(planId, status):
-- the Opportunity model has no `plan_id` column. Plans relate to opps via the
-- territory_plan_districts.district_leaid → opportunities.district_lea_id join.
-- The composite index (district_lea_id, school_yr, stage) already exists on
-- the `opportunities` table (see prisma/schema.prisma) and covers the plan-
-- scoped open-opps aggregate used by GET /api/territory-plans?stats=1. No
-- additional index is required for the stats query.

-- ==========================================================================
-- 1. saved_lists — owner-scoped saved filter trees.
-- ==========================================================================
CREATE TABLE "saved_lists" (
    "id"                TEXT            NOT NULL,
    "owner_id"          UUID            NOT NULL,
    "name"              VARCHAR(200)    NOT NULL,
    "source"            VARCHAR(20)     NOT NULL,
    "filter_tree"       JSONB           NOT NULL,
    "scope_mode"        VARCHAR(20)     NOT NULL DEFAULT 'none',
    "scope_filter_tree" JSONB,
    "scope_ref_kind"    VARCHAR(10),
    "scope_ref_id"      TEXT,
    "shared"            BOOLEAN         NOT NULL DEFAULT FALSE,
    "created_at"        TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "saved_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saved_lists_owner_id_idx"
    ON "saved_lists" ("owner_id");

CREATE INDEX "saved_lists_shared_idx"
    ON "saved_lists" ("shared");

ALTER TABLE "saved_lists"
    ADD CONSTRAINT "saved_lists_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "user_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- 2. saved_list_hidden — per-user hide flag for saved lists.
-- ==========================================================================
CREATE TABLE "saved_list_hidden" (
    "list_id"   TEXT         NOT NULL,
    "user_id"   UUID         NOT NULL,
    "hidden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_list_hidden_pkey" PRIMARY KEY ("list_id", "user_id")
);

ALTER TABLE "saved_list_hidden"
    ADD CONSTRAINT "saved_list_hidden_list_id_fkey"
    FOREIGN KEY ("list_id") REFERENCES "saved_lists"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_list_hidden"
    ADD CONSTRAINT "saved_list_hidden_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================================================
-- 3. territory_plan_hidden — per-user hide flag for territory plans.
-- ==========================================================================
CREATE TABLE "territory_plan_hidden" (
    "plan_id"   TEXT         NOT NULL,
    "user_id"   UUID         NOT NULL,
    "hidden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territory_plan_hidden_pkey" PRIMARY KEY ("plan_id", "user_id")
);

ALTER TABLE "territory_plan_hidden"
    ADD CONSTRAINT "territory_plan_hidden_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "territory_plans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "territory_plan_hidden"
    ADD CONSTRAINT "territory_plan_hidden_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
