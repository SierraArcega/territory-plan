# Implementation Plan: Admin Page

**Date:** 2026-03-14
**Spec:** `docs/superpowers/specs/2026-03-14-admin-page-spec.md`
**Backend Context:** `docs/superpowers/specs/2026-03-14-admin-page-backend-context.md`

## Task Overview

| # | Task | Type | Depends On | Est. Complexity |
|---|------|------|------------|----------------|
| 1 | Add `role` enum + field to Prisma schema | Backend | — | Low |
| 2 | Add `getAdminUser()` helper | Backend | 1 | Low |
| 3 | Build admin API routes | Backend | 1, 2 | Medium |
| 4 | Update Sidebar with admin section | Frontend | 2 | Medium |
| 5 | Build admin feature module + dashboard | Frontend | 3 | Medium |
| 6 | Build Users tab (table + modals) | Frontend | 3 | High |
| 7 | Build Integrations tab | Frontend | 3 | Low |
| 8 | Build Data Sync tab | Frontend | 3 | Medium |
| 9 | Integrate Unmatched Opps tab | Frontend | 5 | Low |
| 10 | Update admin layout + routing | Frontend | 4, 5 | Medium |

## Detailed Tasks

### Task 1: Prisma Schema — Add `UserRole` enum + field

**Files:**
- `prisma/schema.prisma`

**Changes:**
1. Add `UserRole` enum with values `admin` and `user`
2. Add `role UserRole @default(user) @map("role")` to `UserProfile` model
3. Run `npx prisma migrate dev --name add-user-role`
4. Run `npx prisma generate`

**Test:** Verify migration applies cleanly, Prisma client regenerates with `role` field.

---

### Task 2: Add `getAdminUser()` helper

**Files:**
- `src/lib/supabase/server.ts`

**Changes:**
1. Add `getAdminUser()` that calls `getUser()`, then queries `UserProfile` for role
2. Returns `{ user, profile }` if admin, `null` otherwise
3. Used by all admin API routes and admin layout

**Test:** Unit test: returns null for non-admin, returns user+profile for admin.

---

### Task 3: Build admin API routes

**Files:**
- `src/app/api/admin/users/route.ts` — extend with GET (list users)
- `src/app/api/admin/users/[id]/route.ts` — new: PATCH (update user)
- `src/app/api/admin/integrations/route.ts` — new: GET (integration status)
- `src/app/api/admin/sync/route.ts` — new: GET (DataRefreshLog list)
- `src/app/api/admin/stats/route.ts` — new: GET (KPI summary)

**Patterns (from backend-context doc):**
- Auth: `getAdminUser()` → 401/403
- Pagination: `{ items, pagination: { page, pageSize, total } }`
- Error handling: try/catch with console.error + 500

**API Details:**

`GET /api/admin/users`:
- Query params: `page`, `pageSize`, `search`, `role`
- Returns: UserProfile list with all fields
- Sort: by `lastLoginAt` desc (most recent first)

`PATCH /api/admin/users/[id]`:
- Body: `{ role?, fullName?, jobTitle?, deactivated? }`
- Validates user exists, validates role enum
- Returns updated profile

`GET /api/admin/integrations`:
- No params
- Aggregates: CalendarConnection count by status, scheduler health from DataRefreshLog
- Returns: `{ integrations: [{ name, status, userCount, totalUsers, lastSyncAt }] }`

`GET /api/admin/sync`:
- Query params: `page`, `pageSize`, `source`, `status`
- Returns: DataRefreshLog list, sorted by `completedAt` desc

`GET /api/admin/stats`:
- No params
- Returns: `{ unmatched: { total, newThisWeek }, users: { total, activeToday }, integrations: { total, errors }, sync: { status, lastSyncAgo } }`

**Test:** Test each route for auth, validation, happy path, error.

---

### Task 4: Update Sidebar with admin section

**Files:**
- `src/features/shared/components/navigation/Sidebar.tsx`
- `src/features/shared/components/layout/AppShell.tsx`

**Changes:**
1. Add `isAdmin` prop to `Sidebar`
2. Add expandable "Admin" section between main tabs and Profile
3. Admin section header with gear icon + "Admin" label + chevron toggle
4. Sub-items: Dashboard, Unmatched Opps, Users, Integrations, Data Sync
5. Sub-items use `<a href="/admin/...">` for navigation (App Router pages)
6. Collapsed sidebar: gear icon, sub-items as tooltips
7. Only render admin section if `isAdmin === true`
8. Pass `isAdmin` from AppShell (which gets it from server component)

**Sidebar TabId update:**
- Admin items navigate via `<a>` links to `/admin/*` routes, NOT via `onTabChange`
- This keeps the sidebar simple — admin pages are separate routes

**Test:** Render test: admin section visible for admin, hidden for non-admin. Navigation links correct.

---

### Task 5: Build admin feature module + dashboard

**Files:**
- `src/features/admin/components/AdminDashboard.tsx` — main dashboard client component
- `src/features/admin/components/AdminKPICards.tsx` — 4 KPI cards
- `src/features/admin/hooks/useAdminStats.ts` — TanStack Query hook for stats

**AdminDashboard:**
- Fetches stats via `useAdminStats`
- Renders KPI cards + horizontal tabs
- Tab state managed locally (useState)
- Tab content switches between UnmatchedTab, UsersTab, IntegrationsTab, DataSyncTab
- KPI card click sets active tab

**AdminKPICards:**
- 4 cards following KPI Card pattern from dashboard-metrics-layout.md
- Props: stats object
- Accent colors: coral, plum, steel-blue, sage

**Test:** Render test: dashboard shows cards, tabs switch content.

---

### Task 6: Build Users tab

**Files:**
- `src/features/admin/components/UsersTab.tsx`
- `src/features/admin/components/InviteUserModal.tsx`
- `src/features/admin/components/EditUserModal.tsx`
- `src/features/admin/hooks/useAdminUsers.ts`

**UsersTab:**
- TanStack Query for user list with search/pagination
- Data table following `data-table.md` spec
- Columns: Name, Email, Role (badge), Job Title, Last Login, Setup Status, Actions
- Toolbar: search input + "Invite User" button
- Role badges: Admin = `bg-[#403770] text-white`, User = `bg-[#6EA3BE]/15 text-[#4d7285]`
- Last Login: relative time format ("2h ago", "3d ago", "Never")
- Setup Status: green dot = completed, gray dot = pending
- Hover-reveal actions: Edit, Deactivate

**InviteUserModal:**
- Email input (required) + Full Name input (optional)
- Calls POST `/api/admin/users`
- Success: close modal, refetch user list

**EditUserModal:**
- Role dropdown (admin/user) + name + job title fields
- Calls PATCH `/api/admin/users/[id]`
- Success: close modal, refetch

**Test:** Table renders, search filters, invite creates user, edit updates user.

---

### Task 7: Build Integrations tab

**Files:**
- `src/features/admin/components/IntegrationsTab.tsx`
- `src/features/admin/hooks/useAdminIntegrations.ts`

**IntegrationsTab:**
- Card-per-integration layout
- Each card: name, status dot + label, user count, last sync time
- Status dot: green = connected/healthy, coral = error, gray = disconnected
- Cards are view-only (no actions in v1)

**Test:** Cards render with correct status indicators.

---

### Task 8: Build Data Sync tab

**Files:**
- `src/features/admin/components/DataSyncTab.tsx`
- `src/features/admin/hooks/useAdminSync.ts`

**DataSyncTab:**
- Data table with columns: Source, Status, Records Updated, Records Failed, Started At, Duration
- Status badges: success = sage, error = coral, running = steel-blue
- Sortable columns, filterable by source and status
- Error rows expandable (accordion) to show errorMessage
- Pagination

**Test:** Table renders, sort/filter work, error rows expand.

---

### Task 9: Integrate Unmatched Opps tab

**Files:**
- `src/features/admin/components/UnmatchedTab.tsx` — wrapper that imports existing page component

**Changes:**
1. Extract the existing page content into a reusable component
2. Import into the admin dashboard tabs
3. Keep all existing functionality intact

**Test:** Unmatched opps renders identically within the tab.

---

### Task 10: Update admin layout + routing

**Files:**
- `src/app/admin/layout.tsx` — update with role check
- `src/app/admin/page.tsx` — new: renders AdminDashboard
- `src/app/admin/unmatched-opportunities/page.tsx` — redirect to `/admin?tab=unmatched`

**Changes:**
1. Admin layout checks `getAdminUser()` — redirect to `/` if not admin (with flash message)
2. New `/admin/page.tsx` renders the `AdminDashboard` component
3. Admin layout uses its own header (existing pattern) but with sidebar awareness
4. URL params for tab state: `/admin?tab=users`, `/admin?tab=sync`, etc.

**Test:** Non-admin redirected, admin sees dashboard, URL tab params work.

## Execution Order

**Phase 1 (Backend, sequential):** Tasks 1 → 2 → 3
**Phase 2 (Frontend, parallel after Phase 1):** Tasks 4, 5, 6, 7, 8, 9 (can be parallelized)
**Phase 3 (Integration):** Task 10

## Test Strategy

- **Unit tests:** Each API route, each hook, each component
- **Integration:** Admin layout auth gating, sidebar role visibility, tab navigation
- **Verify:** `npx vitest run` + `npm run build`
