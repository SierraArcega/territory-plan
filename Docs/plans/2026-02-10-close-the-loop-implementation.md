# Close the Loop — Implementation Plan

> **Status: Complete** — All steps implemented and committed on `feature/close-the-loop`.

## Branch

`feature/close-the-loop` (created from `main`)

Commit early and often. Each step below should result in at least one commit.

---

## Phase 1: Google Calendar Sync

### Step 1.1 — Schema & Database

**Files to create/modify:**
- `prisma/schema.prisma` — Add `CalendarConnection`, `CalendarEvent` models; add `googleEventId`, `source`, `outcome`, `outcomeType` fields to `Activity`

**Schema additions:**

```prisma
// Calendar connection - stores Google OAuth tokens for calendar access
model CalendarConnection {
  id                 String   @id @default(uuid())
  userId             String   @map("user_id") @db.Uuid
  googleAccountEmail String   @map("google_account_email") @db.VarChar(255)
  accessToken        String   @map("access_token")    // encrypted
  refreshToken       String   @map("refresh_token")   // encrypted
  tokenExpiresAt     DateTime @map("token_expires_at")
  companyDomain      String   @map("company_domain") @db.VarChar(100)
  syncEnabled        Boolean  @default(true) @map("sync_enabled")
  lastSyncAt         DateTime? @map("last_sync_at")
  status             String   @default("connected") @db.VarChar(20) // connected, disconnected, error
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  user   UserProfile    @relation(fields: [userId], references: [id], onDelete: Cascade)
  events CalendarEvent[]

  @@unique([userId])
  @@map("calendar_connections")
}

// Staged calendar events - inbox for rep review
model CalendarEvent {
  id                    String   @id @default(uuid())
  userId                String   @map("user_id") @db.Uuid
  connectionId          String   @map("connection_id")
  googleEventId         String   @map("google_event_id")
  title                 String   @db.VarChar(500)
  description           String?
  startTime             DateTime @map("start_time")
  endTime               DateTime @map("end_time")
  location              String?  @db.VarChar(500)
  attendees             Json     @default("[]") // [{email, name, responseStatus}]
  status                String   @default("pending") @db.VarChar(20) // pending, confirmed, dismissed, cancelled
  suggestedActivityType String?  @map("suggested_activity_type") @db.VarChar(30)
  suggestedDistrictId   String?  @map("suggested_district_id") @db.VarChar(7)
  suggestedContactIds   Json?    @map("suggested_contact_ids") // [contactId, ...]
  suggestedPlanId       String?  @map("suggested_plan_id")
  matchConfidence       String   @default("none") @db.VarChar(10) // high, medium, low, none
  activityId            String?  @map("activity_id")
  lastSyncedAt          DateTime @map("last_synced_at")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  connection CalendarConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  @@unique([connectionId, googleEventId])
  @@index([userId, status])
  @@index([activityId])
  @@map("calendar_events")
}
```

**Activity table additions:**
```prisma
// Add to Activity model:
googleEventId   String?  @unique @map("google_event_id")
source          String   @default("manual") @db.VarChar(20) // manual, calendar_sync
outcome         String?  @db.VarChar(500) // free-text outcome note
outcomeType     String?  @map("outcome_type") @db.VarChar(30) // positive_progress, neutral, etc.
```

**UserProfile addition:**
```prisma
// Add relation:
calendarConnection CalendarConnection?
```

**Commands:**
```bash
npx prisma db push
npx prisma generate
```

**Commit:** `feat: Add CalendarConnection and CalendarEvent schema + Activity outcome fields`

---

### Step 1.2 — Google OAuth Calendar Scope Extension

**Files to create/modify:**
- `src/app/api/calendar/connect/route.ts` — Initiate Google OAuth with calendar scopes
- `src/app/api/calendar/callback/route.ts` — Handle OAuth callback, store tokens
- `src/app/api/calendar/disconnect/route.ts` — Remove connection
- `src/app/api/calendar/status/route.ts` — Check connection status
- `src/lib/google-calendar.ts` — Google Calendar API client wrapper

**How the OAuth flow works:**
1. Rep clicks "Connect Google Calendar" on Profile or Activities view
2. App redirects to Google OAuth with scopes: `calendar.readonly`, `calendar.events` (for push)
3. Google redirects back to `/api/calendar/callback` with auth code
4. Callback exchanges code for access+refresh tokens, stores in `CalendarConnection`
5. App redirects rep back to Activities view with success toast

**Google Calendar client (`src/lib/google-calendar.ts`):**
- `fetchCalendarEvents(accessToken, timeMin, timeMax)` — Pull events from primary calendar
- `createCalendarEvent(accessToken, event)` — Push activity to calendar
- `updateCalendarEvent(accessToken, eventId, event)` — Update existing event
- `deleteCalendarEvent(accessToken, eventId)` — Remove event
- `refreshAccessToken(refreshToken)` — Token refresh helper
- `filterExternalAttendees(attendees, companyDomain)` — Filter out internal people

**Environment variables needed:**
- `GOOGLE_CALENDAR_CLIENT_ID` — From Google Cloud Console (can reuse existing OAuth app)
- `GOOGLE_CALENDAR_CLIENT_SECRET` — From Google Cloud Console
- `GOOGLE_CALENDAR_REDIRECT_URI` — `/api/calendar/callback`

**Commit:** `feat: Add Google Calendar OAuth flow and API client`

---

### Step 1.3 — Calendar Sync Engine

**Files to create/modify:**
- `src/app/api/calendar/sync/route.ts` — Trigger sync (POST) and get sync status (GET)
- `src/lib/calendar-sync.ts` — Core sync logic: pull events, match contacts, stage events

**Sync logic (`src/lib/calendar-sync.ts`):**
1. Fetch events from Google Calendar (last 7 days + next 14 days)
2. Filter to events with external attendees (not matching `companyDomain`)
3. For each event:
   a. Check if `googleEventId` already exists in `CalendarEvent` — update if so
   b. Match attendee emails against `Contact.email` in the database
   c. If contacts match → look up their districts → look up plans containing those districts
   d. Set `matchConfidence`: high (exact email match to contact), medium (domain match to district), low (no match), none
   e. Auto-suggest activity type based on attendee count and title keywords
   f. Upsert into `CalendarEvent` table with status `pending`
4. Mark cancelled Google events as `cancelled` in staging table
5. Update `CalendarConnection.lastSyncAt`

**Smart matching algorithm:**
```
For each external attendee email:
  1. Exact match: Contact.email === attendeeEmail → HIGH confidence
     → suggestedDistrictId = contact.leaid
     → suggestedContactIds = [contact.id]
     → suggestedPlanId = first active plan containing that district
  2. Domain match: Contact.email domain === attendee email domain → MEDIUM
  3. No match → LOW (still import, just no suggestions)
```

**Activity type auto-detection:**
- 1 external attendee → `discovery_call`
- 2-3 external attendees → `customer_check_in`
- 4+ external attendees → `demo`
- Title contains "demo" → `demo`
- Title contains "proposal" → `proposal_review`
- Title contains "check-in" or "check in" → `customer_check_in`

**Commit:** `feat: Add calendar sync engine with smart contact matching`

---

### Step 1.4 — Calendar Sync API Hooks

**Files to modify:**
- `src/lib/api.ts` — Add types and hooks for calendar features

**New types:**
```typescript
export interface CalendarConnection {
  id: string;
  googleAccountEmail: string;
  companyDomain: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  status: 'connected' | 'disconnected' | 'error';
}

export interface CalendarEventAttendee {
  email: string;
  name: string | null;
  responseStatus: string;
}

export interface CalendarEvent {
  id: string;
  googleEventId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  attendees: CalendarEventAttendee[];
  status: 'pending' | 'confirmed' | 'dismissed' | 'cancelled';
  suggestedActivityType: ActivityType | null;
  suggestedDistrictId: string | null;
  suggestedDistrictName: string | null;  // joined from District
  suggestedContactIds: number[] | null;
  suggestedContacts: Array<{ id: number; name: string; title: string | null }>;  // joined
  suggestedPlanId: string | null;
  suggestedPlanName: string | null;  // joined from TerritoryPlan
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  activityId: string | null;
  lastSyncedAt: string;
}

export interface CalendarInboxResponse {
  events: CalendarEvent[];
  total: number;
  pendingCount: number;
}
```

**New hooks:**
- `useCalendarConnection()` — GET connection status
- `useCalendarInbox(status?)` — GET pending/all calendar events
- `useCalendarInboxCount()` — GET just the pending count (for badge)
- `useTriggerCalendarSync()` — POST to trigger sync
- `useConfirmCalendarEvent()` — POST to confirm event → create activity
- `useDismissCalendarEvent()` — PATCH to dismiss event
- `useBatchConfirmCalendarEvents()` — POST to confirm multiple high-confidence events

**Commit:** `feat: Add calendar sync API types and React Query hooks`

---

### Step 1.5 — Calendar Inbox UI (Activities View)

**Files to create/modify:**
- `src/components/calendar/CalendarInbox.tsx` — **Main inbox component** (appears at top of Activities view)
- `src/components/calendar/CalendarEventCard.tsx` — Individual event card with suggestions and actions
- `src/components/calendar/CalendarConnectBanner.tsx` — "Connect Google Calendar" CTA (shown when not connected)
- `src/components/calendar/CalendarSyncBadge.tsx` — Small sync status indicator
- `src/components/views/ActivitiesView.tsx` — Integrate inbox at top

**Design direction — "Smart Inbox":**

The inbox should feel intelligent and helpful, not like a todo list. The visual language should communicate "the app understands your work."

**CalendarInbox.tsx layout:**
- Collapsible section at top of Activities view with header: "Calendar Inbox" + pending count badge
- When expanded: vertical list of `CalendarEventCard` components
- Batch action bar when multiple pending: "Confirm All High-Confidence (X)" button
- Collapse toggle with smooth height animation
- Empty state: "All caught up — no new meetings to review" with checkmark

**CalendarEventCard.tsx design:**
- Card with left accent border colored by confidence (coral = high, steel-blue = medium, gray = low)
- **Top row:** Event title (semibold) + date/time (right-aligned, gray)
- **Middle row:** Attendee chips — external ones as coral-tinted pills, matched contacts as linked plum pills with district label
- **Suggestion banner** (when confidence > none):
  - Light robin's egg background strip
  - Icon + text: "Matches Jane Smith at Springfield USD → Midwest Territory Plan"
  - Confidence dot indicator
- **Bottom row:** Action buttons
  - **Confirm** — Coral filled button, creates activity with pre-filled data
  - **Edit & Confirm** — Coral outlined button, opens activity form modal pre-filled
  - **Dismiss** — Ghost gray button
- Smooth exit animation on confirm/dismiss (slide left + fade)

**CalendarConnectBanner.tsx:**
- Shown when `useCalendarConnection()` returns null or disconnected
- Warm gradient card (plum → slightly lighter plum, matching header banner style)
- Google Calendar icon + "Sync your Google Calendar" heading
- Brief explanation + "Connect" button
- Dismissable (stores in localStorage)

**Commit:** `feat: Add Calendar Inbox UI with event cards and smart suggestions`

---

### Step 1.6 — Calendar Push (Activity → Google Calendar)

**Files to modify:**
- `src/app/api/activities/route.ts` — On POST (create activity), if user has calendar connection and activity has a date + contacts, push to Google Calendar
- `src/app/api/activities/[id]/route.ts` — On PATCH (update), sync changes to Google Calendar event
- `src/lib/google-calendar.ts` — Add push helpers

**Push logic:**
- Only push if: user has `CalendarConnection` with `syncEnabled: true` AND activity has `startDate`
- Create Google Calendar event with: title, startTime, endTime, attendee emails (from linked contacts), description (from notes)
- Store `googleEventId` on the Activity record
- On activity update: if `googleEventId` exists, update the Google event too
- On activity delete: if `googleEventId` exists, delete the Google event

**Commit:** `feat: Add two-way sync — push activities to Google Calendar`

---

### Step 1.7 — Home Dashboard Calendar Widget

**Files to create/modify:**
- `src/components/calendar/CalendarInboxWidget.tsx` — Compact inbox widget for Home dashboard
- `src/components/views/HomeView.tsx` — Add widget to dashboard layout

**Widget design:**
- Small card matching existing Home dashboard card style (`bg-white rounded-2xl shadow-sm border border-gray-100`)
- Header: Google Calendar icon + "Calendar Inbox" + count badge
- Shows top 3 highest-confidence pending events as mini-cards (title + suggested match, one line each)
- "View All" link → navigates to Activities tab
- If no pending: "All caught up" with green check
- If not connected: compact "Connect Calendar" CTA

**Commit:** `feat: Add Calendar Inbox widget to Home dashboard`

---

## Phase 2: Activity Outcome Tagging

### Step 2.1 — Outcome Types System

**Files to create:**
- `src/lib/outcomeTypes.ts` — Outcome type definitions, categories, labels, colors

**Outcome type constants:**
```typescript
// Meetings outcomes
'positive_progress' | 'neutral' | 'negative' | 'follow_up_needed'

// Outreach outcomes
'response_received' | 'meeting_booked' | 'no_response'

// Events outcomes
'contacts_made' | 'meetings_scheduled' | 'pipeline_generated'
```

Each outcome type gets: label, description, icon (emoji), color (matching brand palette).

**Commit:** `feat: Add outcome type system with category-specific options`

---

### Step 2.2 — Outcome Popover Component

**Files to create/modify:**
- `src/components/activities/OutcomePopover.tsx` — Lightweight outcome prompt
- `src/lib/api.ts` — Update `useUpdateActivity` to accept outcome fields

**OutcomePopover.tsx design:**
- Appears as a floating popover anchored to the status change trigger
- Popover card: white, rounded-xl, shadow-lg, subtle border
- Header: "What happened?" in plum, small text
- Outcome options rendered as pill buttons (3-4 per category), arranged in a tight grid
  - Each pill: icon + short label
  - Hover: slight scale + shadow
  - Selected: coral background + white text
- Optional "Quick note" textarea below (collapsed by default, expand on click)
- "Save" button (coral) + "Skip" ghost link
- Auto-dismisses after saving with a brief success flash (mint background pulse)

**Trigger conditions:**
- When activity status changes from `planned` to `completed`
- When a calendar event is confirmed (the confirmation flow offers outcome selection)
- Not shown on `cancelled` status changes

**Commit:** `feat: Add outcome tagging popover on activity completion`

---

### Step 2.3 — Auto-Generated Follow-Up Tasks

**Files to modify:**
- `src/components/activities/OutcomePopover.tsx` — On `follow_up_needed` or `meeting_booked`, auto-create task
- `src/lib/api.ts` — May need to chain mutations (update activity → create task)

**Logic:**
- When outcome is `follow_up_needed`:
  - Create task: title = "Follow up with [contact name] at [district name]"
  - Due date = 3 business days from now
  - Priority = medium
  - Auto-link to same district, plan, and contact as the activity
  - Show brief toast: "Follow-up task created"

- When outcome is `meeting_booked`:
  - Create task: title = "Prepare for meeting with [contact/district]"
  - Due date = 1 business day before the next calendar event (if identifiable)
  - Auto-link to same entities
  - Show toast: "Prep task created"

**Commit:** `feat: Auto-generate follow-up tasks from activity outcomes`

---

### Step 2.4 — Outcome Display in Activity Table & Detail

**Files to modify:**
- `src/components/activities/ActivitiesTable.tsx` — Show outcome badge on completed activities
- `src/components/activities/ActivityFormModal.tsx` — Show outcome in detail view (read-only after set, editable via popover re-trigger)

**Table display:**
- New column or inline badge on completed activities: colored pill with outcome icon + label
- Completed activities without outcome: subtle "Add outcome" link (opens popover)

**Commit:** `feat: Display activity outcomes in table and detail views`

---

## Phase 3: Progress Dashboard

### Step 3.1 — Progress Metrics API

**Files to create:**
- `src/app/api/progress/activities/route.ts` — Activity metrics (counts by type, category, period, plan)
- `src/app/api/progress/outcomes/route.ts` — Outcome metrics (funnel, distribution)
- `src/app/api/progress/plans/route.ts` — Plan engagement metrics (districts touched, activity recency)

**Activity metrics response:**
```typescript
{
  period: { start: string; end: string };
  totalActivities: number;
  byCategory: { events: number; outreach: number; meetings: number };
  bySource: { manual: number; calendar_sync: number };
  byStatus: { planned: number; completed: number; cancelled: number };
  byPlan: Array<{ planId: string; planName: string; planColor: string; count: number }>;
  trend: { current: number; previous: number; changePercent: number };
  planCoveragePercent: number; // activities linked to at least one plan
}
```

**Outcome metrics response:**
```typescript
{
  totalWithOutcome: number;
  totalCompleted: number;
  outcomeRate: number;
  byOutcomeType: Record<string, number>;
  funnel: {
    discoveryCallsCompleted: number;
    demosCompleted: number;
    proposalsReviewed: number;
    positiveOutcomes: number;
  };
  districtsEngaged: number;
  totalDistrictsInPlans: number;
  newContactsThisPeriod: number;
}
```

**Plan engagement response:**
```typescript
Array<{
  planId: string;
  planName: string;
  planColor: string;
  totalDistricts: number;
  districtsWithActivity: number;
  lastActivityDate: string | null;
  activityCount: number;
}>
```

**Commit:** `feat: Add progress metrics API endpoints`

---

### Step 3.2 — Progress API Hooks

**Files to modify:**
- `src/lib/api.ts` — Add types and hooks for progress endpoints

**New hooks:**
- `useActivityMetrics(period?)` — GET activity counts and trends
- `useOutcomeMetrics(period?)` — GET outcome distribution and funnel
- `usePlanEngagement()` — GET plan-level engagement metrics

**Commit:** `feat: Add progress metrics React Query hooks`

---

### Step 3.3 — Leading Indicators Panel (Home Dashboard)

**Files to create/modify:**
- `src/components/progress/LeadingIndicatorsPanel.tsx` — Activity metrics panel
- `src/components/views/HomeView.tsx` — Add to dashboard layout

**Panel design:**
- Card matching existing dashboard style
- Header: "Activity This Month" with period selector (this month / this quarter / this FY)
- **Top stats row:** Three metric cards side by side
  - Meetings count (with category icon)
  - Outreach count
  - Events count
  - Each with small trend indicator (↑12% in green or ↓5% in coral)
- **Plan coverage bar:** Horizontal progress bar showing "85% of activities linked to a plan"
  - Bar uses plum fill on gray-100 track
  - Text label right-aligned
- **By plan breakdown:** Small stacked list
  - Plan color dot + name + activity count
  - Sorted by count descending
- **Source split:** Subtle footer line: "14 from calendar · 8 manual"

**Commit:** `feat: Add leading indicators panel to Home dashboard`

---

### Step 3.4 — Lagging Indicators Panel (Home Dashboard)

**Files to create/modify:**
- `src/components/progress/LaggingIndicatorsPanel.tsx` — Outcomes and funnel panel
- `src/components/progress/FunnelChart.tsx` — Horizontal funnel visualization
- `src/components/views/HomeView.tsx` — Add to dashboard layout

**Panel design:**
- Card matching existing dashboard style
- Header: "Results & Outcomes" with same period selector

**FunnelChart.tsx:**
- Horizontal funnel (left to right): Discovery Calls → Demos → Proposals → Won
- Each stage as a colored bar with count label
- Width proportional to count (widest = first stage)
- Colors progressing from steel-blue → plum → coral → mint (builds toward success)
- Connecting arrows between stages

**Outcome distribution:**
- Below funnel: grid of outcome pills showing count per outcome type
- Positive outcomes highlighted in mint, negative in light gray

**District engagement:**
- Progress metric: "Engaged 12 of 34 districts" with circular progress indicator
- New contacts count with upward trend arrow

**Commit:** `feat: Add lagging indicators panel with funnel chart to Home dashboard`

---

### Step 3.5 — Enhanced Goal Progress

**Files to modify:**
- `src/components/views/HomeView.tsx` — Enhance existing goal donut charts with activity-powered data
- `src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts` — Enrich with activity-based metrics

**Enhancements:**
- Pipeline target donut → tooltip shows "X districts moved to pipeline via Y activities"
- New districts target donut → counts districts with ≥1 completed activity
- Below each donut: micro-text showing what's driving the number
- Subtle animation when progress updates from new activity data

**Commit:** `feat: Enhance goal progress with activity-powered metrics`

---

### Step 3.6 — Plan Health Indicators

**Files to modify:**
- `src/components/plans/PlanCard.tsx` — Add activity recency badge and engagement bar
- `src/components/views/PlansView.tsx` — Fetch plan engagement data

**PlanCard additions:**
- **Recency badge** (top-right of card):
  - "Active 2d ago" in green if activity within 7 days
  - "2 weeks ago" in amber if 7-21 days
  - "Stale — 3 weeks" in coral if >21 days
  - "No activity" in gray if never
- **Engagement bar** (bottom of card, before owner):
  - Thin horizontal bar: filled portion = districts with activity / total districts
  - Label: "8/24 districts engaged"
  - Bar color: plan's own color

**Commit:** `feat: Add plan health indicators to plan cards`

---

### Step 3.7 — Activities View Summary Bar

**Files to modify:**
- `src/components/views/ActivitiesView.tsx` — Add summary bar at top (below inbox, above table)

**Summary bar design:**
- Thin strip with gray-50 background, rounded-lg
- Inline metrics: "This month: 22 activities · 14 from calendar · 8 manual · 67% with outcomes"
- Each metric as a small chip with subtle color coding
- Collapses to single line on mobile

**Commit:** `feat: Add activity summary bar to Activities view`

---

## File Tree Summary

**New files (17):**
```
src/lib/
  google-calendar.ts          # Google Calendar API client
  calendar-sync.ts            # Sync engine with smart matching
  outcomeTypes.ts             # Outcome type definitions

src/app/api/calendar/
  connect/route.ts            # Initiate Google OAuth
  callback/route.ts           # Handle OAuth callback
  disconnect/route.ts         # Remove connection
  status/route.ts             # Check connection status
  sync/route.ts               # Trigger/status sync

src/app/api/progress/
  activities/route.ts         # Activity metrics
  outcomes/route.ts           # Outcome metrics
  plans/route.ts              # Plan engagement metrics

src/components/calendar/
  CalendarInbox.tsx            # Main inbox component
  CalendarEventCard.tsx        # Individual event card
  CalendarConnectBanner.tsx    # Connect CTA
  CalendarSyncBadge.tsx        # Sync status indicator
  CalendarInboxWidget.tsx      # Home dashboard widget

src/components/activities/
  OutcomePopover.tsx           # Outcome tagging popover

src/components/progress/
  LeadingIndicatorsPanel.tsx   # Activity metrics panel
  LaggingIndicatorsPanel.tsx   # Outcomes panel
  FunnelChart.tsx              # Horizontal funnel chart
```

**Modified files (10):**
```
prisma/schema.prisma          # New models + Activity fields
src/lib/api.ts                # New types + hooks
src/components/views/HomeView.tsx         # Dashboard widgets
src/components/views/ActivitiesView.tsx   # Inbox + summary bar
src/components/plans/PlanCard.tsx         # Health indicators
src/components/views/PlansView.tsx        # Fetch engagement data
src/components/activities/ActivitiesTable.tsx   # Outcome badges
src/components/activities/ActivityFormModal.tsx  # Outcome display
src/app/api/activities/route.ts           # Calendar push on create
src/app/api/activities/[id]/route.ts      # Calendar push on update
src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts  # Activity-powered metrics
```

---

## Aesthetic Direction

All new components follow the existing Fullmind brand system:
- **Colors:** Coral (#F37167) for primary actions, Plum (#403770) for headers/focus, Steel Blue (#6EA3BE) for secondary, Robin's Egg (#C4E7E6) for suggestion banners, Mint (#EDFFE3) for success states
- **Typography:** Plus Jakarta Sans, consistent weight hierarchy
- **Cards:** `bg-white rounded-2xl shadow-sm border border-gray-100` (dashboard widgets) or `rounded-xl` (inline cards)
- **Buttons:** Coral filled primary, coral outlined secondary, gray ghost tertiary
- **Animations:** Smooth height transitions for inbox expand/collapse, slide+fade for card confirm/dismiss, pulse flash for success states
- **Confidence indicators:** Left border accent on calendar event cards (coral = high, steel-blue = medium, gray-300 = low)
- **Source badges:** Small Google Calendar icon (SVG) on synced activities to distinguish from manual

The inbox cards bring a new visual element — the left accent border + suggestion banner — that adds information density without breaking the existing clean aesthetic. The progress panels use the same card containers as the existing goals section, so they feel native to the Home dashboard.

---

## Implementation Order & Dependencies

```
Step 1.1 (Schema) ──────────────────────────────────┐
Step 1.2 (OAuth Flow) ──────────────────────────┐    │
Step 1.3 (Sync Engine) ← depends on 1.1 + 1.2  │    │
Step 1.4 (API Hooks) ← depends on 1.1          │    │
Step 1.5 (Inbox UI) ← depends on 1.3 + 1.4     │    │
Step 1.6 (Push Sync) ← depends on 1.2 + 1.3    │    │
Step 1.7 (Home Widget) ← depends on 1.4 + 1.5  │    │
                                                │    │
Step 2.1 (Outcome Types) ← depends on 1.1      │    │
Step 2.2 (Outcome Popover) ← depends on 2.1    │    │
Step 2.3 (Auto Tasks) ← depends on 2.2         │    │
Step 2.4 (Outcome Display) ← depends on 2.1    │    │
                                                │    │
Step 3.1 (Progress API) ← depends on 1.1 + 2.1 │    │
Step 3.2 (Progress Hooks) ← depends on 3.1     │    │
Step 3.3 (Leading Panel) ← depends on 3.2      │    │
Step 3.4 (Lagging Panel) ← depends on 3.2      │    │
Step 3.5 (Goal Enhancement) ← depends on 3.1   │    │
Step 3.6 (Plan Health) ← depends on 3.1        │    │
Step 3.7 (Summary Bar) ← depends on 3.2        │    │
```

Steps within each phase are sequential. Phases 2 and 3 can partially overlap once Phase 1 schema is done.
