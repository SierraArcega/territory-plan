# Customer Dots on National View

**Date:** 2026-01-29
**Status:** Approved
**Branch:** `feature/customer-dots-national-view`

## Overview

Add visual dots on the national map view showing the geographic spread of Fullmind customers and prospects. This gives users an immediate sense of where Fullmind has relationships before drilling into any state.

## Dot Categories

| Category | Criteria | Color | Size |
|----------|----------|-------|------|
| **Multi-year customer** | Revenue in FY25 AND FY26 | Plum `#403770` | 8px |
| **Lapsed customer** | FY25 revenue, NO FY26 revenue | Plum `#403770` at 40% opacity | 6px |
| **New customer** | FY26 revenue only (no FY25) | Green `#22C55E` | 6px |
| **Prospect** | No revenue, has open pipeline | Amber `#F59E0B` | 5px |

## Map Layer Implementation

### Data Source
- New endpoint: `GET /api/customer-dots`
- Returns GeoJSON FeatureCollection with district centroids
- Only includes districts with Fullmind relationships (~1500 points)
- Cached with React Query (5 minute stale time)

### Layer Stacking
```
Bottom:  state-fill (existing)
         state-outline (existing)
         customer-dots (NEW)
Top:     state-hover (existing)
```

### Response Shape
```typescript
{
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        leaid: "0100001",
        name: "Mesa Unified School District",
        state: "AZ",
        category: "multi_year" | "new" | "lapsed" | "prospect"
      }
    }
  ]
}
```

## Transitions & Interactions

### Click Behavior
- Clicking a dot zooms directly to that district using `map.flyTo()` (1.5s duration)
- Side panel opens with district details

### Hover Behavior
- Tooltip shows district name + category (e.g., "Mesa USD - Multi-year customer")
- Cursor changes to pointer
- Slight size increase (1.2x scale) on hover

### Zoom-Based Opacity
```
Zoom 3-5:   Dots 100%, Districts hidden
Zoom 5-7:   Dots fade 100% → 30%, Districts fade in
Zoom 7+:    Dots 30% (subtle context), Districts 100%
```

## Legend Component

Always-visible legend in bottom-left corner:

```
┌─────────────────────────────┐
│  Customer Overview          │
├─────────────────────────────┤
│  ●  Multi-year customer     │
│  ●  New this year           │
│  ○  Lapsed customer         │
│  ●  Prospect                │
└─────────────────────────────┘
```

### Legend Styling
- Background: white with subtle shadow
- Font: Plus Jakarta Sans (brand)
- Text color: Plum `#403770`
- Fades to 50% opacity when zoomed to district level

## Files to Create/Modify

### New Files
- `src/app/api/customer-dots/route.ts` - API endpoint
- `src/components/map/CustomerDotsLegend.tsx` - Legend component

### Modified Files
- `src/components/map/MapContainer.tsx` - Add dots layer, hover/click handlers
- `src/lib/api.ts` - Add React Query hook for customer dots

## Implementation Notes

- Dots use MapLibre `circle` layer with data-driven styling
- Category logic calculated server-side in API endpoint
- Legend positioned to avoid existing map controls
- Touch devices: tap dot to zoom to district (same as click)
