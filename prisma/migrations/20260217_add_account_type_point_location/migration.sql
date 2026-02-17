-- Add account_type column to distinguish districts from other entity types
ALTER TABLE "districts" ADD COLUMN "account_type" VARCHAR(20) NOT NULL DEFAULT 'district';

-- Add point_location for geocoded lat/lng (non-district accounts without polygon geometry)
-- Using AddGeometryColumn for PostGIS compatibility
SELECT AddGeometryColumn('public', 'districts', 'point_location', 4326, 'POINT', 2);

-- Index for filtering by account type
CREATE INDEX idx_districts_account_type ON districts (account_type);

-- Spatial index for point_location queries in tile serving
CREATE INDEX idx_districts_point_location ON districts USING GIST (point_location);
