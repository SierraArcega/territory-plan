# Plan Owner, States & Collaborators Design

**Date:** 2026-02-15

**Goal:** Replace the free-text owner field with a proper user reference, support multi-state plan associations, and add collaborators to plans.

## Decisions

- **Owner** becomes a FK to UserProfile (replaces free-text `owner` column)
- **States** are many-to-many via junction table (replaces single `stateFips` column)
- **Collaborators** are registered UserProfile users only, flat list (no roles)

## Database Schema

### New: `TerritoryPlanState` junction table
| Column    | Type       | Notes                         |
|-----------|------------|-------------------------------|
| planId    | UUID (FK)  | → TerritoryPlan.id            |
| stateFips | VARCHAR(2) | → State.fips                  |

Composite PK: `(planId, stateFips)`

### New: `TerritoryPlanCollaborator` junction table
| Column  | Type       | Notes                |
|---------|------------|----------------------|
| planId  | UUID (FK)  | → TerritoryPlan.id   |
| userId  | UUID (FK)  | → UserProfile.id     |
| addedAt | DateTime   | Default: now()       |

Composite PK: `(planId, userId)`

### Modified: `TerritoryPlan`
- **Add** `ownerId` (UUID, FK → UserProfile.id, nullable)
- **Drop** `owner` (VARCHAR 100) — after data migration
- **Drop** `stateFips` (VARCHAR 2) — after data migration into junction table

### Migration strategy
1. Add `ownerId` column, create junction tables
2. Migrate `owner` string → match to UserProfile.fullName → set `ownerId`
3. Migrate existing `stateFips` values into `TerritoryPlanState` rows
4. Drop old `owner` and `stateFips` columns

## API Changes

### Modified endpoints
- `GET /api/territory-plans` — returns `owner: { id, fullName, avatarUrl } | null`, `states: [{ fips, abbrev, name }]`, `collaborators: [{ id, fullName, avatarUrl }]`
- `GET /api/territory-plans/[id]` — same expanded fields
- `POST /api/territory-plans` — accepts `ownerId`, `stateFips: string[]`, `collaboratorIds: string[]`
- `PUT /api/territory-plans/[id]` — accepts `ownerId`, `stateFips: string[]`, `collaboratorIds: string[]`

### New endpoints
- `GET /api/users` — list all UserProfile records (for picker UI)
- `POST /api/territory-plans/[id]/states/[fips]` — add state
- `DELETE /api/territory-plans/[id]/states/[fips]` — remove state
- `POST /api/territory-plans/[id]/collaborators/[userId]` — add collaborator
- `DELETE /api/territory-plans/[id]/collaborators/[userId]` — remove collaborator

## UI Changes

### PlanEditForm (right panel)
- Owner: user picker dropdown (search by name, shows avatar)
- States: multi-select dropdown of US states with checkboxes
- Collaborators: user picker to add, chips with avatar to show/remove

### PlanWorkspace header
- Owner avatar + name next to plan name
- State abbreviation badges in badge row
- Collaborator avatar stack

### PlanFormModal + PlanFormPanel
- Same owner picker, state multi-select, collaborator picker

## TypeScript Types

```typescript
interface PlanOwner {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface PlanState {
  fips: string;
  abbrev: string;
  name: string;
}

interface PlanCollaborator {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

// TerritoryPlan gains:
//   owner: PlanOwner | null (replaces owner: string | null)
//   states: PlanState[]
//   collaborators: PlanCollaborator[]
```
