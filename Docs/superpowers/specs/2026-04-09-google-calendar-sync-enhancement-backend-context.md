# Backend Context: Google Calendar Sync Enhancement

**Date:** 2026-04-09
**Feature:** google-calendar-sync (enhancement of existing feature)
**Base branch:** main

Context document for the implementation subagent. This is an **enhancement** to an
already-shipped Google Calendar sync — most infrastructure exists; we're adding
configurable backfill, auto-sync on mount, and a guided first-time logging
exercise.

---

## 1. Current Schema (as of 2026-04-09)

### `UserIntegration` — `prisma/schema.prisma:834`

Token storage for all integrations (gmail, google_calendar, slack, mixmax).

```
id             String    @id @default(uuid())
userId         String    @map("user_id") @db.Uuid
service        String    @db.VarChar(30)          // "google_calendar"
accountEmail   String?   @map("account_email")
accountName    String?   @map("account_name")
accessToken    String    @db.Text                  // encrypted (AES-256-GCM)
refreshToken   String?   @db.Text                  // encrypted
tokenExpiresAt DateTime? @map("token_expires_at")
scopes         String[]  @default([])
metadata       Json?                               // { companyDomain: "fullmindlearning.com" }
syncEnabled    Boolean   @default(true)
status         String    @default("connected")    // connected | disconnected | error
lastSyncAt     DateTime? @map("last_sync_at")
@@unique([userId, service])
```

### `CalendarConnection` — `prisma/schema.prisma:1019`

Calendar-specific settings + the *legacy* token store (kept for back-compat; the
active tokens live on `UserIntegration`).

```
id                     String    @id @default(uuid())
userId                 String    @unique @db.Uuid
googleAccountEmail     String    @db.VarChar(255)
accessToken            String                       // encrypted — LEGACY, prefer UserIntegration
refreshToken           String                       // encrypted — LEGACY
tokenExpiresAt         DateTime
companyDomain          String    @db.VarChar(100)   // filters internal attendees
syncEnabled            Boolean   @default(true)
lastSyncAt             DateTime?
status                 String    @default("connected")  // connected | disconnected | error
syncDirection          String    @default("two_way")    // one_way (app→cal) | two_way
syncedActivityTypes    String[]  @default([])           // [] = all types
reminderMinutes        Int       @default(15)
secondReminderMinutes  Int?
createdAt              DateTime  @default(now())
updatedAt              DateTime  @updatedAt
events                 CalendarEvent[]
```

### `CalendarEvent` — `prisma/schema.prisma:1049`

Staging table for pulled Google events awaiting rep review.

```
id                    String   @id @default(uuid())
userId                String   @db.Uuid
connectionId          String?
googleEventId         String
title                 String   @db.VarChar(500)
description           String?
startTime             DateTime
endTime               DateTime
location              String?  @db.VarChar(500)
attendees             Json     @default("[]")          // [{ email, name, responseStatus }]
status                String   @default("pending")     // pending | confirmed | dismissed | cancelled
suggestedActivityType String?  @db.VarChar(30)
suggestedDistrictId   String?  @db.VarChar(7)
suggestedContactIds   Json?
suggestedPlanId       String?
matchConfidence       String   @default("none")        // high | medium | low | none
activityId            String?                          // populated on confirm
lastSyncedAt          DateTime
@@unique([connectionId, googleEventId])
@@index([userId, status])
```

### `Activity` — `prisma/schema.prisma:609` (relevant fields only)

```
id               String    @id @default(uuid())
type             String    @db.VarChar(30)
title            String    @db.VarChar(255)
startDate        DateTime? @map("start_date")
endDate          DateTime? @map("end_date")
status           String    @default("planned")
createdByUserId  String?   @db.Uuid
googleEventId    String?   @unique @map("google_event_id")  // ★ already unique — trivial dedupe
source           String    @default("manual") @db.VarChar(30)  // manual | calendar_sync
```

The `@unique` constraint on `googleEventId` means we can skip in Prisma with a
single `findUnique`.

---

## 2. Current Sync Flow

### OAuth entrypoint — `src/app/api/calendar/connect/route.ts`
- `GET` builds a Google OAuth URL via `getAuthUrl(redirectUri, state)`.
- `state` is base64url-encoded JSON `{ userId, nonce, returnTo }` for CSRF.
- `returnTo` is read from query param (e.g. `?returnTo=settings`).
- Redirects to Google.

### OAuth callback — `src/app/api/calendar/callback/route.ts`
1. Receives `?code=...&state=...`.
2. Verifies `state.userId === session.user.id`.
3. Exchanges code via `exchangeCodeForTokens(code, redirectUri)` →
   `{ accessToken, refreshToken, expiresAt, email }`.
4. Computes `companyDomain` from `session.user.email`.
5. **Upserts `UserIntegration`** with encrypted tokens + metadata.
   (Does NOT touch `CalendarConnection` — but sync expects one. **This is a
   gap**: callback must also upsert `CalendarConnection` so sync works. Check
   current behavior; there may be a fallback.)
6. Calls `syncCalendarEvents(user.id)` immediately — non-fatal on error.
7. Redirects to:
   - `?tab=profile&section=calendar-sync&calendarConnected=true` if `returnTo=settings`
   - `?tab=activities&calendarConnected=true` otherwise

### Manual sync — `src/app/api/calendar/sync/route.ts`
- `POST` → authed → `syncCalendarEvents(user.id)` → returns `SyncResult`.

### Status — `src/app/api/calendar/status/route.ts`
- `GET` returns `{ connected: boolean, connection: CalendarConnection | null, pendingCount: number }`.
- `PATCH` updates connection settings (syncEnabled, companyDomain, syncDirection, syncedActivityTypes, reminderMinutes, secondReminderMinutes).

### Inbox list — `src/app/api/calendar/events/route.ts`
- `GET ?status=pending` returns staged events with enriched
  district/contact/plan names for the cards.

### Event confirm — `src/app/api/calendar/events/[id]/route.ts`
- `POST` → `confirmCalendarEvent(userId, eventId, overrides?)` → creates Activity.
- `PATCH` → `dismissCalendarEvent(userId, eventId)`.

### Batch confirm — `src/app/api/calendar/events/batch-confirm/route.ts`
- `POST` → `batchConfirmHighConfidence(userId)` → confirms all pending events with `matchConfidence === "high"`.

### Disconnect — `src/app/api/calendar/disconnect/route.ts`
- Sets `UserIntegration.syncEnabled = false` + `status = "disconnected"`.

### Sync engine — `src/features/calendar/lib/sync.ts`

`syncCalendarEvents(userId)`:
1. Loads `UserIntegration` (google_calendar) + `CalendarConnection` for user.
2. Short-circuits if `syncDirection === "one_way"` (push-only mode).
3. Decrypts tokens, calls `getValidAccessToken()` (refreshes if within 5 min of expiry).
4. **Hardcoded window (lines 254-257):**
   ```ts
   const timeMin = new Date(); timeMin.setDate(timeMin.getDate() - 7);
   const timeMax = new Date(); timeMax.setDate(timeMax.getDate() + 14);
   ```
5. `fetchCalendarEvents(accessToken, timeMin, timeMax)` paginates primary calendar.
6. For each event:
   - `filterExternalAttendees(attendees, companyDomain)` — skip if empty (internal meeting).
   - `matchAttendeesToContacts(userId, externalAttendees)` — returns `{ confidence, suggestedDistrictId, suggestedContactIds, suggestedPlanId }`.
   - `detectActivityType(title, count)` — keyword + attendee-count heuristic.
   - Upsert into `CalendarEvent` (staging), keyed by `(connectionId, googleEventId)`.
7. Marks staged `pending` events whose `googleEventId` no longer appears in the fetched list as `cancelled`.
8. Updates `UserIntegration.lastSyncAt`.

### Google client — `src/features/calendar/lib/google.ts`
- `getAuthUrl(redirectUri, state)` — `access_type: "offline"`, `prompt: "consent"`.
- `exchangeCodeForTokens(code, redirectUri)` — returns `{ accessToken, refreshToken, expiresAt, email }`.
- `refreshAccessToken(refreshToken)` — returns `{ accessToken, expiresAt }`.
- `isTokenExpired(expiresAt)` — returns true if within 5 min of expiry.
- `getValidAccessToken({ accessToken, refreshToken, tokenExpiresAt })` — returns valid token or `null` on refresh failure.
- `fetchCalendarEvents(accessToken, timeMin, timeMax)` — paginates through primary calendar; filters out all-day + cancelled events.
- `filterExternalAttendees(attendees, companyDomain)` — excludes `self` + same-domain.
- `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent` — used by push.ts (write sync).

### Encryption — `src/features/integrations/lib/encryption.ts`
- `encrypt(plaintext)` / `decrypt(ciphertext)` — AES-256-GCM using `process.env.ENCRYPTION_KEY` (64 hex chars).
- Format: `iv:authTag:ciphertext` (all hex).

---

## 3. Auth Pattern

All calendar routes use `getUser()` from `@/lib/supabase/server`, which returns
the Supabase session user or `null`. Unauthed requests return `401 { error }`.
`user.id` (uuid) is the key for `UserIntegration.userId` and
`CalendarConnection.userId`.

---

## 4. Schema Changes Needed

Additions to `CalendarConnection`:

```prisma
model CalendarConnection {
  // ...existing fields...
  backfillStartDate   DateTime? @map("backfill_start_date")
  backfillCompletedAt DateTime? @map("backfill_completed_at")
}
```

**Rationale:**
- `backfillStartDate`: the `timeMin` the user picked during first-connect
  setup (e.g., `now() - 30 days`). Used by the sync engine on the initial
  backfill run. `NULL` after the backfill pass is done — incremental sync
  uses `lastSyncAt - 2 days` (buffer for stragglers).
- `backfillCompletedAt`: set when the user finishes (or explicitly skips) the
  first-time logging exercise. While `NULL`, the setup modal reopens on app
  mount until resolved. Separate from `backfillStartDate` because the user
  may close the modal mid-exercise and return later.

**Indexes:** no new indexes needed — queries go through the `userId` unique key.

**Draft migration SQL:**

```sql
ALTER TABLE calendar_connections
  ADD COLUMN backfill_start_date    TIMESTAMP(3),
  ADD COLUMN backfill_completed_at  TIMESTAMP(3);
```

**Callback fix (unrelated but blocking):** the current callback only upserts
`UserIntegration`, not `CalendarConnection` — verify what happens on first
connect, because `syncCalendarEvents` short-circuits without a
`CalendarConnection`. If the callback is missing that upsert, the implementer
must add it.

---

## 5. Sync Engine Changes Needed

Target: `src/features/calendar/lib/sync.ts`.

### Change 1: Replace hardcoded window (lines 254-257)

```ts
// BEFORE
const timeMin = new Date();
timeMin.setDate(timeMin.getDate() - 7);
const timeMax = new Date();
timeMax.setDate(timeMax.getDate() + 14);

// AFTER
const timeMax = new Date();
timeMax.setDate(timeMax.getDate() + 14);

let timeMin: Date;
if (calendarConnection.backfillStartDate && !calendarConnection.backfillCompletedAt) {
  // Initial backfill: use the user-chosen window
  timeMin = calendarConnection.backfillStartDate;
} else if (calendarConnection.lastSyncAt) {
  // Incremental: last sync time minus 2-day buffer for late-arriving updates
  timeMin = new Date(calendarConnection.lastSyncAt);
  timeMin.setDate(timeMin.getDate() - 2);
} else {
  // Fallback (no backfill chosen, no prior sync) — preserve old 7-day behavior
  timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 7);
}
```

### Change 2: Dedupe against Activities (inside the per-event loop, around line 299)

Before looking up `existingEvent` in `CalendarEvent`, check if an Activity
already exists for this `googleEventId`:

```ts
const existingActivity = await prisma.activity.findUnique({
  where: { googleEventId: event.id },
  select: { id: true },
});
if (existingActivity) continue; // user already logged this manually — skip staging
```

This is a tight inner-loop query; Prisma hits the `@unique` index so it's cheap
(~1ms). If the implementer wants to optimize, batch-prefetch all
`googleEventId`s for the window:

```ts
const googleIds = googleEvents.map(e => e.id);
const alreadyLogged = new Set(
  (await prisma.activity.findMany({
    where: { googleEventId: { in: googleIds } },
    select: { googleEventId: true },
  })).map(a => a.googleEventId)
);
// then inside the loop: if (alreadyLogged.has(event.id)) continue;
```

Recommend the batch approach.

### Change 3: Close out backfill on last event

Not in the sync engine. The `backfillCompletedAt` is set by a separate API
route (e.g., `POST /api/calendar/backfill/complete`) when the user finishes or
skips the wizard.

### Change 4: Update `CalendarConnection.lastSyncAt` too

Currently sync updates `UserIntegration.lastSyncAt` (line 386). It should also
update `CalendarConnection.lastSyncAt` — the status route reads from
`CalendarConnection`.

---

## 6. Auto-Sync Trigger Strategy

**Recommendation: client-side mutation on mount, fired from `HomeView.tsx`
(or the route entry component that runs once after login).**

### Where to hook

`src/app/providers.tsx` is the QueryClient provider wrapper — too early
(no session context yet). `src/features/shared/components/views/HomeView.tsx`
mounts once after auth and already imports calendar hooks — this is the
cleanest injection point.

Add a new hook `useAutoSyncCalendarOnMount()` in
`src/features/calendar/lib/queries.ts`:

```ts
export function useAutoSyncCalendarOnMount() {
  const { data: connection } = useCalendarConnection();
  const sync = useTriggerCalendarSync();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (!connection?.connected) return;
    if (!connection.connection?.syncEnabled) return;
    ran.current = true;
    sync.mutate();
  }, [connection, sync]);
}
```

Then call `useAutoSyncCalendarOnMount()` once at the top of `HomeView`.

**Why not server-side?** Server-side (middleware or server action in layout)
means every navigation could trigger a sync. Client-side on HomeView mount gives
us exactly one sync per login session, which matches user intent.

**Throttling:** the `useRef` guards against re-running across renders within
the same session. If the user hard-refreshes, a new sync fires — this is
acceptable and desired.

### Toast on new events

After `sync.mutate()` resolves successfully, check `inboxData.pendingCount`
(or the returned `SyncResult.newEvents`) and fire a toast. The codebase uses
hand-rolled toast components — look for an existing toast pattern in
`HomeView` or add a lightweight one if missing.

---

## 7. Activity Dedupe Query

Already covered in §5. Exact batch query:

```ts
const googleIds = googleEvents.map(e => e.id);
const alreadyLogged = await prisma.activity.findMany({
  where: { googleEventId: { in: googleIds } },
  select: { googleEventId: true },
});
const alreadyLoggedSet = new Set(alreadyLogged.map(a => a.googleEventId));
```

Relies on the `@unique` constraint on `Activity.googleEventId` (schema line
623). No additional index needed.

---

## 8. Testing Conventions

The calendar feature has unit tests under `src/features/calendar/lib/__tests__/`
(verify; directory may or may not exist yet). Gmail sync has
`src/features/integrations/lib/__tests__/gmail-sync.test.ts` which is the
canonical pattern for mocked integration sync tests.

**Conventions:**
- Vitest + Testing Library + jsdom.
- Prisma is mocked via `vi.mock('@/lib/prisma', ...)`.
- Google API is mocked by mocking the wrapper module (e.g. `@/features/calendar/lib/google`) rather than `googleapis` directly.
- Tests co-located in `__tests__/` next to source.
- For the new backfill logic: parameterize tests over `{ backfillStartDate, backfillCompletedAt, lastSyncAt }` tuples to verify `timeMin` selection.

---

## 9. E2E Test Infrastructure

- `e2e/tests/calendar-sync.spec.ts` — connect flow, sync, confirm, dismiss, batch confirm.
- `e2e/helpers/mock-google.ts` — `buildCalendarEvent(...)`, `buildEventMutationResponse(...)`, three scenarios (`highConfidence`, `mediumConfidence`, `lowConfidence`).
- `e2e/pages/CalendarInboxPage.ts` — page object for inbox interactions.
- `e2e/global-setup.ts` + `e2e/helpers/seed-data.ts` — seed users + districts + contacts.

**Extensions needed for the backfill flow:**
1. New page object `CalendarBackfillWizardPage.ts` with methods: `pickWindow(days)`, `clickConfirm()`, `clickSkip()`, `clickDismiss()`, `waitForProgress(n, total)`.
2. New test `e2e/tests/calendar-backfill.spec.ts` covering: connect → pick 30-day window → wizard opens with N events → confirm some → skip some → dismiss some → wizard closes → `backfillCompletedAt` set → CalendarInbox shows empty state.
3. Mock `buildCalendarEvent` to accept `daysAgo` so we can seed events at specific points in the backfill window.

---

## 10. Environment Variables

Referenced in `src/features/calendar/lib/google.ts`:
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `NEXT_PUBLIC_SITE_URL` (for redirect URI in production)

Referenced in `src/features/integrations/lib/encryption.ts`:
- `ENCRYPTION_KEY` (64 hex chars, AES-256-GCM)

All already configured — no new env vars needed for this enhancement.

---

## Key Findings Summary

1. **Foundation is solid.** OAuth, encryption, sync engine, staging table, smart matching, inbox UI, batch confirm — all exist and work. Enhancement is narrow: configurable window + auto-mount sync + first-time wizard.
2. **Schema additions are minimal.** Two nullable DateTime fields on `CalendarConnection` (`backfillStartDate`, `backfillCompletedAt`) carry all the new state.
3. **Sync engine change is surgical.** Replace 4 lines of hardcoded `timeMin` with a conditional, add a batch dedupe query against `Activity.googleEventId` (already unique-indexed).
4. **Auto-sync is a single `useEffect` hook** mounted in `HomeView` — no server-side plumbing required.
5. **Dedupe is free** thanks to `Activity.googleEventId @unique` (schema line 623).
