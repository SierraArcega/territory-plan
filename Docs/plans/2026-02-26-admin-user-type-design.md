# Admin User Type — Design Document

**Date:** 2026-02-26
**Status:** Approved

## Overview

Add a three-tier role system (Admin, Manager, Rep) to the territory planning application. Admins can set team-wide goals, manage users, bulk-assign territory ownership, and override any ownership. Managers can set goals for and edit plans of their direct reports. Reps retain self-service ownership and plan creation.

## Data Model Changes

### UserProfile Additions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `role` | Enum: `admin`, `manager`, `rep` | `rep` | User's permission tier |
| `managerId` | UUID (nullable, self-ref FK) | `null` | Which manager this user reports to |
| `isActive` | Boolean | `true` | Soft-delete flag for deactivation |

### New Model: TeamGoal

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `fiscalYear` | Int (unique) | e.g., 2025, 2026, 2027 |
| `earningsTarget` | Decimal | Overall revenue target |
| `renewalTarget` | Decimal | Renewal revenue target |
| `winbackTarget` | Decimal | Winback revenue target |
| `expansionTarget` | Decimal | Expansion revenue target |
| `newBusinessTarget` | Decimal | New business revenue target |
| `takeTarget` | Decimal | Sessions/take target |
| `newDistrictsTarget` | Int | New district acquisition target |
| `createdById` | UUID (FK → UserProfile) | Admin who created it |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

Team goals are independent aggregates. Individual UserGoals remain independent — the UI compares the sum of individual goals/actuals against the team target.

## Permission Matrix

| Capability | Rep | Manager | Admin |
|---|---|---|---|
| Create own territory plans | Yes | Yes | Yes |
| Edit own plans/goals | Yes | Yes | Yes |
| Self-assign ownership of territories/states/districts | Yes | Yes | Yes |
| View all territory plans | Yes | Yes | Yes |
| Edit their reps' plans | No | Yes | Yes |
| Set goals for their reps | No | Yes | Yes |
| Reassign ownership within their team | No | Yes | Yes |
| Set team-wide goals | No | No | Yes |
| Bulk assign territory ownership | No | No | Yes |
| Override any ownership | No | No | Yes |
| Create/edit/deactivate users | No | No | Yes |
| Assign roles | No | No | Yes |
| Assign managers to users | No | No | Yes |
| Invite new users | No | No | Yes |

"Their reps" = users where `managerId` equals the current manager's user ID.

## API Design

### New Endpoints (all under `/api/admin/`, require admin role)

- `GET /api/admin/users` — List all users with roles (extend existing)
- `PUT /api/admin/users/[id]` — Update role, managerId, isActive
- `POST /api/admin/users/invite` — Invite user via email
- `GET /api/admin/team-goals` — List team goals
- `POST /api/admin/team-goals` — Create/upsert team goal by fiscal year
- `PUT /api/admin/team-goals/[fiscalYear]` — Update team goal
- `POST /api/admin/bulk-assign` — Bulk assign ownership of districts/states to a user

### Modified Endpoints

- `PUT /api/territory-plans/[id]` — Allow managers to edit their reps' plans; admins can edit any plan
- `POST /api/profile/goals` — Allow managers to set goals for their reps; admins can set goals for anyone

### Authorization Middleware

`withRole(roles: Role[])` helper wraps API route handlers. Checks the user's role from UserProfile at request time (not JWT) so role changes are immediate.

## Admin Page UI

Dedicated `/admin` route with three tabs:

### Users Tab
Table of all users: name, email, role (inline dropdown), manager (inline dropdown), status (active/deactivated), last login. Actions: invite user, deactivate/reactivate, change role, assign manager.

### Team Goals Tab
Form to set team-wide targets by fiscal year. Displays the team goal alongside auto-calculated sum of individual rep goals and actuals for comparison.

### Territory Assignment Tab
Bulk assignment interface. Select states or districts, assign ownership to a user. Shows current ownership with override capability.

### Access Control
Non-admin users navigating to `/admin` are redirected to home.

## Technical Approach

- **Role storage:** `role` enum field on `UserProfile` (Prisma enum)
- **Manager hierarchy:** `managerId` self-referential FK on `UserProfile`
- **Enforcement:** API-level middleware (`withRole`), not JWT claims
- **Migration:** Add fields with defaults so existing users become `rep` role
- **First admin:** Set via direct DB update or seed script
