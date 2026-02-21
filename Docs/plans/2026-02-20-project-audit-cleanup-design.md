# Project Audit & Cleanup Design

**Date:** 2026-02-20
**Scope:** Components + lib reorganization into feature-based folders

## Motivation

- Tech debt slowing development
- Inconsistent naming makes code hard to reference
- Mixed organizational patterns (type-based vs feature-based) cause confusion
- Preparing codebase to be more approachable and maintainable

## Current State

- ~60K LoC TypeScript, 130+ components, 40+ API routes
- `src/components/` uses type-based organization (15 directories)
- `src/lib/` is a flat grab-bag with mixed naming (camelCase, kebab-case)
- `api.ts` is a 74KB monolith with 50+ React Query hooks
- `map-v2/` already follows feature-based pattern; older code does not
- Dead code: old `map/` (9 files, 1 import), partially replaced `panel/`
- Duplicate components across old and new implementations

## Target Structure

```
src/features/
├── map/
│   ├── components/         # From map-v2/ (57 files)
│   │   ├── explore/
│   │   ├── focus-mode/
│   │   ├── panels/
│   │   └── right-panels/
│   ├── lib/
│   │   ├── store.ts        # Was map-v2-store.ts
│   │   ├── layers.ts       # Was map-v2-layers.ts
│   │   ├── ref.ts          # Was map-v2-ref.ts
│   │   └── geocode.ts
│   ├── hooks/
│   │   ├── use-animated-number.ts
│   │   └── use-is-touch-device.ts
│   └── types.ts
│
├── explore/
│   └── lib/
│       └── filters.ts      # Was explore-filters.ts
│
├── plans/
│   ├── components/         # From plans/ (15 files)
│   ├── lib/
│   │   ├── queries.ts      # Plan hooks extracted from api.ts
│   │   └── rollup-sync.ts  # Was plan-rollup-sync.ts
│   └── types.ts
│
├── tasks/
│   ├── components/         # From tasks/ (7 files)
│   ├── lib/
│   │   └── queries.ts      # Task hooks extracted from api.ts
│   └── types.ts            # Was taskTypes.ts
│
├── activities/
│   ├── components/         # From activities/ (3 files)
│   ├── lib/
│   │   └── queries.ts      # Activity hooks extracted from api.ts
│   └── types.ts            # Was activityTypes.ts + outcomeTypes.ts
│
├── calendar/
│   ├── components/         # From calendar/ (5 files)
│   └── lib/
│       ├── queries.ts
│       ├── sync.ts         # Was calendar-sync.ts
│       ├── push.ts         # Was calendar-push.ts
│       └── google.ts       # Was google-calendar.ts
│
├── goals/
│   ├── components/         # From goals/ (2 files) + user/ (4 files)
│   └── lib/
│       └── queries.ts
│
├── progress/
│   ├── components/         # From progress/ (3 files)
│   └── types.ts
│
├── districts/
│   └── lib/
│       └── queries.ts      # District hooks extracted from api.ts
│
└── shared/
    ├── components/
    │   ├── ViewToggle.tsx
    │   ├── InlineEditCell.tsx
    │   ├── MultiSelectActionBar.tsx
    │   └── layout/         # layout/, navigation/
    ├── lib/
    │   ├── api-client.ts   # Shared fetch helpers from api.ts
    │   ├── date-utils.ts   # Was dateUtils.ts
    │   ├── auto-tags.ts    # Was autoTags.ts
    │   ├── db.ts
    │   ├── prisma.ts
    │   └── supabase/
    └── types/
        ├── contact-types.ts
        └── account-types.ts
```

## Work Classification Convention

| Type | Where it goes | Example |
|------|--------------|---------|
| New Feature | New `src/features/<name>/` folder | "Add reporting" → `features/reports/` |
| Enhancement | Existing feature folder | "Add explore sorting" → `features/map/components/explore/` |
| Bug Fix | The file where the bug lives | "Fix rollup calc" → `features/plans/lib/rollup-sync.ts` |
| Shared utility | `features/shared/` (only when 3+ features need it) | "Currency formatter" → `features/shared/lib/format.ts` |
| API route | `src/app/api/` (unchanged) | stays as-is |

### The 2-Feature Rule

Code starts in its feature folder. It moves to `shared/` only when a **third** feature needs it. This prevents premature abstraction.

### Naming Standards

| What | Convention | Example |
|------|-----------|---------|
| Feature directories | kebab-case | `focus-mode/` |
| Component files | PascalCase | `DistrictCard.tsx` |
| Lib/hook files | kebab-case | `rollup-sync.ts`, `use-animated-number.ts` |
| Type files | kebab-case | `types.ts`, `contact-types.ts` |
| Test files | Same name + `.test` | `DistrictCard.test.tsx` |
| Test directories | `__tests__/` colocated | `components/__tests__/` |

## api.ts Split Strategy

1. Extract hooks into feature-local `queries.ts` files
2. Keep a thin re-export barrel at `src/lib/api.ts` temporarily
3. Gradually update imports to point directly at feature files
4. Delete barrel once all imports are migrated

## Dead Code Removal

| Item | Action |
|------|--------|
| `src/components/map/` (9 files) | Audit imports, remove if confirmed dead |
| `src/lib/store.ts` (old v1 store) | Migrate remaining imports to map-v2 equivalents, remove |

## Duplicate Resolution

| Component | Resolution |
|-----------|-----------|
| `DistrictCard` (plans/ vs map-v2/) | Audit both, rename for clarity if different purposes |
| `DistrictHeader` (panel/ vs map-v2/) | Remove panel/ version if unused |
| `AddToPlanButton` (panel/ vs map-v2/) | Consolidate to one location |
| `ActivityFormModal` (activities/ vs plans/) | Check if one wraps the other, consolidate |
| `FilterBar` (filters/ vs plans/) | Rename plans version to `PlanFilterBar` |

## Out of Scope

- API routes (`src/app/api/`) — already organized by domain
- Prisma schema / migrations
- Scripts directory
- Docs directory
- New test coverage (existing tests move with their components)
- `src/app/` page structure (Next.js routes stay as-is)
