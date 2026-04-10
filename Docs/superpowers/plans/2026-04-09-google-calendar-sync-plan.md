# Implementation Plan: Google Calendar Sync — Backfill Wizard & Auto-Sync

**Date:** 2026-04-09
**Spec:** [`docs/superpowers/specs/2026-04-09-google-calendar-sync-spec.md`](../specs/2026-04-09-google-calendar-sync-spec.md)
**Backend context:** [`docs/superpowers/specs/2026-04-09-google-calendar-sync-enhancement-backend-context.md`](../specs/2026-04-09-google-calendar-sync-enhancement-backend-context.md)
**Branch:** `worktree-google-calendar-sync`

## Execution Strategy

Work is split into **3 phases** with clean cut points:

- **Phase 1: Backend foundation** — schema migration + sync engine changes + new API routes. Unlocks everything downstream.
- **Phase 2: Frontend wizard** — the BackfillSetupModal and its sub-components. Largest surface area but all isolated under `src/features/calendar/components/backfill/`. Can be worked on in parallel with Phase 3 once Phase 1 is done.
- **Phase 3: Integration & auto-sync** — wire hooks into `HomeView`, adjust OAuth callback, toast, settings touch-ups. Depends on Phase 1 (API) and Phase 2 (modal component exists).

Phase 2 and the non-OAuth parts of Phase 3 can run in parallel subagents.

---

## Phase 1: Backend Foundation

### Task 1.1 — Schema migration

**Files:**
- `prisma/schema.prisma`
- `prisma/migrations/manual/2026-04-09-calendar-backfill-fields.sql` (new manual migration file)

**Changes:**
1. Add two nullable DateTime fields to `CalendarConnection` model:
   ```prisma
   backfillStartDate   DateTime? @map("backfill_start_date")
   backfillCompletedAt DateTime? @map("backfill_completed_at")
   ```
2. Create the manual SQL migration:
   ```sql
   ALTER TABLE calendar_connections
     ADD COLUMN backfill_start_date    TIMESTAMP(3),
     ADD COLUMN backfill_completed_at  TIMESTAMP(3);
   ```
3. Run `npx prisma generate` to regenerate the Prisma client.

**Notes:**
- This repo uses `prisma/migrations/manual/` for DDL that is run out-of-band
  (see existing files like `phase1_schema_normalization_ddl.sql`). Follow
  that pattern — no `prisma migrate dev` / `deploy`.
- Verify the Prisma client picks up the new fields by running
  `npx tsc --noEmit` after regeneration.

**Testing:** None required for the migration itself. Downstream tests will
cover the new fields.

**Completion check:** `npx prisma generate` succeeds, `npx tsc --noEmit`
passes, Prisma client types include `backfillStartDate` and
`backfillCompletedAt` on `CalendarConnection`.

---

### Task 1.2 — Sync engine: configurable window + dedupe

**File:** `src/features/calendar/lib/sync.ts`

**Changes:**

1. **Replace hardcoded window (lines ~254-257)** with conditional logic:
   ```ts
   const timeMax = new Date();
   timeMax.setDate(timeMax.getDate() + 14);

   let timeMin: Date;
   if (calendarConnection.backfillStartDate && !calendarConnection.backfillCompletedAt) {
     timeMin = calendarConnection.backfillStartDate;
   } else if (calendarConnection.lastSyncAt) {
     timeMin = new Date(calendarConnection.lastSyncAt);
     timeMin.setDate(timeMin.getDate() - 2);
   } else {
     timeMin = new Date();
     timeMin.setDate(timeMin.getDate() - 7);
   }
   ```

2. **Add batch Activity dedupe** — after fetching `googleEvents` from Google
   but before the per-event loop (~line 273), fetch existing Activities:
   ```ts
   const googleIds = googleEvents.map(e => e.id);
   const alreadyLogged = new Set(
     (await prisma.activity.findMany({
       where: { googleEventId: { in: googleIds } },
       select: { googleEventId: true },
     }))
       .map(a => a.googleEventId)
       .filter((id): id is string => id !== null)
   );
   ```

3. **Inside the per-event loop**, skip events already logged as Activities:
   ```ts
   for (const event of googleEvents) {
     result.eventsProcessed++;
     if (alreadyLogged.has(event.id)) continue;
     // ... existing logic
   }
   ```

4. **Update `CalendarConnection.lastSyncAt`** alongside `UserIntegration.lastSyncAt`
   (currently only the latter is updated at line ~386):
   ```ts
   await prisma.calendarConnection.update({
     where: { id: calendarConnection.id },
     data: { lastSyncAt: syncTimestamp },
   });
   ```

**Testing (co-located in `src/features/calendar/lib/__tests__/sync.test.ts`):**

Create the test file if it doesn't exist. Mock `@/lib/prisma`, mock
`@/features/calendar/lib/google` (especially `fetchCalendarEvents` and
`getValidAccessToken`), and mock `@/features/integrations/lib/encryption`.

Tests:
- **Window selection (parameterized):**
  1. `backfillStartDate = 30d ago, backfillCompletedAt = null` → timeMin is 30d ago
  2. `backfillStartDate = 30d ago, backfillCompletedAt = set` → timeMin is lastSyncAt - 2d
  3. `backfillStartDate = null, lastSyncAt = 1d ago` → timeMin is 3d ago
  4. `backfillStartDate = null, lastSyncAt = null` → timeMin is 7d ago (fallback)
- **Dedupe:**
  1. 3 Google events, 1 already has a matching Activity → staging called for 2
  2. 3 Google events, 0 matches → staging called for 3
  3. Empty Google response → no dedupe query fired (optional optimization)
- **`CalendarConnection.lastSyncAt` updated** after successful sync.
- **`syncDirection === "one_way"`** still short-circuits (regression guard).

**Completion check:** `npx vitest run src/features/calendar/lib/__tests__/sync.test.ts`
passes.

---

### Task 1.3 — OAuth callback: defer sync, upsert CalendarConnection

**File:** `src/app/api/calendar/callback/route.ts`

**Changes:**

1. **Remove the auto-sync call** after token upsert (currently lines
   105-110). The wizard will trigger sync via `POST /api/calendar/backfill/start`.

2. **Add `CalendarConnection` upsert** alongside the existing `UserIntegration`
   upsert. The sync engine reads from `CalendarConnection` for
   `companyDomain`, `syncDirection`, `syncedActivityTypes`, `reminderMinutes`,
   `backfillStartDate`, `backfillCompletedAt`. Without this, first-time users
   hit the `"No calendar connection found"` error path.

   Add after the `UserIntegration.upsert`:
   ```ts
   await prisma.calendarConnection.upsert({
     where: { userId: user.id },
     update: {
       googleAccountEmail: tokens.email,
       accessToken: encrypt(tokens.accessToken),
       refreshToken: encrypt(tokens.refreshToken),
       tokenExpiresAt: tokens.expiresAt,
       companyDomain,
       status: "connected",
       syncEnabled: true,
     },
     create: {
       userId: user.id,
       googleAccountEmail: tokens.email,
       accessToken: encrypt(tokens.accessToken),
       refreshToken: encrypt(tokens.refreshToken),
       tokenExpiresAt: tokens.expiresAt,
       companyDomain,
       status: "connected",
       syncEnabled: true,
       // backfillStartDate + backfillCompletedAt remain NULL — user picks in wizard
     },
   });
   ```

3. **Change the success redirect** to route through the home tab so the
   BackfillSetupModal can mount. Replace both redirects with:
   ```ts
   return NextResponse.redirect(
     `${origin}/?tab=home&calendarJustConnected=true${returnTo === "settings" ? "&from=settings" : ""}`
   );
   ```

**Testing:** The existing `e2e/tests/calendar-sync.spec.ts` covers the OAuth
flow end-to-end — ensure it still passes after the changes. Add a unit test
only if the callback's logic branches meaningfully (it doesn't — so E2E is
sufficient).

**Completion check:** Callback upserts both tables; E2E test that mocks OAuth
still passes.

---

### Task 1.4 — New API route: `POST /api/calendar/backfill/start`

**File:** `src/app/api/calendar/backfill/start/route.ts` (new)

**Responsibilities:**
1. Auth via `getUser()` (mirror `src/app/api/calendar/sync/route.ts`).
2. Parse body `{ days: number }`; validate days ∈ `[7, 30, 60, 90]` (reject otherwise with 400).
3. Compute `backfillStartDate = new Date(now - days * 86400000)`.
4. Update `CalendarConnection` (by `userId`) with the new `backfillStartDate`
   and set `backfillCompletedAt = null`.
5. Call `syncCalendarEvents(user.id)` — returns a `SyncResult`.
6. Query `prisma.calendarEvent.count({ where: { userId, status: "pending" } })`
   for `pendingCount`.
7. Return `{ ...syncResult, pendingCount }`.

**Error handling:**
- Unauthed → 401
- Invalid `days` → 400
- No `CalendarConnection` found → 404 "Not connected"
- Sync errors → 500 with `{ error, syncResult }` so the UI can show partial state

**Testing:** Optional unit test for validation; covered by E2E in Phase 3.

---

### Task 1.5 — New API route: `POST /api/calendar/backfill/complete`

**File:** `src/app/api/calendar/backfill/complete/route.ts` (new)

**Responsibilities:**
1. Auth via `getUser()`.
2. Update `CalendarConnection` by `userId`: set `backfillCompletedAt = new Date()`.
3. Return `{ success: true }`.

**Error handling:**
- Unauthed → 401
- No `CalendarConnection` found → 404

**Testing:** Covered by E2E; no dedicated unit test needed.

---

## Phase 2: Frontend Wizard Components

> All files live under `src/features/calendar/components/backfill/`. Create
> the directory. All components use tokens from
> `Documentation/UI Framework/tokens.md`:
> - Plum `#403770`, Coral `#F37167`, Mint bg `#EDFFE3`, Off-white `#FFFCFA`
> - Borders: `#D4CFE2` (default), `#C2BBD4` (strong)
> - Text: `#403770` (primary), `#6E6390` (body), `#8A80A8` (secondary)
> - NO Tailwind grays, NO fonts other than Plus Jakarta Sans
> - `rounded-2xl` for modal, `rounded-lg` for buttons/cards, `shadow-xl` for modal

### Task 2.1 — New hooks in `queries.ts`

**File:** `src/features/calendar/lib/queries.ts`

Add at the bottom of the file:

1. **`useAutoSyncCalendarOnMount()`**:
   ```ts
   export function useAutoSyncCalendarOnMount() {
     const { data } = useCalendarConnection();
     const sync = useTriggerCalendarSync();
     const ranRef = useRef(false);
     const onNewEventsRef = useRef<((n: number) => void) | null>(null);

     useEffect(() => {
       if (ranRef.current) return;
       if (!data?.connected) return;
       if (!data.connection?.syncEnabled) return;
       // Don't auto-sync while backfill wizard is still pending — wizard owns sync
       if (!data.connection?.backfillCompletedAt) return;
       ranRef.current = true;
       sync.mutate(undefined, {
         onSuccess: (result) => {
           if (result.newEvents > 0 && onNewEventsRef.current) {
             onNewEventsRef.current(result.newEvents);
           }
         },
       });
     }, [data, sync]);

     return {
       setOnNewEvents: (cb: (n: number) => void) => {
         onNewEventsRef.current = cb;
       },
     };
   }
   ```

2. **`useBackfillStatus()`**:
   ```ts
   export function useBackfillStatus() {
     const { data, isLoading } = useCalendarConnection();
     return {
       isLoading,
       connected: !!data?.connected,
       needsSetup:
         !!data?.connected &&
         !data.connection?.backfillStartDate &&
         !data.connection?.backfillCompletedAt,
       needsResume:
         !!data?.connected &&
         !!data.connection?.backfillStartDate &&
         !data.connection?.backfillCompletedAt,
       backfillCompletedAt: data?.connection?.backfillCompletedAt ?? null,
     };
   }
   ```

3. **`useStartBackfill()`**:
   ```ts
   export function useStartBackfill() {
     const queryClient = useQueryClient();
     return useMutation({
       mutationFn: (days: 7 | 30 | 60 | 90) =>
         fetchJson<CalendarSyncResult & { pendingCount: number }>(
           `${API_BASE}/calendar/backfill/start`,
           { method: "POST", body: JSON.stringify({ days }) }
         ),
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
         queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
       },
     });
   }
   ```

4. **`useCompleteBackfill()`**:
   ```ts
   export function useCompleteBackfill() {
     const queryClient = useQueryClient();
     return useMutation({
       mutationFn: () =>
         fetchJson<{ success: boolean }>(
           `${API_BASE}/calendar/backfill/complete`,
           { method: "POST" }
         ),
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
       },
     });
   }
   ```

**Imports to add at the top:** `useRef, useEffect` from `react`; the existing
queries module already imports `useQueryClient, useMutation`.

**Also update `CalendarConnection` type** in
`src/features/shared/types/api-types.ts` to add the two new nullable fields.
Check the file first — type may be derived from Prisma or hand-written.

**Testing:** Co-located tests for each hook using MSW or a mocked
`fetchJson` + testing-library's `renderHook`.
- `useAutoSyncCalendarOnMount`: fires once, respects guard flags, skips when
  `backfillCompletedAt === null`.
- `useBackfillStatus`: parameterized over connection shapes.
- Mutation hooks: fire the right URL + body.

---

### Task 2.2 — `BackfillWindowPicker.tsx`

**File:** `src/features/calendar/components/backfill/BackfillWindowPicker.tsx` (new)

**Props:**
```ts
interface BackfillWindowPickerProps {
  onStart: (days: 7 | 30 | 60 | 90) => void;
  onCancel: () => void;
  isLoading: boolean;
}
```

**Layout:**
- Heading: "Get your calendar caught up"
- Subtitle: "Choose how far back you want to sync events"
- 2×2 grid of preset cards (7/30/60/90), each with:
  - Label ("Last 30 days")
  - Approximate count range ("~20-40 events")
  - Subtitle ("Monthly review")
  - Selection ring when active
  - ★ badge on the 30-day card by default
- Footer: `Maybe later` (ghost) + `Start sync →` (coral, disabled until selection)

**State:**
- `selected: 7 | 30 | 60 | 90 | null` — starts at `30`
- Click on card updates selection
- Keyboard: Tab/Arrow to move between cards, Enter to select

**Styles:**
- Modal body `bg-white rounded-2xl p-8 max-w-2xl shadow-xl`
- Card default: `bg-white border border-[#D4CFE2] rounded-lg p-6 text-left hover:border-[#403770] transition-colors`
- Card selected: `bg-[#F7F5FA] border-[#403770] border-2 ring-2 ring-[#403770]/10`
- Star badge: coral filled, top-right corner
- Start button: `bg-[#F37167] text-white hover:bg-[#e0564c] disabled:opacity-50`

**Testing:**
- Renders 4 cards
- 30-day card has ★ badge by default
- Clicking a card moves the ring
- `onStart(days)` called with selected value
- `onCancel` called on "Maybe later"
- Keyboard navigation works

---

### Task 2.3 — `BackfillEventCard.tsx`

**File:** `src/features/calendar/components/backfill/BackfillEventCard.tsx` (new)

**Props:**
```ts
interface BackfillEventCardProps {
  event: CalendarEvent; // from api-types
  onConfirm: (overrides: ConfirmOverrides) => void;
  onSkip: () => void;
  onDismiss: () => void;
  isSaving: boolean;
}

interface ConfirmOverrides {
  activityType: string;
  title: string;
  planIds: string[];
  districtLeaids: string[];
  notes: string | null;
}
```

**Layout:**
```
┌─ confidence banner (if any) ────────────────┐
│  ✨ Strong match — found from 2 attendees   │
└──────────────────────────────────────────────┘
┌─ Card body ─────────────────────────────────┐
│  Title (large, plum, editable inline)       │
│  🗓 Date • Time → Time (duration)          │
│                                              │
│  Activity type  [ dropdown ▾ ]              │
│  Plan           [ dropdown ▾ ]              │
│  District       [ MultiSelect ]             │
│                                              │
│  Attendees (2 external)  — read-only list  │
│  ● J. Smith • Superintendent                │
│  ● R. Doe   • Asst Principal                │
│                                              │
│  Notes   [ textarea, auto-grow ]            │
└──────────────────────────────────────────────┘
```

**Local state:**
- `title, activityType, planIds, districtLeaids, notes` — initialized from
  suggestions on mount; resets whenever `event.id` changes.

**Sources for editable fields:**
- `activityType`: `event.suggestedActivityType` ?? `"program_check_in"`
- `planIds`: `event.suggestedPlanId ? [event.suggestedPlanId] : []` — dropdown populated via `useTerritoryPlans()` with `{ status: "working" }`
- `districtLeaids`: `[event.suggestedDistrictId]` if present
- `notes`: `event.description ?? ""`

**Reuses:**
- `useTerritoryPlans` from `@/features/plans/lib/queries` (or wherever it lives)
- `ACTIVITY_TYPE_LABELS`, `ACTIVITY_TYPE_ICONS` from `@/features/activities/types`
- `MultiSelect` from `@/features/shared/components/MultiSelect`

**Confidence banner colors:**
- high: `bg-[#EDFFE3] text-[#69B34A] border-[#8AA891]/30` + ✨
- medium: `bg-[#e8f1f5] text-[#6EA3BE] border-[#8bb5cb]/30` + 💡
- low: `bg-[#fffaf1] text-[#b88a00] border-[#ffd98d]/30` + ❔
- none: hidden

**Styles:**
- Card: `bg-white rounded-2xl border border-[#D4CFE2] p-6`
- Field label: `text-xs font-medium text-[#544A78] uppercase tracking-wider`
- Dropdown/input: `bg-white border border-[#C2BBD4] rounded-lg px-3 py-2 text-sm text-[#403770]`
- Focus: `focus:ring-2 focus:ring-[#F37167] focus:border-[#F37167]`

**Testing:**
- Pre-fills all fields from suggestions
- Editing a field updates local state but doesn't call `onConfirm`
- Clicking Save calls `onConfirm` with current local state
- Resets when a new event is passed in via props
- Skip/Dismiss don't call onConfirm
- isSaving disables buttons and shows spinner on Save

---

### Task 2.4 — `BackfillWizard.tsx`

**File:** `src/features/calendar/components/backfill/BackfillWizard.tsx` (new)

**Props:**
```ts
interface BackfillWizardProps {
  events: CalendarEvent[]; // pending events from inbox query
  onComplete: () => void;  // called when user finishes the last event
  onClose: () => void;     // "Save & finish later"
}
```

**State:**
- `currentIndex: number` — starts at 0
- `confirmedIds: Set<string>`, `skippedIds: Set<string>`, `dismissedIds: Set<string>`

**Layout:**
- Header strip (sticky):
  - Progress bar + "Event N of M • K%"
  - Counters: "X confirmed • Y skipped"
  - Close button (×) → calls `onClose`
- Body: `<BackfillEventCard event={events[currentIndex]} ... />`
- Action row (sticky bottom, or inside the card):
  - `‹ Prev` (disabled at index 0) → decrement
  - `Skip` → add to skippedIds, advance
  - `Dismiss` → call `useDismissCalendarEvent`, add to dismissedIds, advance
  - `★ Save & Next` → calls `useConfirmCalendarEvent` via card's `onConfirm`, adds to confirmedIds, advances
- Footer: `Save & finish later` (ghost link) → `onClose`

**Advance logic:**
- After each action, increment `currentIndex`
- If `currentIndex >= events.length` → call `onComplete`

**Keyboard handlers** (attached via `useEffect` to `document`):
- `Y` or `Enter` → Save & Next (if not saving)
- `S` → Skip
- `X` → Dismiss
- `ArrowLeft` → Prev
- `ArrowRight` → next (Save & Next if current is not yet resolved)
- `Escape` → onClose

Cleanup listeners on unmount. Don't trigger shortcuts if focus is inside a
dropdown/textarea.

**Testing:**
- Renders first event
- Clicking Skip advances + updates counter
- Clicking Save calls confirm mutation then advances
- Clicking Dismiss calls dismiss mutation then advances
- Keyboard shortcuts fire the right handlers
- Escape closes the wizard
- Last event → `onComplete` called
- Prev button disabled at index 0

---

### Task 2.5 — `BackfillCompletionScreen.tsx`

**File:** `src/features/calendar/components/backfill/BackfillCompletionScreen.tsx` (new)

**Props:**
```ts
interface BackfillCompletionScreenProps {
  confirmed: number;
  dismissed: number;
  skipped: number;
  onClose: () => void;
}
```

**Layout:**
- Centered `🎉` emoji (large, text-6xl)
- Heading: "You're all caught up"
- Body: `{confirmed} activities logged from {confirmed + dismissed + skipped} events`
- Subtext: `{dismissed} dismissed • {skipped} skipped for later`
- Primary CTA: `Go to Activities →`
- `useEffect` auto-closes after 3000ms via `onClose`

**Testing:**
- Displays correct counts
- Clicking CTA calls onClose
- Auto-closes after 3s (use fake timers in test)

---

### Task 2.6 — `BackfillSetupModal.tsx`

**File:** `src/features/calendar/components/backfill/BackfillSetupModal.tsx` (new)

**The orchestrator.** Manages step state and renders the right sub-component.

**Props:**
```ts
interface BackfillSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: "picker" | "wizard"; // for resume flow, default "picker"
}
```

**Internal state:**
- `step: "picker" | "loading" | "wizard" | "empty" | "complete" | "error"`
- `selectedDays: 7 | 30 | 60 | 90 | null`
- counters from wizard

**Step transitions:**
1. `picker` → user clicks Start → call `useStartBackfill.mutate(days)` → `loading`
2. `loading` → onSuccess:
   - `pendingCount === 0` → `empty`
   - `pendingCount > 0` → `wizard`
   - On error → `error`
3. `wizard` → last event → call `useCompleteBackfill.mutate()` → `complete`
4. `complete` → auto-close after 3s → fire `onClose`
5. `empty` → "All caught up" copy + Close button

**Resume flow:**
- If `initialStep === "wizard"`, skip picker + loading; fetch pending events
  via `useCalendarInbox("pending")` and go straight to the wizard.

**Modal shell:**
- `fixed inset-0 z-50 flex items-center justify-center bg-[#403770]/40 backdrop-blur-sm`
- Inner: `bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4`
- Close button (×) top-right
- Mobile: full-screen (`md:max-w-2xl md:rounded-2xl rounded-none max-w-full max-h-full`)

**Focus trap + Escape:**
- Focus the primary CTA on mount
- Escape key closes (via onClose)
- Use `useEffect` to add/remove body scroll lock

**Testing:**
- Step transitions fire at the right moments
- Loading state displays correct copy
- Wizard opens with events from inbox query
- `complete` state calls `useCompleteBackfill`
- Auto-close after 3s on complete
- Modal closes on backdrop click, ×, and Escape

---

## Phase 3: Integration & Polish

### Task 3.1 — `CalendarSyncToast.tsx` + shared toast

**Files:**
- `src/features/calendar/components/CalendarSyncToast.tsx` (new)
- (optional) `src/features/shared/components/Toast.tsx` if no shared primitive exists

**Scan first:** search `src/features/shared/components/` for any existing
Toast/Notification component. If one exists, reuse it. If not, build a simple
one in shared.

**`CalendarSyncToast` props:**
```ts
interface CalendarSyncToastProps {
  visible: boolean;
  newEventCount: number;
  onDismiss: () => void;
  onReview: () => void;
}
```

**Behavior:**
- Slide in from bottom-right on `visible` true
- Auto-dismiss after 6s via internal `setTimeout`
- Clear timer on unmount or on user interaction
- `Review` button → `onReview` callback (parent navigates)
- × button → `onDismiss`

**Styles:**
- Container: `fixed bottom-6 right-6 z-40 bg-white rounded-xl border border-[#D4CFE2] shadow-xl p-4 max-w-sm`
- Icon: 📅 in a plum bg circle
- Headline: `text-sm font-semibold text-[#403770]`
- Subtext: `text-xs text-[#8A80A8]`
- CTA: `text-xs font-medium text-[#F37167] hover:text-[#e0564c]`
- Entry: `animate-in slide-in-from-bottom-4 duration-300`

**Testing:**
- Renders when visible
- Auto-dismisses after 6s (fake timers)
- CTA calls onReview
- × calls onDismiss

---

### Task 3.2 — Wire into `HomeView.tsx`

**File:** `src/features/shared/components/views/HomeView.tsx`

**Changes:**

1. **Imports:**
   ```ts
   import { useRouter, useSearchParams } from "next/navigation";
   import {
     useAutoSyncCalendarOnMount,
     useBackfillStatus,
   } from "@/features/calendar/lib/queries";
   import BackfillSetupModal from "@/features/calendar/components/backfill/BackfillSetupModal";
   import CalendarSyncToast from "@/features/calendar/components/CalendarSyncToast";
   ```

2. **Inside `HomeView` component:**
   ```ts
   const router = useRouter();
   const searchParams = useSearchParams();
   const backfillStatus = useBackfillStatus();
   const autoSync = useAutoSyncCalendarOnMount();

   const [backfillModalOpen, setBackfillModalOpen] = useState(false);
   const [toastVisible, setToastVisible] = useState(false);
   const [toastCount, setToastCount] = useState(0);

   // Open the backfill modal when connection just happened or needs resume
   useEffect(() => {
     const justConnected = searchParams.get("calendarJustConnected") === "true";
     if (justConnected || backfillStatus.needsSetup || backfillStatus.needsResume) {
       setBackfillModalOpen(true);
     }
     if (justConnected) {
       // Strip the param
       const next = new URLSearchParams(searchParams.toString());
       next.delete("calendarJustConnected");
       router.replace(`?${next.toString()}`, { scroll: false });
     }
   }, [searchParams, router, backfillStatus.needsSetup, backfillStatus.needsResume]);

   // Hook auto-sync's new-events callback to the toast
   useEffect(() => {
     autoSync.setOnNewEvents((n) => {
       setToastCount(n);
       setToastVisible(true);
     });
   }, [autoSync]);
   ```

3. **JSX (near the root):**
   ```tsx
   <BackfillSetupModal
     isOpen={backfillModalOpen}
     onClose={() => setBackfillModalOpen(false)}
     initialStep={backfillStatus.needsResume ? "wizard" : "picker"}
   />
   <CalendarSyncToast
     visible={toastVisible}
     newEventCount={toastCount}
     onDismiss={() => setToastVisible(false)}
     onReview={() => {
       setToastVisible(false);
       router.push("?tab=activities");
     }}
   />
   ```

**Testing:**
- HomeView test file (`src/features/shared/components/views/__tests__/HomeView.test.tsx`) — extend if it exists, or add:
  - Mount with `calendarJustConnected=true` → modal opens
  - Mount with `backfillStatus.needsResume === true` → modal opens at wizard step
  - Mock `useAutoSyncCalendarOnMount` to fire new events → toast appears

---

### Task 3.3 — `ConnectionStatusCard` resume link

**File:** `src/features/calendar/components/ConnectionStatusCard.tsx`

**Changes:**

Below the `Sync Now / Disconnect` button row, add a conditional small link:
```tsx
{connection.backfillStartDate && !connection.backfillCompletedAt && (
  <button
    onClick={() => { /* open modal — see below */ }}
    className="mt-3 text-xs text-[#F37167] hover:text-[#e0564c] font-medium"
  >
    Resume calendar setup →
  </button>
)}
```

**Plumbing:** The card doesn't control the modal today. Options:
- (a) Lift modal state to a shared context
- (b) Broadcast via a window event or Zustand
- (c) Navigate to `?tab=home&resumeBackfill=true` and let HomeView catch it

**Pick (c)** — simplest, no new plumbing:
```tsx
onClick={() => router.push("/?tab=home&resumeBackfill=true")}
```

Then in HomeView, also detect `?resumeBackfill=true` alongside
`calendarJustConnected=true`.

**Testing:** Manual — verify link appears only when `backfillStartDate &&
!backfillCompletedAt` and navigates correctly. No unit test required.

---

### Task 3.4 — Update CalendarConnection type

**File:** `src/features/shared/types/api-types.ts`

Find the `CalendarConnection` type and add:
```ts
backfillStartDate: string | null;
backfillCompletedAt: string | null;
```

Search first to find its exact location. If derived from Prisma, nothing to do.

**Testing:** `npx tsc --noEmit` passes.

---

## Test Strategy Summary

| Layer | Location | Covers |
|-------|----------|--------|
| Unit (sync engine) | `src/features/calendar/lib/__tests__/sync.test.ts` | Window selection, dedupe, lastSyncAt update |
| Unit (hooks) | `src/features/calendar/lib/__tests__/queries.test.ts` | All 4 new hooks |
| Unit (components) | `src/features/calendar/components/backfill/__tests__/*.test.tsx` | Each backfill component in isolation |
| Unit (HomeView integration) | `src/features/shared/components/views/__tests__/HomeView.test.tsx` | Modal opens on right flags; toast fires |
| E2E | `e2e/tests/calendar-backfill.spec.ts` | End-to-end happy path + resume + dedupe |

Run after implementation:
```bash
npx vitest run
npx playwright test e2e/tests/calendar-backfill.spec.ts
npm run build
```

---

## Dependencies & Ordering

```
    ┌─ 1.1 Schema ────────────────────┐
    │                                  │
    ▼                                  ▼
  1.2 Sync engine         1.3 OAuth callback
    │                                  │
    ▼                                  ▼
  1.4 /backfill/start     1.5 /backfill/complete
    │                                  │
    └──────────┬───────────────────────┘
               │
               ▼
  ┌────────────┴────────────┐
  │                          │
  ▼                          ▼
Phase 2 (frontend wizard)  Phase 3 (integration)
  2.1 hooks                  3.1 toast
  2.2 WindowPicker           3.2 HomeView wiring
  2.3 EventCard              3.3 ConnectionStatusCard
  2.4 Wizard                 3.4 types
  2.5 CompletionScreen
  2.6 SetupModal
```

**Parallelization plan for implementer dispatch:**
- **Round 1:** Task 1.1 alone (schema must land first — Prisma client regen blocks everything)
- **Round 2:** Tasks 1.2, 1.3, 1.4, 1.5 in parallel (all backend, all independent after schema)
- **Round 3:** Task 2.1 (hooks + types) alone — unblocks all UI work
- **Round 4:** Tasks 2.2, 2.3, 2.5, 3.1 in parallel (isolated leaf components)
- **Round 5:** Task 2.4 (depends on 2.3), Task 2.6 (depends on 2.2, 2.4, 2.5)
- **Round 6:** Tasks 3.2, 3.3, 3.4 (final wiring) in parallel

Alternatively, dispatch **backend** and **frontend** as two parallel subagents
with clear handoffs at each round boundary. Given the tight coupling between
components, a single subagent walking the phases sequentially may be less
error-prone than aggressive parallelization.

**Recommended:** one backend subagent (Phase 1), one frontend subagent
(Phase 2 + 3), dispatched in series with a checkpoint between them.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Google API rate limits hit on 90-day backfill | Pagination already handled; 90d = ~100 events max for most users; acceptable |
| `CalendarConnection` missing on existing users | Task 1.3 upsert ensures it exists after callback. Existing disconnected users unaffected. |
| Resume flow loads stale inbox data | `useCalendarInbox("pending")` query is already invalidated on sync success; no special handling needed |
| Type field drift between Prisma and `api-types.ts` | Regenerate Prisma client in Task 1.1; update types in Task 3.4 before component work |
| Toast collides with existing notifications | Scan for existing Toast in Task 3.1; reuse if present |
| Wizard keyboard shortcuts trigger inside form inputs | Skip shortcuts when `document.activeElement` is an input/textarea/select |
