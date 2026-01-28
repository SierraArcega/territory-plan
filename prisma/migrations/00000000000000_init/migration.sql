-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateTable
CREATE TABLE "districts" (
    "leaid" VARCHAR(7) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "state_fips" VARCHAR(2) NOT NULL,
    "state_abbrev" VARCHAR(2),
    "mtfcc" VARCHAR(5),
    "sdtyp" VARCHAR(1),
    "funcstat" VARCHAR(1) DEFAULT 'E',
    "lograde" VARCHAR(2),
    "higrade" VARCHAR(2),
    "enrollment" INTEGER,
    "urban_institute_year" INTEGER,
    "geometry" GEOMETRY(MultiPolygon, 4326),
    "centroid" GEOMETRY(Point, 4326),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("leaid")
);

-- CreateTable
CREATE TABLE "fullmind_data" (
    "leaid" VARCHAR(7) NOT NULL,
    "account_name" VARCHAR(255),
    "sales_executive" VARCHAR(100),
    "lmsid" VARCHAR(50),
    "fy25_sessions_revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy25_sessions_take" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy25_sessions_count" INTEGER NOT NULL DEFAULT 0,
    "fy26_sessions_revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy26_sessions_take" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy26_sessions_count" INTEGER NOT NULL DEFAULT 0,
    "fy25_closed_won_opp_count" INTEGER NOT NULL DEFAULT 0,
    "fy25_closed_won_net_booking" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy25_net_invoicing" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy26_closed_won_opp_count" INTEGER NOT NULL DEFAULT 0,
    "fy26_closed_won_net_booking" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy26_net_invoicing" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy26_open_pipeline_opp_count" INTEGER NOT NULL DEFAULT 0,
    "fy26_open_pipeline" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy26_open_pipeline_weighted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy27_open_pipeline_opp_count" INTEGER NOT NULL DEFAULT 0,
    "fy27_open_pipeline" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy27_open_pipeline_weighted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_customer" BOOLEAN NOT NULL DEFAULT false,
    "has_open_pipeline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fullmind_data_pkey" PRIMARY KEY ("leaid")
);

-- CreateTable
CREATE TABLE "district_edits" (
    "leaid" VARCHAR(7) NOT NULL,
    "notes" TEXT,
    "owner" VARCHAR(100),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "district_edits_pkey" PRIMARY KEY ("leaid")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "district_tags" (
    "district_leaid" VARCHAR(7) NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "district_tags_pkey" PRIMARY KEY ("district_leaid","tag_id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" SERIAL NOT NULL,
    "leaid" VARCHAR(7) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unmatched_accounts" (
    "id" SERIAL NOT NULL,
    "account_name" VARCHAR(255) NOT NULL,
    "sales_executive" VARCHAR(100),
    "state_abbrev" VARCHAR(2) NOT NULL,
    "lmsid" VARCHAR(50),
    "leaid_raw" VARCHAR(50),
    "match_failure_reason" VARCHAR(100) NOT NULL,
    "fy25_net_invoicing" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy26_net_invoicing" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy26_open_pipeline" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fy27_open_pipeline" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_customer" BOOLEAN NOT NULL DEFAULT false,
    "has_open_pipeline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unmatched_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_districts_geometry" ON "districts" USING GIST ("geometry");

-- CreateIndex
CREATE INDEX "idx_districts_state" ON "districts"("state_fips");

-- CreateIndex
CREATE INDEX "idx_fullmind_status" ON "fullmind_data"("is_customer", "has_open_pipeline");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "idx_unmatched_state" ON "unmatched_accounts"("state_abbrev");

-- AddForeignKey
ALTER TABLE "fullmind_data" ADD CONSTRAINT "fullmind_data_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_edits" ADD CONSTRAINT "district_edits_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_tags" ADD CONSTRAINT "district_tags_district_leaid_fkey" FOREIGN KEY ("district_leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_tags" ADD CONSTRAINT "district_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create view for map data with computed status
CREATE OR REPLACE VIEW district_map_data AS
SELECT
    d.leaid,
    d.name,
    d.state_fips,
    d.state_abbrev,
    d.geometry,
    d.centroid,
    COALESCE(f.is_customer, false) AS is_customer,
    COALESCE(f.has_open_pipeline, false) AS has_open_pipeline,
    CASE
        WHEN f.is_customer AND f.has_open_pipeline THEN 'customer_pipeline'
        WHEN f.is_customer THEN 'customer'
        WHEN f.has_open_pipeline THEN 'pipeline'
        ELSE 'no_data'
    END AS status_category,
    COALESCE(f.fy25_sessions_revenue, 0) AS fy25_sessions_revenue,
    COALESCE(f.fy25_sessions_take, 0) AS fy25_sessions_take,
    COALESCE(f.fy25_sessions_count, 0) AS fy25_sessions_count,
    COALESCE(f.fy26_sessions_revenue, 0) AS fy26_sessions_revenue,
    COALESCE(f.fy26_sessions_take, 0) AS fy26_sessions_take,
    COALESCE(f.fy26_sessions_count, 0) AS fy26_sessions_count,
    COALESCE(f.fy25_closed_won_net_booking, 0) AS fy25_closed_won_net_booking,
    COALESCE(f.fy25_net_invoicing, 0) AS fy25_net_invoicing,
    COALESCE(f.fy26_closed_won_net_booking, 0) AS fy26_closed_won_net_booking,
    COALESCE(f.fy26_net_invoicing, 0) AS fy26_net_invoicing,
    COALESCE(f.fy26_open_pipeline, 0) AS fy26_open_pipeline,
    COALESCE(f.fy26_open_pipeline_weighted, 0) AS fy26_open_pipeline_weighted,
    COALESCE(f.fy27_open_pipeline, 0) AS fy27_open_pipeline,
    COALESCE(f.fy27_open_pipeline_weighted, 0) AS fy27_open_pipeline_weighted
FROM districts d
LEFT JOIN fullmind_data f ON d.leaid = f.leaid;
