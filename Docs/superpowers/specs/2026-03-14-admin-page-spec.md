# Feature Spec: Admin Page

**Date:** 2026-03-14
**Slug:** admin-page
**Branch:** worktree-admin-page

## Requirements

- Add `role` enum field (admin/user) to `UserProfile` model via Prisma migration
- Expandable admin section in the existing sidebar — visible only for users with `role = admin`
- Four admin sections, navigable via horizontal tabs and sidebar sub-items:
  1. **Unmatched Opps** — integrate the existing `/admin/unmatched-opportunities` page
  2. **Users** — full CRUD: view, invite, edit roles, deactivate
  3. **Integrations** — extensible card-based list (currently Google Calendar + OpenSearch)
  4. **Data Sync** — table of `DataRefreshLog` entries showing sync history and health

## Visual Design

### Approved Approach: "Command Center"

Dashboard landing page with KPI summary cards + horizontal tab navigation.

**Sidebar changes:**
- Expandable "Admin" section with chevron toggle, between the main nav items and Profile
- Sub-items: Dashboard, Unmatched Opps, Users, Integrations, Data Sync
- Uses existing coral active state system from `side-nav.md`
- Only rendered when `user.role === 'admin'`
- When sidebar is collapsed: admin shows as a gear/shield icon; sub-items appear as tooltips

**Content area:**
- Header: "Admin" title with "System overview and management" subline
- 4 KPI cards in a row (following `dashboard-metrics-layout.md` KPI card pattern):
  - Unmatched (coral accent): count of unresolved, subtitle "X new this week"
  - Users (plum accent): total count, subtitle "X active today"
  - Integrations (steel-blue accent): count of connections, subtitle shows error count if any
  - Sync (sage accent): "All OK" or error count, subtitle "last sync X ago"
- KPI cards are clickable — navigate to the corresponding tab
- Horizontal tabs below KPI cards (following `tabs.md` spec):
  - Unmatched Opps | Users | Integrations | Data Sync
  - Coral bottom indicator on active tab

### Tab: Unmatched Opps
- Integrates the existing `src/app/admin/unmatched-opportunities/page.tsx` as a component
- Retains all existing functionality (DataGrid, filters, column picker, resolution flow)

### Tab: Users
- Data table following `data-table.md` spec
- Columns: Name, Email, Role (badge), Job Title, Last Login (relative), Setup (dot indicator), Actions
- Role badges: Admin = plum bg, User = steel-blue bg
- Toolbar: search input + "Invite User" button (plum primary)
- Hover-reveal actions: Edit (pencil), Deactivate (ban icon)
- Edit modal: change role, update name/job title
- Invite modal: email + optional name, creates stub UserProfile via existing POST endpoint

### Tab: Integrations
- Card-per-integration layout (extensible)
- Each card shows: integration name, status indicator (dot + label), user count, last sync time
- Currently: Google Calendar, OpenSearch Sync
- Status dot colors: green (connected/healthy), coral (error), gray (disconnected)
- Cards are not actionable in v1 — view-only status

### Tab: Data Sync
- Data table of `DataRefreshLog` entries
- Columns: Source, Status (badge), Records Updated, Records Failed, Started At (relative), Duration
- Status badges: success = sage bg, error = coral bg, running = steel-blue bg
- Sortable by any column, filterable by source and status
- Error rows expandable to show `errorMessage`

## Component Plan

### Existing components to reuse:
- `DataGrid` — for Unmatched Opps tab (already used)
- `AdminFilterBar` — for Unmatched Opps tab (already used)
- `AdminColumnPicker` — for Unmatched Opps tab (already used)
- KPI Card pattern from `ExploreKPICards.tsx`
- Side-nav active state system from `Sidebar.tsx`

### New components needed:
- `src/features/admin/components/AdminDashboard.tsx` — main admin page with tabs + KPI cards
- `src/features/admin/components/AdminKPICards.tsx` — the 4 summary KPI cards
- `src/features/admin/components/UsersTab.tsx` — users table with search/filter
- `src/features/admin/components/IntegrationsTab.tsx` — integration cards
- `src/features/admin/components/DataSyncTab.tsx` — sync log table
- `src/features/admin/components/InviteUserModal.tsx` — invite modal
- `src/features/admin/components/EditUserModal.tsx` — edit user modal

### Components to extend:
- `Sidebar.tsx` — add expandable admin section with role check
- `AppShell.tsx` — pass user role to Sidebar
- Admin layout (`src/app/admin/layout.tsx`) — update to use AppShell integration or maintain separate admin layout with sidebar

## Backend Design

See: `docs/superpowers/specs/2026-03-14-admin-page-backend-context.md`

### Schema changes:
- Add `UserRole` enum (`admin`, `user`) to Prisma schema
- Add `role` field to `UserProfile` model, default `user`
- Migration: `npx prisma migrate dev --name add-user-role`

### New API routes:
- `GET /api/admin/users` — list all users with pagination, search, role filter
- `PATCH /api/admin/users/[id]` — update user (role, fullName, jobTitle, deactivated)
- `GET /api/admin/integrations` — aggregate integration status (calendar connections + scheduler health)
- `GET /api/admin/sync` — list DataRefreshLog entries with pagination, filters
- `GET /api/admin/stats` — KPI summary stats (unmatched count, user count, integration count, sync status)

### Auth changes:
- Add `getAdminUser()` helper that checks both auth and `role === 'admin'`
- All admin API routes use `getAdminUser()` instead of `getUser()`
- Admin layout server component checks role and redirects non-admins

## States

- **Loading**: Skeleton KPI cards + skeleton table rows (per `data-table.md` loading spec)
- **Empty**: Centered message per section (e.g., "No sync logs yet")
- **Error**: Error state in table body area with retry button (per `data-table.md` error spec)

## Out of Scope

- User deactivation/deletion from Supabase auth (only marks profile as deactivated)
- Integration configuration (connecting/disconnecting integrations from admin)
- Real-time sync status (polling or WebSocket) — page refresh shows latest
- Audit log for admin actions
- Permission granularity beyond admin/user roles
