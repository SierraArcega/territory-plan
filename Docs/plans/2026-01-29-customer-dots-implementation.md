# Customer Dots on National View - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show customer/prospect dots on the national map view with color-coded categories and a legend.

**Architecture:** Add a GeoJSON layer to MapLibre that renders district centroids with data-driven styling. Fetch dot data from a new API endpoint that queries districts with Fullmind relationships and calculates their category based on FY25/FY26 revenue.

**Tech Stack:** Next.js API routes, PostgreSQL with PostGIS (centroid geometry), MapLibre GL JS, React Query, Tailwind CSS.

---

## Task 1: Create the Customer Dots API Endpoint

**Files:**
- Create: `src/app/api/customer-dots/route.ts`

**Step 1: Create the API route file**

```typescript
// src/app/api/customer-dots/route.ts
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Category colors and sizes for the legend
export const DOT_CATEGORIES = {
  multi_year: { color: "#403770", size: 8, label: "Multi-year customer" },
  new: { color: "#22C55E", size: 6, label: "New this year" },
  lapsed: { color: "#403770", opacity: 0.4, size: 6, label: "Lapsed customer" },
  prospect: { color: "#F59E0B", size: 5, label: "Prospect" },
} as const;

export type DotCategory = keyof typeof DOT_CATEGORIES;

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Query districts with Fullmind data, calculating category based on revenue
      // - multi_year: has FY25 AND FY26 revenue
      // - new: has FY26 revenue only (no FY25)
      // - lapsed: has FY25 revenue but NO FY26 revenue
      // - prospect: no revenue but has open pipeline
      const result = await client.query(`
        SELECT
          d.leaid,
          d.name,
          d.state_abbrev as "stateAbbrev",
          ST_X(ST_Centroid(d.geometry)) as lng,
          ST_Y(ST_Centroid(d.geometry)) as lat,
          CASE
            WHEN (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
              AND (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
            THEN 'multi_year'
            WHEN (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
              AND NOT (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
            THEN 'new'
            WHEN (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
              AND NOT (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
            THEN 'lapsed'
            WHEN f.has_open_pipeline = true
            THEN 'prospect'
            ELSE NULL
          END as category
        FROM districts d
        INNER JOIN fullmind_data f ON d.leaid = f.leaid
        WHERE d.geometry IS NOT NULL
          AND (f.is_customer = true OR f.has_open_pipeline = true)
      `);

      // Filter out nulls and build GeoJSON
      const features = result.rows
        .filter((row) => row.category !== null && row.lng !== null && row.lat !== null)
        .map((row) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [row.lng, row.lat],
          },
          properties: {
            leaid: row.leaid,
            name: row.name,
            stateAbbrev: row.stateAbbrev,
            category: row.category as DotCategory,
          },
        }));

      const geojson = {
        type: "FeatureCollection" as const,
        features,
      };

      return NextResponse.json(geojson, {
        headers: {
          "Cache-Control": "public, max-age=300", // 5 minute cache
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching customer dots:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer dots" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the endpoint works**

Run: `curl http://localhost:3000/api/customer-dots | head -c 500`
Expected: GeoJSON with features array containing points with leaid, name, stateAbbrev, category

**Step 3: Commit**

```bash
git add src/app/api/customer-dots/route.ts
git commit -m "feat: add customer-dots API endpoint

- Query districts with Fullmind relationships
- Calculate category (multi_year, new, lapsed, prospect)
- Return GeoJSON FeatureCollection with centroids"
```

---

## Task 2: Add React Query Hook for Customer Dots

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add the CustomerDot type and hook**

Add after line 614 (end of file), before the closing:

```typescript
// Customer dots for national view
export type DotCategory = "multi_year" | "new" | "lapsed" | "prospect";

export interface CustomerDotFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    leaid: string;
    name: string;
    stateAbbrev: string;
    category: DotCategory;
  };
}

export interface CustomerDotsGeoJSON {
  type: "FeatureCollection";
  features: CustomerDotFeature[];
}

export function useCustomerDots() {
  return useQuery({
    queryKey: ["customerDots"],
    queryFn: () => fetchJson<CustomerDotsGeoJSON>(`${API_BASE}/customer-dots`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add useCustomerDots hook

- Define CustomerDotFeature and CustomerDotsGeoJSON types
- Add React Query hook with 5-minute stale time"
```

---

## Task 3: Create the Customer Dots Legend Component

**Files:**
- Create: `src/components/map/CustomerDotsLegend.tsx`

**Step 1: Create the legend component**

```typescript
// src/components/map/CustomerDotsLegend.tsx
"use client";

interface LegendItem {
  category: string;
  color: string;
  size: number;
  opacity?: number;
  label: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  { category: "multi_year", color: "#403770", size: 8, label: "Multi-year customer" },
  { category: "new", color: "#22C55E", size: 6, label: "New this year" },
  { category: "lapsed", color: "#403770", size: 6, opacity: 0.4, label: "Lapsed customer" },
  { category: "prospect", color: "#F59E0B", size: 5, label: "Prospect" },
];

interface CustomerDotsLegendProps {
  className?: string;
  fadeOnZoom?: boolean;
}

export default function CustomerDotsLegend({
  className = "",
  fadeOnZoom = false,
}: CustomerDotsLegendProps) {
  return (
    <div
      className={`
        bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200
        px-3 py-2 text-sm
        transition-opacity duration-300
        ${fadeOnZoom ? "opacity-50" : "opacity-100"}
        ${className}
      `}
    >
      <div className="font-semibold text-[#403770] mb-2 text-xs uppercase tracking-wide">
        Customer Overview
      </div>
      <div className="space-y-1.5">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.category} className="flex items-center gap-2">
            <span
              className="inline-block rounded-full flex-shrink-0"
              style={{
                width: item.size,
                height: item.size,
                backgroundColor: item.color,
                opacity: item.opacity ?? 1,
              }}
            />
            <span className="text-[#403770] text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/map/CustomerDotsLegend.tsx
git commit -m "feat: add CustomerDotsLegend component

- Display four customer categories with dot colors
- Support fadeOnZoom prop for zoom-level opacity"
```

---

## Task 4: Add Customer Dots Layer to MapContainer

**Files:**
- Modify: `src/components/map/MapContainer.tsx`

**Step 1: Import the hook and legend component**

Add imports near the top (after line 10):

```typescript
import { useCustomerDots } from "@/lib/api";
import CustomerDotsLegend from "./CustomerDotsLegend";
```

**Step 2: Add the hook call inside the component**

After line 152 (after `const isTouchDevice = useIsTouchDevice();`):

```typescript
// Fetch customer dots for national view
const { data: customerDotsData } = useCustomerDots();
```

**Step 3: Add state to track current zoom level**

After line 150 (after `const [mapInstance, setMapInstance] = useState...`):

```typescript
const [currentZoom, setCurrentZoom] = useState(4);
```

**Step 4: Add zoom tracking effect**

After line 429 (after the map initialization useEffect closes):

```typescript
// Track zoom level for legend fading
useEffect(() => {
  if (!map.current) return;

  const handleZoom = () => {
    if (map.current) {
      setCurrentZoom(map.current.getZoom());
    }
  };

  map.current.on("zoom", handleZoom);
  return () => {
    map.current?.off("zoom", handleZoom);
  };
}, [mapReady]);
```

**Step 5: Add the customer dots source and layer**

After line 419 (after the district-similar-outline layer is added, before `setMapReady(true)`):

```typescript
// Add customer dots source (empty initially, populated by effect)
map.current.addSource("customer-dots", {
  type: "geojson",
  data: { type: "FeatureCollection", features: [] },
});

// Add customer dots layer with data-driven styling
map.current.addLayer({
  id: "customer-dots",
  type: "circle",
  source: "customer-dots",
  paint: {
    // Color based on category
    "circle-color": [
      "match",
      ["get", "category"],
      "multi_year", "#403770",
      "new", "#22C55E",
      "lapsed", "#403770",
      "prospect", "#F59E0B",
      "#403770", // fallback
    ],
    // Size based on category
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3, ["match", ["get", "category"],
        "multi_year", 4,
        "new", 3,
        "lapsed", 3,
        "prospect", 2.5,
        3,
      ],
      6, ["match", ["get", "category"],
        "multi_year", 8,
        "new", 6,
        "lapsed", 6,
        "prospect", 5,
        6,
      ],
    ],
    // Opacity: lapsed is faded, others fade out at high zoom
    "circle-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3, ["match", ["get", "category"], "lapsed", 0.4, 1],
      5, ["match", ["get", "category"], "lapsed", 0.4, 1],
      7, ["match", ["get", "category"], "lapsed", 0.15, 0.3],
    ],
    // Add subtle stroke for visibility
    "circle-stroke-width": 1,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3, 0.8,
      7, 0.2,
    ],
  },
});

// Add customer dots hover layer (larger, highlighted)
map.current.addLayer({
  id: "customer-dots-hover",
  type: "circle",
  source: "customer-dots",
  filter: ["==", ["get", "leaid"], ""],
  paint: {
    "circle-color": [
      "match",
      ["get", "category"],
      "multi_year", "#403770",
      "new", "#22C55E",
      "lapsed", "#403770",
      "prospect", "#F59E0B",
      "#403770",
    ],
    "circle-radius": 12,
    "circle-opacity": 1,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
});
```

**Step 6: Add effect to update customer dots data when it loads**

After the zoom tracking effect (from Step 4):

```typescript
// Update customer dots source when data loads
useEffect(() => {
  if (!map.current?.isStyleLoaded() || !customerDotsData) return;

  const source = map.current.getSource("customer-dots") as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(customerDotsData);
  }
}, [customerDotsData, mapReady]);
```

**Step 7: Add hover handler for customer dots**

Add a new ref after line 157 (after `lastHoverTimeRef`):

```typescript
const lastHoveredDotLeaidRef = useRef<string | null>(null);
```

Add new hover handler after `handleStateMouseLeave` (around line 744):

```typescript
// Handle customer dot hover events
const handleDotHover = useCallback(
  (e: maplibregl.MapLayerMouseEvent) => {
    if (!map.current || isTouchDevice) return;

    const now = Date.now();
    if (now - lastHoverTimeRef.current < HOVER_THROTTLE_MS) return;
    lastHoverTimeRef.current = now;

    const feature = e.features?.[0];
    if (!feature) return;

    const leaid = feature.properties?.leaid as string | undefined;

    // Change detection
    if (leaid === lastHoveredDotLeaidRef.current) {
      updateTooltipPosition(e.originalEvent.clientX, e.originalEvent.clientY);
      return;
    }
    lastHoveredDotLeaidRef.current = leaid || null;

    const name = feature.properties?.name;
    const stateAbbrev = feature.properties?.stateAbbrev;
    const category = feature.properties?.category;

    // Category label for tooltip
    const categoryLabels: Record<string, string> = {
      multi_year: "Multi-year customer",
      new: "New this year",
      lapsed: "Lapsed customer",
      prospect: "Prospect",
    };

    map.current.getCanvas().style.cursor = "pointer";

    // Update hover filter
    map.current.setFilter("customer-dots-hover", [
      "==",
      ["get", "leaid"],
      leaid || "",
    ]);

    showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, {
      type: "district",
      leaid,
      name: `${name} - ${categoryLabels[category] || category}`,
      stateAbbrev,
    });
  },
  [showTooltip, updateTooltipPosition, isTouchDevice]
);

// Handle customer dot mouse leave
const handleDotMouseLeave = useCallback(() => {
  if (!map.current) return;
  lastHoveredDotLeaidRef.current = null;
  map.current.getCanvas().style.cursor = "";
  map.current.setFilter("customer-dots-hover", ["==", ["get", "leaid"], ""]);
  hideTooltip();
}, [hideTooltip]);
```

**Step 8: Add click handler for customer dots**

Modify the existing `handleClick` function. After the state click handling (around line 525) and before the district click handling, add:

```typescript
// Check for customer dot clicks (at national view level)
if (zoom < 7 && map.current.getLayer("customer-dots")) {
  const dotFeatures = map.current.queryRenderedFeatures(e.point, {
    layers: ["customer-dots"],
  });

  if (dotFeatures.length > 0) {
    const feature = dotFeatures[0];
    const leaid = feature.properties?.leaid;
    const stateAbbrev = feature.properties?.stateAbbrev;
    const name = feature.properties?.name;

    if (leaid && stateAbbrev && STATE_BOUNDS[stateAbbrev]) {
      // Get the dot's coordinates for zoom target
      const coords = (feature.geometry as GeoJSON.Point).coordinates;

      hideTooltip();
      announce(`Zooming to ${name}`);

      // First zoom to state, then select district
      setSelectedState(stateAbbrev);
      setStateFilter(stateAbbrev);

      map.current.flyTo({
        center: coords as [number, number],
        zoom: 9,
        duration: 1500,
        essential: true,
      });

      // Select the district after zoom completes
      setTimeout(() => {
        setSelectedLeaid(leaid);
      }, 1600);

      return;
    }
  }
}
```

**Step 9: Register the dot event listeners**

In the event listeners useEffect (around line 821), add after the state listener setup:

```typescript
// Add customer dot event listeners
if (map.current.getLayer("customer-dots")) {
  map.current.on("mousemove", "customer-dots", handleDotHover);
  map.current.on("mouseleave", "customer-dots", handleDotMouseLeave);
}
```

And in the cleanup:

```typescript
map.current?.off("mousemove", "customer-dots", handleDotHover);
map.current?.off("mouseleave", "customer-dots", handleDotMouseLeave);
```

**Step 10: Add the legend to the JSX**

In the return JSX, after the interactive hint div (around line 927), add:

```typescript
{/* Customer dots legend */}
{mapReady && (
  <CustomerDotsLegend
    className="absolute bottom-4 left-4 z-10"
    fadeOnZoom={currentZoom > 7}
  />
)}
```

And remove the existing interactive hint since the legend will be in that spot. Find and remove:

```typescript
{/* Interactive hint when at US level */}
{!selectedState && mapReady && (
  <div className="absolute bottom-4 left-4 z-10 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md text-xs text-gray-600 pointer-events-none">
    {isTouchDevice ? "Tap a state to explore districts" : "Click a state to explore districts"}
  </div>
)}
```

**Step 11: Verify the app compiles and runs**

Run: `npm run dev`
Expected: App loads, dots visible on national view, legend shows in bottom-left

**Step 12: Commit**

```bash
git add src/components/map/MapContainer.tsx
git commit -m "feat: add customer dots layer to map

- Add customer-dots GeoJSON source and circle layer
- Data-driven styling for color, size, and opacity by category
- Hover effect with tooltip showing category
- Click to zoom directly to district
- Legend in bottom-left with fade on zoom"
```

---

## Task 5: Update MapTooltip for Category Display (if needed)

**Files:**
- Check: `src/components/map/MapTooltip.tsx`

**Step 1: Review existing tooltip**

Read the MapTooltip component to see if it handles the modified name format (e.g., "Mesa USD - Multi-year customer") gracefully.

If the tooltip already displays `name` as-is, no changes needed. If it truncates or needs adjustment, update accordingly.

**Step 2: Commit (only if changes made)**

```bash
git add src/components/map/MapTooltip.tsx
git commit -m "fix: ensure tooltip displays category in name"
```

---

## Task 6: Test the Complete Feature

**Step 1: Manual verification checklist**

- [ ] Dots appear on national view
- [ ] Four distinct colors visible (Plum, Green, Plum-faded, Amber)
- [ ] Larger dots for multi-year customers
- [ ] Legend visible in bottom-left
- [ ] Hovering a dot shows tooltip with name and category
- [ ] Clicking a dot zooms to district and opens side panel
- [ ] Dots fade when zoomed into a state
- [ ] Legend fades when zoomed past level 7

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete customer dots national view

- Customer/prospect dots visible on landing
- Four categories: multi-year, new, lapsed, prospect
- Click-to-zoom navigation
- Legend with all categories"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | `src/app/api/customer-dots/route.ts` | API endpoint returning GeoJSON |
| 2 | `src/lib/api.ts` | React Query hook |
| 3 | `src/components/map/CustomerDotsLegend.tsx` | Legend component |
| 4 | `src/components/map/MapContainer.tsx` | Map layer + interactions |
| 5 | `src/components/map/MapTooltip.tsx` | Tooltip update (if needed) |
| 6 | — | Manual testing |
