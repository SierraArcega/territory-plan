# Implementation Plan: Feed Redesign

**Spec:** `docs/superpowers/specs/2026-03-24-feed-redesign-spec.md`
**Date:** 2026-03-24

## Task Overview

| # | Task | Type | Dependencies | Est. Complexity |
|---|------|------|-------------|-----------------|
| 1 | Build `/api/feed/alerts` endpoint | Backend | None | Medium |
| 2 | Create `useFeedAlerts` query hook | Frontend | Task 1 |  Low |
| 3 | Create `AlertRow` component | Frontend | None | Low |
| 4 | Rewrite `FeedTab` with three-zone layout | Frontend | Tasks 2, 3 | High |
| 5 | Redesign `FeedSummaryCards` for zone counts | Frontend | Task 4 | Low |
| 6 | Bring forward impersonation fixes | Backend | None | Done |

## Detailed Tasks

### Task 1: Build `/api/feed/alerts` endpoint

**File:** `src/app/api/feed/alerts/route.ts` (new)

**Purpose:** Single endpoint returning all "Needs Attention" alerts, computed server-side.

**Response shape:**
```typescript
{
  districtsWithoutContacts: Array<{
    leaid: string;
    districtName: string;
    stateAbbrev: string;
    planId: string;
    planName: string;
    planColor: string;
  }>;
  stalePlans: Array<{
    planId: string;
    planName: string;
    planColor: string;
    districtCount: number;
    lastActivityDate: string | null;  // most recent activity or task date
  }>;
}
```

**Query logic:**

1. **Districts without contacts:**
   - Get all user's territory plans with their districts
   - For each district, count contacts (`Contact` where `leaid` matches)
   - Return districts where contact count = 0

2. **Stale plans (no activity in 30 days):**
   - Get all user's territory plans
   - For each plan, find most recent ActivityPlan or TaskPlan join date
   - Check Activity.startDate/createdAt and Task.createdAt/dueDate in last 30 days
   - Return plans where no recent activity found

**Auth:** Uses `getUser()` (supports impersonation)

### Task 2: Create `useFeedAlerts` query hook

**File:** `src/features/home/lib/queries.ts` (new)

```typescript
export function useFeedAlerts() {
  return useQuery({
    queryKey: ["feed-alerts"],
    queryFn: () => fetchJson<FeedAlertsResponse>(`${API_BASE}/feed/alerts`),
    staleTime: 5 * 60 * 1000, // 5 minutes — alerts don't change fast
  });
}
```

**Types:** Add `FeedAlertsResponse` to the same file or to `api-types.ts`.

### Task 3: Create `AlertRow` component

**File:** `src/features/home/components/AlertRow.tsx` (new)

Three variants based on alert type:

1. **District without contacts:**
   - Plan color dot + district name
   - Subtitle: plan name + "No contacts"
   - Action: "Add Contacts" button (links to district detail or map)

2. **Stale plan:**
   - Plan color dot + plan name
   - Subtitle: "No tasks or activities in 30 days" + district count
   - Action: "View Plan" button

3. **Completed activity without outcome:**
   - Coral dot + activity title
   - Subtitle: "Completed [date] · No next steps"
   - Action: "Add Next Steps" button (opens OutcomeModal)

**Design tokens:** Follow existing `FeedRows.tsx` patterns — same padding (px-5 py-4), hover state (hover:bg-[#F7F5FA]/50), text colors (#403770 primary, #8A80A8 secondary).

### Task 4: Rewrite `FeedTab` with three-zone layout

**File:** `src/features/home/components/FeedTab.tsx` (major rewrite)

**Data logic changes:**

1. **Today's Focus zone:**
   - Filter tasks: `dueDate` matches selected day OR overdue (status !== done, dueDate < today)
   - Filter activities: `startDate` matches selected day, status === "planned"
   - Interleave: tasks first (sorted by priority), then activities (sorted by time)
   - Keep existing `showCompleted` toggle

2. **Needs Attention zone:**
   - Districts without contacts: from `useFeedAlerts()`
   - Stale plans: from `useFeedAlerts()`
   - Completed without outcomes: from existing `useActivities({})` filter

3. **Coming Up zone:**
   - Filter tasks: `dueDate` > today AND <= today + 7 days, status !== "done"
   - Filter activities: `startDate` > today AND <= today + 7 days, status === "planned"
   - Group by date, sorted ascending
   - Count overflow: items with dates > today + 7 days

**Day navigator:** Still controls "Today's Focus" zone. Build `daysWithItems` from both tasks and activities (already implemented in current code).

**Summary cards:** Pass zone counts to redesigned `FeedSummaryCards`.

**Empty state:** Show "You're all set" CTA only when ALL three zones are empty.

### Task 5: Redesign `FeedSummaryCards`

**File:** `src/features/home/components/FeedSummaryCards.tsx` (rewrite)

Change from 5 specific cards to 3 zone-based cards:

| Card | Icon | Color | Count Source |
|------|------|-------|-------------|
| Due Today | CalendarCheck | #403770 plum | Today tasks + activities |
| Needs Attention | AlertTriangle | #F37167 coral | Total alerts |
| This Week | Calendar | #6EA3BE steel | Coming Up items |

Clicking a card smooth-scrolls to that zone (use `id` attributes on zone containers + `scrollIntoView`).

### Task 6: Impersonation fixes (already done)

The fixes to `getUser()`, `/api/profile`, and `/api/profile/goals` from earlier in this session are already on the `fix/vacancy-scanner-and-map-interactions-v2` branch. These need to be cherry-picked into this worktree branch.

**Files already modified:**
- `src/lib/supabase/server.ts` — `isImpersonating` flag + target user email
- `src/app/api/profile/route.ts` — skip upsert during impersonation
- `src/app/api/profile/goals/route.ts` — skip profile ensure during impersonation

## Execution Order

```
Task 6 (cherry-pick impersonation fixes) — already done
    ↓
Task 1 (API endpoint) + Task 3 (AlertRow component) — parallel
    ↓
Task 2 (query hook) — depends on Task 1
    ↓
Task 4 (FeedTab rewrite) — depends on Tasks 2, 3
    ↓
Task 5 (summary cards) — depends on Task 4
```

## Test Strategy

- **Task 1:** Unit test the API route with mocked Prisma (test each alert type returns correct data)
- **Task 4:** Component test FeedTab renders all three zones with mock data
- **Task 5:** Component test summary cards show correct counts and scroll behavior
- **Integration:** Manual test with impersonation to verify end-to-end data flow
