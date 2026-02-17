# Non-LEAID Account Support — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create and manage CRM accounts that don't have LEAIDs, with optional map plotting and full plan/activity/task/contact integration.

**Architecture:** Expand the `districts` table with `account_type` (VARCHAR) and `point_location` (PostGIS Point) columns. Non-LEAID accounts get synthetic IDs (M000001). They appear as circle markers on the map when geocoded. The "Add Account" flow is integrated into the existing district search bar in Map V2.

**Tech Stack:** Next.js 16, React 19, Prisma, PostGIS, MapLibre GL JS, Nominatim geocoding, Zustand, TanStack Query

**Design Doc:** `Docs/plans/2026-02-17-non-leaid-accounts-design.md`

---

## Task 1: Schema Migration — Add account_type and point_location

**Files:**
- Modify: `prisma/schema.prisma` (District model, ~line 15-260)
- Create: `prisma/migrations/20260217_add_account_type_point_location/migration.sql`

**Step 1: Update Prisma schema**

Add two new fields to the `District` model, right after the `updatedAt` field (line 38):

```prisma
  // ===== Account Type =====
  // Distinguishes traditional districts from other entity types (CMO, ESA, etc.)
  // Defaults to 'district' for all existing rows
  accountType        String   @default("district") @map("account_type") @db.VarChar(20)

  // ===== Point Location (managed outside Prisma) =====
  // Geocoded lat/lng for map pin — used when polygon geometry is null
  pointLocation Unsupported("geometry(Point, 4326)")?  @map("point_location")
```

**Step 2: Generate and apply migration SQL**

```bash
# Generate the migration SQL
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260217_add_account_type_point_location/migration.sql
```

The generated SQL should look roughly like:

```sql
ALTER TABLE "districts" ADD COLUMN "account_type" VARCHAR(20) NOT NULL DEFAULT 'district';
-- point_location won't appear because it's Unsupported — add manually:
SELECT AddGeometryColumn('districts', 'point_location', 4326, 'POINT', 2);
CREATE INDEX idx_districts_point_location ON districts USING GIST (point_location);
CREATE INDEX idx_districts_account_type ON districts (account_type);
```

Review the generated file. If `point_location` is missing (likely, since it's `Unsupported`), manually add the `AddGeometryColumn` and index lines.

**Step 3: Apply the migration**

```bash
npx prisma db execute --file prisma/migrations/20260217_add_account_type_point_location/migration.sql
npx prisma migrate resolve --applied "20260217_add_account_type_point_location"
npx prisma generate
```

**Step 4: Verify**

```bash
npx prisma studio
```

Open the districts table and confirm `account_type` shows "district" for all existing rows.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260217_add_account_type_point_location/
git commit -m "feat(schema): add account_type and point_location columns to districts"
```

---

## Task 2: Account Type Constants & Shared Types

**Files:**
- Create: `src/lib/account-types.ts`

**Step 1: Create the account types definition file**

This file defines the dropdown options, tooltips, and type used across the app:

```typescript
// Account type definitions — used in create form dropdown, detail panel badges, etc.

export const ACCOUNT_TYPES = [
  {
    value: "district",
    label: "District",
    tooltip: "Traditional public school district (K-12 LEA)",
  },
  {
    value: "cmo",
    label: "Charter/CMO",
    tooltip: "Charter management organization operating multiple charter schools",
  },
  {
    value: "esa_boces",
    label: "ESA/BOCES",
    tooltip: "Regional education service agency supporting multiple districts",
  },
  {
    value: "cooperative",
    label: "Cooperative",
    tooltip: "Purchasing cooperative where districts pool buying power",
  },
  {
    value: "private_school",
    label: "Private School",
    tooltip: "Private or parochial school",
  },
  {
    value: "state_agency",
    label: "State Agency",
    tooltip: "State department of education or board",
  },
  {
    value: "university",
    label: "University",
    tooltip: "College or university",
  },
  {
    value: "organization",
    label: "Organization",
    tooltip: "Other education-related organization",
  },
  {
    value: "other",
    label: "Other",
    tooltip: "Doesn't fit the above categories",
  },
] as const;

export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number]["value"];

// Helper to look up label/tooltip by value
export function getAccountTypeLabel(value: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? value;
}

// Returns true for account types that won't have education data
export function isNonDistrictAccount(accountType: string): boolean {
  return accountType !== "district";
}
```

**Step 2: Commit**

```bash
git add src/lib/account-types.ts
git commit -m "feat: add account type constants and helpers"
```

---

## Task 3: API Route — Create Account

**Files:**
- Create: `src/app/api/accounts/route.ts`
- Modify: `src/lib/geocode.ts` (add `geocodeAddress` function)

**Step 1: Add a geocodeAddress helper to geocode.ts**

The existing `searchLocations` function is interactive (returns multiple suggestions). We need a simpler fire-and-forget function that takes structured address fields and returns a single lat/lng:

```typescript
// Geocode a structured address to a single lat/lng point
// Returns null if geocoding fails or no results found
export async function geocodeAddress(address: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}): Promise<{ lat: number; lng: number } | null> {
  // Build a search string from available address parts
  const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
  if (parts.length === 0) return null;

  const query = parts.join(", ");

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      countrycodes: "us",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: { "User-Agent": "TerritoryPlanBuilder/1.0" },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}
```

**Step 2: Create the accounts API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import { ACCOUNT_TYPES, type AccountTypeValue } from "@/lib/account-types";

export const dynamic = "force-dynamic";

// Generate the next synthetic ID: M000001, M000002, etc.
async function generateSyntheticId(): Promise<string> {
  // Find the highest existing M-series ID
  const result = await prisma.$queryRaw<{ max_id: string | null }[]>`
    SELECT MAX(leaid) as max_id FROM districts WHERE leaid LIKE 'M%'
  `;

  const maxId = result[0]?.max_id;
  if (!maxId) return "M000001";

  const num = parseInt(maxId.substring(1), 10);
  return `M${String(num + 1).padStart(6, "0")}`;
}

// POST — create a new non-district account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      accountType,
      stateAbbrev,
      street,
      city,
      state,
      zip,
      salesExecutive,
      phone,
      websiteUrl,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: "Account name is required" }, { status: 400 });
    }
    if (!accountType || !ACCOUNT_TYPES.some((t) => t.value === accountType)) {
      return NextResponse.json({ error: "Valid account type is required" }, { status: 400 });
    }

    // Generate synthetic ID
    const leaid = await generateSyntheticId();

    // Geocode if address fields provided
    let pointLocationSql = null;
    const hasAddress = street || city || state || zip;
    if (hasAddress) {
      const coords = await geocodeAddress({ street, city, state, zip });
      if (coords) {
        pointLocationSql = coords;
      }
    }

    // Create the district row with synthetic ID
    // Use raw SQL for the point_location geometry field since Prisma can't handle it
    await prisma.$executeRaw`
      INSERT INTO districts (
        leaid, name, account_type, state_abbrev,
        street_location, city_location, state_location, zip_location,
        sales_executive, phone, website_url,
        point_location,
        state_fips, created_at, updated_at
      ) VALUES (
        ${leaid}, ${name.trim()}, ${accountType},
        ${stateAbbrev || state || null},
        ${street || null}, ${city || null}, ${state || null}, ${zip || null},
        ${salesExecutive || null}, ${phone || null}, ${websiteUrl || null},
        ${pointLocationSql ? prisma.$queryRaw`ST_SetSRID(ST_MakePoint(${pointLocationSql.lng}, ${pointLocationSql.lat}), 4326)` : null},
        ${stateAbbrev ? await getStateFips(stateAbbrev) : "00"},
        NOW(), NOW()
      )
    `;

    return NextResponse.json({ leaid, name: name.trim(), accountType }, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}

// GET — search for potential duplicate accounts (used for duplicate warning)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const state = searchParams.get("state");

    if (!name || name.length < 2) {
      return NextResponse.json({ matches: [] });
    }

    // Fuzzy match: case-insensitive name contains, optionally scoped to state
    const where: Record<string, unknown> = {
      name: { contains: name, mode: "insensitive" },
    };
    if (state) {
      where.stateAbbrev = state;
    }

    const matches = await prisma.district.findMany({
      where,
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        accountType: true,
        isCustomer: true,
      },
      take: 5,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Error searching accounts:", error);
    return NextResponse.json({ error: "Failed to search accounts" }, { status: 500 });
  }
}

// Helper: look up state FIPS code from abbreviation
async function getStateFips(abbrev: string): Promise<string> {
  const state = await prisma.state.findUnique({
    where: { abbrev: abbrev.toUpperCase() },
    select: { fips: true },
  });
  return state?.fips || "00";
}
```

**Important note:** The raw SQL for `point_location` insertion needs to be tested — Prisma's `$executeRaw` with PostGIS functions may need the geometry constructed inline in the SQL string rather than as a parameter. During implementation, test this and adjust the SQL construction if needed. An alternative approach is to do the INSERT via Prisma (without `point_location`), then UPDATE the geometry with a separate raw query:

```typescript
// Alternative: insert first, then set geometry
await prisma.district.create({ data: { leaid, name, accountType, ... } });
if (pointLocationSql) {
  await prisma.$executeRaw`
    UPDATE districts
    SET point_location = ST_SetSRID(ST_MakePoint(${pointLocationSql.lng}::float, ${pointLocationSql.lat}::float), 4326)
    WHERE leaid = ${leaid}
  `;
}
```

**Step 3: Commit**

```bash
git add src/lib/geocode.ts src/app/api/accounts/route.ts
git commit -m "feat(api): add account creation endpoint with geocoding and duplicate search"
```

---

## Task 4: Update District Search API to Include Account Type

**Files:**
- Modify: `src/app/api/districts/route.ts`
- Modify: `src/app/api/districts/[leaid]/route.ts`

**Step 1: Add accountType to the districts list endpoint**

In `src/app/api/districts/route.ts`, add `accountType` to the `select` clause (~line 117) and to the returned `districtList` mapping (~line 148):

In the `select` block, add:
```typescript
accountType: true,
```

In the `districtList` mapping, add:
```typescript
accountType: d.accountType || "district",
```

**Step 2: Add accountType to the district detail endpoint**

In `src/app/api/districts/[leaid]/route.ts`, include `accountType` in the response's `district` object. Also read `point_location` coordinates if they exist (for accounts without a centroid polygon). Add to the centroid query:

```sql
SELECT
  COALESCE(ST_Y(centroid::geometry), ST_Y(point_location::geometry)) as lat,
  COALESCE(ST_X(centroid::geometry), ST_X(point_location::geometry)) as lng
FROM districts WHERE leaid = ${leaid}
```

This way non-district accounts with a `point_location` still return a lat/lng for the map to fly to.

Add `accountType: district.accountType || "district"` to the response `district` object.

**Step 3: Commit**

```bash
git add src/app/api/districts/route.ts src/app/api/districts/[leaid]/route.ts
git commit -m "feat(api): include accountType in district list and detail endpoints"
```

---

## Task 5: Update Materialized View for Point Accounts

**Files:**
- Modify: `scripts/district-map-features-view.sql`

**Step 1: Update the materialized view**

The view currently only selects `geometry` (MultiPolygon). Update the final SELECT to also include `point_location` and `account_type`, and use `COALESCE` so tile serving can pick the right geometry:

Add these columns to the final SELECT:

```sql
  d.account_type,
  d.point_location,
  -- Use polygon geometry when available, fall back to point_location
  COALESCE(d.geometry, d.point_location) AS render_geometry
```

Also update the WHERE clause — currently it implicitly filters to rows with polygon `geometry` (via the spatial index). Add `OR d.point_location IS NOT NULL` so point-only accounts appear:

```sql
WHERE d.geometry IS NOT NULL OR d.point_location IS NOT NULL
```

**Step 2: Refresh the view**

```bash
npx prisma db execute --stdin <<< "REFRESH MATERIALIZED VIEW CONCURRENTLY district_map_features;"
```

**Step 3: Commit**

```bash
git add scripts/district-map-features-view.sql
git commit -m "feat(tiles): include point accounts in district_map_features materialized view"
```

---

## Task 6: Update Tile Route to Render Point Geometry

**Files:**
- Modify: `src/app/api/tiles/[z]/[x]/[y]/route.ts`

**Step 1: Update the tile SQL query**

The tile query currently uses `d.geometry` in `ST_AsMVTGeom`. Update it to use the new `render_geometry` column (or `COALESCE(geometry, point_location)`) so both polygons and points get included in the vector tile.

Add `account_type` to the list of selected properties so MapLibre can access it for styling:

```sql
d.account_type,
```

The `ST_AsMVTGeom` call should use `COALESCE(d.geometry, d.point_location)` instead of just `d.geometry`. The spatial filter (`&&`) should also use `COALESCE`:

```sql
WHERE COALESCE(d.geometry, d.point_location) && tb.env_4326
```

**Step 2: Commit**

```bash
git add src/app/api/tiles/[z]/[x]/[y]/route.ts
git commit -m "feat(tiles): render point accounts as MVT features alongside polygons"
```

---

## Task 7: Map Layer — Circle Style for Point Accounts

**Files:**
- Modify: `src/lib/map-v2-layers.ts`
- Modify: `src/components/map-v2/MapV2Shell.tsx` (add the circle layer to the map)

**Step 1: Add a circle layer definition**

In `map-v2-layers.ts`, add a circle layer config that renders features where `account_type != 'district'`. The circle color should follow the same vendor category coloring as the polygon fill:

```typescript
// Circle layer for non-district accounts (CMOs, ESAs, etc.)
// Renders on top of polygon fills, uses same vendor category colors
export const ACCOUNT_POINT_LAYER: maplibregl.CircleLayerSpecification = {
  id: "account-points",
  type: "circle",
  source: "districts",
  "source-layer": "districts",
  filter: ["!=", ["get", "account_type"], "district"],
  paint: {
    "circle-radius": [
      "interpolate", ["linear"], ["zoom"],
      4, 4,
      8, 6,
      12, 10,
    ],
    "circle-color": /* same match expression as the active vendor fill layer */,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
    "circle-opacity": 0.9,
  },
};
```

The `circle-color` should use the same `match` expression as whichever vendor layer is active. This can be a function that takes the active vendor config and returns the circle paint properties.

**Step 2: Add the layer to MapV2Shell**

After the existing fill layers are added to the map, add the circle layer. It should be added last so it renders on top of polygons.

**Step 3: Commit**

```bash
git add src/lib/map-v2-layers.ts src/components/map-v2/MapV2Shell.tsx
git commit -m "feat(map-v2): add circle layer for non-district account points"
```

---

## Task 8: SearchBar — "Add Account" CTA

**Files:**
- Modify: `src/components/map-v2/SearchBar.tsx`
- Modify: `src/lib/map-v2-store.ts` (add state for account creation form)

**Step 1: Add store state for account creation**

In the map-v2 store, add:

```typescript
// Account creation
showAccountForm: boolean;
accountFormDefaults: { name?: string } | null;
openAccountForm: (defaults?: { name?: string }) => void;
closeAccountForm: () => void;
```

**Step 2: Add "Can't find it?" CTA to SearchBar**

In `SearchBar.tsx`, update the empty results state (line 138-142). Instead of just "No districts found", show:

```tsx
{showResults && results.length === 0 && searchQuery.length >= 2 && !loading && (
  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-3 z-30 text-center">
    <p className="text-xs text-gray-400 mb-2">No districts found</p>
    <button
      onClick={() => {
        openAccountForm({ name: searchQuery });
        setSearchQuery("");
        setShowResults(false);
      }}
      className="text-xs font-medium text-plum hover:text-plum/80 transition-colors"
    >
      Can't find it? Add a new account
    </button>
  </div>
)}
```

Also add the same CTA at the bottom of the results list when results DO exist (the user might be searching for something that isn't in the list):

```tsx
{showResults && results.length > 0 && (
  <div className="...existing dropdown...">
    {results.map(...)}
    {/* Add account CTA at bottom of results */}
    <div className="border-t border-gray-100 px-3 py-2 text-center">
      <button
        onClick={() => {
          openAccountForm({ name: searchQuery });
          setSearchQuery("");
          setShowResults(false);
        }}
        className="text-xs font-medium text-plum/70 hover:text-plum transition-colors"
      >
        Don't see it? Add a new account
      </button>
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/components/map-v2/SearchBar.tsx src/lib/map-v2-store.ts
git commit -m "feat(map-v2): add 'create account' CTA to district search bar"
```

---

## Task 9: Account Creation Form Component

**Files:**
- Create: `src/components/map-v2/panels/AccountForm.tsx`
- Modify: `src/components/map-v2/PanelContent.tsx` (render the form)
- Modify: `src/lib/api.ts` (add mutation hook)

**Step 1: Add the API mutation hook**

In `src/lib/api.ts`, add:

```typescript
// Create a new non-district account
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      accountType: string;
      stateAbbrev?: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      salesExecutive?: string;
      phone?: string;
      websiteUrl?: string;
    }) => {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create account");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
    },
  });
}

// Check for duplicate accounts before creating
export function useDuplicateCheck(name: string, state?: string) {
  return useQuery({
    queryKey: ["account-duplicates", name, state],
    queryFn: async () => {
      const params = new URLSearchParams({ name });
      if (state) params.set("state", state);
      const res = await fetch(`/api/accounts?${params}`);
      if (!res.ok) throw new Error("Failed to check duplicates");
      return res.json();
    },
    enabled: name.length >= 3,
    staleTime: 5000,
  });
}
```

**Step 2: Create the AccountForm component**

Build `src/components/map-v2/panels/AccountForm.tsx`:

- Form with required fields: name (pre-filled from search), account type dropdown (with tooltips)
- Optional fields: state dropdown, address fields (street, city, state, zip), sales executive, phone, website
- Duplicate warning section: when the user has typed a name, show any fuzzy matches from `useDuplicateCheck`
- On submit: call `useCreateAccount`, then `selectDistrict(newLeaid)` to open the new account's detail panel
- Account type dropdown should show the tooltip as a help icon or hover text next to each option

The form should be clean and compact — it renders inside the left panel area (same space as SearchPanel). Keep the Fullmind brand styling (plum accents, rounded-xl inputs, text-sm).

**Step 3: Wire into PanelContent**

In `PanelContent.tsx`, check `showAccountForm` from the store. If true, render `<AccountForm />` instead of the SearchPanel:

```typescript
if (showAccountForm) return <PanelContentWrapper><AccountForm /></PanelContentWrapper>;
```

**Step 4: Commit**

```bash
git add src/components/map-v2/panels/AccountForm.tsx src/components/map-v2/PanelContent.tsx src/lib/api.ts
git commit -m "feat(map-v2): add account creation form with duplicate warning"
```

---

## Task 10: Detail Panel — Account Type Badge & Conditional Tabs

**Files:**
- Modify: `src/components/map-v2/panels/district/DistrictHeader.tsx` (add type badge)
- Modify: `src/components/map-v2/panels/district/tabs/DistrictTabStrip.tsx` (hide Signals tab for non-districts)
- Modify: `src/components/map-v2/right-panels/DistrictCard.tsx` (pass accountType, adjust footer label)

**Step 1: Add account type badge to DistrictHeader**

When `accountType` is not `"district"`, show a small badge below the district name with the account type label. Use `getAccountTypeLabel()` from `account-types.ts`.

```tsx
{accountType !== "district" && (
  <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-plum/10 text-plum rounded-full">
    {getAccountTypeLabel(accountType)}
  </span>
)}
```

**Step 2: Conditionally hide Signals tab**

In `DistrictTabStrip.tsx`, accept a new prop `showSignals` (default `true`). When `false`, filter out the "signals" tab just like "planning" is filtered when `showPlanning` is false:

```typescript
const visibleTabs = TABS
  .filter((t) => t.key !== "planning" || showPlanning)
  .filter((t) => t.key !== "signals" || showSignals);
```

**Step 3: Pass accountType through DistrictCard**

In `DistrictCard.tsx`, read `data.district.accountType` and pass `showSignals={data.district.accountType === "district"}` to `DistrictTabStrip`. Also update the footer text from `LEAID: {leaid}` to show "Account ID" for non-district types:

```tsx
<p className="text-[10px] text-gray-300 text-center pb-2">
  {data.district.accountType === "district" ? "LEAID" : "Account ID"}: {leaid}
</p>
```

**Step 4: Commit**

```bash
git add src/components/map-v2/panels/district/DistrictHeader.tsx \
  src/components/map-v2/panels/district/tabs/DistrictTabStrip.tsx \
  src/components/map-v2/right-panels/DistrictCard.tsx
git commit -m "feat(map-v2): account type badge and conditional signals tab"
```

---

## Task 11: Migrate Existing Unmatched Accounts

**Files:**
- Create: `scripts/migrate-unmatched-accounts.sql`

**Step 1: Write the migration script**

```sql
-- Migrate unmatched_accounts into districts table with synthetic IDs
-- Each unmatched account gets a M-series ID and account_type = 'other'

-- First, find the starting sequence number
-- (in case any M-series IDs already exist)
DO $$
DECLARE
  next_num INT;
  rec RECORD;
  new_leaid VARCHAR(7);
BEGIN
  -- Get starting number
  SELECT COALESCE(MAX(CAST(SUBSTRING(leaid FROM 2) AS INT)), 0) + 1
    INTO next_num
    FROM districts
    WHERE leaid LIKE 'M%';

  -- Loop through unmatched accounts and insert
  FOR rec IN SELECT * FROM unmatched_accounts ORDER BY id LOOP
    new_leaid := 'M' || LPAD(next_num::TEXT, 6, '0');

    INSERT INTO districts (
      leaid, name, account_type, state_fips, state_abbrev,
      sales_executive, lmsid,
      fy25_net_invoicing, fy26_net_invoicing,
      fy26_open_pipeline, fy27_open_pipeline,
      is_customer, has_open_pipeline,
      created_at, updated_at
    )
    SELECT
      new_leaid,
      rec.account_name,
      'other',
      COALESCE(s.fips, '00'),
      rec.state_abbrev,
      rec.sales_executive,
      rec.lmsid,
      rec.fy25_net_invoicing,
      rec.fy26_net_invoicing,
      rec.fy26_open_pipeline,
      rec.fy27_open_pipeline,
      rec.is_customer,
      rec.has_open_pipeline,
      rec.created_at,
      NOW()
    FROM (SELECT 1) AS dummy
    LEFT JOIN states s ON s.abbrev = rec.state_abbrev;

    next_num := next_num + 1;
  END LOOP;

  RAISE NOTICE 'Migrated % unmatched accounts', next_num - 1;
END $$;
```

**Step 2: Run it**

```bash
npx prisma db execute --file scripts/migrate-unmatched-accounts.sql
```

**Step 3: Verify**

Check that the accounts exist and have correct data:

```sql
SELECT leaid, name, account_type, state_abbrev, is_customer, has_open_pipeline
FROM districts
WHERE leaid LIKE 'M%'
ORDER BY leaid
LIMIT 20;
```

**Step 4: Refresh the materialized view**

```bash
npx prisma db execute --stdin <<< "REFRESH MATERIALIZED VIEW CONCURRENTLY district_map_features;"
```

**Step 5: Commit**

```bash
git add scripts/migrate-unmatched-accounts.sql
git commit -m "feat(data): migrate unmatched accounts into districts with synthetic IDs"
```

---

## Task 12: Update Fullmind ETL Loader

**Files:**
- Modify: `scripts/etl/loaders/fullmind.py`

**Step 1: Update the ETL to create non-LEAID accounts directly**

Instead of dumping unmatched accounts into the `unmatched_accounts` table, the loader should now:

1. Keep the existing `categorize_records` logic that splits matched/unmatched
2. For unmatched records: generate synthetic M-series IDs and INSERT directly into the `districts` table (with `account_type = 'other'`)
3. Still populate the `unmatched_accounts` table as a backup/audit trail (for now)
4. Log how many new accounts were created vs. how many were updates to existing M-series accounts

The key change in `insert_unmatched_accounts()`:
- Before truncating `unmatched_accounts`, check if any of the unmatched records already have a matching M-series district (by `account_name + state_abbrev`)
- For new unmatched records: generate M-series ID and insert into `districts`
- For existing matches: update the financial fields on the existing M-series district
- Still write to `unmatched_accounts` for the audit trail

**Step 2: Commit**

```bash
git add scripts/etl/loaders/fullmind.py
git commit -m "feat(etl): create non-LEAID accounts directly in districts table during fullmind import"
```

---

## Task 13: Manual Testing & Polish

**Step 1: Test account creation flow**

1. Open Map V2, go to the search panel
2. Search for something that doesn't exist (e.g., "KIPP Houston Test")
3. Click "Can't find it? Add a new account"
4. Fill in required fields (name, type), optionally add an address
5. Submit — verify the account is created and the detail panel opens
6. Verify the detail panel shows the type badge and hides the Signals tab
7. If an address was provided, verify the account appears as a circle on the map

**Step 2: Test duplicate warning**

1. Create an account named "Test Academy" in state "TX"
2. Try to create another account named "Test Academy" in "TX"
3. Verify the duplicate warning appears showing the existing account
4. Confirm you can still proceed with creation

**Step 3: Test plan integration**

1. Open a territory plan
2. Search for the newly created account
3. Add it to the plan
4. Verify it appears in the plan's district list
5. Create an activity and task linked to the account

**Step 4: Commit any polish fixes**

```bash
git add -A
git commit -m "fix(accounts): polish account creation flow after manual testing"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Schema migration (account_type, point_location) | schema.prisma, migration.sql |
| 2 | Account type constants & types | account-types.ts |
| 3 | API route — create account + geocoding | api/accounts/route.ts, geocode.ts |
| 4 | Update district APIs to include accountType | api/districts/route.ts, api/districts/[leaid]/route.ts |
| 5 | Update materialized view for points | district-map-features-view.sql |
| 6 | Update tile route for point geometry | api/tiles/[z]/[x]/[y]/route.ts |
| 7 | Map circle layer for point accounts | map-v2-layers.ts, MapV2Shell.tsx |
| 8 | SearchBar "Add Account" CTA | SearchBar.tsx, map-v2-store.ts |
| 9 | Account creation form component | AccountForm.tsx, PanelContent.tsx, api.ts |
| 10 | Detail panel type badge + conditional tabs | DistrictHeader.tsx, DistrictTabStrip.tsx, DistrictCard.tsx |
| 11 | Migrate unmatched accounts | migrate-unmatched-accounts.sql |
| 12 | Update Fullmind ETL loader | fullmind.py |
| 13 | Manual testing & polish | Various |
