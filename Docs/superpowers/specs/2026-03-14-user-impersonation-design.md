# User Impersonation Design

**Date**: 2026-03-14
**Status**: Draft
**Goal**: Allow admins to view the app as any user to debug and understand their experience.

## Context

The app has no role-based access control. All authenticated users have equal access, including admin endpoints. There is no existing impersonation or admin panel tooling.

### Current State
- Auth: Supabase Auth with `@supabase/ssr`, middleware-based session refresh
- User model: `UserProfile` (18 fields, no role concept)
- All server code funnels through `getUser()` in `src/lib/supabase/server.ts`
- Admin layout at `src/app/admin/layout.tsx` only checks authentication, not authorization
- Existing `/api/admin/*` routes have no role-based authorization — any authenticated user can access them

### Decisions
- **Access control**: Database-driven `role` field on `UserProfile` (no env var shortcut)
- **Mechanism**: Cookie-based session swap — `getUser()` returns impersonated user when cookie is set
- **Access level**: Full access (not read-only) while impersonating
- **User selection**: Searchable dropdown by name/email in admin header
- **Bootstrapping**: Database migration + seed script to set initial admin

## Design

### 1. Data Model

Add a `UserRole` enum, `role` field, and `ImpersonationLog` model to `prisma/schema.prisma`:

```prisma
enum UserRole {
  USER
  ADMIN
}

model UserProfile {
  // ... existing fields ...
  role  UserRole @default(USER)
}

model ImpersonationLog {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  adminId          String    @map("admin_id") @db.Uuid
  targetUserId     String    @map("target_user_id") @db.Uuid
  action           String    @db.VarChar(10) // "start" or "stop"
  createdAt        DateTime  @default(now()) @map("created_at")

  @@map("impersonation_logs")
}
```

A Prisma migration adds the `role` column with `USER` as the default, and creates the `impersonation_logs` table. A separate seed script or manual SQL sets the initial admin account.

The `role` column maps to `role` in the database (no `@map` needed). The enum creates a PostgreSQL enum type.

### 2. Server-Side Impersonation (`getUser()` / `getRealUser()`)

Modify `src/lib/supabase/server.ts` to support impersonation:

**`getUser()` — returns the effective user (impersonated if active):**

1. Get real user from Supabase auth (existing behavior)
2. If no user, return `null` (existing behavior)
3. Check for `impersonate_uid` cookie
4. If cookie exists:
   a. Look up real user's `UserProfile` in Prisma — verify `role === ADMIN`
   b. If not admin, ignore cookie and return real user
   c. If admin, verify the target user exists in `UserProfile`. If not, clear the cookie and return real user.
   d. If target exists, return a modified user object with only the `id` overridden to the impersonated user's id
5. If no cookie, return real user (existing behavior)

**Important**: Only the `id` field is overridden. All other Supabase `User` fields (`app_metadata`, `user_metadata`, etc.) remain from the real admin's auth session. This is acceptable because downstream code always queries Prisma using `user.id` to get profile data — it does not rely on other `User` fields. The returned object is effectively a synthetic user that routes Prisma queries to the target user's data.

**`getRealUser()` — always returns the actual authenticated user, bypassing impersonation:**

Used by:
- The impersonation UI (to check admin role and show the banner)
- The admin layout guard (to protect admin routes by real identity)
- The impersonation API endpoints (to verify admin before setting/clearing the cookie)
- All `/api/admin/*` routes (to enforce admin-only access)

### 3. API Endpoints

#### `GET /api/admin/users/search?q=<query>`

- **Auth**: Requires `role === ADMIN` via `getRealUser()` + Prisma lookup
- **Query**: Case-insensitive `contains` search on `fullName` and `email`
- **Response**: `{ users: [{ id, email, fullName, avatarUrl }] }` — max 10 results
- **Errors**: `401` if not authenticated, `403` if not admin, `400` if `q` param missing
- **Purpose**: Populates the impersonation search dropdown

#### `POST /api/admin/impersonate`

- **Auth**: Requires `role === ADMIN` via `getRealUser()` + Prisma lookup
- **Body**: `{ userId: string }` to start impersonation, or `{ userId: null }` to stop
- **Start**: Validates the target `userId` exists in `UserProfile`, then sets the `impersonate_uid` cookie and writes an `ImpersonationLog` entry with `action: "start"`
- **Stop**: Clears the `impersonate_uid` cookie and writes an `ImpersonationLog` entry with `action: "stop"`
- **Response**: `{ ok: true }`
- **Errors**: `401` if not authenticated, `403` if not admin, `404` if target userId not found, `400` if body is invalid
- **Cookie settings**: `httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production, `path: /`, `maxAge: 3600` (1 hour auto-expiry)

The 1-hour `maxAge` ensures the cookie auto-expires if the admin forgets to exit, or if their session expires and they re-login.

### 4. UI Components

#### Impersonation Banner (`src/components/ImpersonationBanner.tsx`)

A server component rendered in `src/app/layout.tsx` that reads the `impersonate_uid` cookie and verifies the real user is admin. Contains a nested client component for the interactive Exit button:

- Fixed position at the top of the viewport, above all other content
- Deep Coral (`#E8735A`) background — impossible to miss
- Shows: "Viewing as **{fullName}** ({email})" + "Exit" button
- Exit button (client component) calls `POST /api/admin/impersonate` with `{ userId: null }` and reloads the page
- Only renders when impersonation is active (cookie exists and real user is admin)

#### Impersonation Search Dropdown (in admin header)

Added to `src/app/admin/layout.tsx` header:

- Client component with a search input
- Debounced query to `GET /api/admin/users/search?q=...`
- Dropdown results show avatar + name + email
- Clicking a result calls `POST /api/admin/impersonate` with their `userId`, then navigates to `/`
- Only visible to users with `role === ADMIN`

### 5. Admin Layout & Route Protection

Update `src/app/admin/layout.tsx` to verify the real user has `role === ADMIN`:

1. Call `getRealUser()` to get the authenticated user (bypassing impersonation)
2. Look up their `UserProfile` in Prisma
3. If `role !== ADMIN`, redirect to `/`
4. If not authenticated, redirect to `/login` (existing behavior)

**Update all existing `/api/admin/*` routes** to use `getRealUser()` + admin role check instead of the current `getUser()` authentication-only pattern. This closes the existing security gap where any authenticated user can access admin endpoints. Affected routes:
- `POST /api/admin/users`
- `POST /api/admin/districts`
- `GET /api/admin/districts/suggestions`
- `GET /api/admin/districts/search`
- All `/api/admin/unmatched-opportunities/*` routes

### 6. Security

- **Cookie is httpOnly**: Client JS cannot read or tamper with it
- **Cookie is sameSite strict**: Not sent on cross-origin requests
- **Cookie is secure in production**: Only sent over HTTPS
- **Cookie has maxAge**: Auto-expires after 1 hour to prevent stale impersonation
- **Server-side validation**: Every request that honors the impersonation cookie re-validates that the real user (from Supabase auth) has `role === ADMIN`. Even if someone manually sets the cookie, it does nothing without a valid admin session.
- **Target user validation**: `getUser()` verifies the impersonation target still exists on every request. If the target is deleted, the cookie is cleared and the real user is returned.
- **Admin role is database-driven**: No env var shortcuts — the role must be set in the database
- **Audit trail**: `ImpersonationLog` records every impersonation start/stop with admin ID, target user ID, and timestamp
- **Cookie name**: Uses `impersonate_uid` (standard cookie naming) rather than `x-` prefix

### 7. Out of Scope

- **Read-only mode**: Restricting mutations during impersonation
- **Admin user management UI**: Promoting/demoting users via UI (use database directly for now)
- **Granular permissions**: Fine-grained RBAC beyond admin/user

## File Changes Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `UserRole` enum, `role` field on `UserProfile`, `ImpersonationLog` model |
| `prisma/migrations/...` | New migration for `role` column + `impersonation_logs` table |
| `src/lib/supabase/server.ts` | Add impersonation logic to `getUser()`, add `getRealUser()` |
| `src/app/api/admin/users/search/route.ts` | New — user search endpoint |
| `src/app/api/admin/impersonate/route.ts` | New — start/stop impersonation endpoint |
| `src/app/api/admin/users/route.ts` | Update to use `getRealUser()` + admin check |
| `src/app/api/admin/districts/route.ts` | Update to use `getRealUser()` + admin check |
| `src/app/api/admin/districts/suggestions/route.ts` | Update to use `getRealUser()` + admin check |
| `src/app/api/admin/districts/search/route.ts` | Update to use `getRealUser()` + admin check |
| `src/app/api/admin/unmatched-opportunities/*/route.ts` | Update to use `getRealUser()` + admin check |
| `src/components/ImpersonationBanner.tsx` | New — server component with nested client exit button |
| `src/app/layout.tsx` | Render `ImpersonationBanner` |
| `src/app/admin/layout.tsx` | Add role check + impersonation search dropdown |
