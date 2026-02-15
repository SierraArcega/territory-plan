# School Dots on Map — Design

**Date:** 2026-02-15
**Status:** Approved

## Goal

Display all ~100K schools as colored dots on the map when zoomed in. Dots are colored by school level. Hovering shows a tooltip. Clicking a school selects its parent district.

## Decisions

| Decision | Choice |
|----------|--------|
| Visibility | Always visible when zoomed in (zoom ~9-10+) |
| School scope | All schools (~100K), ETL loaded by state |
| Interaction | Hover tooltip + click highlights parent district |
| Styling | Color by school level (elementary/middle/high/other) |

## Approach: GeoJSON Source with Clustering

Fetch school points as GeoJSON from a new API endpoint. Use MapLibre's built-in clustering at medium zoom. Individual colored dots at high zoom.

### Why not vector tiles?

More complex, requires tile pipeline changes. GeoJSON with clustering handles 100K points well in MapLibre and is simpler to implement. Can upgrade to tiles later if needed.

### Why not client-side load all?

~100K points with properties = ~15-20MB GeoJSON. Too slow on initial load.

## Architecture

### Data Flow

1. ETL: Run `urban_institute_schools.py --no-charter-only` per state → populates `schools` table with lat/lng
2. API: New endpoint `GET /api/schools/geojson?bounds=w,s,e,n` returns GeoJSON FeatureCollection
3. Map: GeoJSON source with `cluster: true`, loads/reloads on viewport change (debounced)
4. Render: Cluster circles at medium zoom, individual school dots at high zoom
5. Hover: Tooltip with school name, enrollment, grade range
6. Click: Look up school's `leaid`, trigger district selection

### API Endpoint

```
GET /api/schools/geojson?bounds=-122.5,37.2,-121.8,37.9
```

Returns:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-122.1, 37.5] },
      "properties": {
        "ncessch": "060000100001",
        "name": "Lincoln Elementary",
        "leaid": "0600001",
        "schoolLevel": 1,
        "enrollment": 450,
        "lograde": "KG",
        "higrade": "05",
        "charter": 0
      }
    }
  ]
}
```

### Visual Design

| School Level | Value | Color |
|-------------|-------|-------|
| Elementary | 1 | Blue (#3B82F6) |
| Middle | 2 | Green (#10B981) |
| High | 3 | Orange (#F59E0B) |
| Other | 4 | Gray (#6B7280) |

- Dot size: 6px radius, 8px on hover
- Clusters: Neutral color (#64748B) with white count label
- Min zoom for visibility: ~9-10
- Clusters dissolve into individual dots by zoom ~13-14

### MapLibre Layers

- `schools-clusters`: Circle layer for clustered points (filter: `has`, `point_count`)
- `schools-cluster-count`: Symbol layer for cluster count labels
- `schools-unclustered`: Circle layer for individual schools, color driven by `schoolLevel` property
- `schools-hover`: Circle layer for hover highlight (larger radius, filtered to hovered feature)

### Interactions

- **Hover**: Show tooltip with school name, enrollment, grade range via `mouseenter`/`mouseleave` on `schools-unclustered` layer
- **Click on school**: Query `leaid` from feature properties, call existing district selection logic (same as clicking a district polygon)
- **Click on cluster**: Zoom into the cluster's expansion zoom level

### ETL Change

No code changes to the ETL script itself. Just run with `--no-charter-only` flag and optionally a `--state` filter to load all schools by state. The `schools` table schema already supports all fields.

### Schema Changes

None. The `schools` table already has `latitude` and `longitude` Decimal columns.

### Performance Considerations

- Bounding-box filtering in the API keeps payload size manageable (~1-5K schools per viewport)
- MapLibre clustering handles rendering performance
- Debounce viewport change events (300ms) to avoid excessive API calls
- Consider adding a spatial index on lat/lng if query performance is slow:
  ```sql
  CREATE INDEX idx_schools_lat_lng ON schools (latitude, longitude);
  ```
