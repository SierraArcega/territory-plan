# School Dots on Map — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display all ~100K schools as clustered, color-coded dots on the map with hover tooltips and click-to-select-district behavior.

**Architecture:** New GeoJSON API endpoint returns school points filtered by bounding box. MapV2Container adds a clustered GeoJSON source and circle/symbol layers. Tooltip and click handlers are extended to handle school features alongside existing district/state logic.

**Tech Stack:** Next.js API route, Prisma, MapLibre GL JS (clustering), Zustand store extension, React

---

### Task 1: Add GeoJSON API Endpoint

**Files:**
- Create: `src/app/api/schools/geojson/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

function toNum(val: Decimal | null | undefined): number | null {
  return val != null ? Number(val) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bounds = searchParams.get("bounds"); // "west,south,east,north"

    if (!bounds) {
      return NextResponse.json(
        { error: "bounds parameter required (west,south,east,north)" },
        { status: 400 }
      );
    }

    const [west, south, east, north] = bounds.split(",").map(Number);
    if ([west, south, east, north].some(isNaN)) {
      return NextResponse.json(
        { error: "Invalid bounds format" },
        { status: 400 }
      );
    }

    const schools = await prisma.school.findMany({
      where: {
        latitude: { gte: south, lte: north },
        longitude: { gte: west, lte: east },
        schoolStatus: 1, // open schools only
      },
      select: {
        ncessch: true,
        leaid: true,
        schoolName: true,
        schoolLevel: true,
        enrollment: true,
        latitude: true,
        longitude: true,
        lograde: true,
        higrade: true,
        charter: true,
      },
    });

    const features = schools
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [toNum(s.longitude)!, toNum(s.latitude)!],
        },
        properties: {
          ncessch: s.ncessch,
          leaid: s.leaid,
          name: s.schoolName,
          schoolLevel: s.schoolLevel ?? 4,
          enrollment: s.enrollment ?? 0,
          lograde: s.lograde ?? "",
          higrade: s.higrade ?? "",
          charter: s.charter ?? 0,
        },
      }));

    return NextResponse.json(
      { type: "FeatureCollection", features },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching school GeoJSON:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the endpoint**

Run: `curl "http://localhost:3000/api/schools/geojson?bounds=-122.5,37.2,-121.8,37.9" | jq '.features | length'`
Expected: A number > 0 (schools in the SF Bay Area bounds)

**Step 3: Commit**

```bash
git add src/app/api/schools/geojson/route.ts
git commit -m "feat: add /api/schools/geojson endpoint with bounding box filter"
```

---

### Task 2: Add School Type to Tooltip Store

**Files:**
- Modify: `src/lib/map-v2-store.ts:17-29` (V2TooltipData type)

**Step 1: Extend the tooltip data type**

In `src/lib/map-v2-store.ts`, change the `V2TooltipData` type at line 18 to include `"school"`:

```typescript
export interface V2TooltipData {
  type: "state" | "district" | "school";
  stateName?: string;
  stateCode?: string;
  districtCount?: number;
  leaid?: string;
  name?: string;
  stateAbbrev?: string;
  enrollment?: number;
  customerCategory?: string;
  dominantVendor?: string;
  salesExecutive?: string | null;
  // School-specific
  schoolLevel?: number;
  lograde?: string;
  higrade?: string;
}
```

**Step 2: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "feat: extend tooltip data type to support school features"
```

---

### Task 3: Add School Tooltip Rendering

**Files:**
- Modify: `src/components/map-v2/MapV2Tooltip.tsx:93` (add school rendering block)

**Step 1: Add school level labels and colors at the top of the file**

After the `CATEGORY_COLORS` block (line 20), add:

```typescript
const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Elementary",
  2: "Middle",
  3: "High",
  4: "Other",
};

const SCHOOL_LEVEL_COLORS: Record<number, string> = {
  1: "#3B82F6",
  2: "#10B981",
  3: "#F59E0B",
  4: "#6B7280",
};
```

**Step 2: Add school tooltip block**

After the district tooltip block (after line 92's closing `</>`) and before the closing `</div>`, add:

```tsx
{data.type === "school" && (
  <>
    <div className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: SCHOOL_LEVEL_COLORS[data.schoolLevel ?? 4] || "#6B7280" }}
      />
      <div className="text-sm font-medium text-gray-800 leading-tight">
        {data.name}
      </div>
    </div>
    <div className="text-xs text-gray-400 mt-0.5">
      {SCHOOL_LEVEL_LABELS[data.schoolLevel ?? 4] || "School"}
      {data.lograde && data.higrade ? ` · ${data.lograde}–${data.higrade}` : ""}
    </div>
    {data.enrollment != null && data.enrollment > 0 && (
      <div className="text-xs text-gray-500 mt-0.5">
        {data.enrollment.toLocaleString()} students
      </div>
    )}
  </>
)}
```

**Step 3: Commit**

```bash
git add src/components/map-v2/MapV2Tooltip.tsx
git commit -m "feat: add school tooltip rendering with level colors"
```

---

### Task 4: Add School Layers to MapV2Container

This is the main task. We add a GeoJSON source with clustering, circle layers for clusters and individual schools, a symbol layer for cluster counts, and wire up data loading on viewport change.

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx`

**Step 1: Add school level color constants**

Near the top of the file (after line 11 imports or in the constants section around line 12), add:

```typescript
const SCHOOL_LEVEL_COLORS: Record<number, string> = {
  1: "#3B82F6", // Elementary - blue
  2: "#10B981", // Middle - green
  3: "#F59E0B", // High - orange
  4: "#6B7280", // Other - gray
};

const SCHOOL_MIN_ZOOM = 9;
```

**Step 2: Add a ref to track the fetch abort controller**

Near the other refs (around lines 105-107), add:

```typescript
const schoolFetchController = useRef<AbortController | null>(null);
```

**Step 3: Add the school GeoJSON source and layers inside the map "load" handler**

After the `district-selected` layer (after line 330), and before `setMapReady(true)` (line 332), add:

```typescript
      // === SCHOOL LAYERS ===

      // Empty GeoJSON source with clustering enabled
      map.current.addSource("schools", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Cluster circles
      map.current.addLayer({
        id: "schools-clusters",
        type: "circle",
        source: "schools",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#64748B",
          "circle-radius": [
            "step", ["get", "point_count"],
            14,   // default
            10, 18,   // 10+ schools
            50, 22,   // 50+ schools
          ],
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
        minzoom: SCHOOL_MIN_ZOOM,
      });

      // Cluster count labels
      map.current.addLayer({
        id: "schools-cluster-count",
        type: "symbol",
        source: "schools",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: {
          "text-color": "#ffffff",
        },
        minzoom: SCHOOL_MIN_ZOOM,
      });

      // Individual school dots (unclustered)
      map.current.addLayer({
        id: "schools-unclustered",
        type: "circle",
        source: "schools",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match", ["get", "schoolLevel"],
            1, "#3B82F6",
            2, "#10B981",
            3, "#F59E0B",
            "#6B7280",
          ],
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            SCHOOL_MIN_ZOOM, 3,
            12, 5,
            15, 7,
          ],
          "circle-opacity": 0.9,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
        minzoom: SCHOOL_MIN_ZOOM,
      });
```

**Step 4: Add a function to load schools for the current viewport**

After the `clearHover` callback (around line 350), add a new callback:

```typescript
  // Load school GeoJSON for current viewport
  const loadSchoolsForViewport = useCallback(() => {
    if (!map.current || !mapReady) return;
    if (map.current.getZoom() < SCHOOL_MIN_ZOOM) {
      // Clear schools when zoomed out
      const source = map.current.getSource("schools") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    // Abort previous in-flight request
    if (schoolFetchController.current) {
      schoolFetchController.current.abort();
    }
    schoolFetchController.current = new AbortController();

    const bounds = map.current.getBounds();
    const boundsParam = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    fetch(`/api/schools/geojson?bounds=${boundsParam}`, {
      signal: schoolFetchController.current.signal,
    })
      .then((res) => res.json())
      .then((geojson) => {
        if (!map.current) return;
        const source = map.current.getSource("schools") as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData(geojson);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load schools:", err);
        }
      });
  }, [mapReady]);
```

**Step 5: Wire up viewport change events to load schools**

In the event listener setup effect (around lines 514-527), add these listeners after the existing ones:

```typescript
    // Load schools on viewport change (debounced)
    let schoolDebounceTimer: ReturnType<typeof setTimeout>;
    const handleMoveEnd = () => {
      clearTimeout(schoolDebounceTimer);
      schoolDebounceTimer = setTimeout(loadSchoolsForViewport, 300);
    };
    map.current.on("moveend", handleMoveEnd);

    // Initial load
    loadSchoolsForViewport();
```

And in the cleanup, add:

```typescript
    map.current.off("moveend", handleMoveEnd);
    clearTimeout(schoolDebounceTimer);
```

Also add `loadSchoolsForViewport` to the dependency array of this effect.

**Step 6: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat: add clustered school dot layers with viewport-based loading"
```

---

### Task 5: Add School Hover and Click Handlers

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx` (hover and click handlers)

**Step 1: Extend hover handler to check school layer**

In `handleDistrictHover` (around line 352), after the district hover logic (after the `else` block that starts at line 398), but BEFORE the state hover fallback at low zoom, add a check for school features. The logic should be:

1. First check districts (existing logic)
2. If no district found, check schools-unclustered layer
3. If no school found, fall back to state hover at low zoom

Insert after the district features check (around line 398), replacing the existing else block:

```typescript
      } else {
        // Check for school hover
        const schoolFeatures = map.current.getLayer("schools-unclustered")
          ? map.current.queryRenderedFeatures(e.point, {
              layers: ["schools-unclustered"],
            })
          : [];

        if (schoolFeatures.length > 0) {
          const props = schoolFeatures[0].properties;
          lastHoveredLeaidRef.current = null; // clear district hover
          map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], ""]);
          map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
          map.current.getCanvas().style.cursor = "pointer";

          useMapV2Store.getState().showTooltip(e.point.x, e.point.y, {
            type: "school",
            name: props?.name || "Unknown School",
            leaid: props?.leaid,
            enrollment: props?.enrollment,
            schoolLevel: props?.schoolLevel,
            lograde: props?.lograde,
            higrade: props?.higrade,
          });
        } else if (map.current.getZoom() < 6) {
          // existing state hover fallback code stays here
```

**Step 2: Extend click handler to check school and cluster layers**

In `handleClick` (around line 428), BEFORE the district click check (line 434), add school click handling:

```typescript
      // Check for school cluster click — zoom in
      const clusterFeatures = map.current.getLayer("schools-clusters")
        ? map.current.queryRenderedFeatures(e.point, {
            layers: ["schools-clusters"],
          })
        : [];

      if (clusterFeatures.length > 0) {
        const clusterId = clusterFeatures[0].properties?.cluster_id;
        const source = map.current.getSource("schools") as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const geo = clusterFeatures[0].geometry;
          if (geo.type === "Point") {
            map.current?.easeTo({
              center: geo.coordinates as [number, number],
              zoom: zoom,
              duration: 500,
            });
          }
        });
        return;
      }

      // Check for individual school click — select parent district
      const schoolFeatures = map.current.getLayer("schools-unclustered")
        ? map.current.queryRenderedFeatures(e.point, {
            layers: ["schools-unclustered"],
          })
        : [];

      if (schoolFeatures.length > 0) {
        const leaid = schoolFeatures[0].properties?.leaid;
        if (leaid) {
          const store = useMapV2Store.getState();
          store.addClickRipple(e.point.x, e.point.y, "coral");
          store.selectDistrict(leaid);
        }
        return;
      }
```

**Step 3: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat: add school hover tooltips and click-to-select-district"
```

---

### Task 6: Add Spatial Index for Performance

**Files:**
- Create: `scripts/add-school-spatial-index.sql`

**Step 1: Create index SQL**

```sql
-- Composite index on lat/lng for bounding box queries
CREATE INDEX IF NOT EXISTS idx_schools_lat_lng
ON schools (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index on school_status for the WHERE clause filter
CREATE INDEX IF NOT EXISTS idx_schools_status
ON schools (school_status)
WHERE school_status = 1;
```

**Step 2: Apply the index**

Run: `npx prisma db execute --file scripts/add-school-spatial-index.sql`
Expected: Indexes created successfully

**Step 3: Commit**

```bash
git add scripts/add-school-spatial-index.sql
git commit -m "feat: add spatial index on schools lat/lng for GeoJSON queries"
```

---

### Task 7: Load All Schools via ETL (by state)

This task uses the existing ETL script to populate all schools.

**Step 1: Run ETL for a test state**

Run: `cd scripts/etl && python3 loaders/urban_institute_schools.py --no-charter-only --state CA`
Expected: Schools loaded for California

**Step 2: Verify data in the API**

Run: `curl "http://localhost:3000/api/schools/geojson?bounds=-124.5,32.5,-114.1,42.0" | jq '.features | length'`
Expected: A number in the thousands (all CA schools)

**Step 3: Run ETL for remaining states**

Run the script for each state as needed, or create a batch script. No code changes needed — the ETL already supports `--no-charter-only`.

---

### Task 8: Manual Integration Test

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Test checklist**

- [ ] Navigate to /map-v2
- [ ] Zoom into a state (California or whichever was loaded)
- [ ] At zoom ~9-10, school dots should appear as clusters
- [ ] Zoom in further — clusters dissolve into colored dots
- [ ] Hover a school dot — tooltip shows name, level, grades, enrollment
- [ ] Click a school dot — parent district highlights and panel opens
- [ ] Click a cluster — map zooms into the cluster
- [ ] Zoom out past zoom 9 — school dots disappear
- [ ] Pan around while zoomed in — new schools load for viewport (debounced)
- [ ] Verify dot colors: blue (elementary), green (middle), orange (high), gray (other)
