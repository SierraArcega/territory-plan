# Implementation Plan: Calendar Sync Configuration

**Date:** 2026-03-18
**Spec:** `docs/superpowers/specs/2026-03-18-calendar-sync-config-spec.md`
**Backend Context:** `docs/superpowers/specs/2026-03-18-calendar-sync-config-backend-context.md`

## Task Overview

| # | Task | Type | Dependencies |
|---|------|------|-------------|
| 1 | Add sync config fields to CalendarConnection schema | Backend | None |
| 2 | Run Prisma migration | Backend | Task 1 |
| 3 | Update API types + status endpoint | Backend | Task 2 |
| 4 | Create PATCH /api/calendar/sync-config endpoint | Backend | Task 2 |
| 5 | Update sync.ts to respect activity type filters | Backend | Task 2 |
| 6 | Update push.ts to respect activity type filters + reminders | Backend | Task 2 |
| 7 | Update google.ts to support reminder overrides | Backend | Task 2 |
| 8 | Add frontend query/mutation hooks | Frontend | Task 3, 4 |
| 9 | Build CalendarSyncSettings component + 4 cards | Frontend | Task 8 |
| 10 | Wire CalendarSyncSettings into ProfileView settings modal | Frontend | Task 9 |

## Detailed Tasks

### Task 1: Schema — Add sync config fields to CalendarConnection

**File:** `prisma/schema.prisma`

Add to `CalendarConnection` model:
```
syncDirection          String   @default("two_way") @map("sync_direction") @db.VarChar(20)
syncedActivityTypes    String[] @default([]) @map("synced_activity_types")
reminderMinutes        Int      @default(15) @map("reminder_minutes")
secondReminderMinutes  Int?     @map("second_reminder_minutes")
```

Note: `syncedActivityTypes` default of empty array `[]` means "sync all types" (opt-out model — empty = all, populated = only those types). This avoids needing to populate all 11 types on creation.

### Task 2: Run Prisma migration

```bash
npx prisma migrate dev --name add-calendar-sync-config
```

### Task 3: Update API types + status endpoint

**Files:**
- `src/features/shared/types/api-types.ts` — add `syncDirection`, `syncedActivityTypes`, `reminderMinutes`, `secondReminderMinutes` to `CalendarConnection` interface
- `src/app/api/calendar/status/route.ts` — include new fields in the `select` clause of GET handler and in the PATCH handler's accepted fields

### Task 4: Create PATCH /api/calendar/sync-config endpoint

**File:** `src/app/api/calendar/sync-config/route.ts` (new)

Alternatively, extend the existing `PATCH /api/calendar/status` endpoint to accept the new fields. The existing endpoint already handles partial updates — just widen the accepted fields.

**Decision:** Extend existing `PATCH /api/calendar/status` rather than creating a new route. Simpler, consistent with existing pattern.

Accepted fields to add:
- `syncDirection` — validate: must be `"one_way"` or `"two_way"`
- `syncedActivityTypes` — validate: array of strings, each must be a valid activity type
- `reminderMinutes` — validate: must be one of [0, 5, 10, 15, 30, 60, 1440] (0 = none)
- `secondReminderMinutes` — validate: null or one of [5, 10, 15, 30, 60, 1440], must differ from primary

### Task 5: Update sync.ts to respect activity type filters

**File:** `src/features/calendar/lib/sync.ts`

In `syncCalendarEvents()`:
1. Read `connection.syncDirection` — if `"one_way"`, skip the entire pull sync (return early after validation)
2. Read `connection.syncedActivityTypes` — after detecting the `suggestedActivityType`, check if it's in the allowed types. If the array is empty, allow all. If populated but the detected type isn't included, still stage the event (the type detection is a suggestion, not a filter on pull).

Actually, for pull sync the filter should apply differently: pull sync stages events for review, and the `suggestedActivityType` is just a suggestion. The activity type filter should control which **confirmed activities** get pushed to calendar. For pull, the user always sees incoming events regardless.

**Revised approach:** Activity type filters only affect push sync (Task 6). Pull sync always stages all external-attendee events. `syncDirection` controls whether pull sync runs.

### Task 6: Update push.ts to respect activity type filters + reminders

**File:** `src/features/calendar/lib/push.ts`

In `getCalendarAccess()`:
- Also return `syncDirection`, `syncedActivityTypes`, `reminderMinutes`, `secondReminderMinutes`

In `pushActivityToCalendar()`:
1. Check `syncDirection` — if only pulling (`two_way` allows push, `one_way` means app→calendar which also allows push). Actually `one_way` = app→calendar = push only. `two_way` = push + pull. So push is always allowed.
2. Check activity type against `syncedActivityTypes` — if array is non-empty and the activity type isn't included, skip push
3. Pass reminder config to `createCalendarEvent()`

In `updateActivityOnCalendar()`:
- Same activity type filter check

### Task 7: Update google.ts to support reminder overrides

**File:** `src/features/calendar/lib/google.ts`

Add optional `reminders` to `createCalendarEvent` and `updateCalendarEvent` params:
```typescript
reminders?: { minutes: number }[];
```

In the Google API request body, add:
```typescript
reminders: event.reminders ? {
  useDefault: false,
  overrides: event.reminders.map(r => ({ method: 'popup', minutes: r.minutes }))
} : undefined
```

### Task 8: Add frontend query/mutation hooks

**File:** `src/features/calendar/lib/queries.ts`

Add `useUpdateCalendarSyncConfig()` mutation:
```typescript
export function useUpdateCalendarSyncConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      syncDirection?: "one_way" | "two_way";
      syncedActivityTypes?: string[];
      reminderMinutes?: number;
      secondReminderMinutes?: number | null;
    }) => fetchJson<{ connection: CalendarConnection }>(
      `${API_BASE}/calendar/status`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}
```

The existing `useCalendarConnection()` hook already returns the connection data — the new fields will be available after Task 3 updates the types and endpoint.

### Task 9: Build CalendarSyncSettings component + 4 cards

**Directory:** `src/features/calendar/components/`

**New files:**
- `CalendarSyncSettings.tsx` — main container, fetches connection status, renders cards
- `ConnectionStatusCard.tsx` — shows email, last sync, sync now / disconnect buttons
- `SyncDirectionCard.tsx` — radio group for one_way / two_way
- `ActivityTypeFiltersCard.tsx` — grouped checkboxes by category
- `RemindersCard.tsx` — two dropdown selects

**Shared patterns:**
- Each card uses the Card pattern from `Documentation/UI Framework/Components/Containers/card.md`
- Colors from `tokens.md` — plum palette, no Tailwind grays
- Auto-save: each card calls `useUpdateCalendarSyncConfig()` on change with a debounce or immediate mutate
- Toast feedback: use a simple inline "Saved" text that fades after 1.5s (no external toast library)

**Disconnected state:**
- If `!connected`, show `CalendarConnectBanner` at top
- Render config cards below with `opacity-50 pointer-events-none` and an overlay message

### Task 10: Wire into ProfileView settings modal

**File:** `src/features/shared/components/views/ProfileView.tsx`

Replace the "Coming Soon" content in the settings modal with `<CalendarSyncSettings />`. Make the modal wider (`max-w-lg` instead of `max-w-md`) to accommodate the card layout. Remove the footer "Close" button (the modal close X in header is sufficient).

## Test Strategy

- **Backend:** Test the PATCH endpoint with valid and invalid payloads. Test that sync.ts respects `syncDirection`. Test that push.ts respects `syncedActivityTypes` filter.
- **Frontend:** Component tests for each card — render with mock data, simulate interactions, verify mutation calls.
- **Integration:** Connect calendar → configure sync → create activity → verify it appears/doesn't appear on calendar based on type filter.
