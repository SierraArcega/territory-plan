-- Composite index on lat/lng for bounding box queries
CREATE INDEX IF NOT EXISTS idx_schools_lat_lng
ON schools (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index on school_status for the WHERE clause filter
CREATE INDEX IF NOT EXISTS idx_schools_status
ON schools (school_status)
WHERE school_status = 1;
