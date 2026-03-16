# Feature Spec: Home Base

**Date:** 2026-03-15
**Slug:** home-base
**Branch:** worktree-home-base

## Requirements

Home Base is the new default landing page (`/` / `?tab=home`) that replaces the existing `HomeView.tsx`. It provides a sales rep's command center — a single view that surfaces actionable items, territory plan status, and profile/integration management.

**Core goals:**
- Surface what needs attention *right now* (overdue tasks, unmapped opps, meetings to log)
- Show territory plan performance at a glance with revenue metrics
- Consolidate the user's profile and tool integrations into a persistent sidebar

**Users:** Sales representatives using the territory planning tool daily.
**Success:** Reps open the app and immediately see their top priorities without navigating to separate tabs.

## Visual Design

**Approved approach: Full HomeView replacement with profile sidebar + tabbed content**

The Figma design (file `1Dpts0E42QsXQNmFWLmag0`) defines three screens sharing a common layout:
- Left: Profile sidebar (340px) with user avatar, name, title, integrations list, profile setup progress
- Right: Tabbed content area with Feed | Plans | Dashboard tabs
- Dashboard tab is **deferred** — not included in this build

**Layout:** Two-panel horizontal split inside the existing `AppShell`. The AppShell's global sidebar (navigation icons) remains; HomeView adds its own internal profile sidebar.

**Key design tokens (from Figma):**
- Background: `#FFFCFA` (off-white)
- Plum: `#403770` (primary text, navigation)
- Deep Coral: `#F37167` (accents, active states, CTA)
- Muted Purple: `#8A80A8` (secondary text)
- Mid Purple: `#544A78` (integration text)
- Border: `#D4CFE2` (card/section borders)
- Divider: `#E2DEEC` (lighter dividers)
- Surface: `#F7F5FA` (buttons, search bg)
- Font: Plus Jakarta Sans (Regular/Medium/SemiBold/Bold)

## Component Plan

### Existing components to reuse
| Component | Source | Purpose |
|-----------|--------|---------|
| `useProfile()` | `shared/lib/queries.ts` | User name, avatar, job title |
| `useTasks({})` | `tasks/lib/queries.ts` | Overdue tasks list |
| `useTerritoryPlans()` | `plans/lib/queries.ts` | Territory plan cards |
| `useActivities()` | `activities/lib/queries.ts` | Activities needing next steps |
| `useCalendarInbox("pending")` | `calendar/lib/queries.ts` | Meetings to log |
| `useUpdateTask()` | `tasks/lib/queries.ts` | Complete task from feed |
| `useCreateTerritoryPlan()` | `plans/lib/queries.ts` | Create plan from plans tab |
| `PlanFormModal` | `plans/components/PlanFormModal.tsx` | Plan creation modal |
| `TaskDetailModal` | `tasks/components/TaskDetailModal.tsx` | Task detail/edit modal |
| `formatCurrency()` | `shared/lib/format.ts` | Currency formatting |

### New components needed
| Component | Category | Purpose |
|-----------|----------|---------|
| `HomeView` (rewrite) | View | Top-level orchestrator: sidebar + tab routing |
| `ProfileSidebar` | Layout | User profile, integrations list, setup progress |
| `HomeTabBar` | Navigation | Feed / Plans / Dashboard tab navigation with badges |
| `FeedTab` | View | Feed content: summary cards + action sections |
| `FeedSummaryCards` | Display | Row of 5 KPI cards (counts with icons) |
| `FeedSection` | Display | Reusable section: colored dot header + bordered list |
| `FeedTaskRow` | Display | Task row: checkbox + title + territory + date + action |
| `FeedOpportunityRow` | Display | Opp row: title + territory + amount + action |
| `FeedActivityRow` | Display | Activity row: title + date + action button |
| `FeedMeetingRow` | Display | Meeting row: title + source + time + action |
| `PlansTab` | View | Plans content: FY-grouped cards with metrics |
| `TerritoryPlanCard` | Display | Plan card with revenue metrics + progress bar + actions |
| `FYPlanGroup` | Display | Fiscal year header + plan card grid |

### Components to extend
None — clean replacement approach.

## Backend Design

See: `docs/superpowers/specs/2026-03-15-home-base-backend-context.md`

**No new API endpoints needed for initial build.** All data comes from existing endpoints:

| Data need | Existing endpoint | Hook |
|-----------|------------------|------|
| User profile | `GET /api/profile` | `useProfile()` |
| Tasks (overdue filter) | `GET /api/tasks` | `useTasks({})` |
| Territory plans | `GET /api/territory-plans` | `useTerritoryPlans()` |
| Activities | `GET /api/activities` | `useActivities()` |
| Calendar inbox | `GET /api/calendar/inbox` | `useCalendarInbox("pending")` |
| Plan actuals | computed in `useTerritoryPlans` | included in plan response |

**Unmapped Opportunities:** The Figma feed shows "Unmapped Opportunities" — districts with open pipeline not linked to a territory plan. This data can be computed client-side by cross-referencing the district list against plan district assignments. For the initial build, this section will use a **derived query** from existing data rather than a new endpoint. If performance is an issue, a dedicated `GET /api/home/unmapped-opportunities` endpoint can be added later.

**Untracked Expenses:** No data model exists. This feed section will be **omitted** from the initial build.

## Feed Tab Sections

Each section follows a consistent pattern:
1. **Section header:** colored dot + uppercase label + item count + info tooltip
2. **Content list:** bordered card with rows separated by dividers
3. **Row actions:** contextual button (Complete, Map, Add next steps, Log activity)

| Section | Dot color | Data source | Row structure |
|---------|-----------|-------------|---------------|
| Overdue Tasks | `#F37167` (coral) | `useTasks` filtered `status !== done && dueDate < today` | Checkbox + title + territory dot + priority + date + "Complete" |
| Unmapped Opportunities | `#E8913A` (orange) | Derived from plan/district data | Title + territory + close date + amount + "Map" |
| Activities Need Next Steps | `#6EA3BE` (steel blue) | `useActivities` filtered `status === completed && !outcome` | Title + completion date + "Add next steps" |
| Meetings to Log | `#8AA891` (sage green) | `useCalendarInbox("pending")` | Title + source + time + "Log activity" |

## Plans Tab Structure

- **Header:** "My Territory Plans" title + "Recently updated" sort button + "+ New Plan" coral CTA
- **FY groups:** Plans grouped by `fiscalYear`, current FY first with "Current" badge, past FYs with "Completed" badge
- **Plan cards:** 2-column grid within each FY group
  - Territory name + state abbreviation + district count + status badge (Active/Planning/Closed)
  - Revenue metrics row: Rev. Target, Open Pipeline, Closed Won, Revenue
  - "Revenue to target" progress bar with percentage (uses Goal Progress Bar pattern from UI Framework)
  - Action buttons row: View on Map, Log Activity, Create Task, Update Notes
- **Create card:** Dashed border + icon, triggers `PlanFormModal`

## Profile Sidebar Structure

- **User section:** Coral gradient avatar (initials) + full name + job title
- **Integrations section:** Header "INTEGRATIONS" + list of 5 tools
  - Each: icon bg + tool name + status pill (Connected=green, Set up=coral)
  - Static data for initial build (no real integration status checks)
  - Tools: Calendar, Gmail, Mixmax, Slack, Rippling
- **Profile Setup section:** Divider + "Profile Setup" label + percentage + progress bar + helper text

## States

### Loading
- Skeleton placeholders for profile sidebar (avatar circle + text lines)
- Skeleton cards for summary stats row
- Skeleton rows in feed sections
- Follow existing app pattern (shimmer animation not required)

### Empty
- **Feed tab, no items in a section:** Section still renders with header, body shows "All caught up!" with checkmark icon
- **Plans tab, no plans:** Single "Create your first plan" card with illustration
- **No profile data:** Fallback to initials from email, "Set up your profile" CTA

### Error
- Individual sections fail gracefully — show "Unable to load" inline with retry button
- Don't block the entire page if one data source fails
- TanStack Query's built-in error/retry handling applies

## Out of Scope

- **Dashboard tab** — deferred to future build
- **Untracked Expenses section** — no data model exists
- **Real integration status checks** — static placeholders only
- **Profile editing** from the sidebar — links to existing profile page
- **Notification system** — badge counts are computed from data, not pushed
- **Mobile/responsive layout** — desktop-first, responsive polish deferred
- **Search functionality** — the search bar in the top nav is handled by FilterBar
