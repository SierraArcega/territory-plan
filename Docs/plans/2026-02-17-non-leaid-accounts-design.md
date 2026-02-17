# Non-LEAID Account Support — Design Doc

**Date:** 2026-02-17
**Status:** Approved

---

## Goal

Allow users to add accounts to the system that don't have LEAIDs or geospatial data — CMOs, ESAs, cooperatives, universities, and other education orgs — so they can be treated as first-class CRM entities: added to territory plans, plotted on the map (when address is provided), and linked to activities, tasks, and contacts.

---

## Architecture: Expand the Districts Table

Rather than creating a separate Account entity (high migration cost) or parallel tables (double maintenance), we expand the existing `districts` table to support non-district account types.

**Why this approach:**
- All existing junction tables (`territory_plan_districts`, `activity_districts`, `task_districts`, `contacts`, `district_tags`) continue to work without changes
- All existing API routes and components work without refactoring
- Education data columns (200+) simply stay null for non-district accounts — they already are for many sparse districts
- If a full Account abstraction is ever needed, this approach doesn't close that door

### New Columns on `districts`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `account_type` | VARCHAR(20) | `'district'` | Identifies what kind of entity this is |
| `point_location` | geometry(Point, 4326) | NULL | Geocoded lat/lng for map pin — only needed for map visibility |

### Account Types (dropdown with tooltips)

| Value | Label | Tooltip |
|-------|-------|---------|
| `district` | District | Traditional public school district (K-12 LEA) |
| `cmo` | Charter/CMO | Charter management organization operating multiple charter schools |
| `esa_boces` | ESA/BOCES | Regional education service agency supporting multiple districts |
| `cooperative` | Cooperative | Purchasing cooperative where districts pool buying power |
| `private_school` | Private School | Private or parochial school |
| `state_agency` | State Agency | State department of education or board |
| `university` | University | College or university |
| `organization` | Organization | Other education-related organization |
| `other` | Other | Doesn't fit the above categories |

### Synthetic ID Scheme

Non-LEAID accounts get IDs like `M000001`, `M000002`, etc.:
- "M" prefix for "manual" — distinguishes from real 7-digit LEAIDs
- Generated server-side (max existing M-id + 1, or sequence)
- Stored in the `leaid` column (VARCHAR(7) — fits perfectly)
- Aliased as "Account ID" in the UI

---

## Map Rendering

### Tile Serving Changes

The `district_map_features` materialized view gets updated to include non-district accounts that have a `point_location`:
- For accounts without polygon `geometry`, the tile query uses `point_location` (Point) instead
- Each feature gets an `account_type` property for client-side styling
- Both polygon and point features live in the same `districts` MVT layer

### Client-Side Display

- District polygons render as filled shapes (no change)
- Non-district accounts render as **colored circles** on top of the polygon layer
- Circles pick up the same vendor category colors (fullmind_category, etc.)
- All account types use the same circle style — no shape differentiation
- Clicking a circle opens the same detail panel
- Tooltip on hover shows name, type, state
- Filter expressions (state, sales_executive, plan_ids) apply to points the same way

### Location Is Optional

- Address/geocoding is NOT required to create an account
- Accounts without `point_location` simply don't appear on the map
- They're still fully functional for plans, activities, tasks, contacts, etc.
- Users can add/update the address later to make the account appear on the map

---

## Account Creation UX (Map V2)

### Integrated Into District Search

The "Add Account" action lives within the existing district search flow:

1. User searches for an account/district in the search field
2. Results show matching districts as usual
3. At the bottom of results (or when no/few matches): **"Can't find it? Add a new account"** link
4. Opens the create account form (name pre-filled with the search term)

This is the natural workflow — search first, create only when needed.

### Create Account Form

**Required fields:**
- Account name
- Account type (dropdown with tooltips)

**Optional fields:**
- State (dropdown)
- Address (street, city, state, zip — geocoded to `point_location` on save)
- Sales executive
- Phone
- Website URL

Everything else (contacts, tags, notes, activities, tasks, plan membership) gets added through the detail panel after the account exists.

### Duplicate Warning

On creation, a fuzzy name match (case-insensitive, same state) checks for similar existing accounts:
- If matches found: show them as a non-blocking warning — "These accounts look similar"
- User can select an existing account or confirm they want to create new
- **Warning only — never blocks creation.** The user always has final say.

---

## Detail Panel

When a non-district account is opened, the detail panel renders the same as for districts, with one key difference:

| Section | District (has LEAID) | Non-district account |
|---------|---------------------|---------------------|
| Header (name, type badge, state) | Yes | Yes |
| Info tab (address, phone, website) | Yes | Yes |
| Contacts tab | Yes | Yes |
| Tags | Yes | Yes |
| Notes | Yes | Yes |
| Data & Demographics tab | Yes | **Hidden** (no education data) |
| Fullmind CRM data (revenue, pipeline) | Yes | Yes |
| Activities / Tasks | Yes | Yes |
| Plan membership | Yes | Yes |

The Data & Demographics tab is conditionally hidden when there's no education data — which is always the case for non-district accounts and already the case for some sparse districts.

---

## Unmatched Accounts Migration

Existing `unmatched_accounts` rows get migrated into `districts` with:
- Synthetic M-series IDs
- `account_type` set based on available info (likely `'other'` for most)
- CRM fields (sales_executive, revenue, pipeline) carried over
- After migration, `unmatched_accounts` table becomes unused (drop later)

---

## In Scope

1. Schema changes — `account_type` column, `point_location` geometry column
2. Synthetic ID generation (M000001 scheme)
3. API route — create/update non-district accounts with optional geocoding
4. Materialized view update — include point accounts in `district_map_features`
5. Tile query update — render point geometry as circles alongside polygon fills
6. Map V2 — "Add Account" integrated into district search flow
7. Detail panel — conditionally hide Data & Demographics tab
8. Account type dropdown with tooltips
9. Duplicate warning (fuzzy name match, non-blocking)
10. Migrate existing `unmatched_accounts` rows into `districts`

## Out of Scope

- Click/drag map to place pins (address geocode only)
- Bulk import of non-LEAID accounts (CSV upload)
- Search/filter by account type in map layer controls
- Different map icon shapes per account type
- Full Account abstraction layer (Approach A — only if needed later)
- Dropping the `unmatched_accounts` table (migrate data now, drop later)
- Changes to Map V1 or any non-Map-V2 workflows
- Automated deduplication or merge tooling
