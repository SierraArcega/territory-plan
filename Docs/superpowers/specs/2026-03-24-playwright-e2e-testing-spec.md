# Feature Spec: Playwright E2E Testing Infrastructure

**Date:** 2026-03-24
**Slug:** playwright-e2e-testing
**Branch:** worktree-playwright-e2e-testing

## Requirements

- Set up Playwright E2E testing infrastructure for the territory-plan app
- Goal: regression safety net + living documentation of calendar integration flows
- OAuth strategy: seed authenticated state + mock Google API responses (no real credentials)
- Cover all calendar integration flows: sync, activity CRUD, task linking, calendar push
- CI: local-first with GitHub Actions placeholder

## Architecture

**Pattern:** Page Object Model (POM)

```
e2e/
├── fixtures/              # Playwright test fixtures
│   ├── auth.fixture.ts    # Seed UserIntegration + auth session
│   ├── db.fixture.ts      # DB connection, seed/cleanup helpers
│   └── api-mocks.fixture.ts  # Intercept Google Calendar API
├── pages/                 # Page Object Models
│   ├── CalendarInboxPage.ts
│   ├── CalendarSettingsPage.ts
│   ├── ActivityFormPage.ts
│   ├── ActivityTimelinePage.ts
│   └── TaskBoardPage.ts
├── tests/                 # Test specs
│   ├── calendar-sync.spec.ts
│   ├── activity-crud.spec.ts
│   ├── task-linking.spec.ts
│   └── calendar-push.spec.ts
├── helpers/               # Shared utilities
│   ├── seed-data.ts       # DB seeding (plans, districts, contacts)
│   └── mock-google.ts     # Google Calendar API mock responses
└── playwright.config.ts   # (symlinked or referenced from root)
```

**Root files:**
- `playwright.config.ts` — project root, targets localhost:3005
- `.github/workflows/e2e.yml` — CI placeholder (not activated)

## Component Plan

### Infrastructure (new)

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright config: Chromium-only, baseURL localhost:3005, e2e/ testDir |
| `e2e/fixtures/auth.fixture.ts` | Seeds UserIntegration with google_calendar service, fake tokens, auth session |
| `e2e/fixtures/db.fixture.ts` | Prisma client for test DB, seed helpers, afterEach cleanup |
| `e2e/fixtures/api-mocks.fixture.ts` | `page.route()` interceptors for googleapis.com/calendar/* |
| `e2e/helpers/seed-data.ts` | Factory functions: createTestPlan, createTestDistrict, createTestContact |
| `e2e/helpers/mock-google.ts` | Mock response builders: calendar event list, single event, error responses |
| `.github/workflows/e2e.yml` | GitHub Actions workflow (placeholder, manual trigger only) |

### Page Objects (new)

| Page Object | Encapsulates |
|-------------|-------------|
| `CalendarSettingsPage` | Navigate to calendar settings, toggle sync, set company domain, configure activity type filters, set reminders |
| `CalendarInboxPage` | View pending events list, check confidence badges, confirm/dismiss events, batch confirm, empty state |
| `ActivityFormPage` | Open activity form modal, fill fields by type, link plans/districts/contacts, save/cancel |
| `ActivityTimelinePage` | View activity timeline, filter by type/status/source, verify calendar-synced activities |
| `TaskBoardPage` | View kanban columns, create task, link to activities, drag between columns, quick-add |

### Existing components to reference (not modify)

- `src/features/calendar/components/` — Calendar UI (selectors target these)
- `src/features/activities/components/` — Activity forms and views
- `src/features/tasks/components/` — Task board and forms
- `src/features/integrations/lib/encryption.ts` — Token encryption (seed data must match)

## Test Suites

### 1. calendar-sync.spec.ts — Calendar Sync Flow

Tests the pull sync pipeline: connect → sync → inbox review.

| Test | Description |
|------|-------------|
| shows calendar connect banner when not connected | Verify CTA appears for new users |
| connects Google Calendar successfully | Seed auth → verify connected state in settings |
| triggers manual sync and shows inbox events | Mock Google API returns 3 events → verify they appear in inbox |
| displays smart matching confidence correctly | Events with known contact emails show "high" confidence |
| confirms a high-confidence event creates an activity | Confirm event → verify Activity record created with correct type, district, contacts |
| dismisses an event and it disappears | Dismiss → verify removed from inbox, status = dismissed |
| batch confirms high-confidence events | Multiple high-confidence events → batch confirm → all become activities |
| shows error state when Google API returns 401 | Mock 401 → verify error banner with reconnect prompt |
| shows empty state when no pending events | All events confirmed/dismissed → verify empty inbox message |

### 2. activity-crud.spec.ts — Activity CRUD + Calendar Push

Tests manual activity creation and its push to Google Calendar.

| Test | Description |
|------|-------------|
| creates a new activity with required fields | Open form → fill title, type, dates → save → verify in timeline |
| edits an existing activity | Click edit → change title → save → verify updated |
| deletes an activity | Delete → confirm → verify removed from timeline |
| activity with startDate pushes to Google Calendar | Create activity → verify mock Google API received create call |
| editing activity updates Google Calendar event | Edit title/time → verify mock received update call |
| deleting activity removes Google Calendar event | Delete → verify mock received delete call |
| calendar-synced activities skip push (no duplicate) | Confirm from inbox → verify NO push call made |

### 3. task-linking.spec.ts — Task ↔ Activity Linking

Tests the relationship between tasks and activities.

| Test | Description |
|------|-------------|
| creates a task linked to an activity | From activity detail → create linked task → verify link |
| task appears on kanban board | Create linked task → navigate to kanban → verify visible |
| unlinks a task from an activity | Remove link → verify task still exists but no activity association |
| links an existing task to an activity | From task detail → link to activity → verify bidirectional |
| completing a task preserves activity link | Mark task done → verify activity still shows the task |

### 4. calendar-push.spec.ts — App → Calendar Push Sync

Tests the push direction in detail.

| Test | Description |
|------|-------------|
| push creates event with correct title and time | Verify Google API mock received matching title, start, end |
| push includes attendees from activity contacts | Activity with contacts → verify attendees in push payload |
| push respects sync direction setting | Set one_way (calendar→app) → create activity → verify NO push |
| push respects activity type filters | Filter out "dinner" → create dinner activity → verify NO push |
| push handles Google API errors gracefully | Mock 500 → create activity → verify activity saved, error logged |

## States

- **Loading:** Skeleton placeholders while calendar events / activities load
- **Empty:** "No pending events" in inbox, "No activities yet" in timeline
- **Error:** Google API failures show error banner with reconnect/retry option
- **Auth disconnected:** Calendar connect banner appears, sync controls disabled

## Backend Design

No backend changes needed. E2E tests interact with existing API routes:
- `GET/POST /api/calendar/*` — Calendar sync and inbox
- `GET/POST/PATCH/DELETE /api/activities/*` — Activity CRUD
- `GET/POST/PATCH/DELETE /api/tasks/*` — Task CRUD

Test DB seeding uses Prisma client directly (same schema, test database).

## Out of Scope

- Real Google OAuth flow testing (mocked only)
- Gmail sync, Slack sync, Mixmax E2E tests (calendar-focused first)
- Visual regression testing (screenshots/snapshots)
- Performance/load testing
- Mobile viewport testing (desktop Chromium only)
- Multi-browser testing (Chromium only to start)
