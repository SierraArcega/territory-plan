# The Lineup Enhancements — Design Spec

**Date:** 2026-03-14
**Branch:** `aston-lineup-tab` (or new branch from main post-merge)
**Status:** Design approved, pending implementation plan

---

## Overview

Two enhancements to The Lineup and activity editing experience:

1. **Edit gap fix** — plan and state association is currently missing from the activity edit flow
2. **AI-powered goal suggestions** — a smart recommendations panel in The Lineup that surfaces prioritised actions based on the user's stated goals and current progress

---

## Part 1 — Edit Gap Fix

### Problem

When opening an existing activity to edit it, `ActivityFormModal` wraps both the Plans and States pickers in `{!isEditing && ...}` guards (lines 289 and 331), actively suppressing them in edit mode. It also resets `selectedPlanIds` and `selectedStateFips` to empty on mount. Users cannot see or modify plan/state associations after creation.

### Fix

1. **Remove the `!isEditing` guards** so plan and state fields render in edit mode
2. **Pre-populate from a full activity fetch** — `ActivityListItem` only carries `planCount`, not IDs or fips. The edit modal calls `useActivity(initialData.id)` on open, guarded with `enabled: !!isEditing`, to load the full `Activity` type. `useActivity` is already available in `src/features/activities/lib/queries.ts` and requires no new import.
3. **Initialise selections** from the fetched data:
   - `selectedPlanIds` ← `activity.plans.map(p => p.planId)`
   - `selectedStateFips` ← `activity.states.filter(s => s.isExplicit).map(s => s.fips)`
   - Notes field ← `activity.notes` (populated once fetch resolves; shown as empty string until then — no skeleton needed since empty is an acceptable interim state)
4. **`handleSubmit` in edit mode** is updated to pass `planIds: selectedPlanIds` and `stateFips: selectedStateFips` to `updateActivity.mutateAsync`

### Loading state (edit open)

While `useActivity(id)` loads, plan and state fields render in a disabled/skeleton state. Type, title, dates, status, and assignee (available immediately from `ActivityListItem`) render normally. Save button is disabled until fetch resolves.

### Save behaviour

`useUpdateActivity()` in `src/features/activities/lib/queries.ts` is extended to accept **optional** `planIds?: string[]` and `stateFips?: string[]`. Existing callers that omit these fields continue to work unchanged. The PATCH handler at `/api/activities/[id]` is extended to sync links only when these fields are present in the request body: remove deselected, add newly selected.

---

## Part 2 — AI Goal Suggestions

### Solution

A persistent suggestions panel in The Lineup that uses Claude to generate prioritised recommended actions based on the user's `UserGoal` data, recent activity history, and active territory plans. **Shown only when `selectedDate === today`.**

---

### Layout

- A collapsed **banner** sits above the timeline when viewing today (hidden on all other dates)
- Clicking banner opens a **floating overlay** (does not push the timeline down)
- Overlay: goal context bar at top + suggestion cards below
- Closing returns to collapsed banner

**Busy day:** Busy = 4+ activities in the user's **own today activities** (filtered by `assignedToUserId = currentUser`, date = today, regardless of any person-selector or plan filter applied in the Lineup UI). This count is fetched independently or derived from the existing `useActivities` call scoped to today + current user. When busy, banner text: "Looks like your day is pretty booked — click here if you need more ideas."

---

### Goal Context Bar

**If no `UserGoal` record exists for the current fiscal year**, replace the bar with: "Set your goals on the Home page to get personalised recommendations." Cards still show.

**Source fields:**

`UserGoal` actuals (`takeActual`, `pipelineActual`, etc.) are virtual fields returned by the API layer — they are computed from activity and plan data at query time and are not persisted DB columns. The suggestions API computes these the same way the existing goals API does.

| Display | Target field | Actual / progress |
|---|---|---|
| Earnings | `earningsTarget` | `takeActual` (computed: sum of take amounts from completed activities in fiscal year) |
| Pipeline | `renewalTarget + winbackTarget + expansionTarget + newBusinessTarget` | `pipelineActual` (computed: sum of opportunity values in active pipeline) |
| Renewals | `renewalTarget` (dollar figure) | sum of completed renewal-type activity values in current fiscal year |

All values displayed as currency. No counts.

**Color logic:**
- < 90%: Coral gap label + bar
- 90–99%: Amber
- ≥ 100%: Green + surplus shown

---

### Suggestion Cards

Three cards by default. If Claude returns fewer than 3, show however many are returned. If zero, show a single message: "Nothing urgent right now — check back tomorrow."

Each card:

| Element | Detail |
|---|---|
| Activity type + icon | e.g. "📞 Renewal Call" |
| District + Plan names | from suggestion payload |
| Metrics row | 3 chips: contract/opportunity value, days since last contact, `renewalWeeks` (AI-inferred weeks until likely renewal window, estimated from the date of the most recent renewal-type activity for that district plus a 12-month cycle — null if no prior renewal activity exists; no contract end date field is currently in the schema) |
| AI reasoning | 1–2 sentences referencing goal gap and dollar amounts |
| Tags | Goal category pills + risk status pills |
| Schedule button | Opens `ActivityFormModal` pre-filled with `activityType`, `title`, `planId`. A new optional `onSuccess: (activityId: string) => void` prop is added to `ActivityFormModal` — it is called with the new activity's ID after `createActivity.mutateAsync` resolves. `SuggestionCard` passes this callback and uses the returned `activityId` to call `useLinkActivityDistricts().mutate({ activityId, leaids: [districtLeaid] })`. If this post-save link call fails: show a toast "Activity saved — couldn't link district. Add it manually." The activity is kept. |

---

### Goal States

**Behind (< 90%):** Gap-focused, urgent, at-risk accounts prioritised.
**Nearing (90–99%):** Motivating push to cross the line.
**Exceeding (≥ 100%):** Upside opportunities — additional earnings potential, no gap language.

---

### Data Fetching

New hook: `useLineupSuggestions(date: string)`:
- Returns `null` immediately if `date !== today`
- Otherwise calls `GET /api/lineup/suggestions`
- Returns `{ suggestions, isLoading, error, refetch }`

---

### Loading, Caching & Error States

- Fires on mount when viewing today
- Banner shows shimmer while `isLoading`
- Suggestions cached in `LineupSuggestion` table keyed by `userId + date (YYYY-MM-DD)`
- **Cache invalidation:** The server checks for an existing record matching `userId + today's date string`. If found, returns it immediately. If not found (date key has rolled over to a new day), calls Claude and stores the result. No cron required — the date key is the TTL.
- **Error:** Banner shows "Couldn't load recommendations — try again later" + retry button (calls `refetch()`)

---

### AI Suggestions API

**Endpoint:** `GET /api/lineup/suggestions`

**Input to Claude:**
- `UserGoal` for current fiscal year + computed actuals (or null)
- Last 30 days of user's activities (type, district leaid, plan IDs, outcome, date)
- Active territory plans + districts (names, leaids, contract end dates where available)
- Today's date

**Output:** Array of 3–5 objects. The API validates each `opportunityType` value against the enum `["renewal", "expansion", "winback", "new_business"]`; any unrecognised value is replaced with `"new_business"` before storing or returning.

```ts
{
  activityType: string
  title: string
  districtLeaid: string | null
  districtName: string | null
  planId: string | null
  planName: string | null
  contractValue: number | null
  lastContactDays: number | null
  renewalWeeks: number | null          // weeks to contract end date; null if unknown
  opportunityType: "renewal" | "expansion" | "winback" | "new_business"
  reasoning: string
  goalTags: string[]
  riskTags: string[]
}
```

---

### Design Tokens

- **Font:** Plus Jakarta Sans
- **Primary:** Plum `#403770` | **Accent:** Coral `#F37167`
- **Surfaces:** `#FFFCFA`, `#F7F5FA`
- **Borders:** `#D4CFE2`, `#E2DEEC`
- **Cards:** `rounded-lg shadow-sm border border-[#D4CFE2]`
- **Overlay:** `rounded-2xl shadow-xl`
- **Pills:** `rounded-full text-xs font-medium`
- **Banner:** `bg-[#403770]` with white text, coral ✦ icon

---

## New Files

| File | Purpose |
|---|---|
| `src/features/lineup/components/SuggestionsBanner.tsx` | Banner + overlay |
| `src/features/lineup/components/SuggestionCard.tsx` | Individual card |
| `src/features/lineup/lib/queries.ts` | `useLineupSuggestions()` hook (new directory — `src/features/lineup/lib/` does not exist yet) |
| `src/app/api/lineup/suggestions/route.ts` | Suggestions API |

## Modified Files

| File | Change |
|---|---|
| `src/features/activities/components/ActivityFormModal.tsx` | Remove `!isEditing` guards; pre-populate plans/states/notes; add `defaultDistrictLeaid` prop; update `handleSubmit` edit path |
| `src/features/activities/lib/queries.ts` | Extend `useUpdateActivity` to accept `planIds` and `stateFips` |
| `src/app/api/activities/[id]/route.ts` | Extend PATCH to sync plan and state links |
| `src/features/lineup/components/LineupView.tsx` | Mount `SuggestionsBanner`; derive and pass today's raw activity count and selected date |
| `prisma/schema.prisma` | Add `LineupSuggestion` model; add `lineupSuggestions LineupSuggestion[]` to `UserProfile` |

## New DB Model

```prisma
model LineupSuggestion {
  id          String      @id @default(uuid())
  userId      String
  user        UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        String      // YYYY-MM-DD — acts as natural TTL key
  suggestions Json        // array of suggestion objects
  createdAt   DateTime    @default(now())

  @@unique([userId, date])
  @@map("lineup_suggestions")
}
```

`UserProfile` gains: `lineupSuggestions LineupSuggestion[]`

---

## Out of Scope

- Suggestions for team members (only logged-in user's goals)
- Manual dismissal of individual cards
- User feedback on suggestion quality
- Suggestions outside The Lineup
