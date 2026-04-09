# Feature Spec: Google Calendar Sync — Backfill Wizard & Auto-Sync

**Date:** 2026-04-09
**Slug:** google-calendar-sync
**Branch:** `worktree-google-calendar-sync` (git worktree)
**Status:** Approved for implementation

## Overview

Enhancement to the existing Google Calendar sync feature. The base
infrastructure (OAuth, sync engine, staging table, inbox UI, smart matching)
already ships. This spec covers three additions:

1. **First-connect backfill wizard** — after OAuth, the user picks how far back
   to sync (7/30/60/90 days) and walks through a one-at-a-time guided logging
   exercise to turn past calendar events into Activities.
2. **Auto-sync on app mount** — after the user logs in, the app fires a single
   incremental sync automatically and surfaces new events via a bottom-right
   toast.
3. **Persistent connection** — the calendar stays connected across sessions
   until the user explicitly disconnects (behavior already exists; this spec
   codifies it).

## Requirements

- **Configurable backfill window:** users pick from 4 presets on first connect:
  7, 30, 60, or 90 days. Default selected: 30 days.
- **Guided logging exercise:** after the initial sync pulls events, a
  full-screen modal walks the user through each event one at a time with all
  fields pre-populated from smart-matching suggestions.
- **Inline review UX:** every key field (activity type, plan, district,
  contacts, notes) is editable directly on the wizard card — no intermediate
  edit step. Three actions per event: Skip, Dismiss, Save & Next.
- **Resumable state:** if the user closes the modal mid-exercise, re-opening
  the app brings them back to the wizard at the same event until
  `backfillCompletedAt` is set.
- **Auto-sync on mount:** one sync per page load, fired client-side from
  `HomeView`. Guarded by `useRef` so it runs once per mount.
- **Post-sync toast:** if the incremental sync finds new events, a bottom-right
  toast slides in with a link to the Calendar Inbox. Non-blocking, non-modal.
- **Dedupe vs manual activities:** events that already have an `Activity`
  record with the same `googleEventId` are silently skipped during staging.
- **Persistent connection:** tokens stay valid via refresh token; user
  disconnects explicitly from settings.

### Out of Scope

- Background cron sync (mount-triggered only for v1)
- Google Calendar push notification webhooks
- Multiple calendars per user (primary only)
- Bidirectional conflict resolution after backfill
- "Un-dismiss" or "review dismissed" flows
- Team/shared calendar backfill
- Toast deduplication across multiple tabs

## Visual Design

**Approved approach:** Direction B — *Inline Review* wizard. Full-screen modal
with a deliberate, rich card that exposes every field for editing before the
user commits. Three-button action row (Skip / Dismiss / Save & Next). Warm
"Mr. Menke" coaching tone in copy.

### Key architectural decisions

- **Full-screen modal, not a dedicated route.** Keeps state ephemeral, lets
  the user dismiss and resume, avoids new routing surface area.
- **Step state in component local state**, persisted to the database only via
  `backfillStartDate` / `backfillCompletedAt` on `CalendarConnection`. The
  modal is stateless between sessions beyond those two flags.
- **Auto-sync triggered from `HomeView`, not root layout.** HomeView mounts
  once after auth and already imports calendar hooks — cleanest injection
  point. `useRef` guards prevent double-firing.
- **Backfill uses `CalendarConnection.backfillStartDate` as `timeMin`** on the
  first sync pass; subsequent incremental syncs use `lastSyncAt - 2 days`.
- **Dedupe via batch query** against `Activity.googleEventId` (already
  `@unique` in schema) before staging events.

## User Flow

```
Settings: [Connect Google Calendar] ──▶ OAuth consent
                                              │
                                              ▼
                           Callback: upsert UserIntegration + CalendarConnection
                                              │
                                              ▼
            Redirect to ?tab=home&calendarJustConnected=true (NO immediate sync)
                                              │
                                              ▼
               HomeView mounts → detects flag → opens BackfillSetupModal
                                              │
                                              ▼
              ┌─ Step 1: Window Picker (default = 30 days) ─┐
              │    [7d]  [30d★]  [60d]  [90d]                │
              │    [Maybe later]     [Start sync →]          │
              └──────────────────────────────────────────────┘
                                              │
                                              ▼
                    POST /api/calendar/backfill/start { days }
                                              │
                                              ▼
                    Loading: "Pulling 30 days from Google…"
                                              │
                                              ▼
                   ┌── no events ──▶ 🎉 "All caught up" → close
                   │
                   ▼
              ┌─ Step 2: Wizard ────────────────────────────┐
              │    Progress: 8 of 47 • 17%                   │
              │    [rich inline-edit card]                   │
              │    [Skip] [Dismiss] [★ Save & Next]          │
              │    "Save & finish later" (footer link)       │
              └──────────────────────────────────────────────┘
                                              │
                                              ▼
                         (on last event or user clicks "Finish")
                                              │
                                              ▼
                    POST /api/calendar/backfill/complete
                                              │
                                              ▼
                    🎉 Completion screen (auto-close 3s)
                                              │
                                              ▼
                              Land on ?tab=activities

—— subsequent logins ——

      HomeView mount → useAutoSyncCalendarOnMount() fires once
                                │
                                ▼
           Incremental sync (lastSyncAt-2d → now+14d)
                                │
                       ┌────────┴────────┐
                       │                 │
                 newEvents > 0       newEvents === 0
                       │                 │
                       ▼                 ▼
             Toast: "3 new…"         (silent)
             + nav badge update
```

## Component Plan

### New components (in `src/features/calendar/components/backfill/`)

| Component | Purpose |
|-----------|---------|
| `BackfillSetupModal.tsx` | Full-screen modal shell; manages step state (picker → loading → wizard → complete); portal pattern mirrored from `ActivityFormModal.tsx` |
| `BackfillWindowPicker.tsx` | Step 1 — 4 preset cards in a 2×2 grid; 30-day preselected with ★ badge |
| `BackfillWizard.tsx` | Step 2 — wraps card + progress bar + action row + keyboard handlers |
| `BackfillEventCard.tsx` | The rich inline-edit card — displays date/time, confidence banner, editable Type/Plan/District/Notes fields, read-only attendees list |
| `BackfillCompletionScreen.tsx` | 🎉 celebration screen shown after last event; auto-closes after 3s |
| `CalendarSyncToast.tsx` | Bottom-right toast for post-sync "N new events" prompt (generalize into shared `Toast.tsx` if no similar pattern exists) |

### New hooks (in `src/features/calendar/lib/queries.ts`)

| Hook | Purpose |
|------|---------|
| `useAutoSyncCalendarOnMount()` | Fires one sync per mount, reads `newEvents` from result, triggers toast if > 0 |
| `useBackfillStatus()` | Derives `{ needsSetup, needsResume, backfillCompletedAt }` from the existing connection query |
| `useStartBackfill()` | Mutation → `POST /api/calendar/backfill/start { days }` |
| `useCompleteBackfill()` | Mutation → `POST /api/calendar/backfill/complete` |

### Components to extend

| File | Changes |
|------|---------|
| `src/features/shared/components/views/HomeView.tsx` | Mount `<BackfillSetupModal />`, call `useAutoSyncCalendarOnMount()`, detect `?calendarJustConnected=true` query param |
| `src/features/calendar/components/ConnectionStatusCard.tsx` | Add "Resume backfill" link when `backfillCompletedAt === null` |
| `src/app/api/calendar/callback/route.ts` | Remove immediate `syncCalendarEvents` call (defer to user's window choice); ensure `CalendarConnection` is upserted (not only `UserIntegration`); redirect to `?tab=home&calendarJustConnected=true` |
| `src/features/calendar/lib/sync.ts` | Replace hardcoded window (lines 254-257) with `backfillStartDate`-driven logic; add batch Activity dedupe query; also update `CalendarConnection.lastSyncAt` |

### Existing components reused

- `useConfirmCalendarEvent`, `useDismissCalendarEvent`, `useCalendarInbox`,
  `useTriggerCalendarSync`, `useCalendarConnection` — from
  `src/features/calendar/lib/queries.ts`
- `MultiSelect`, `AsyncMultiSelect` — shared form controls
- `ACTIVITY_TYPE_LABELS`, `ACTIVITY_TYPE_ICONS` — from
  `@/features/activities/types`
- `fetchJson`, `API_BASE` — from `@/features/shared/lib/api-client`
- `formatRelativeTime` — can be lifted from `ConnectionStatusCard` if needed

## Backend Design

See: [`docs/superpowers/specs/2026-04-09-google-calendar-sync-enhancement-backend-context.md`](./2026-04-09-google-calendar-sync-enhancement-backend-context.md)

### New schema fields

```prisma
model CalendarConnection {
  // ...existing fields...
  backfillStartDate   DateTime? @map("backfill_start_date")
  backfillCompletedAt DateTime? @map("backfill_completed_at")
}
```

### Migration

```sql
ALTER TABLE calendar_connections
  ADD COLUMN backfill_start_date    TIMESTAMP(3),
  ADD COLUMN backfill_completed_at  TIMESTAMP(3);
```

### New API routes

| Route | Method | Body | Returns | Purpose |
|-------|--------|------|---------|---------|
| `/api/calendar/backfill/start` | POST | `{ days: 7\|30\|60\|90 }` | `SyncResult + { pendingCount }` | Sets `backfillStartDate = now() - days`, triggers initial sync |
| `/api/calendar/backfill/complete` | POST | — | `{ success: true }` | Sets `backfillCompletedAt = now()` |

### Sync engine changes (in `src/features/calendar/lib/sync.ts`)

1. **Replace hardcoded `timeMin`/`timeMax` (lines 254-257)** with:
   - If `backfillStartDate && !backfillCompletedAt` → `timeMin = backfillStartDate`
   - Else if `lastSyncAt` → `timeMin = lastSyncAt - 2 days`
   - Else → `timeMin = now() - 7 days` (fallback)
   - `timeMax = now() + 14 days` (unchanged)
2. **Batch dedupe against Activities** — before per-event staging, query:
   ```ts
   const alreadyLogged = new Set(
     (await prisma.activity.findMany({
       where: { googleEventId: { in: googleEvents.map(e => e.id) } },
       select: { googleEventId: true },
     })).map(a => a.googleEventId)
   );
   ```
   Inside the loop: `if (alreadyLogged.has(event.id)) continue;`
3. **Update `CalendarConnection.lastSyncAt`** in addition to
   `UserIntegration.lastSyncAt`.

## States

### BackfillSetupModal

| State | Behavior |
|-------|----------|
| **Hidden** | Default. Shown when HomeView detects `needsSetup || needsResume`. |
| **Step 1: Picker** | Four preset cards, 30-day pre-selected. Start button disabled until selection. |
| **Loading (sync)** | Centered spinner + "Pulling your last N days from Google…" + subtext. |
| **Step 2: Wizard** | Card + action row + progress bar. Keyboard active. |
| **Empty (no events)** | "All caught up — no external meetings in that window." + Close button. |
| **Last event** | Save & Next triggers fade to BackfillCompletionScreen. |
| **Error (sync failed)** | Inline error card with Retry button, "Couldn't reach Google." |
| **Error (confirm failed)** | Red border on card + toast "Couldn't save. Try again." |

### BackfillEventCard (per-event)

| State | Behavior |
|-------|----------|
| **Default** | All fields editable, confidence banner at top |
| **Saving** | Save button → spinner + "Saving…", card locks to pointer-events: none |
| **Prev of confirmed event** | Read-only overlay with "Undo" link that reverts the Activity |
| **No match (confidence = none)** | No confidence banner; dropdowns empty but editable |

### CalendarSyncToast

| State | Behavior |
|-------|----------|
| **Hidden** | Default |
| **Visible** | Slides in bottom-right on `sync.onSuccess` when `newEvents > 0`. Auto-dismisses after 6s or on click × |
| **Click "Review"** | Navigates to `?tab=activities` + scrolls to `CalendarInbox` section |

### Auto-sync on mount

| Condition | Behavior |
|-----------|----------|
| Not connected | Skip — no sync |
| `syncEnabled === false` | Skip — no sync |
| `backfillCompletedAt === null` | Skip auto-sync (user is in/about to see the wizard); wizard will trigger its own sync |
| Already ran in this session | Skip — `useRef` guard |
| Otherwise | Fire `syncCalendarEvents()` incrementally |

## Testing Strategy

### Unit tests (Vitest + Testing Library)

1. **`sync.ts` window logic** (parameterized test):
   - `{ backfillStartDate: "...", backfillCompletedAt: null }` → timeMin = backfillStartDate
   - `{ backfillStartDate: "...", backfillCompletedAt: "..." }` → timeMin = lastSyncAt - 2d
   - `{ backfillStartDate: null, lastSyncAt: "..." }` → timeMin = lastSyncAt - 2d
   - `{ backfillStartDate: null, lastSyncAt: null }` → timeMin = now() - 7d (fallback)
2. **`sync.ts` dedupe logic**:
   - Events with a matching `Activity.googleEventId` are skipped
   - Events without a match are staged as normal
3. **`BackfillWindowPicker`**:
   - 30-day preset pre-selected on mount
   - Clicking a card moves selection ring
   - Start button disabled until selection (should always be enabled given default)
4. **`BackfillEventCard`**:
   - Pre-fills suggested values from event
   - Save button calls `useConfirmCalendarEvent` with user-edited values (not originals if user changed them)
   - Skip advances without calling confirm
   - Dismiss calls `useDismissCalendarEvent`
5. **`useAutoSyncCalendarOnMount`**:
   - Fires once per mount (useRef guard test)
   - Skips when `!connected`
   - Skips when `backfillCompletedAt === null`
6. **`useBackfillStatus`** selector:
   - Derives correct flags from various connection shapes

### E2E tests (Playwright)

Extend `e2e/tests/calendar-sync.spec.ts` or add `e2e/tests/calendar-backfill.spec.ts`:

1. **Connect → window picker shows** — user completes OAuth, modal opens to Step 1
2. **Pick 30 days → sync runs → wizard opens** — uses `mock-google.ts` seeded with 5 events across 30 days
3. **Confirm first event → Activity created** — verify via API assertion
4. **Skip second event → stays pending** — next card loads
5. **Dismiss third event → marked dismissed** — next card loads
6. **Close modal mid-flow → reopen → resumes at same event** — `Save & finish later` → close → navigate away → come back → modal opens at Step 2 at the same card
7. **Finish last event → completion screen** — `backfillCompletedAt` set
8. **Subsequent visit → auto-sync + toast** — mock returns 2 new events, toast appears
9. **Dedupe**: pre-seed an Activity with `googleEventId = "evt-1"`, then sync an event with the same ID → assert it's NOT in the staging table

Page object: `e2e/pages/CalendarBackfillWizardPage.ts` with methods
`pickWindow(days)`, `clickStartSync()`, `waitForEvent(n, total)`, `confirm()`,
`skip()`, `dismiss()`, `closeAndResume()`, `undoLast()`.

Extend `e2e/helpers/mock-google.ts` with `buildCalendarEvent({ daysAgo })` so
events can be seeded relative to the backfill window.

## Success Criteria

- User can connect Google Calendar, pick a window, and complete a logging
  exercise without leaving the app.
- `backfillCompletedAt` is set after completion — wizard does not reopen on
  subsequent mounts.
- Auto-sync fires once per app mount and surfaces a toast when new events
  arrive.
- Events with matching `Activity.googleEventId` are not re-staged.
- All unit tests pass (`npx vitest run`).
- All E2E tests pass.
- `npm run build` clean.
- Accessibility: keyboard navigation through the wizard works (Y/S/X/←/→/Esc);
  modal traps focus; color contrast meets WCAG AA against Fullmind tokens.
