-- CreateTable
CREATE TABLE "agency_district_maps" (
    "agency_key"   INTEGER PRIMARY KEY,
    "kind"         TEXT NOT NULL,
    "leaid"        VARCHAR(7),
    "state_fips"   VARCHAR(2),
    "source"       TEXT NOT NULL DEFAULT 'highergov',
    "notes"        TEXT,
    "resolved_by"  TEXT,
    "resolved_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "agency_district_maps_kind_check" CHECK (kind IN ('district', 'state', 'non_lea')),
    CONSTRAINT "agency_district_maps_kind_consistency_check" CHECK (
        (kind = 'district' AND leaid IS NOT NULL AND state_fips IS NULL) OR
        (kind = 'state'    AND leaid IS NULL     AND state_fips IS NOT NULL) OR
        (kind = 'non_lea'  AND leaid IS NULL     AND state_fips IS NULL)
    ),
    CONSTRAINT "agency_district_maps_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "agency_district_maps_kind_idx"  ON "agency_district_maps" ("kind");
CREATE INDEX "agency_district_maps_leaid_idx" ON "agency_district_maps" ("leaid");
