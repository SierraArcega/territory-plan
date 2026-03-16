# Implementation Plan: Home Base

**Date:** 2026-03-15
**Spec:** `docs/superpowers/specs/2026-03-15-home-base-spec.md`
**Backend Context:** `docs/superpowers/specs/2026-03-15-home-base-backend-context.md`
**Branch:** worktree-home-base

## Task Overview

| # | Task | Depends on | Estimated files |
|---|------|-----------|----------------|
| 1 | ProfileSidebar component | — | 1 new |
| 2 | HomeTabBar component | — | 1 new |
| 3 | FeedSection + FeedSummaryCards | — | 2 new |
| 4 | Feed row components (Task, Opp, Activity, Meeting) | 3 | 1 new (4 sub-components) |
| 5 | FeedTab orchestrator | 3, 4 | 1 new |
| 6 | TerritoryPlanCard + FYPlanGroup | — | 1 new (2 sub-components) |
| 7 | PlansTab orchestrator | 6 | 1 new |
| 8 | Rewrite HomeView (compose all) | 1, 2, 5, 7 | 1 modified |
| 9 | Verification + polish | 8 | — |

## Parallel Groups

**Group A (independent, can run in parallel):**
- Task 1: ProfileSidebar
- Task 2: HomeTabBar
- Task 3: FeedSection + FeedSummaryCards
- Task 6: TerritoryPlanCard + FYPlanGroup

**Group B (depends on Group A):**
- Task 4: Feed row components (needs Task 3)
- Task 5: FeedTab (needs Tasks 3, 4)
- Task 7: PlansTab (needs Task 6)

**Group C (depends on Group B):**
- Task 8: HomeView rewrite (needs Tasks 1, 2, 5, 7)
- Task 9: Verification

## File Structure

All new components go in `src/features/home/components/`:

```
src/features/home/
  components/
    HomeView.tsx          # Orchestrator (replaces shared/views/HomeView.tsx)
    ProfileSidebar.tsx    # User profile + integrations + setup progress
    HomeTabBar.tsx        # Feed | Plans | Dashboard tab navigation
    FeedTab.tsx           # Feed tab content
    FeedSummaryCards.tsx  # 5 KPI cards row
    FeedSection.tsx       # Reusable section (header + list wrapper)
    FeedRows.tsx          # TaskRow, OpportunityRow, ActivityRow, MeetingRow
    PlansTab.tsx          # Plans tab content
    PlanCard.tsx          # Territory plan card with metrics + progress + actions
```

## Detailed Tasks

### Task 1: ProfileSidebar

**File:** `src/features/home/components/ProfileSidebar.tsx`

**Inputs:** `useProfile()` hook data

**Structure:**
- Fixed-width left panel (w-[340px]) with white bg + right border
- User avatar: coral gradient circle with initials, 88px
- Name: Plus Jakarta Sans Bold 20px, `#403770`
- Title: Plus Jakarta Sans Medium 14px, `#8A80A8`
- Divider: `#E2DEEC` 1px
- "INTEGRATIONS" label: 11px semibold uppercase tracking-wider `#8A80A8`
- Integration rows: icon bg + name + status pill
  - Connected: green bg `#F7FFF2`, green text `#69B34A`
  - Set up: coral bg `#FEF1F0`, coral text `#F37167`
- Profile Setup: semibold label + bold percentage + coral gradient progress bar + helper text

**Static data for integrations:**
```ts
const INTEGRATIONS = [
  { name: "Calendar", icon: CalendarIcon, status: "connected", bgColor: "#E8F1F5" },
  { name: "Gmail", icon: MailIcon, status: "setup", bgColor: "#FEF1F0" },
  { name: "Mixmax", icon: ZapIcon, status: "setup", bgColor: "#F7F5FA" },
  { name: "Slack", icon: MessageIcon, status: "connected", bgColor: "#F7FFF2" },
  { name: "Rippling", icon: UsersIcon, status: "setup", bgColor: "#FFFAF1" },
];
```

---

### Task 2: HomeTabBar

**File:** `src/features/home/components/HomeTabBar.tsx`

**Props:** `activeTab`, `onTabChange`, `badgeCounts: { feed: number, plans: number }`

**Structure:**
- Horizontal tab row with 3 tabs: Feed, Plans, Dashboard
- Active tab: coral text `#F37167` + bottom border 2px coral
- Inactive tab: muted purple `#8A80A8` + no border
- Badge pills: active = coral bg + white text; inactive = `#D4CFE2` bg + `#8A80A8` text
- Dashboard tab shown but disabled (gray, no badge, "Coming soon" tooltip)
- Each tab has an icon (from Lucide) + label + optional badge

---

### Task 3: FeedSection + FeedSummaryCards

**File:** `src/features/home/components/FeedSummaryCards.tsx`

**FeedSummaryCards:**
- Grid of 5 cards, `grid grid-cols-5 gap-3`
- Each card: white bg, `#D4CFE2` border, 8px rounded, padding
- Icon (colored, 24px) + large count (24px bold `#403770`) + label (12px `#8A80A8`)
- Info button (small circle, `#D4CFE2` bg)

**File:** `src/features/home/components/FeedSection.tsx`

**FeedSection:**
- Props: `title`, `dotColor`, `itemCount`, `children`
- Header row: colored dot (8px rounded) + uppercase bold label + item count right-aligned
- Info button tooltip
- Content: white bg card with `#D4CFE2` border, rounded-lg, children rendered inside with dividers

---

### Task 4: Feed Row Components

**File:** `src/features/home/components/FeedRows.tsx`

4 exported components, each follows a consistent row pattern:
- `px-5 py-4` padding, flex layout, items-center
- Title + subtitle left, metadata + action button right
- Dividers between rows handled by parent FeedSection

**TaskRow:** checkbox + title + territory dot + priority text + date + "Complete" button
**OpportunityRow:** title + territory + close date + dollar amount + "Map" button
**ActivityRow:** title + completion date + "Add next steps" button
**MeetingRow:** title + source label + time + "Log activity" button

Action buttons: `bg-[#F7F5FA] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#403770]`

---

### Task 5: FeedTab

**File:** `src/features/home/components/FeedTab.tsx`

**Orchestrator that composes:**
1. `FeedSummaryCards` — computed counts from all data sources
2. `FeedSection` "Overdue Tasks" — `useTasks` filtered for overdue
3. `FeedSection` "Unmapped Opportunities" — derived from plans + district data
4. `FeedSection` "Activities Need Next Steps" — `useActivities` filtered for completed without outcome
5. `FeedSection` "Meetings to Log" — `useCalendarInbox("pending")`

**Data hooks used:**
- `useTasks({})` — filter: `status !== "done" && dueDate < today`
- `useActivities({})` — filter: `status === "completed" && !outcome`
- `useCalendarInbox("pending")` — pending calendar events
- `useTerritoryPlans()` — for unmapped opp derivation

**Badge count computation:** Sum of all section item counts → passed up to HomeTabBar

---

### Task 6: TerritoryPlanCard + FYPlanGroup

**File:** `src/features/home/components/PlanCard.tsx`

**TerritoryPlanCard:**
- Props: plan data (from `useTerritoryPlans()`)
- White card with left border (plan color), `#D4CFE2` border, rounded-lg
- Header: plan name + state abbreviation + district count + status badge
  - Status badges: Active=`#69B34A` bg, Planning=`#6EA3BE` bg, Closed=`#F37167` bg
- Metrics row: 4 stats (Rev. Target, Open Pipeline, Closed Won, Revenue) — use UI Framework stat pattern
- Progress bar: "Revenue to target" + percentage — use Goal Progress Bar from UI Framework
- Action buttons row: 4 ghost buttons (View on Map, Log Activity, Create Task, Update Notes)
  - Button style: `bg-[#F7F5FA] rounded-lg px-3 py-1.5 text-xs text-[#403770]` with small icon

**FYPlanGroup:**
- Props: `fiscalYear`, `status` ("Current" | "Completed"), `planCount`, `plans[]`
- Header: "FY27" bold + status badge + "N plans" count
- Grid: `grid grid-cols-2 gap-4` of TerritoryPlanCards
- Last position in current FY: dashed "Create new plan" card

---

### Task 7: PlansTab

**File:** `src/features/home/components/PlansTab.tsx`

**Structure:**
- Header: "My Territory Plans" h2 + "Recently updated" sort button + "+ New Plan" coral CTA
- Plans grouped by fiscal year (current first, then past)
- Each group rendered as `FYPlanGroup`
- Uses `useTerritoryPlans()` + `useProfile()` for owner filtering
- Triggers `PlanFormModal` for plan creation

---

### Task 8: Rewrite HomeView

**File:** `src/features/home/components/HomeView.tsx` (new file)
**Modified:** `src/features/shared/components/views/HomeView.tsx` → re-export from new location

**Structure:**
```tsx
<div className="h-full flex bg-[#FFFCFA]">
  <ProfileSidebar />
  <div className="flex-1 flex flex-col overflow-hidden">
    <HomeTabBar activeTab={tab} onTabChange={setTab} badgeCounts={counts} />
    <div className="flex-1 overflow-auto px-8 py-6">
      {tab === "feed" && <FeedTab onBadgeCountChange={setCounts} />}
      {tab === "plans" && <PlansTab />}
    </div>
  </div>
</div>
```

Update the import in `src/app/page.tsx` to point to the new HomeView location OR keep the old file as a re-export.

---

### Task 9: Verification + Polish

- `npm run build` must pass
- `npx vitest run` must pass
- Visual check against Figma screenshots
- Test empty states (no tasks, no plans)
- Test loading states
- Verify tab switching works
- Verify action buttons navigate correctly (View on Map → map tab, Create Task → task modal)

## Test Strategy

- **Unit tests** for data derivation logic (overdue task filtering, FY grouping, unmapped opp computation)
- **Component tests** deferred to Stage 8 (test-writer agent)
- **Integration:** Verify existing API hooks still work when consumed by new components
- **Visual:** Compare against Figma screenshots at each stage
