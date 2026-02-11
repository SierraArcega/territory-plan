# Close the Loop — Design Document

> **Status: Implemented** — All three phases shipped on the `feature/close-the-loop` branch (February 2026). See the [implementation plan](./2026-02-10-close-the-loop-implementation.md) for step-by-step details.

## Problem

Territory plans are created but become static documents. Activities happen in the real world (meetings, calls, events) but reps don't log them, so plans look empty even when work is being done. There's no connection between "I did these things" and "I'm making progress toward my goals." The full feedback loop is broken: hard to input → no visibility → plans feel stale → less motivation to input.

## Solution Overview

A three-phase feature set that connects real-world actions back to territory plan goals:

1. **Google Calendar Sync** — Auto-pull meetings, smart-suggest associations, push activities back
2. **Activity Outcome Tagging** — Lightweight "what happened?" prompt when completing activities
3. **Progress Dashboard** — Leading indicators (effort) + lagging indicators (results) tied to goals

---

## Phase 1: Google Calendar Sync

### How It Connects

The app already uses Google OAuth via Supabase for login. Calendar sync extends this by requesting additional Google Calendar API scopes. When a rep first enables calendar sync, they see a consent screen asking for calendar read/write access.

### Sync Engine

- **Pull cycle:** A background job (or on-demand fetch) calls the Google Calendar API to get events from the last 7 days + next 14 days. Events with at least one attendee outside the rep's company domain (e.g., not `@fullmindlearning.com`) get pulled into a staging area — not directly into Activities.

- **Smart matching:** For each staged event, the app checks attendee emails against the Contact table. If matches are found, it auto-suggests district and plan associations. The rep sees a card like: *"Meeting with Jane Smith (Springfield USD) — link to Midwest Territory Plan?"*

- **Rep approval:** Staged events sit in an "Inbox" until the rep confirms, dismisses, or ignores them. Confirmed events become real Activities (type auto-detected: 1 attendee = `discovery_call`, multiple = `meeting`, etc.). Dismissed events are hidden. Ignored ones persist but stay in inbox.

- **Push cycle:** When a rep creates an Activity in the app with a date and linked contacts, it creates/updates a corresponding Google Calendar event with the contact emails as attendees.

- **Conflict handling:** Each synced Activity stores a `googleEventId`. On subsequent pulls, the app checks for updates (time changes, cancellations) and flags changes for the rep to acknowledge.

### Data Model Changes

**New `CalendarConnection` table:**
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to UserProfile |
| googleAccountEmail | String | The Google account connected |
| accessToken | String (encrypted) | OAuth access token |
| refreshToken | String (encrypted) | OAuth refresh token |
| tokenExpiresAt | DateTime | When access token expires |
| companyDomain | String | e.g., "fullmindlearning.com" — filters internal attendees |
| syncEnabled | Boolean | Toggle sync on/off |
| lastSyncAt | DateTime? | Last successful sync timestamp |
| status | Enum | connected / disconnected / error |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**New `CalendarEvent` table (staging area):**
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to UserProfile |
| googleEventId | String (unique) | Google's event ID for dedup/sync |
| title | String | Event title from Google |
| description | String? | Event description |
| startTime | DateTime | Event start |
| endTime | DateTime | Event end |
| location | String? | Event location |
| attendees | Json | Array of {email, name, responseStatus} |
| status | Enum | pending / confirmed / dismissed / cancelled |
| suggestedActivityType | String? | Auto-detected activity type |
| suggestedDistrictId | String? | Best-match district from contact lookup |
| suggestedContactIds | Json? | Matched contact IDs |
| suggestedPlanId | String? | Best-match plan from district's plan membership |
| matchConfidence | Enum | high / medium / low / none |
| activityId | String? | FK to Activity (populated on confirm) |
| lastSyncedAt | DateTime | Last refreshed from Google |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Changes to existing `Activity` table:**
- Add `googleEventId` (String?, nullable) — links back to calendar event for two-way sync
- Add `source` (Enum: `manual` / `calendar_sync`) — shows provenance in UI

### Calendar Inbox UI

**Location:** Activities view gets a "Calendar Inbox" section at the top when pending events exist. Also surfaces as a notification badge on the Activities tab and a compact widget on the Home dashboard.

**Inbox card design:**
- Event title and date/time from Google
- Attendee chips — external attendees highlighted, matched contacts shown as linked pills
- Smart suggestion banner with confidence indicator: *"Looks like a meeting with Springfield USD (Jane Smith is a contact). Link to Midwest Territory Plan?"*
- Action buttons: **Confirm** (creates Activity with pre-filled associations), **Edit & Confirm** (opens Activity form pre-filled), **Dismiss** (hides it)
- Batch action: "Confirm All High-Confidence" for fast processing

**Home dashboard widget:**
- Count of pending items: *"5 meetings to review"*
- Top 2-3 highest-confidence matches as mini-cards
- Link to full inbox in Activities view

**Activity indicators:**
- Synced activities get a small Google Calendar icon badge in table/calendar views
- Source distinction visible at a glance

---

## Phase 2: Activity Outcome Tagging

### Purpose

Completing an activity is currently binary (planned → completed). Outcome tagging adds the "so what?" layer — what resulted from this activity?

### Outcome Types by Category

**Meetings** (discovery_call, demo, proposal_review, customer_check_in):
- `positive_progress` — Moved forward (demo requested, proposal sent, contract discussion)
- `neutral` — Good conversation, no next step yet
- `negative` — Not a fit / went cold
- `follow_up_needed` — Need to reconnect (auto-creates a task)

**Outreach** (email_campaign, phone_call, linkedin_message):
- `response_received` — Got a reply
- `meeting_booked` — Scheduled a meeting (auto-links to resulting calendar event)
- `no_response` — No reply yet

**Events** (conference, road_trip, trade_show, school_visit_day):
- `contacts_made` — Met new people (prompt to add contacts)
- `meetings_scheduled` — Booked follow-ups
- `pipeline_generated` — Identified opportunities

### UX Flow

A small popover appears after marking an activity as completed — three to four buttons with the outcome options. One tap and done. Optional free-text "quick note" field below. If the rep dismisses the popover, the activity still completes — outcomes are encouraged, not enforced.

### Auto-Generated Tasks

Selecting `follow_up_needed` or `meeting_booked` triggers a pre-filled task creation:
- Title: *"Follow up with Jane Smith at Springfield USD"*
- Suggested due date: 3 business days out
- Auto-linked to the same plan/district/contact as the source activity
- Rep can edit or accept

### Data Model Changes

**Add to `Activity` table:**
- `outcome` (String?, nullable) — free-text quick note
- `outcomeType` (Enum?, nullable) — the selected outcome category

---

## Phase 3: Progress Dashboard

### Enhanced Home Dashboard

**Leading Indicators panel** (activity-based metrics):
- Activity counts by category over current period: *"This month: 8 meetings, 12 outreach touches, 2 events"*
- Trend sparklines comparing to previous month/quarter
- Activity-to-plan coverage: *"85% of your activities are linked to a plan"*
- Breakdown by plan: *"Midwest Territory Plan: 14 activities, Southeast: 6"*

**Lagging Indicators panel** (outcome-based metrics):
- Funnel visualization: *"23 discovery calls → 8 demos → 3 proposals → 1 closed"*
- Outcome distribution: percentage of meetings moving forward vs going cold
- Districts touched vs. total in plan: *"Engaged 12 of 34 districts in Midwest plan"*
- New contacts added this period (calendar sync + manual)

### Enhanced Goal Progress

Existing goal donut charts get "powered by" real data:
- Pipeline target → districts that moved into pipeline (outcome-tagged)
- New districts target → districts with at least one completed activity
- Earnings target → actual revenue data from CRM fields

### Distributed Across Views

**Plans view:** Each plan card gets:
- Activity recency badge: *"Last activity: 2 days ago"* vs *"No activity in 3 weeks"*
- Mini progress bar: districts engaged vs total districts in plan

**Activities view:** Summary bar at top:
- *"This month: 22 activities, 14 from calendar, 8 manual. 67% with outcomes logged"*

---

## Not In Scope (Future)

- Email sync (Gmail integration)
- Auto-detection of meeting notes/transcripts
- Manager/team-level dashboards
- Notifications or reminders
- Mobile-specific UI

These can all be layered on later. The architecture supports it — CalendarEvent staging and outcome tagging create the data foundation.

---

## Implementation Order

Phase 1 is the foundation — once real meetings flow in automatically, Phases 2 and 3 have data to work with. Phase 2 is lightweight and can ship quickly after Phase 1. Phase 3 iterates on existing UI (Home dashboard, plan cards) using data from Phases 1 and 2.
