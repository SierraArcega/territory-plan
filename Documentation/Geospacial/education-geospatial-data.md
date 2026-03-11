---
name: education-geospatial
description: Work with US education boundary and location data for interactive maps. Use when building maps with school districts, states, or school locations. Covers NCES EDGE boundaries, Census TIGER shapefiles, joining to Education Data Portal API, and web mapping optimization. Includes district types, special cases, and GeoJSON export.
---

# Education Geospatial Data

Build interactive maps with US education boundaries and locations.

## Data Sources

| Level | Source | Download |
|-------|--------|----------|
| School Districts | NCES EDGE Composite | https://nces.ed.gov/programs/edge/Geographic/DistrictBoundaries |
| States | Census TIGER/Line | https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html |
| Schools (points) | NCES EDGE Geocodes | https://nces.ed.gov/programs/edge/Geographic/SchoolLocations |

## School District Boundaries

**File:** `EDGE_SCHOOLDISTRICT_TL{YY}_S{YYYY}.shp`  
**CRS:** NAD83 (EPSG:4269)

### Attribute Schema

| Field | Type | Description |
|-------|------|-------------|
| STATEFP | String(2) | State FIPS code |
| GEOID | String(7) | State FIPS + LEA code (joins to `leaid`) |
| NAME | String(100) | District name |
| LOGRADE | String(2) | Lowest grade (PK, KG, 01-12) |
| HIGRADE | String(2) | Highest grade (01-12) |
| MTFCC | String(5) | District type code |
| SDTYP | String(1) | Special district type |
| FUNCSTAT | String(1) | E=Active, F=Fictitious |
| ALAND | Number | Land area (sq meters) |
| INTPTLAT | String | Centroid latitude |
| INTPTLON | String | Centroid longitude |

**LEA Code Fields** (one populated per record):
- `ELSDLEA` — Elementary district
- `SCSDLEA` — Secondary district
- `UNSDLEA` — Unified district

### District Types (MTFCC)

| Code | Type | Grades | Notes |
|------|------|--------|-------|
| G5420 | Unified | K-12 | Most common, no overlaps |
| G5400 | Elementary | K-8 typical | May overlap Secondary |
| G5410 | Secondary | 9-12 typical | May overlap Elementary |
| G5430 | Administrative | — | Vermont only |

### Special Cases

- **Hawaii, NYC, Puerto Rico:** Single unified district each
- **Pseudo districts (SDTYP='A'):** ~100 records for Census allocation, not real districts
- **Code 99997:** Areas with no defined school district

### Load and Filter

```python
import geopandas as gpd

districts = gpd.read_file("EDGE_SCHOOLDISTRICT_TL24_S2324.shp")

# Active districts only
active = districts[districts['FUNCSTAT'] == 'E']

# By type
unified = districts[districts['MTFCC'] == 'G5420']
elementary = districts[districts['MTFCC'] == 'G5400']

# Exclude pseudo districts
real = districts[districts['SDTYP'] != 'A']

# Single state
california = districts[districts['STATEFP'] == '06']
```

## State Boundaries

**File:** `tl_{YYYY}_us_state.shp` (Census TIGER/Line)

### Key Fields

| Field | Description |
|-------|-------------|
| STATEFP | 2-digit state FIPS code |
| NAME | State name |
| STUSPS | 2-letter postal code |

## Join Fields Reference

| Education Data API | Boundary Field | Level |
|--------------------|----------------|-------|
| `leaid` | `GEOID` | School districts |
| `fips` | `STATEFP` | States |
| `ncessch` | `NCESSCH` | School points |

**GEOID format:** State FIPS (2 digits) + LEA code (5 digits) = 7 characters total

## Joining API Data to Boundaries

### District Choropleth

```python
import geopandas as gpd
import pandas as pd
import requests

# Load boundaries
districts = gpd.read_file("EDGE_SCHOOLDISTRICT_TL24_S2324.shp")

# Fetch from Education Data Portal
url = "https://educationdata.urban.org/api/v1/school-districts/ccd/enrollment/summaries"
params = {"stat": "sum", "var": "enrollment", "by": "leaid", "year": "2022"}
response = requests.get(url, params=params).json()
data = pd.DataFrame(response["results"])

# Ensure matching format (7-char string with leading zeros)
data["leaid"] = data["leaid"].astype(str).str.zfill(7)

# Join
merged = districts.merge(data, left_on="GEOID", right_on="leaid", how="left")
```

### State Choropleth

```python
import geopandas as gpd
import pandas as pd
import requests

# Load state boundaries
states = gpd.read_file("tl_2023_us_state.shp")

# Fetch state-level summary
url = "https://educationdata.urban.org/api/v1/schools/ccd/enrollment/summaries"
params = {"stat": "sum", "var": "enrollment", "by": "fips", "year": "2022"}
response = requests.get(url, params=params).json()
data = pd.DataFrame(response["results"])

# Ensure matching format (2-char string)
data["fips"] = data["fips"].astype(str).str.zfill(2)

# Join
merged = states.merge(data, left_on="STATEFP", right_on="fips", how="left")
```

### School Points (No Boundary File Needed)

```python
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import requests

# Fetch school directory with coordinates
url = "https://educationdata.urban.org/api/v1/schools/ccd/directory/2022/"
params = {"fips": "06"}  # California
data = []

while url:
    response = requests.get(url, params=params).json()
    data.extend(response["results"])
    url = response.get("next")
    params = None

df = pd.DataFrame(data)

# Create GeoDataFrame from lat/lon
geometry = [Point(xy) for xy in zip(df['longitude'], df['latitude'])]
schools = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
```

## Web Mapping Export

### GeoJSON Optimization

For ~13,000 district polygons, optimize for web performance:

```python
# Simplify geometries (80-90% file size reduction)
simplified = merged.copy()
simplified['geometry'] = simplified.geometry.simplify(tolerance=0.01)

# Keep only needed columns
cols = ['GEOID', 'NAME', 'enrollment', 'geometry']
simplified = simplified[cols]

# Export
simplified.to_file("districts.geojson", driver="GeoJSON")
```

### Simplification Tolerance Guide

| Tolerance | Use Case | File Size |
|-----------|----------|-----------|
| 0.001 | High detail, small areas | Large |
| 0.01 | Balanced (recommended) | Medium |
| 0.05 | Overview maps | Small |

### TopoJSON (Smaller Files)

```bash
# Install: npm install -g topojson-server
geo2topo districts.geojson > districts.topojson
```

## Web Mapping Libraries

| Library | Best For | Notes |
|---------|----------|-------|
| Leaflet | Lightweight, simple | Easy setup, good for <5k features |
| Mapbox GL JS | Large datasets | Vector tiles, high performance |
| D3.js | Custom viz | Full control, steeper learning curve |
| Deck.gl | Big data | WebGL, millions of points |
| Folium | Python prototypes | Generates Leaflet maps |

### Leaflet Quick Start

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<div id="map" style="height: 500px;"></div>

<script>
const map = L.map('map').setView([39.8, -98.5], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

fetch('districts.geojson')
  .then(r => r.json())
  .then(data => {
    L.geoJSON(data, {
      style: feature => ({
        fillColor: getColor(feature.properties.enrollment),
        weight: 1,
        color: '#666',
        fillOpacity: 0.7
      })
    }).addTo(map);
  });
</script>
```

## Visualization Notes

- Elementary districts render on top of Secondary by default
- Use `INTPTLAT`/`INTPTLON` for label placement
- Exclude pseudo districts (SDTYP='A') for cleaner maps
- For district-level detail, consider loading on zoom rather than all at once

## Additional Reference

For complete FIPS codes and attribute value definitions, see [references/attribute-codes.md](references/attribute-codes.md).
