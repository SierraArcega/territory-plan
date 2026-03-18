# Feature Spec: Calendar Sync Configuration

**Date:** 2026-03-18
**Slug:** calendar-sync-config
**Branch:** worktree-calendar-sync-config

## Requirements

- **Problem:** Calendar sync is all-or-nothing — reps have zero control over what syncs or how
- **Solution:** Calendar sync configuration section within the existing Settings page
- **Controls needed:**
  - Activity type filters (choose which types sync)
  - Sync direction (one-way app→calendar vs full two-way)
  - Reminder preferences (default + optional second reminder)
- **Existing state:** Google Calendar OAuth connection already built — this adds configuration on top
- **Two-way sync:** Full — calendar changes (reschedule, cancel) reflect back into app activities
- **Success metric:** Majority of reps connect and configure within the first week

## Visual Design

- **Approach:** Stacked configuration cards within the Settings page
- **Save behavior:** Auto-save per control change with subtle toast confirmation
- **Disconnected state:** CalendarConnectBanner at top + config cards visible but locked with overlay

### Card Layout (top to bottom):

**1. Connection Status Card**
- Connected email address + status indicator (green dot)
- Last synced timestamp (relative, e.g. "2 min ago")
- "Sync Now" button (secondary/outline style)
- "Disconnect" button (destructive/text style)
- When disconnected: shows CalendarConnectBanner CTA

**2. Sync Direction Card**
- Radio group with two options:
  - "One-way (App → Calendar)" — Activities created in app appear on your calendar
  - "Two-way sync" — Changes in either place stay in sync automatically
- Description text below each option explaining what it means
- Auto-saves on selection change

**3. Activity Types to Sync Card**
- Grouped by category with category headers:
  - **Events:** Conference, Road Trip, Trade Show, School Visit Day
  - **Outreach:** Email Campaign, Phone Call, LinkedIn Message
  - **Meetings:** Discovery Call, Demo, Proposal Review, Customer Check-in
- "Select all" toggle per category group
- Individual checkboxes per activity type (with emoji icon + label)
- Auto-saves on change

**4. Reminders Card**
- Primary reminder: dropdown select (None, 5 min, 10 min, 15 min, 30 min, 1 hour, 1 day)
- Second reminder: dropdown select (None + same options, minus the primary selection)
- Auto-saves on change

## Component Plan

### Existing components to reuse:
- `CalendarConnectBanner` — for disconnected state CTA (from `src/features/calendar/components/CalendarConnectBanner.tsx`)
- `MultiSelect` pattern — reference for checkbox group styling (from `src/features/shared/components/MultiSelect.tsx`)
- Toggle/Switch pattern — from `Documentation/UI Framework/Components/Forms/toggle.md`
- Checkbox pattern — from `Documentation/UI Framework/Components/Forms/checkbox-and-radio.md`
- Card pattern — from `Documentation/UI Framework/Components/Containers/card.md`

### New components needed:
- `CalendarSyncSettings` — main container component that orchestrates all cards
- `ConnectionStatusCard` — displays connection info and actions
- `SyncDirectionCard` — radio group for sync direction
- `ActivityTypeFiltersCard` — grouped checkboxes for activity type selection
- `RemindersCard` — dropdown selects for reminder configuration

### Components to extend:
- `ProfileView.tsx` — replace "Coming Soon" settings modal content with CalendarSyncSettings
- Calendar API hooks (`queries.ts`) — add new query/mutation for sync config CRUD

## Backend Design

- See: `docs/superpowers/specs/2026-03-18-calendar-sync-config-backend-context.md`

### New model/table: `CalendarSyncConfig`
Extends the existing `CalendarConnection` with configuration fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `syncDirection` | Enum: `one_way`, `two_way` | `two_way` | Sync direction preference |
| `syncedActivityTypes` | String[] | all types | Activity types to sync |
| `reminderMinutes` | Int | 15 | Primary reminder (minutes before event) |
| `secondReminderMinutes` | Int? | null | Optional second reminder |

**Option A (preferred):** Add these columns directly to the existing `CalendarConnection` model, since there's a 1:1 relationship.

**Option B:** Create a separate `CalendarSyncConfig` table with a FK to `CalendarConnection`.

### New API routes:
- `GET /api/calendar/sync-config` — fetch current sync configuration
- `PATCH /api/calendar/sync-config` — update sync configuration (partial updates supported)

### Modified logic:
- `src/features/calendar/lib/sync.ts` (pull sync) — filter events by `syncedActivityTypes` and respect `syncDirection`
- `src/features/calendar/lib/push.ts` (push sync) — filter pushed activities by `syncedActivityTypes`, apply reminder settings
- Reminder minutes passed to Google Calendar API when creating/updating events

## States

- **Loading:** Skeleton placeholder cards (pulse animation) while fetching connection status and config
- **Disconnected:** CalendarConnectBanner at top of settings area. Config cards visible below but with reduced opacity and pointer-events-none, overlay text "Connect your calendar to configure sync"
- **Connected (default):** All cards interactive, auto-save on change
- **Saving:** Brief spinner icon on the changed control + subtle success toast ("Saved")
- **Error:** Inline error text below the failed control with retry affordance. Connection errors show a banner at top.

## Out of Scope

- Calendar selection (choosing which Google Calendar to sync to) — future enhancement
- Sync schedule/frequency configuration — uses existing sync intervals
- Multiple calendar account support — one connection per user
- Webhook-based real-time sync from Google — continues using polling
- Admin-level default configurations — each rep configures independently
- Migration of existing synced events when filters change — only affects future syncs
