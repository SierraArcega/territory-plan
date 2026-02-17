# Fullmind Team Map Layer — Design

## Goal

Add a toggleable "Fullmind Team" layer to the map-v2 that shows where each team member is based, using circular profile photos (or initials as fallback) as markers.

## Data Source

Existing `user_profiles` table — already has all required fields:

| Field | Purpose |
|-------|---------|
| `fullName` | Display name |
| `avatarUrl` | Profile photo URL |
| `location` | City, State text |
| `locationLat` / `locationLng` | Coordinates for map placement |
| `jobTitle` | Shown in tooltip |

### Seeding

Pre-populate ~15 team members into `user_profiles` with city/state, coordinates, and photo URLs. Set `hasCompletedSetup = false` so real logins can update their profiles later.

## API

**`GET /api/team-members`** — Returns GeoJSON FeatureCollection:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-86.7816, 36.1627] },
      "properties": {
        "id": "uuid",
        "fullName": "Jane Smith",
        "initials": "JS",
        "jobTitle": "Account Executive",
        "location": "Nashville, TN",
        "avatarUrl": "https://..."
      }
    }
  ]
}
```

Query: `SELECT * FROM user_profiles WHERE location_lat IS NOT NULL`

## Map Rendering

**HTML Markers** (MapLibre `Marker` with custom DOM elements):

- 36px diameter circle, 2px white border, subtle drop shadow
- Photo available → circular `<img>` with `object-fit: cover`
- No photo → colored circle with white initials (color from name hash)
- Markers sit above district fill layers but below tooltips

## Layer Toggle

- New toggle in `LayerBubble` component: "Fullmind Team" with people icon
- New Zustand store field: `showTeamLayer: boolean` (default: `true`)
- Toggle calls `.remove()` / `.addTo(map)` on all team markers

## Interactions

- **Hover**: Tooltip with name, job title, city/state
- **Click**: No-op initially (can be extended later to open profile)

## Visual Design

```
  ┌──────┐
  │ 📷  │  36px circle, white border, shadow
  └──────┘
     ↕
  Tooltip on hover:
  ┌─────────────────┐
  │ Jane Smith       │
  │ Account Executive│
  │ Nashville, TN    │
  └─────────────────┘
```
