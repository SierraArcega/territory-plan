# E2E Tests — Playwright

End-to-end tests for the Territory Plan Builder using Playwright with Chromium.

## Quick Start

```bash
# Install Chromium browser (first time only)
npx playwright install chromium

# Run tests headless
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with Playwright UI (interactive debugging)
npm run test:e2e:ui
```

## Prerequisites

### Environment Variables

Create a `.env` file (or set these in your shell):

| Variable | Purpose |
|----------|---------|
| `E2E_USER_EMAIL` | Email for the Supabase test user |
| `E2E_USER_PASSWORD` | Password for the Supabase test user |
| `ENCRYPTION_KEY` | 64 hex chars for token encryption |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Test User Setup

Create a test user in your Supabase project:

1. Go to Supabase Dashboard > Authentication > Users
2. Create a user with the email/password from env vars
3. The global setup script will authenticate this user and save cookies

## Architecture

```
e2e/
├── fixtures/           # Playwright test fixtures
│   ├── auth.fixture.ts     # StorageState auth session
│   ├── db.fixture.ts       # Prisma seed/cleanup helpers
│   ├── api-mocks.fixture.ts # Google Calendar API interceptors
│   └── index.ts            # Combined fixture (import this)
├── helpers/            # Shared utilities
│   ├── seed-data.ts        # Factory functions with e2e- prefixed IDs
│   └── mock-google.ts      # Google Calendar API mock responses
├── pages/              # Page Object Models
│   ├── CalendarSettingsPage.ts
│   ├── CalendarInboxPage.ts
│   ├── ActivityFormPage.ts
│   ├── ActivityTimelinePage.ts
│   └── TaskBoardPage.ts
├── tests/              # Test specs
│   ├── calendar-sync.spec.ts    # Calendar sync flow (9 tests)
│   ├── activity-crud.spec.ts    # Activity CRUD + push (7 tests)
│   ├── task-linking.spec.ts     # Task-Activity linking (5 tests)
│   └── calendar-push.spec.ts    # Push sync details (5 tests)
├── .auth/              # Saved auth state (gitignored)
├── test-results/       # Test artifacts (gitignored)
└── global-setup.ts     # One-time auth setup
```

## Writing Tests

### Import from fixtures

Always import `test` and `expect` from the combined fixtures:

```typescript
import { test, expect } from "../fixtures";
```

This gives you access to:
- `page` — standard Playwright page
- `db` — database seed/cleanup helpers
- `mockGoogleCalendar` — Google Calendar API mock

### Use Page Objects

```typescript
import { CalendarInboxPage } from "../pages/CalendarInboxPage";

test("my test", async ({ page, db }) => {
  await db.seedTestData();
  const inbox = new CalendarInboxPage(page);
  await inbox.goto();
  await expect(inbox.emptyState).toBeVisible();
});
```

### Test Data

All test data uses deterministic IDs prefixed with `e2e`:
- `TEST_USER_ID`: `e2e00000-0000-0000-0000-000000000001`
- `TEST_PLAN_ID`: `e2e00000-0000-0000-0000-000000000002`
- etc.

Cleanup runs automatically after each test via the `db` fixture.

### Adding a New Page Object

1. Create `e2e/pages/MyPage.ts`
2. Explore the actual component for selectors
3. Prefer selectors in this order: `data-testid` > `aria` > `text` > CSS class
4. Export the class and import it in your spec files

## Troubleshooting

**Tests fail with auth errors:**
- Check that `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` are set
- Ensure the test user exists in Supabase
- Delete `e2e/.auth/user.json` and re-run to refresh the session

**Port 3005 already in use:**
- The config uses `reuseExistingServer: true`, so a running dev server is fine
- Or stop the existing process: `lsof -i :3005 | grep LISTEN`

**Database connection errors:**
- Verify `DATABASE_URL` is set and the DB is reachable
- Run `npx prisma generate` if Prisma client is missing

**Tests are flaky:**
- Add explicit waits: `await page.waitForLoadState("networkidle")`
- Use `waitFor()` on specific elements rather than `waitForTimeout()`
- Check for animation timing (CSS transitions can delay element visibility)

## CI

The GitHub Actions workflow (`.github/workflows/e2e.yml`) is manual-trigger only.
To run it, go to Actions > "Playwright E2E Tests" > "Run workflow".

Required GitHub secrets:
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`
- `ENCRYPTION_KEY`
- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
