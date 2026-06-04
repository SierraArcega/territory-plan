# Mobile Optimization Plan

Scope: full-app audit and fix pass using the `/mobile-design` skill.
Each segment = one worktree, one PR, one focused review.
All segments follow the same protocol: audit first → present findings → await approval → implement → test checklist → PR.

---

## How to Execute a Segment

1. Start a new session and paste the execution prompt (see bottom of this doc).
2. Claude audits only the files listed under that segment.
3. Claude presents findings and waits for approval before writing any code.
4. Changes land in an isolated worktree; a PR is opened against `main`.

---

## Segment Menu

### 0 · AppShell & Global Chrome
**Branch:** `fix/mobile-appshell-chrome`
**Status:** ✅ Complete — PR #203

**Fixed:**
- ~~`src/app/globals.css`~~ — `overflow: hidden` removed, `overscroll-behavior: none` added (PR #197)
- ~~`src/features/shared/components/layout/AppShell.tsx`~~ — `h-dvh` on root div (PR #197); `useIsMobile()` swaps sidebar for bottom nav on mobile (PR #203)
- ~~`src/features/shared/components/navigation/Sidebar.tsx`~~ — `overflow-y-auto` + `touch-action:pan-y` on main nav (PR #203)
- ~~`src/features/shared/components/navigation/BottomNav.tsx`~~ — new horizontally-scrollable bottom tab bar at < 640px with Lucide icons, safe-area padding, LeaderboardModal (PR #203)
- ~~`src/features/shared/hooks/useIsMobile.ts`~~ — shared breakpoint hook (PR #203)

---

### 1 · Home Dashboard
**Branch:** `fix/mobile-home`
**Status:** ✅ Complete — PR #204

**Fixed (PR #204):**
- ~~`src/features/home/components/HomeTabBar.tsx`~~ — `overflow-x-auto` on container, `whitespace-nowrap` on labels, `px-4 sm:px-8` padding
- ~~`src/features/home/components/HomeView.tsx`~~ — content area `px-4 sm:px-8`
- ~~`src/features/home/components/FeedSection.tsx`~~ — `whitespace-nowrap` on section title

**Already owned by other PRs (do not touch):**
- ~~`src/features/home/components/ProfileSidebar.tsx`~~ — PR #201 implements the icon strip collapse pattern (Section 2b of /mobile-design): auto-collapse at < 768px, `w-11` icon strip with action buttons + hover tooltips, localStorage persistence, `transition-[width] duration-200` animation

**Audited, no action needed:**
- `FeedSummaryCards.tsx` — `flex flex-wrap` + `min-w-[100px] flex-1` handles wrapping correctly
- `AlertRow.tsx` — `flex-1 min-w-0` + `truncate` + `shrink-0` on action button is solid
- `PlanCard.tsx` — `grid-cols-2 sm:grid-cols-4` already responsive
- `FeedRows.tsx`, `FeedControls.tsx`, `PlansTab.tsx`, `ActivitiesTab.tsx` — no mobile issues found

---

### 2 · Map Shell & Search Bar
**Branch:** `fix/mobile-map-shell`
**Status:** ✅ Complete — PR #207

**Fixed (PR #207):**
- ~~`src/features/map/components/SearchBar/index.tsx`~~ — search input is `shrink-0 w-[140px] lg:w-[220px]` (fixed, outside scroll container) so filter strip always gets `flex-1`; filter strip uses `overflow-x-auto overflow-y-hidden` (horizontal scroll without vertical scrollbar); suggestions dropdown clamped to `min(320px, 100vw-1.5rem)`
- ~~`src/features/map/components/FloatingPanel.tsx`~~ — `env(safe-area-inset-bottom)` padding on mobile bottom drawer
- ~~`src/features/map/components/ViewActionsBar.tsx`~~ — popovers clamped to `max-w-[calc(100vw-3rem)]` to prevent overflow at 320px
- ~~`src/features/map/components/StylesBubble.tsx`~~ — District Styles panel clamped to `min(360px, 100vw-2rem)`

**Audited, no action needed:**
- `MapV2Shell.tsx` — clean structure, no touch-action issues
- `MapV2Container.tsx` — MapLibre canvas `absolute inset-0`, clean
- `MapSummaryBar.tsx` — already uses compact labels below `xl:`, `overflow-x-auto` on vendor rows
- `IconBar.tsx` — inside `hidden sm:block` wrapper in FloatingPanel, never shown on mobile
- `PanelContent.tsx` — pure router component, no layout issues

---

### 3 · District Detail Panel
**Branch:** `fix/mobile-district-panel`
**Files:**
- `src/features/map/components/panels/district/DistrictDetailPanel.tsx`
- `src/features/map/components/panels/district/DistrictHeader.tsx`
- `src/features/map/components/panels/district/DistrictInfoTab.tsx`
- `src/features/map/components/panels/district/DataDemographicsTab.tsx`
- `src/features/map/components/panels/district/tabs/` (all)
- `src/features/map/components/panels/district/signals/` (all)
- `src/features/map/components/SearchResults/` (all)

**Key risks:**
- Multi-tab panel with no collapse — stats/header consuming > 25% before tabs are reachable
- `DistrictHeader` stat row overflowing at narrow widths
- Cards (`FinanceCard`, `AcademicCard`, etc.) — fixed widths or misaligned grid columns

---

### 4 · Plan Detail (remaining tabs)
**Branch:** `fix/mobile-plan-detail-remaining`
**Status:** Partially done — PR #202 delivered the full-screen mobile shell, collapsible stats strip, and Districts tab responsive columns. Remaining tabs untouched.

**Files remaining:**
- `src/features/plans/components/PlanTabs.tsx`
- `src/features/plans/components/ActivitiesPanel.tsx`
- `src/features/plans/components/ActivitiesTable.tsx`
- `src/features/plans/components/ContactsTable.tsx`
- `src/features/plans/components/ContactsActionBar.tsx`
- `src/features/plans/components/PlanOverviewSection.tsx`
- `src/features/plans/components/PlanPerfSection.tsx`
- `src/features/plans/components/PlanContactsSection.tsx`
- `src/features/plans/components/PlanActivitiesSection.tsx`
- `src/features/plans/components/PlanTasksSection.tsx`
- `src/features/plans/components/DistrictPerformanceSection.tsx`

**Already fixed (PR #202):**
- ~~`PlanDetailModal.tsx`~~ — full-screen overlay at < 640px
- ~~`PlanDetailMobileShell.tsx`~~ — purple header bar, collapsible stats, scrollable tab bar
- ~~`PlanDetailSidebar.tsx`~~ — hidden on mobile (inside shell)
- ~~`PlanDistrictsTab.tsx`~~ — responsive `[1fr_52px_52px_44px_28px]` grid + state/enrollment sub-label

**Key risks remaining:**
- `ContactsTable` — multi-column table with no responsive grid
- `PlanPerfSection` — likely fixed-width metric columns
- Tab bar scrolling when > 4 tabs visible

---

### 5 · Plans List & Plan Cards
**Branch:** `fix/mobile-plans-list`
**Files:**
- `src/features/map/components/panels/PlansListPanel.tsx`
- `src/features/plans/components/PlansTable.tsx`
- `src/features/plans/components/PlanCard.tsx`
- `src/features/plans/components/FlippablePlanCard.tsx`
- `src/features/plans/components/PlanCardFilters.tsx`
- `src/features/plans/components/FilterBar.tsx`
- `src/features/plans/components/PlanFormModal.tsx`

**Key risks:**
- `PlansTable` — multi-column table with fixed-px columns
- `PlanCardFilters` / `FilterBar` — filter chips overflowing on narrow screens
- `PlanFormModal` — modal not switching to `fixed inset-0` on mobile

---

### 6 · Activities
**Branch:** `fix/mobile-activities`
**Files:**
- `src/features/activities/components/page/ActivitiesPageShell.tsx`
- `src/features/activities/components/page/ActivitiesPageHeader.tsx`
- `src/features/activities/components/page/CommandBar.tsx`
- `src/features/activities/components/page/ViewToggle.tsx`
- `src/features/activities/components/page/ScopeToggle.tsx`
- `src/features/activities/components/page/SavedViewTabs.tsx`
- `src/features/activities/components/page/table/` (all)
- `src/features/activities/components/page/drawer/ActivityDetailDrawer.tsx`
- `src/features/activities/components/page/MapTimeView/` (all)
- `src/features/activities/components/page/WeekGridView.tsx`
- `src/features/activities/components/page/MonthView.tsx`
- `src/features/activities/components/page/ScheduleView.tsx`
- `src/features/activities/components/page/UpcomingRail.tsx`

**Key risks:**
- Multiple view modes (table, map, week, month, schedule) — each needs independent mobile audit
- `ActivityDetailDrawer` — drawer width / overlay behavior at 390px
- `WeekGridView` / `MonthView` — time grids notoriously break at mobile widths
- `CommandBar` — action buttons may overflow

---

### 7 · Tasks
**Branch:** `fix/mobile-tasks`
**Files:**
- `src/features/tasks/components/KanbanBoard.tsx`
- `src/features/tasks/components/TaskList.tsx`
- `src/features/tasks/components/TasksTable.tsx`
- `src/features/tasks/components/TaskCard.tsx`
- `src/features/tasks/components/TaskDetailModal.tsx`
- `src/features/tasks/components/TaskFormModal.tsx`
- `src/features/tasks/components/QuickAddTask.tsx`

**Key risks:**
- `KanbanBoard` — horizontal scroll of columns is correct on desktop; on mobile each column should stack or scroll safely
- `TaskDetailModal` — needs `fixed inset-0` on mobile
- `TasksTable` — multi-column table

---

### 8 · Reports
**Branch:** `fix/mobile-reports`
**Files:**
- `src/features/reports/components/ReportsTab.tsx`
- `src/features/reports/components/ReportsLibrary.tsx`
- `src/features/reports/components/ResultsTable.tsx`
- `src/features/reports/components/library/` (all)
- `src/features/reports/components/builder/ReportsBuilder.tsx`
- `src/features/reports/components/builder/BuilderChat.tsx`
- `src/features/reports/components/builder/ResultsPane.tsx`
- `src/features/reports/components/builder/ChipStrip.tsx`
- `src/features/reports/components/builder/Composer.tsx`
- `src/features/reports/components/builder/CollapsedChatRail.tsx`

**Key risks:**
- `ReportsBuilder` — two-column chat+results layout likely unusable at 390px; may need structural switch via `useIsMobile`
- `ResultsTable` — dynamic columns from AI queries; no way to predict width at mobile
- `CollapsedChatRail` — 44px slim rail may need to go full-bottom-sheet on mobile
- `ChipStrip` — filter chips overflowing

---

### 9 · Leaderboard
**Branch:** `fix/mobile-leaderboard`
**Status:** Partially done — PR #197 added collapsible banner to `LowHangingFruitView`. Rest untouched.

**Files remaining:**
- `src/features/leaderboard/components/LeaderboardModal.tsx`
- `src/features/leaderboard/components/LeaderboardHomeWidget.tsx`
- `src/features/leaderboard/components/LeaderboardNavWidget.tsx`
- `src/features/leaderboard/components/LeaderboardDetailView.tsx`
- `src/features/leaderboard/components/RevenueTable.tsx`
- `src/features/leaderboard/components/RevenuePodium.tsx`
- `src/features/leaderboard/components/LowHangingFruitFilterBar.tsx`

**Already fixed (PR #197):**
- ~~`LowHangingFruitView.tsx`~~ — collapsible summary banner (sessionStorage persistence)

**Key risks remaining:**
- `LeaderboardModal` — needs `fixed inset-0` on mobile
- `RevenueTable` — financial table with likely fixed columns
- `RevenuePodium` — three-column podium layout crushing at 320px
- `LowHangingFruitFilterBar` — filter chips overflowing at narrow widths

---

### 10 · Admin
**Branch:** `fix/mobile-admin`
**Files:**
- `src/features/admin/components/AdminShell.tsx`
- `src/features/admin/components/AdminDashboard.tsx`
- `src/features/admin/components/AdminKPICards.tsx`
- `src/features/admin/components/UsersTab.tsx`
- `src/features/admin/components/EditUserModal.tsx`
- `src/features/admin/components/InviteUserModal.tsx`
- `src/features/admin/components/VacancyConfigTab.tsx`
- `src/features/admin/components/ServiceAliasesTab.tsx`
- `src/features/admin/components/IntegrationsTab.tsx`
- `src/features/admin/components/IngestHealthTab.tsx`

**Key risks:**
- Admin is lower-priority mobile (used primarily on desktop) but modals still need `fixed inset-0`
- `AdminKPICards` — stat cards row overflowing at narrow widths
- Tab bar overflow when many admin tabs visible

---

### 11 · Vacancies & Integrations
**Branch:** `fix/mobile-vacancies-integrations`
**Status:** ✅ Complete — PR #219

**Fixed (PR #219):**
- ~~`ComposeEmailPanel.tsx`~~ — `max-h-[90dvh] flex flex-col` on panel; `flex-1 overflow-y-auto` on form body; `rows={5}`; `px-4 sm:px-6`
- ~~`ComposeSlackPanel.tsx`~~ — same pattern; `rows={4}`
- ~~`VacanciesTable.tsx`~~ — `hidden sm:table-cell` on School + Contact `<th>`/`<td>`; footer `whitespace-nowrap` + `flex-wrap gap-y-1`
- ~~`VacancyList.tsx`~~ — VacancyRow title wrapped in `div.min-w-0.flex-1`; `truncate block` on both anchor and span

**Audited, no action needed:**
- `VacanciesCard.tsx` — thin wrapper around SignalCard; no layout issues
- `ContactOutreachActions.tsx` — icon-only buttons, well-structured
- `ConnectedAccountsSection.tsx` — fix shipped (`p-4 sm:p-6`, `min-w-0` on email row) but component not currently rendered in app (imported but unwired in ProfileView)

**Key discovery:**
- The map panel's plan vacancies view is `PlanVacanciesTab.tsx` (SearchResults), not `VacanciesTable.tsx`. `VacanciesTable` renders inside `PlanTabs.tsx` (Plans tab → plan detail → Vacancies tab).

---

## Execution Prompt (paste at the start of each segment session)

```
Use /mobile-design to audit and fix mobile/narrow-window issues for Segment [N] — [Name].

**Before touching any code:**
1. Use `/start-session` — pull main, create isolated git worktree named [branch from segment above].
2. Symlink the env file: `ln -s "/path/to/main-checkout/.env" "/worktree/path/.env"`
3. Cross-check ALL open PRs for file conflicts before implementing:
   `gh pr list --json number,title | jq '.[].number'` then for each:
   `gh pr view <N> --json files --jq '.files[].path'`
   Any overlap with the segment file list = do not touch that file (note it as "owned by PR #N").
4. Do not make any changes on main or any active deployment branch.

**Segment scope — only audit and fix the files listed below:**
[paste the Files list from the segment]

**Audit approach:**

1. Read `docs/architecture.md` and `docs/mobile-optimization-plan.md` for full context.

2. Read each file in the segment scope and check against the /mobile-design skill:
   - Fixed-px columns that crush at < 640px?
   - Panels or sidebars blocking primary content with no collapse?
   - Modals not switching to `fixed inset-0` on mobile?
   - Floating nav elements inaccessible on full-screen?
   - Icons or chrome that could be cut on mobile?

3. Check scroll & touch safety:
   - `overflow: hidden` on `html`/`body`?
   - `touch-action: pan-y` on any ancestor containing the map?
   - `h-screen`/`100vh` that should be `h-dvh`?
   - Absolute-positioned dropdowns inside an `overflow-x-auto` container?
     (overflow-x:auto forces overflow-y:auto, clipping the dropdown — keep dropdowns outside the scroll zone)

4. Present all findings as a prioritized list. **Wait for explicit approval before writing any code.**

**Implementation rules:**

5. Use Tailwind `sm:` for visual-only changes, `useIsMobile()` only when JSX structure genuinely differs.

6. For horizontal scroll toolbars:
   - Put `overflow-x-auto overflow-y-hidden` on a nested strip — NOT on the outer container
   - Keep any absolutely-positioned dropdown (suggestions, popovers) in a sibling/parent div that has no overflow set
   - Give the scroll strip `flex-1 min-w-0`; give fixed UI (search inputs, icons) `shrink-0` with explicit widths

7. Batch related fixes per file into a single commit. Run `npx vitest run` before pushing.

**Smoke testing (start dev server from the worktree):**

8. `npm run dev -- --port 3005`
   - 390px (iPhone 14) in Safari Responsive Design Mode — primary target
   - 320px (iPhone SE) — stress test
   - Scroll every vertically-scrolling container at both widths
   - Drag through 639→640px — no layout jump or flicker
   - Widen to 1024px — confirm desktop layout unchanged
   - If AppShell/map was touched: smoke-test map pan + pinch-zoom
```
