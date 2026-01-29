#!/bin/bash

# Generate PMTiles from PostGIS database
# Requires: tippecanoe (brew install tippecanoe), ogr2ogr (brew install gdal)
#
# Usage: ./scripts/generate-tiles.sh [output-dir]
#
# This script:
# 1. Exports district boundaries from PostgreSQL to GeoJSON
# 2. Converts to PMTiles format for efficient tile serving
# 3. Optionally uploads to Supabase Storage

set -e

# Configuration
OUTPUT_DIR="${1:-./tiles}"
GEOJSON_FILE="$OUTPUT_DIR/districts.geojson"
PMTILES_FILE="$OUTPUT_DIR/districts.pmtiles"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Verify required tools
command -v ogr2ogr >/dev/null 2>&1 || { echo "Error: ogr2ogr not found. Install with: brew install gdal"; exit 1; }
command -v tippecanoe >/dev/null 2>&1 || { echo "Error: tippecanoe not found. Install with: brew install tippecanoe"; exit 1; }

# Check database URL
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not set. Please configure .env file."
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "=== Step 1: Exporting districts to GeoJSON ==="
# Export with customer/pipeline status for styling
ogr2ogr -f GeoJSON "$GEOJSON_FILE" \
    "PG:$DATABASE_URL" \
    -sql "SELECT
        d.leaid,
        d.name,
        d.state_abbrev,
        d.enrollment,
        COALESCE(f.is_customer, false) as is_customer,
        COALESCE(f.has_open_pipeline, false) as has_open_pipeline,
        f.sales_executive,
        ST_Transform(geometry, 4326) as geometry
    FROM districts d
    LEFT JOIN fullmind_data f ON d.leaid = f.leaid
    WHERE geometry IS NOT NULL"

echo "GeoJSON exported to: $GEOJSON_FILE"
echo "File size: $(du -h "$GEOJSON_FILE" | cut -f1)"

echo ""
echo "=== Step 2: Converting to PMTiles ==="
tippecanoe \
    --output="$PMTILES_FILE" \
    --force \
    --name="School Districts" \
    --description="US School District boundaries with Fullmind data" \
    --attribution="NCES EDGE" \
    --minimum-zoom=2 \
    --maximum-zoom=12 \
    --simplification=10 \
    --detect-shared-borders \
    --coalesce-smallest-as-needed \
    --extend-zooms-if-still-dropping \
    --layer=districts \
    "$GEOJSON_FILE"

echo "PMTiles generated: $PMTILES_FILE"
echo "File size: $(du -h "$PMTILES_FILE" | cut -f1)"

# Clean up intermediate GeoJSON (optional)
# rm "$GEOJSON_FILE"

echo ""
echo "=== Done! ==="
echo ""
echo "Next steps:"
echo "1. Upload $PMTILES_FILE to Supabase Storage (bucket: 'tiles')"
echo "2. Make the bucket public or configure RLS"
echo "3. Update MapContainer.tsx to use PMTiles URL"
echo ""
echo "To upload with Supabase CLI:"
echo "  supabase storage cp $PMTILES_FILE tiles/districts.pmtiles"
