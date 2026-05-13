# Main Sidebar Relocation — Design Spec

**Date:** 2026-05-13
**Status:** Approved by user (B + keep /views/* URLs + hide My Views when collapsed)
**Worktree:** `worktree-saved-views-sidebar`
**Predecessor specs:** `2026-05-13-saved-views-sidebar-spec.md`, `2026-05-13-saved-views-sidebar-plan.md`

## Problem

The Saved Views feature mounts its own `ViewsSidebar` only on `/views/*` routes. Reps navigating from Home / Map / Activities / Tasks see the legacy 140px `Sidebar`, then have to visit a separate `/views` URL to reach their plans and lists. The user calls this a "weird sublink" and wants My Views available from every route.

## Decisions

1. **Layout:** Option B from the smoke-test handoff — keep the legacy `Sidebar.tsx` as the single sidebar for all routes; render `MyViewsSection` inside it below the main tabs. Expanded width grows from 140px to 252px. Collapsed width stays 56px.
2. **Collapse behavior:** When the sidebar is collapsed (chevron toggle), My Views is hidden entirely. Collapsed = icon-only top nav, same intent as today.
3. **URLs:** Keep `/views`, `/views/plans/[id]/[viewId]`, `/views/lists/[id]/[viewId]` routes as-is. Zero migration cost.
4. **Mobile:** Drop the `/views/layout.tsx` hamburger overlay. The legacy sidebar's chevron collapse is the only mobile pattern. Trade-off noted under risks.

## Architecture

### Legacy `Sidebar.tsx` (edited)
- Bump expanded width: `w-[140px]` → `w-[252px]`. Collapsed `w-14` unchanged.
- Add a render block between the existing `<nav>` (main tabs) and the bottom divider/leaderboard/profile area:

  ```tsx
  {!collapsed && (
    <div className="border-t border-[#E2DEEC]">
      <MyViewsSection />
    </div>
  )}
  ```

- `MyViewsSection` is imported from `@/features/views/components/MyViewsSection` — used unchanged.
- Active-tab highlighting: when the `activeTab` prop doesn't match any tab in `MAIN_TABS` or `BOTTOM_TABS` (e.g., `"views"`), no main tab gets the red border. This is the behavior we want on `/views/*` routes.

### `AppShell.tsx` (edited)
- Add `hideFilterBar?: boolean` prop, default `false`.
- When `true`, the `<FilterBar />` is not rendered. `/views/layout.tsx` will pass `true`.

### `TabId` type (edited)
- Add `"views"` to the union. This is the sentinel passed from `/views/layout.tsx` so the legacy Sidebar doesn't highlight any main tab.

### `/views/layout.tsx` (rewritten)
- Replace the bespoke `<div className="flex h-screen w-screen">` shell with `<AppShell>`.
- AppShell receives:
  - `activeTab="views"` (sentinel)
  - `onTabChange={(tab) => router.push(\`/?tab=${tab}\`)}` (main-tab clicks route to legacy `/` with the chosen tab)
  - `sidebarCollapsed` / `onSidebarCollapsedChange` — pull from `useMapStore` (the same Zustand slice that drives `/`) so collapse state is shared across routes
  - `isAdmin` — pull from `useProfile()`
  - `hideFilterBar={true}`
- `DetailPanel` and `ListBuilderModal` stay mounted at the layout level (inside the `<main>` slot, alongside `{children}`). They're route-scoped state.
- Mobile hamburger top bar is removed.

### `src/app/page.tsx` (untouched)
- The legacy `/` route keeps its existing `onTabChange` (Zustand-driven). When a user is already on `/` and clicks a main tab, behavior is identical to today.

### Files deleted
- `src/features/views/components/ViewsSidebar.tsx`
- `src/features/views/components/SidebarTopNav.tsx`
- `src/features/views/components/SidebarFooter.tsx`
- `src/features/views/components/__tests__/ViewsSidebar.test.tsx` (any related test files)

### Files untouched
- `MyViewsSection.tsx`, `PlansSubsection.tsx`, `ListsSubsection.tsx`, `HiddenFooter.tsx`, `GroupContextMenu.tsx`
- Views store, queries, all GroupCanvas / view components, DetailPanel, ListBuilderModal
- All `/views/*` page files

## Component diagram

```
On / (legacy routes):
+-----------------------+ +--------------------+
| AppShell              | |                    |
|  FilterBar (adapts)   | |  legacy view       |
|  Sidebar (252px)      | |  (Home/Map/Plans/  |
|   - main tabs         | |   Activities/...)  |
|   - MyViewsSection    | |                    |
|   - Leaderboard       | |                    |
|   - Profile           | |                    |
+-----------------------+ +--------------------+

On /views/* (saved-views routes):
+-----------------------+ +--------------------+
| AppShell (no FilterBar)| |                   |
|  Sidebar (252px)      | |  GroupCanvas /     |
|   - main tabs         | |   PortfolioView /  |
|   - MyViewsSection    | |   one of 8 views   |
|   - Leaderboard       | |  + DetailPanel     |
|   - Profile           | |  + ListBuilderModal|
+-----------------------+ +--------------------+
```

## Data flow

- **Collapse state**: shared via `useMapStore` Zustand slice (already exists). Both `/` and `/views/*` read/write the same `sidebarCollapsed` boolean. Collapsing on one route persists across navigation.
- **Active tab highlight**: on `/`, driven by `useMapStore.activeTab`. On `/views/*`, the sentinel `"views"` is passed to `Sidebar` so no tab matches.
- **My Views row highlighting**: `MyViewsSection` and its children already read `usePathname()` to highlight the active group/view. Works identically across both routes.
- **Main-tab click navigation**: on `/`, calls `setActiveTab` + Zustand URL sync (unchanged). On `/views/*`, calls `router.push("/?tab=<id>")`.

## Testing

- `npx vitest run` — baseline 2540/2540 must stay green. Tests touching `ViewsSidebar` / `SidebarTopNav` get deleted alongside the components.
- Add light test coverage: `Sidebar` renders `MyViewsSection` when `!collapsed` and the user has plans (mocked queries).
- Manual smoke test:
  - On `/?tab=home` — sidebar shows main tabs + My Views with real plan/list rows.
  - Click "Map" — navigates to `/?tab=map`, map renders with sidebar still visible (and Map highlighted).
  - Click a plan in My Views — navigates to `/views/plans/[id]/<defaultView>`. Sidebar visible, no main tab highlighted, the plan row highlighted.
  - From `/views/plans/[id]/map`, click "Home" — navigates to `/?tab=home`. Home highlighted.
  - Collapse sidebar — width drops to 56px, My Views hidden, top nav icons remain.
  - Expand — width returns to 252px, My Views visible.
  - On `/?tab=map`, FilterBar visible (unchanged). On `/views/plans/[id]/<view>`, FilterBar hidden (new).
  - On `<768px` viewport: sidebar auto-collapses; user can expand inline.
- `npm run build` clean.

## Risks / known trade-offs

1. **Mobile UX regression on /views/***: today `/views/*` has a tap-to-open hamburger overlay backdrop. After this change, mobile users tap the chevron to expand the legacy sidebar inline (252px takes most of the screen). Less polished but consistent. Follow-up: revisit mobile pattern globally.
2. **SidebarFooter deletion**: name + pod subline disappears. The legacy bottom Profile button shows only an icon. Tolerable because `UserProfile.pod` doesn't exist (per handoff section "Known acknowledged deviations" #5).
3. **252px is wide on smaller laptops**: the bump from 140px steals 112px of canvas width. The collapse toggle is the escape valve. The prototype designed for 252px so this is intentional alignment.
4. **AppShell `hideFilterBar` is a one-flag flag**: in the future, FilterBar may need to adapt to /views/* rather than be hidden. Acceptable for now — keeping the flag binary keeps the surface tiny.
5. **TabId "views" sentinel**: adds a value that doesn't appear in `MAIN_TABS`/`BOTTOM_TABS` and isn't a valid `?tab=` value. Worth a brief comment in the type definition so future readers don't try to render it as a tab.

## Out of scope

- Mobile pattern redesign (deferred follow-up).
- Restoring the name+pod footer (no pod field exists yet).
- Refactoring legacy Sidebar's inline SVG icons to Lucide (orthogonal cleanup).
- Reports/LHF/Resources/Admin tabs visual refresh (untouched).

## Verification before commit

- `npx vitest run` — 2540 passing (or 2540 - deleted-test-count, all green).
- `npm run build` — clean.
- Manual smoke test list above.
- Commit message: `feat(saved-views): move My Views into main app sidebar across all routes`.
