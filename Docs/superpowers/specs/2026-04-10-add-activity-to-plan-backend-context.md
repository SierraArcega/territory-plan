# Backend Context: Add Activity to Plan

**Date:** 2026-04-10

## Existing Infrastructure (No backend changes needed)

### Data Model
- `ActivityPlan` join table (`activity_plans`): `activityId` + `planId` composite key
- `TerritoryPlan.activityLinks` → `ActivityPlan[]` relation
- `Activity.plans` → `ActivityPlan[]` relation

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/activities` | GET | List/search activities with filters: `search`, `status`, `ownerId`, `category`, `planId` |
| `POST /api/activities/[id]/plans` | POST | Link plans to activity (accepts `planIds[]`, skips duplicates) |
| `DELETE /api/activities/[id]/plans/[planId]` | DELETE | Unlink a plan from an activity |

### Query Hooks (src/features/activities/lib/queries.ts)
- `useActivities(params)` — list activities with filtering
- `useLinkActivityPlans()` — mutation: `{ activityId, planIds }` → POST
- `useUnlinkActivityPlan()` — mutation: `{ activityId, planId }` → DELETE
- `useUsers()` — list team members (for owner filter) in `src/features/shared/lib/queries.ts`

### Key Types (src/features/shared/types/api-types.ts)
- `ActivityListItem` — list view shape (id, type, category, title, dates, status, source, outcomeType, planCount, districtCount, stateAbbrevs)
- `ActivitiesParams` — query params interface
- `ActivitiesResponse` — `{ activities: ActivityListItem[], total: number }`

### Notes
- `useActivities` currently doesn't forward `search` param — needs adding to the hook
- The `GET /api/activities` route already handles `search` via `title: { contains: search, mode: "insensitive" }`
- The `ownerId` filter defaults to current user; pass `"all"` to see everyone's activities
- `useLinkActivityPlans` links from activity→plans direction, which is what the API expects
