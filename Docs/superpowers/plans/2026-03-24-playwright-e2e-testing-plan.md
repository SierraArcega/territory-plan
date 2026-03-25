# Implementation Plan: Playwright E2E Testing Infrastructure

**Date:** 2026-03-24
**Spec:** `docs/superpowers/specs/2026-03-24-playwright-e2e-testing-spec.md`
**Branch:** worktree-playwright-e2e-testing

## Context

- **Auth:** Supabase Auth (session cookies via `@supabase/ssr`). Middleware at `src/middleware.ts` redirects unauthenticated users to `/login`.
- **DB:** Prisma ORM (`src/lib/prisma.ts`), PostgreSQL. UserIntegration stores encrypted tokens (AES-256-GCM via `src/features/integrations/lib/encryption.ts`).
- **App:** Next.js on port 3005. Calendar feature uses `UserIntegration` (not legacy `CalendarConnection`).
- **Existing Playwright:** `playwright ^1.58.2` as production dep (vacancy scanner). No `@playwright/test` or E2E config.

## Tasks

### Phase 1: Infrastructure Setup

#### Task 1.1: Install dependencies and configure Playwright
**Files:** `package.json`, `playwright.config.ts`, `.gitignore`

- Install `@playwright/test` as devDep (keep existing `playwright` production dep)
- Install Chromium browser: `npx playwright install chromium`
- Create `playwright.config.ts` at project root:
  - `testDir: './e2e/tests'`
  - `baseURL: 'http://localhost:3005'`
  - `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]`
  - `webServer: { command: 'npm run dev', port: 3005, reuseExistingServer: true }`
  - `outputDir: 'e2e/test-results'`
  - `use.storageState` for auth (see Task 1.2)
- Add to `.gitignore`: `e2e/test-results/`, `e2e/.auth/`, `playwright-report/`
- Add npm scripts:
  - `"test:e2e": "playwright test"`
  - `"test:e2e:ui": "playwright test --ui"`
  - `"test:e2e:headed": "playwright test --headed"`

#### Task 1.2: Auth fixture — Supabase session bypass
**Files:** `e2e/fixtures/auth.fixture.ts`, `e2e/.auth/` (gitignored)

The challenge: Supabase auth uses server-side cookies. We can't easily create a real Supabase session without going through OAuth.

**Approach:** Use Playwright's `storageState` pattern with a global setup that authenticates once:
- Create `e2e/global-setup.ts` that:
  1. Launches a browser
  2. Navigates to the app
  3. Uses Supabase Admin API (`SUPABASE_SERVICE_ROLE_KEY`) to create a test user or sign in with email/password
  4. Alternatively: calls `supabase.auth.signInWithPassword()` on a pre-created test account
  5. Saves cookies to `e2e/.auth/user.json` via `page.context().storageState()`
- `auth.fixture.ts` extends base test to load `storageState` from the saved file
- Create a test user in Supabase with known credentials (email/password) for E2E
- Seed a matching `UserProfile` in the DB

**Environment variables needed:**
- `E2E_USER_EMAIL` — test user email
- `E2E_USER_PASSWORD` — test user password
- `ENCRYPTION_KEY` — for encrypting mock integration tokens

#### Task 1.3: Database fixture — seed and cleanup
**Files:** `e2e/fixtures/db.fixture.ts`, `e2e/helpers/seed-data.ts`

- `db.fixture.ts`:
  - Imports Prisma client
  - Provides `seedTestData()` and `cleanupTestData()` as fixture functions
  - Cleanup runs after each test (delete by known test IDs to avoid affecting real data)
  - Uses `prisma.$transaction()` for atomic cleanup

- `seed-data.ts` — Factory functions:
  - `createTestUserProfile(userId)` — UserProfile matching Supabase test user
  - `createTestPlan(userId)` — Territory plan with name "E2E Test Plan"
  - `createTestDistricts(planId)` — 3 districts with known LEAIDs
  - `createTestContacts(districtIds)` — Contacts with known emails (for smart matching)
  - `createTestUserIntegration(userId)` — google_calendar integration with encrypted mock tokens, syncEnabled=true
  - `createTestActivity(planId, districtId)` — Pre-existing activity for edit/delete tests
  - `createTestTask(planId, activityId)` — Pre-existing task for linking tests
  - All IDs are deterministic UUIDs (e.g., `e2e-plan-0001`) for easy cleanup

#### Task 1.4: API mock fixture — Google Calendar interceptors
**Files:** `e2e/fixtures/api-mocks.fixture.ts`, `e2e/helpers/mock-google.ts`

- `api-mocks.fixture.ts`:
  - Extends base test with `mockGoogleCalendar` fixture
  - Uses `page.route('**/googleapis.com/calendar/**', ...)` to intercept
  - Tracks intercepted requests for assertion (e.g., "verify push was called with correct payload")
  - Configurable: can set which events to return, error responses, etc.

- `mock-google.ts` — Mock response builders:
  - `buildCalendarEventList(events)` — Google Calendar API list response format
  - `buildCalendarEvent(overrides)` — Single event with attendees, times, etc.
  - `buildErrorResponse(code, message)` — 401, 500 error responses
  - Pre-built fixtures: 3 events with varying confidence levels (high = known contact email, medium = domain match, low = unknown)

#### Task 1.5: Merge fixtures into combined test base
**Files:** `e2e/fixtures/index.ts`

- Export a combined `test` object that merges all fixtures:
  ```typescript
  export const test = base.extend<{
    db: DbFixture;
    mockGoogleCalendar: GoogleCalendarMock;
  }>({ ... });
  export { expect } from '@playwright/test';
  ```
- All spec files import `{ test, expect }` from this combined fixture

### Phase 2: Page Object Models

#### Task 2.1: CalendarSettingsPage
**File:** `e2e/pages/CalendarSettingsPage.ts`

Encapsulates: `/settings` or wherever calendar settings live
- `goto()` — navigate to calendar settings
- `isConnected()` — check connection status indicator
- `toggleSync(enabled)` — toggle sync switch
- `setCompanyDomain(domain)` — fill company domain input
- `setSyncDirection(direction)` — select one_way or two_way
- `setActivityTypeFilters(types)` — multi-select activity types
- `setReminders(primary, secondary?)` — set reminder minutes
- `getConnectionStatus()` — read status text

#### Task 2.2: CalendarInboxPage
**File:** `e2e/pages/CalendarInboxPage.ts`

Encapsulates: Calendar inbox/pending events view
- `goto()` — navigate to calendar inbox
- `getEventCards()` — list of visible event cards
- `getEventByTitle(title)` — find specific event card
- `getConfidenceBadge(eventTitle)` — read confidence level
- `getSuggestedDistrict(eventTitle)` — read suggested district
- `confirmEvent(eventTitle)` — click confirm on an event
- `dismissEvent(eventTitle)` — click dismiss
- `batchConfirmHighConfidence()` — click batch confirm button
- `isEmpty()` — check for empty state message
- `getErrorBanner()` — check for error state

#### Task 2.3: ActivityFormPage
**File:** `e2e/pages/ActivityFormPage.ts`

Encapsulates: Activity creation/edit modal
- `open()` — click "New Activity" button
- `openFromActivity(activityId)` — open edit for existing activity
- `setTitle(title)` — fill title
- `setType(type)` — select activity type
- `setDates(start, end)` — set start/end dates
- `setStatus(status)` — select status
- `linkDistrict(districtName)` — search and select district
- `linkPlan(planName)` — search and select plan
- `linkContact(contactName)` — search and select contact
- `save()` — click save
- `cancel()` — click cancel
- `delete()` — click delete + confirm

#### Task 2.4: ActivityTimelinePage
**File:** `e2e/pages/ActivityTimelinePage.ts`

Encapsulates: Activity timeline/list view
- `goto()` — navigate to activities
- `getActivityItems()` — list of visible activities
- `getActivityByTitle(title)` — find specific activity
- `getActivitySource(title)` — read source badge (manual vs calendar_sync)
- `filterByType(type)` — apply type filter
- `filterBySource(source)` — apply source filter
- `clickActivity(title)` — open activity detail

#### Task 2.5: TaskBoardPage
**File:** `e2e/pages/TaskBoardPage.ts`

Encapsulates: Task kanban board
- `goto()` — navigate to tasks
- `getColumnCards(status)` — cards in a kanban column
- `getTaskByTitle(title)` — find specific task
- `createTask(title, options?)` — use quick-add or form
- `linkTaskToActivity(taskTitle, activityTitle)` — link via task detail
- `moveTask(taskTitle, toStatus)` — drag or status change
- `getLinkedActivities(taskTitle)` — read linked activities from task detail

### Phase 3: Test Suites

#### Task 3.1: calendar-sync.spec.ts
**File:** `e2e/tests/calendar-sync.spec.ts`
**Depends on:** Tasks 1.1–1.5, 2.1, 2.2

9 tests covering: connect banner, connected state, manual sync → inbox, smart matching confidence, confirm → activity, dismiss, batch confirm, error state (401), empty state.

Each test:
1. Uses `db` fixture to seed appropriate state
2. Uses `mockGoogleCalendar` fixture for API responses
3. Uses page objects for navigation and assertions
4. Cleans up after

#### Task 3.2: activity-crud.spec.ts
**File:** `e2e/tests/activity-crud.spec.ts`
**Depends on:** Tasks 1.1–1.5, 2.3, 2.4

7 tests covering: create activity, edit, delete, push to calendar on create, push on edit, push on delete, calendar-synced activities skip push.

#### Task 3.3: task-linking.spec.ts
**File:** `e2e/tests/task-linking.spec.ts`
**Depends on:** Tasks 1.1–1.5, 2.3, 2.5

5 tests covering: create linked task, task on kanban, unlink, link existing task, complete preserves link.

#### Task 3.4: calendar-push.spec.ts
**File:** `e2e/tests/calendar-push.spec.ts`
**Depends on:** Tasks 1.1–1.5, 2.3

5 tests covering: push payload correctness, attendees in push, sync direction respected, activity type filters respected, error handling.

### Phase 4: CI and Polish

#### Task 4.1: GitHub Actions placeholder
**File:** `.github/workflows/e2e.yml`

- Workflow with `workflow_dispatch` trigger only (manual)
- Steps: checkout, install deps, install Chromium, start dev server, run tests
- Placeholder comments for: DB provisioning, env secrets, scheduled runs

#### Task 4.2: Documentation
**File:** `e2e/README.md`

- How to run E2E tests locally
- How to add new page objects and tests
- Auth setup (test user creation)
- Environment variables needed
- Troubleshooting common issues

## Test Strategy

- Each spec file is independent (can run in isolation or parallel)
- DB seeded fresh per test via fixtures (no shared state between tests)
- Google Calendar API fully mocked (deterministic, no flakiness)
- Auth session created once in global setup, reused via `storageState`
- Cleanup: deterministic test IDs make it easy to delete only test data

## Dependencies & Ordering

```
Phase 1 (sequential within, parallel across 1.1-1.4):
  1.1 Install + config
  1.2 Auth fixture (needs 1.1)
  1.3 DB fixture (needs 1.1)
  1.4 API mock fixture (needs 1.1)
  1.5 Merge fixtures (needs 1.2, 1.3, 1.4)

Phase 2 (all parallel, needs 1.5):
  2.1–2.5 Page objects

Phase 3 (all parallel, needs Phase 2):
  3.1–3.4 Test suites

Phase 4 (parallel, needs Phase 3):
  4.1 CI placeholder
  4.2 Documentation
```

## Risk Notes

- **Supabase auth in E2E:** If `signInWithPassword` doesn't work for the test account, fallback to injecting Supabase session cookies directly using `context.addCookies()`.
- **Port conflicts:** Dev server on 3005 may already be running. Config uses `reuseExistingServer: true`.
- **DB isolation:** Tests use deterministic IDs prefixed with `e2e-` to avoid colliding with real data. Never run against production DB.
