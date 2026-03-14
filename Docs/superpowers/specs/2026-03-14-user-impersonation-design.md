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

### Decisions
- **Access control**: Database-driven `role` field on `UserProfile` (no env var shortcut)
- **Mechanism**: Cookie-based session swap — `getUser()` returns impersonated user when cookie is set
- **Access level**: Full access (not read-only) while impersonating
- **User selection**: Searchable dropdown by name/email in admin header
- **Bootstrapping**: Database migration + seed script to set initial admin

## Design

### 1. Data Model

Add a `UserRole` enum and `role` field to the `UserProfile` model in `prisma/schema.prisma`:

```prisma
enum UserRole {
  USER
  ADMIN
}

model UserProfile {
  // ... existing fields ...
  role  UserRole @default(USER)
}
```

A Prisma migration adds the column with `USER` as the default. A separate seed script or manual SQL sets the initial admin account.

The `role` column maps to `role` in the database (no `@map` needed). The enum creates a PostgreSQL enum type.

### 2. Server-Side Impersonation (`getUser()` / `getRealUser()`)

Modify `src/lib/supabase/server.ts` to support impersonation:

**`getUser()` — returns the effective user (impersonated if active):**

1. Get real user from Supabase auth (existing behavior)
2. If no user, return `null` (existing behavior)
3. Check for `x-impersonate-uid` cookie
4. If cookie exists:
   a. Look up real user's `UserProfile` in Prisma — verify `role === ADMIN`
   b. If not admin, ignore cookie and return real user
   c. If admin, return a modified user object with the impersonated user's `id` and `email`
5. If no cookie, return real user (existing behavior)

**`getRealUser()` — always returns the actual authenticated user, bypassing impersonation:**

Used by:
- The impersonation UI (to check admin role and show the banner)
- The admin layout guard (to protect admin routes by real identity)
- The impersonation API endpoints (to verify admin before setting/clearing the cookie)

Both functions continue to return the Supabase `User` type. `getUser()` overrides the `id` and `email` fields when impersonation is active. Downstream code (API routes, server components) calls `getUser()` and works without any changes.

### 3. API Endpoints

#### `GET /api/admin/users/search?q=<query>`

- **Auth**: Requires `role === ADMIN` via `getRealUser()` + Prisma lookup
- **Query**: Case-insensitive `contains` search on `fullName` and `email`
- **Response**: `{ users: [{ id, email, fullName, avatarUrl }] }` — max 10 results
- **Purpose**: Populates the impersonation search dropdown

#### `POST /api/admin/impersonate`

- **Auth**: Requires `role === ADMIN` via `getRealUser()` + Prisma lookup
- **Body**: `{ userId: string }` to start impersonation, or `{ userId: null }` to stop
- **Start**: Validates the target `userId` exists in `UserProfile`, then sets the `x-impersonate-uid` cookie
- **Stop**: Clears the `x-impersonate-uid` cookie
- **Response**: `{ ok: true }`
- **Cookie settings**: `httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production, `path: /`

### 4. UI Components

#### Impersonation Banner (`src/components/ImpersonationBanner.tsx`)

A server component rendered in `src/app/layout.tsx` when the `x-impersonate-uid` cookie is present:

- Fixed position at the top of the viewport, above all other content
- Deep Coral (`#E8735A`) background — impossible to miss
- Shows: "Viewing as **{fullName}** ({email})" + "Exit" button
- Exit button calls `POST /api/admin/impersonate` with `{ userId: null }` and reloads the page
- Only renders when impersonation is active (cookie exists and real user is admin)

#### Impersonation Search Dropdown (in admin header)

Added to `src/app/admin/layout.tsx` header:

- Client component with a search input
- Debounced query to `GET /api/admin/users/search?q=...`
- Dropdown results show avatar + name + email
- Clicking a result calls `POST /api/admin/impersonate` with their `userId`, then navigates to `/`
- Only visible to users with `role === ADMIN`

### 5. Admin Layout Protection

Update `src/app/admin/layout.tsx` to verify the real user has `role === ADMIN`:

1. Call `getRealUser()` to get the authenticated user (bypassing impersonation)
2. Look up their `UserProfile` in Prisma
3. If `role !== ADMIN`, redirect to `/`
4. If not authenticated, redirect to `/login` (existing behavior)

### 6. Security

- **Cookie is httpOnly**: Client JS cannot read or tamper with it
- **Cookie is sameSite strict**: Not sent on cross-origin requests
- **Cookie is secure in production**: Only sent over HTTPS
- **Server-side validation**: Every request that honors the impersonation cookie re-validates that the real user (from Supabase auth) has `role === ADMIN`. Even if someone manually sets the cookie, it does nothing without a valid admin session.
- **Admin role is database-driven**: No env var shortcuts — the role must be set in the database

### 7. Out of Scope

- **Audit logging**: Logging who impersonated whom and when (future enhancement)
- **Read-only mode**: Restricting mutations during impersonation
- **Admin user management UI**: Promoting/demoting users via UI (use database directly for now)
- **Granular permissions**: Fine-grained RBAC beyond admin/user

## File Changes Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `UserRole` enum and `role` field to `UserProfile` |
| `prisma/migrations/...` | New migration for `role` column |
| `src/lib/supabase/server.ts` | Add impersonation logic to `getUser()`, add `getRealUser()` |
| `src/app/api/admin/users/search/route.ts` | New — user search endpoint |
| `src/app/api/admin/impersonate/route.ts` | New — start/stop impersonation endpoint |
| `src/components/ImpersonationBanner.tsx` | New — impersonation indicator banner |
| `src/app/layout.tsx` | Render `ImpersonationBanner` |
| `src/app/admin/layout.tsx` | Add role check + impersonation search dropdown |
