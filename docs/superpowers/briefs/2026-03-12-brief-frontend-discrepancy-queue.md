# Teammate Brief: Frontend Discrepancy Queue

**Date:** 2026-03-12
**Workstream:** Unmatched Opportunities Resolution UI
**Spec Reference:** `Docs/superpowers/specs/2026-03-12-opportunity-scheduler-design.md` — see "Unmatched Opportunity Resolution UI" section

> **For Claude:** REQUIRED SKILL: Invoke `/frontend-design` before writing any UI code. This ensures Fullmind brand compliance, reads `Documentation/UI Framework/` specs, and follows project design patterns.

---

## What You're Building

An admin-style page where team members can resolve opportunities that couldn't be automatically matched to a district. When the scheduler syncs opportunity data from OpenSearch, some opportunities lack a valid NCES/LEAID mapping. These land in the `unmatched_opportunities` table. Your UI lets users manually assign them to the correct district.

## Context

- **App framework:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **ORM:** Prisma — models are in `prisma/schema.prisma`
- **State:** Zustand for map state, React Query for server state
- **Auth:** Supabase Auth — use `getUser()` from `@/lib/supabase/server` for server-side auth checks
- **Existing admin patterns:** See `src/app/api/admin/users/route.ts` for API route conventions
- **UI framework docs:** `Documentation/UI Framework/` — follow existing component patterns

## Data Model

The `unmatched_opportunities` table (will be created by the scheduler workstream):

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | LMS opportunity ID |
| `name` | TEXT | Opportunity name |
| `stage` | TEXT | Current stage |
| `school_yr` | TEXT | e.g. "2025-26" |
| `account_name` | TEXT | The account name from LMS |
| `account_lms_id` | TEXT | Account ID we tried to match |
| `account_type` | TEXT | district/school |
| `state` | TEXT | State abbreviation |
| `net_booking_amount` | DECIMAL(15,2) | For prioritizing resolution |
| `reason` | TEXT | Why it couldn't be matched |
| `resolved` | BOOLEAN | Default false |
| `resolved_district_leaid` | TEXT | FK to `districts.leaid` when resolved |
| `synced_at` | TIMESTAMPTZ | Last sync timestamp |

**Prisma model name:** `UnmatchedOpportunity` (mapped to `unmatched_opportunities`)

## Requirements

### Page: `/admin/unmatched-opportunities` (or similar)

1. **Table view** of unmatched opportunities, sorted by `net_booking_amount` DESC (highest value first)
2. **Columns to show:** Name, Account Name, State, School Year, Stage, Net Booking Amount, Reason, Status (resolved/unresolved)
3. **Filter controls:** Filter by resolved/unresolved, school year, state
4. **Resolution flow per row:**
   - A search/select widget to pick a district from the `districts` table
   - Search should match on district name, LEAID, state
   - On selection: `PATCH` or `PUT` to set `resolved = true` and `resolved_district_leaid = <selected district leaid>`
   - Next scheduler sync cycle automatically picks up the resolution
5. **Currency formatting:** No decimal points (Math.round) — this is a project-wide preference
6. **Auth required:** Only authenticated users should access this page

### API Routes Needed

1. `GET /api/admin/unmatched-opportunities` — list with filtering/sorting
2. `PATCH /api/admin/unmatched-opportunities/[id]` — resolve (set `resolved` + `resolved_district_leaid`)
3. `GET /api/admin/districts/search?q=...` — search districts for the resolution picker (may already exist or be adaptable from existing district search)

### Design Notes

- **Invoke `/frontend-design` first** — it will read `Documentation/UI Framework/tokens.md`, component foundations, and existing patterns before you write any code
- This is an internal admin tool, not customer-facing — prioritize clarity and function over polish, but still follow Fullmind brand tokens (Plus Jakarta Sans, plum/coral/mint palette)
- Consider a DataGrid/table component if one exists in the UI framework (check `Documentation/UI Framework/Components/`)
- Batch resolution (select multiple, assign to same district) would be nice but not required for v1
- Show a count badge or summary of unresolved items

## Files to Reference

- `prisma/schema.prisma` — data models, especially `District` and `UnmatchedOpportunity`
- `src/app/api/admin/users/route.ts` — API route pattern
- `src/lib/supabase/server.ts` — auth helpers
- `Documentation/UI Framework/` — component specs and patterns
- `src/components/map-v2/explore/ExploreTable.tsx` — example of a data table with inline editing (similar UX)

## Out of Scope

- The scheduler itself (separate workstream)
- The `opportunities` table UI (future work)
- Modifying RLS policies (handled in scheduler workstream)
