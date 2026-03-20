# Backend Context: Map Planning Overlays

## Data Models

### District
- **Primary key:** `leaid` (VarChar 7)
- **Geo data:** `geometry` (MultiPolygon 4326), `centroid` (Point 4326), `pointLocation` (Point 4326) -- all three managed outside Prisma via PostGIS
- **Location fields:** `streetLocation`, `cityLocation`, `stateLocation`, `zipLocation`, `countyName`, `stateAbbrev`, `urbanCentricLocale`
- **Key business fields:** `isCustomer`, `hasOpenPipeline`, `salesExecutive`, `accountType`, FY25-FY27 financial columns
- **Relations:** contacts[], territoryPlans[] (via junction), activityLinks[] (via junction), taskLinks[] (via junction), vacancyScans[], vacancies[], schools[], tags (via DistrictTag junction)
- **Map view:** Exposed via `district_map_features` materialized view which JOINs vendor categories, signal columns, and plan memberships. Uses `COALESCE(geometry, point_location) AS render_geometry` for tile rendering.

### Contact
- **Primary key:** `id` (auto-increment Int)
- **Geo data:** NONE. Located indirectly via `leaid` -> District (which has geometry/centroid).
- **Key fields:** `name`, `title`, `email`, `phone`, `isPrimary`, `linkedinUrl`, `persona`, `seniorityLevel`
- **Relations:** district (via leaid), activityLinks[], taskLinks[], schoolContacts[], vacancies[]

### Vacancy
- **Primary key:** `id` (cuid String)
- **Geo data:** NONE. Located indirectly via `leaid` -> District. Optionally linked to a school via `schoolNcessch` (which has lat/lng).
- **Key fields:** `title`, `category` (SPED, ELL, General Ed, etc.), `status` (open/closed/expired), `fullmindRelevant`, `datePosted`, `startDate`, `hiringManager`, `hiringEmail`, `sourceUrl`, `fingerprint`
- **Relations:** district (via leaid), scan (via scanId), school? (via schoolNcessch), contact? (via contactId)
- **Scan system:** VacancyScan tracks scan runs per district with batch support.

### TerritoryPlan
- **Primary key:** `id` (UUID)
- **Geo data:** NONE. Geographic extent derived from linked districts/states.
- **Key fields:** `name`, `status` (planning/working/stale/archived), `fiscalYear`, `startDate`, `endDate`, `color`, `ownerId`, `userId`
- **Denormalized rollups:** `districtCount`, `stateCount`, `renewalRollup`, `expansionRollup`, `winbackRollup`, `newBusinessRollup`
- **Relations:** districts[] (via TerritoryPlanDistrict junction with per-district targets), states[] (via TerritoryPlanState), collaborators[] (via TerritoryPlanCollaborator), activityLinks[], taskLinks[], ownerUser
- **Junction: TerritoryPlanDistrict** has `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`, `notes`, and linked services via TerritoryPlanDistrictService.

### Activity (Events/Activities)
- **Primary key:** `id` (UUID)
- **Geo data:** NONE. Located indirectly via linked districts (ActivityDistrict junction) and linked states (ActivityState junction).
- **Key fields:** `type` (conference, road_trip, email_campaign, etc.), `title`, `startDate`, `endDate`, `status` (planned/completed/cancelled), `source` (manual/calendar_sync), `outcome`, `outcomeType`
- **Calendar integration:** `googleEventId` links to Google Calendar; `source` distinguishes manual vs synced
- **Relations:** plans[] (via ActivityPlan), districts[] (via ActivityDistrict), contacts[] (via ActivityContact), states[] (via ActivityState), taskLinks[]
- **ActivityDistrict** junction has `warningDismissed` flag for unlinked-district warnings.

### CalendarEvent (staging table)
- **Primary key:** `id` (UUID)
- **Geo data:** `location` (free-text String, not geocoded)
- **Key fields:** `title`, `startTime`, `endTime`, `attendees` (JSON), `status` (pending/confirmed/dismissed/cancelled), suggested matches (district, contacts, plan, activity type)
- **Relations:** connection (CalendarConnection)

### School
- **Primary key:** `ncessch` (VarChar 12)
- **Geo data:** `latitude` (Decimal 10,7), `longitude` (Decimal 10,7) -- proper lat/lng columns
- **Key fields:** `schoolName`, `charter`, `schoolLevel`, `enrollment`, `schoolStatus`, address fields
- **Relations:** district (via leaid), enrollmentHistory[], schoolTags[], schoolContacts[], vacancies[]

### UserProfile
- **Primary key:** `id` (UUID, matches Supabase auth user.id)
- **Geo data:** `locationLat` (Decimal 10,7), `locationLng` (Decimal 10,7), `location` (free-text String)
- **Key fields:** `email`, `fullName`, `role` (admin/manager/rep), `hasCompletedSetup`
- **Relations:** goals[], calendarConnection, ownedPlans[], collaboratingOn[], savedMapViews[]

### MapView
- **Primary key:** `id` (UUID)
- **Key fields:** `name`, `isShared`, `state` (JSON blob capturing full map state), `ownerId`
- **Relations:** owner (UserProfile)

## API Patterns

### Route Structure
- **Framework:** Next.js App Router with route handlers in `src/app/api/`
- **Pattern:** REST-style with `route.ts` files exporting named HTTP method functions (GET, POST, PUT, PATCH, DELETE)
- **Dynamic segments:** `[id]`, `[leaid]`, `[ncessch]`, `[z]/[x]/[y]` for tiles
- **All routes:** `export const dynamic = "force-dynamic"` (no ISR/static generation)

### Database Access
- **Prisma ORM** (`src/lib/prisma.ts`) for most CRUD operations
- **Raw pg Pool** (`src/lib/db.ts`) for PostGIS queries (tiles, customer-dots) where Prisma's Unsupported type handling is insufficient
- Both use singleton pattern with `globalThis` for dev hot-reload safety

### Response Formats
- All responses are `NextResponse.json(...)` with typed payloads
- Error pattern: `{ error: "message" }` with appropriate HTTP status codes
- List endpoints return: `{ items: [...], total: number }` or similar
- GeoJSON endpoints return standard `{ type: "FeatureCollection", features: [...] }`
- MVT tile endpoint returns raw `application/vnd.mapbox-vector-tile` binary

### Client-Side Data Fetching
- **TanStack Query** (React Query) hooks in `src/features/*/lib/queries.ts`
- Shared `fetchJson<T>()` helper in `src/features/shared/lib/api-client.ts`
- `API_BASE = "/api"` -- all client requests are same-origin

## Existing Queries & Filters

### Districts (`GET /api/districts`)
- Filters: `state`, `status` (customer/pipeline/no_data), `salesExec`, `search` (name), `metric`, `year`
- Pagination: `limit`, `offset`
- No auth required (public data)

### Activities (`GET /api/activities`)
- **Auth required** -- scoped to `createdByUserId: user.id`
- Filters: `category`, `planId`, `districtLeaid`, `stateAbbrev`, `status`, `startDate`/`endDate` range, `unscheduled`, `needsPlanAssociation`, `hasUnlinkedDistricts`
- Pagination: `limit`, `offset`
- Computes `needsPlanAssociation` and `hasUnlinkedDistricts` flags post-query

### Contacts (`GET /api/contacts`)
- Filters: `search` (name, title, email), `limit`
- No auth required
- Returns flattened district info

### Territory Plans (`GET /api/territory-plans`)
- **Auth required** -- but returns ALL plans (team-shared visibility)
- Includes district count, enrollment aggregates, pipeline totals, task progress
- Sub-routes: `[id]/districts`, `[id]/contacts`, `[id]/vacancies`

### Vacancies (`GET /api/districts/[leaid]/vacancies`, `GET /api/territory-plans/[id]/vacancies`)
- Fetched per-district or per-plan
- Scan triggered via `POST /api/vacancies/scan` (single) or `POST /api/vacancies/scan-bulk` (batch by plan)

### Map-Specific Endpoints
- **Tiles:** `GET /api/tiles/[z]/[x]/[y]` -- MVT vector tiles from `district_map_features` materialized view. Filters: `state`, `fy`, `fy2` (comparison mode)
- **Customer Dots:** `GET /api/customer-dots` -- GeoJSON point features using `ST_Centroid(geometry)` for districts with customer/pipeline/target status. No auth.
- **School GeoJSON:** `GET /api/schools/geojson` -- Bounds-based query (`?bounds=west,south,east,north`) returning school points with lat/lng. No auth.
- **Map Views:** CRUD at `/api/map-views` and `/api/map-views/[id]` -- Saves/loads named map state snapshots. Auth required.

### Calendar Events (`GET /api/calendar/events`)
- **Auth required** -- scoped to `userId: user.id`
- Filters: `status`, `limit`, `offset`
- Enriches with suggested district/contact/plan names

## Geo Data Assessment

### Models WITH Coordinates
| Model | Geo Fields | Type | Notes |
|-------|-----------|------|-------|
| **District** | `geometry` (MultiPolygon), `centroid` (Point), `pointLocation` (Point) | PostGIS geometry(4326) | Full polygon boundaries for ~13k US school districts. `pointLocation` used as fallback for entities without polygon (CMOs, ESAs). Managed outside Prisma. |
| **School** | `latitude`, `longitude` | Decimal(10,7) | Standard lat/lng columns. All ~100k+ schools have coordinates from NCES data. Queried via Prisma `gte/lte` bounds filter. |
| **UserProfile** | `locationLat`, `locationLng` | Decimal(10,7) | User's home base location. Optional. |

### Models WITHOUT Coordinates (Need Geocoding or Proxy)
| Model | Available Location Data | Geocoding Strategy |
|-------|------------------------|-------------------|
| **Contact** | `leaid` -> District | Use parent district's centroid/pointLocation. No independent address. |
| **Vacancy** | `leaid` -> District, `schoolNcessch` -> School (has lat/lng) | Use linked school's lat/lng when available, fall back to district centroid. ~Good coverage since many vacancies link to schools. |
| **TerritoryPlan** | Linked districts and states | Derive geographic extent from member districts' centroids. No single point needed. |
| **Activity** | Linked districts (via ActivityDistrict) and states (via ActivityState) | Use linked districts' centroids for pin placement. Multi-district activities could use centroid of centroids or show multiple pins. |
| **CalendarEvent** | `location` (free-text string) | Would need geocoding service (Google Maps Geocoding API or similar) to convert to lat/lng. Low priority since these transition to Activities. |

### Existing Geo Infrastructure
- **PostGIS extension** enabled in the database
- **Vector tiles** served via raw SQL with `ST_AsMVT`, `ST_TileEnvelope`, `ST_Transform`, `ST_Simplify`
- **Materialized view** (`district_map_features`) pre-computes vendor categories and uses `COALESCE(geometry, point_location)` as render geometry
- **GeoJSON** generation exists for both districts (customer-dots) and schools
- **Bounds-based querying** implemented for schools using Prisma `gte/lte` on lat/lng columns

## Auth & Permissions

### Auth Provider
- **Supabase Auth** with server-side cookie-based sessions
- Client: `src/lib/supabase/client.ts`
- Server: `src/lib/supabase/server.ts`
- Middleware: `src/lib/supabase/middleware.ts`

### User Context Functions
- `getUser()` -- Returns effective user (respects admin impersonation via `impersonate_uid` cookie). Most API routes use this.
- `getRealUser()` -- Returns the actual authenticated user, bypassing impersonation. Used for admin checks.
- `getAdminUser()` -- Returns user only if they have the `admin` role. Used for admin-only endpoints.

### Role-Based Access
- **Roles:** `admin`, `manager`, `rep` (enum `UserRole`)
- **Activities:** Scoped to `createdByUserId` -- users only see their own activities
- **Territory Plans:** Shared visibility across team (all authenticated users see all plans)
- **Districts/Schools/Contacts:** No user scoping -- shared data across the team
- **Admin routes:** Under `/api/admin/*`, gated by `getAdminUser()` check
- **Map Views:** Scoped to owner + shared views (`ownerId = user.id OR isShared = true`)
- **Impersonation:** Admins can impersonate other users via cookie, allowing them to see the app as another rep

### Auth-Free Endpoints
Some data endpoints do NOT require auth (district lists, customer-dots, tiles, schools, contacts). These serve shared reference data.

## Key Files

### Schema & Database
- `prisma/schema.prisma` -- Full Prisma schema with all 30+ models
- `src/lib/prisma.ts` -- Prisma client singleton
- `src/lib/db.ts` -- Raw pg Pool for PostGIS queries
- `scripts/district-map-features-view.sql` -- Materialized view definition for map tiles

### Auth
- `src/lib/supabase/server.ts` -- `getUser()`, `getRealUser()`, `getAdminUser()`
- `src/lib/supabase/client.ts` -- Browser-side Supabase client
- `src/lib/supabase/middleware.ts` -- Session refresh middleware

### API Routes (Key for Map Overlays)
- `src/app/api/tiles/[z]/[x]/[y]/route.ts` -- MVT vector tile server (raw SQL + PostGIS)
- `src/app/api/customer-dots/route.ts` -- GeoJSON district points for map pins
- `src/app/api/schools/geojson/route.ts` -- Bounds-based school GeoJSON
- `src/app/api/map-views/route.ts` -- Saved map view CRUD
- `src/app/api/districts/route.ts` -- District list with filters
- `src/app/api/contacts/route.ts` -- Contact search/CRUD
- `src/app/api/activities/route.ts` -- Activity list with rich filtering
- `src/app/api/territory-plans/route.ts` -- Plan list with aggregates
- `src/app/api/territory-plans/[id]/vacancies/route.ts` -- Plan-level vacancy aggregation
- `src/app/api/vacancies/scan/route.ts` -- Trigger vacancy scans
- `src/app/api/calendar/events/route.ts` -- Calendar event inbox

### Client Query Hooks
- `src/features/map/lib/queries.ts` -- Map data hooks (customer dots, schools GeoJSON, quantiles, states)
- `src/features/activities/lib/queries.ts` -- Activity CRUD hooks
- `src/features/plans/lib/queries.ts` -- Plan CRUD hooks
- `src/features/vacancies/lib/queries.ts` -- Vacancy and scan hooks
- `src/features/shared/lib/api-client.ts` -- Shared `fetchJson` helper

### Type Definitions
- `src/features/shared/types/api-types.ts` -- All shared TypeScript interfaces (District, Contact, Activity, TerritoryPlan, Vacancy, School, etc.)
- `src/features/activities/types.ts` -- Activity type enums and categories
- `src/features/tasks/types.ts` -- Task status/priority types
