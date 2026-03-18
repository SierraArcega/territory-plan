# Calendar Sync Configuration — Backend Context

## Database & ORM

- **Database**: PostgreSQL (with PostGIS extension)
- **ORM**: Prisma Client JS (`prisma-client-js`) with `postgresqlExtensions` preview feature
- **Schema**: `prisma/schema.prisma`
- **Client singleton**: `src/lib/prisma.ts` — standard global singleton pattern for Next.js hot reload
- **Connection**: Uses `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) env vars

---

## Auth Patterns

**Provider**: Supabase Auth (cookie-based sessions via `@supabase/ssr`)

**Key files**:
- `src/lib/supabase/server.ts` — server-side auth utilities
- `src/lib/supabase/middleware.ts` — route protection middleware

**Auth functions** (from `src/lib/supabase/server.ts`):
- `getUser()` — returns the effective user (respects admin impersonation via `impersonate_uid` cookie). This is what all API routes use.
- `getRealUser()` — returns the real authenticated user, ignoring impersonation. Used for admin checks.
- `getAdminUser()` — returns user + profile only if they have the `admin` role.

**API route auth pattern**: Every API route calls `const user = await getUser()` at the top, returns 401 if null. No separate auth middleware — it's inline per route handler.

**Middleware** (`src/lib/supabase/middleware.ts`): `updateSession()` refreshes the Supabase auth token and redirects unauthenticated users away from protected routes (everything except `/login`, `/signup`, `/auth`).

---

## API Route Patterns

- **Framework**: Next.js App Router (`src/app/api/`)
- **Convention**: Export `GET`, `POST`, `PATCH`, `PUT`, `DELETE` async functions from `route.ts`
- **All routes** set `export const dynamic = "force-dynamic"` (Vercel serverless)
- **Auth**: Inline `getUser()` check at the top of every handler
- **Response format**: `NextResponse.json(...)` with appropriate status codes
- **Error handling**: try/catch with `console.error` + 500 JSON response
- **Imports**: `import prisma from "@/lib/prisma"`, `import { getUser } from "@/lib/supabase/server"`

**Calendar API routes**:
| Route | Method | Purpose |
|---|---|---|
| `/api/calendar/connect` | GET | Redirects to Google OAuth consent screen |
| `/api/calendar/callback` | GET | Handles OAuth redirect, exchanges code for tokens, upserts `CalendarConnection`, triggers initial sync |
| `/api/calendar/status` | GET | Returns connection status + pending event count |
| `/api/calendar/status` | PATCH | Updates `syncEnabled` and `companyDomain` settings |
| `/api/calendar/sync` | POST | Triggers pull sync from Google Calendar |
| `/api/calendar/disconnect` | POST | Deletes connection + cascading calendar events |
| `/api/calendar/events` | GET | Lists staged calendar events (inbox) |
| `/api/calendar/events/[id]` | POST | Confirms event -> creates Activity |
| `/api/calendar/events/[id]` | PATCH | Dismisses event |
| `/api/calendar/events/batch-confirm` | POST | Batch confirms all high-confidence pending events |

---

## Existing Calendar Integration

### Connection Flow
1. User clicks "Connect Google Calendar" -> `GET /api/calendar/connect`
2. Generates CSRF state token (contains userId + nonce), redirects to Google OAuth consent
3. Google redirects to `GET /api/calendar/callback` with auth code
4. Exchanges code for `accessToken` + `refreshToken` via `exchangeCodeForTokens()`
5. Extracts `companyDomain` from user email (e.g., `fullmindlearning.com`)
6. Upserts `CalendarConnection` record (one per user)
7. Auto-triggers initial `syncCalendarEvents()` (non-fatal if fails)
8. Redirects to `/?tab=activities&calendarConnected=true`

### OAuth Details
- **Scopes**: `calendar.readonly`, `calendar.events`, `userinfo.email`
- **Separate OAuth client** from Supabase login (uses `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`)
- **Token refresh**: `getValidAccessToken()` checks expiry (5-minute buffer), refreshes automatically
- **Key file**: `src/features/calendar/lib/google.ts`

### Pull Sync (Google Calendar -> App)
**File**: `src/features/calendar/lib/sync.ts` — `syncCalendarEvents(userId)`

1. Validates `CalendarConnection` exists and `syncEnabled === true`
2. Refreshes access token if expired
3. Fetches events from Google Calendar API: **7 days past + 14 days future** window
4. Filters to timed events only (skips all-day events and cancelled)
5. Filters to events with **external attendees** (not matching `companyDomain`)
6. **Smart matching**: matches attendee emails against `Contact` table -> looks up `District` -> finds active `TerritoryPlan`
7. **Activity type auto-detection**: keyword-based from event title (`demo`, `discovery`, `check-in`, etc.) with fallback to attendee count heuristic
8. Upserts into `CalendarEvent` staging table (`pending` status)
9. Marks events no longer in Google as `cancelled`
10. Updates `lastSyncAt` on the connection

**Confidence levels**: `high` (exact email match to Contact), `low` (has external attendees but no Contact match), `none` (no external attendees)

### Push Sync (App -> Google Calendar)
**File**: `src/features/calendar/lib/push.ts`

- `pushActivityToCalendar(userId, activityId)` — creates Google event when manual Activity is created (skips calendar_sync sourced activities)
- `updateActivityOnCalendar(userId, activityId)` — patches Google event when Activity is updated
- `deleteActivityFromCalendar(userId, activityId, googleEventId)` — deletes Google event when Activity is deleted
- All push operations are **best-effort** (errors logged, not thrown)
- Linked via `Activity.googleEventId` (unique field)

### Calendar Event Confirmation
`confirmCalendarEvent(userId, calendarEventId, overrides?)`:
- Takes a staged `CalendarEvent` (status=`pending`) and creates an `Activity`
- Supports overrides for activityType, title, planIds, districtLeaids, contactIds, notes
- Falls back to suggested values from smart matching
- Sets `Activity.source = "calendar_sync"`
- Links Activity to plans, districts, contacts, states (auto-derives states from districts)
- Runs in a Prisma transaction

### Frontend Query Hooks
**File**: `src/features/calendar/lib/queries.ts` — TanStack Query hooks:
- `useCalendarConnection()` — connection status
- `useDisconnectCalendar()` — disconnect mutation
- `useUpdateCalendarSettings()` — PATCH syncEnabled/companyDomain
- `useTriggerCalendarSync()` — trigger pull sync
- `useCalendarInbox(status?)` — list staged events
- `useCalendarInboxCount()` — pending count for badge
- `useConfirmCalendarEvent()` — confirm event -> create Activity
- `useDismissCalendarEvent()` — dismiss event
- `useBatchConfirmCalendarEvents()` — batch confirm high-confidence

---

## Activity Model & Types

### Schema (`prisma/schema.prisma`)
```
model Activity {
  id              String    @id @default(uuid())
  type            String    @db.VarChar(30)
  title           String    @db.VarChar(255)
  notes           String?
  startDate       DateTime?
  endDate         DateTime?
  status          String    @default("planned") @db.VarChar(20)
  createdByUserId String?   @db.Uuid
  googleEventId   String?   @unique     // Links to Google Calendar event
  source          String    @default("manual") @db.VarChar(20)  // "manual" | "calendar_sync"
  outcome         String?   @db.VarChar(500)
  outcomeType     String?   @db.VarChar(30)
  createdAt       DateTime
  updatedAt       DateTime
}
```

### Activity Types (from `src/features/activities/types.ts`)
Three categories:
- **events**: `conference`, `road_trip`, `trade_show`, `school_visit_day`
- **outreach**: `email_campaign`, `phone_call`, `linkedin_message`
- **meetings**: `discovery_call`, `demo`, `proposal_review`, `customer_check_in`

### Activity Statuses
`planned`, `completed`, `cancelled`

### Relations (many-to-many via junction tables)
- `ActivityPlan` — links to `TerritoryPlan` (multiple plans per activity)
- `ActivityDistrict` — links to `District` (has `warningDismissed` flag)
- `ActivityContact` — links to `Contact`
- `ActivityState` — links to `State` (has `isExplicit` flag for user-added vs auto-derived)
- `TaskActivity` — links to `Task`

---

## CalendarConnection Model

```
model CalendarConnection {
  id                 String    @id @default(uuid())
  userId             String    @unique @db.Uuid
  googleAccountEmail String    @db.VarChar(255)
  accessToken        String
  refreshToken       String
  tokenExpiresAt     DateTime
  companyDomain      String    @db.VarChar(100)  // Filters internal attendees
  syncEnabled        Boolean   @default(true)
  lastSyncAt         DateTime?
  status             String    @default("connected") @db.VarChar(20)  // connected | disconnected | error
  createdAt          DateTime
  updatedAt          DateTime
}
```

## CalendarEvent Staging Model

```
model CalendarEvent {
  id                    String   @id @default(uuid())
  userId                String   @db.Uuid
  connectionId          String
  googleEventId         String
  title                 String   @db.VarChar(500)
  description           String?
  startTime             DateTime
  endTime               DateTime
  location              String?  @db.VarChar(500)
  attendees             Json     @default("[]")
  status                String   @default("pending")  // pending | confirmed | dismissed | cancelled
  suggestedActivityType String?  @db.VarChar(30)
  suggestedDistrictId   String?  @db.VarChar(7)
  suggestedContactIds   Json?
  suggestedPlanId       String?
  matchConfidence       String   @default("none")  // high | medium | low | none
  activityId            String?  // Set when confirmed -> Activity created
  lastSyncedAt          DateTime
  @@unique([connectionId, googleEventId])
}
```

---

## User Preferences / Settings Storage

### UserProfile Model
The `UserProfile` table stores user-level data but has **no general-purpose preferences/settings column**. Current fields:
- Identity: `id` (Supabase UUID), `email`, `fullName`, `avatarUrl`
- Role: `role` (enum: `admin`, `manager`, `rep`)
- Profile: `jobTitle`, `location`, `locationLat/Lng`, `phone`, `slackUrl`, `bio`
- Onboarding: `hasCompletedSetup`
- Timestamps: `createdAt`, `updatedAt`, `lastLoginAt`

### Calendar-specific settings
Currently stored on `CalendarConnection`:
- `syncEnabled` (Boolean) — master toggle for calendar sync
- `companyDomain` (String) — used to filter internal attendees

**There is no generic settings/preferences JSON column or separate settings table.** Feature-specific configuration is stored on the relevant model (e.g., sync settings live on `CalendarConnection`).

### UserGoal Model
Per-user, per-fiscal-year goal targets. Not a general settings store.

---

## Key File Paths

| Area | File |
|---|---|
| Prisma schema | `prisma/schema.prisma` |
| Prisma client | `src/lib/prisma.ts` |
| Auth utilities | `src/lib/supabase/server.ts` |
| Auth middleware | `src/lib/supabase/middleware.ts` |
| Google OAuth + API | `src/features/calendar/lib/google.ts` |
| Pull sync engine | `src/features/calendar/lib/sync.ts` |
| Push sync (app -> gcal) | `src/features/calendar/lib/push.ts` |
| Calendar query hooks | `src/features/calendar/lib/queries.ts` |
| Calendar connect route | `src/app/api/calendar/connect/route.ts` |
| Calendar callback route | `src/app/api/calendar/callback/route.ts` |
| Calendar status route | `src/app/api/calendar/status/route.ts` |
| Calendar sync route | `src/app/api/calendar/sync/route.ts` |
| Calendar disconnect | `src/app/api/calendar/disconnect/route.ts` |
| Calendar events routes | `src/app/api/calendar/events/route.ts`, `src/app/api/calendar/events/[id]/route.ts`, `src/app/api/calendar/events/batch-confirm/route.ts` |
| Activity types/categories | `src/features/activities/types.ts` |
| Activities API | `src/app/api/activities/route.ts` |
| Activity detail API | `src/app/api/activities/[id]/route.ts` |
| Shared API types | `src/features/shared/types/api-types.ts` |
| Calendar UI components | `src/features/calendar/components/` |
