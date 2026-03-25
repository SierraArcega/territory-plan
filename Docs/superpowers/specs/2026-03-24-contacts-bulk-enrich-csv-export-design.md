# Contacts Bulk Enrichment & CSV Export

**Date:** 2026-03-24
**Branch:** `feature/contacts-bulk-enrich-csv-export`
**Status:** Approved

## Overview

Add a path for end users to bulk-enrich superintendent (or other role) contacts for all districts in a territory plan via Clay, then export a full CSV. The feature adds an action bar to the Contacts tab with "Find Contacts" and "Export CSV" buttons.

## 1. Bulk Enrichment API

### `POST /api/territory-plans/[id]/contacts/bulk-enrich`

**Request body:**
```json
{ "targetRole": "Superintendent" }
```

**Behavior:**
1. Fetch all district LEAIDs for the plan
2. Filter out districts that already have any contacts (skip already-enriched districts)
3. Batch remaining districts in chunks of 10, fired sequentially with a 1-second delay between batches (to respect Clay rate limits). Within each batch, all 10 requests fire in parallel via `Promise.all`. If an individual request fails, log the error and continue — partial enrichment is acceptable.
4. Return immediately with response:

```json
{ "total": 401, "skipped": 12, "queued": 389 }
```

**Clay payload per district** (extends existing `clay-lookup` pattern):
```json
{
  "leaid": "3000001",
  "district_name": "Absarokee Elementary School District",
  "state": "MT",
  "city": "Absarokee",
  "target_role": "Superintendent",
  "callback_url": "https://plan.fullmindlearning.com/api/webhooks/clay"
}
```

The `target_role` field is sent as a hint to Clay's enrichment table. Clay may return multiple contacts per district — all are saved. The role selector controls what we send as a hint and how we determine the primary contact for CSV export.

No changes to the existing `/api/webhooks/clay` endpoint — it already creates Contact records.

**Concurrency guard:** Before firing batches, store `enrichmentStartedAt` and `enrichmentQueued` on the `TerritoryPlan` record (two new nullable columns). If a subsequent request arrives and `enrichmentStartedAt` is within the last 10 minutes and `enriched < enrichmentQueued`, return `409 Conflict` with `{ error: "Enrichment already in progress", enriched: N, queued: M }`. These columns are cleared when enrichment completes (enriched >= queued) or after the 10-minute window expires.

### `GET /api/territory-plans/[id]/contacts/enrich-progress`

Returns enrichment progress:

```json
{ "total": 401, "enriched": 124, "queued": 389 }
```

- `total` — all districts in the plan
- `queued` — districts that were sent to Clay (stored on the plan record as `enrichmentQueued`)
- `enriched` — districts from the queued set that now have at least one contact (excludes pre-existing/skipped districts)

Frontend compares `enriched` to `queued` to determine completion.

## 2. Role Selector

The "Find Contacts" popover presents a **role dropdown** with common school district leadership titles:

```typescript
const TARGET_ROLES = [
  "Superintendent",
  "Assistant Superintendent",
  "Chief Technology Officer",
  "Chief Financial Officer",
  "Curriculum Director",
  "Special Education Director",
  "HR Director",
] as const;
```

This is a **new constant** defined in `contact-types.ts`, separate from the existing `PERSONAS` list (which is department-based, not title-based). Default selection: "Superintendent".

The selected role is sent to Clay as `target_role` — a hint for Clay's enrichment logic. It does NOT filter contacts on our side; Clay returns all contacts it finds, and all are saved to the database.

## 3. Action Bar UI

A new action bar at the top of the Contacts tab, above the "CONTACTS BY DISTRICT" header.

### Find Contacts Button
- Opens a small popover with:
  - Role dropdown defaulting to "Superintendent", populated from `TARGET_ROLES`
  - "Start" button to kick off enrichment
- Lucide `Search` icon
- Disabled while enrichment is in progress (polling active)

### Export CSV Button
- Exports all plan contacts immediately (no row selection required)
- Lucide `Download` icon
- This is a **new top-level export** separate from the existing selection-based export in the bulk action bar. Both coexist: the action bar export covers all plan districts, the selection-based export covers manually selected contacts.

Both buttons use Fullmind brand styling (tokens from `Documentation/UI Framework/tokens.md`).

## 4. Enrichment Progress UX

**Flow:**
1. User clicks "Find Contacts", picks a role, clicks "Start"
2. Toast notification: "Contact enrichment started for N districts"
3. Action bar shows inline progress indicator: "Enriching contacts... 124/389" with subtle progress bar
4. TanStack Query polls `enrich-progress` endpoint every 5 seconds
5. `usePlanContacts` refetches on the same 5-second interval so the table populates in real-time
6. When `enriched >= queued`, progress indicator disappears, toast: "Contact enrichment complete — N contacts found"
7. Polling stops automatically

**Error/timeout handling:**
- If `POST /bulk-enrich` fails, show error toast: "Failed to start contact enrichment" with the error message
- If `POST /bulk-enrich` returns 409, show info toast: "Enrichment already in progress"
- If no progress change after 2 minutes of polling, show warning toast: "Enrichment may be stalled — some districts may not have results" and stop polling
- "Find Contacts" button stays disabled while polling is active to prevent duplicate requests

Progress state is derived from the database (districts with contacts vs total), not client state. User can navigate away and return — progress persists.

## 5. CSV Export

### Export CSV Button Behavior
- Exports all contacts for all plan districts (not just selected rows)
- One row per primary contact per district (`isPrimary = true`); if no primary contact exists, uses the first contact alphabetically
- Districts with no contacts included as rows with empty contact fields (full district list as a working template)
- File named: `{plan-name}-contacts-{date}.csv`
- This is a different export format from the existing selection-based CSV (which is one row per selected contact). Both exports coexist.

### CSV Columns
| Column | Source |
|--------|--------|
| District Name | district name from plan districts |
| Contact Name | `contact.name` |
| Title | `contact.title` |
| Email | `contact.email` |
| Phone | `contact.phone` |
| Department | `contact.persona` |
| Seniority Level | `contact.seniorityLevel` |

Uses the existing Blob/download pattern from `ContactsTable.tsx`.

## 6. Data Flow

```
User clicks "Find Contacts" → role selector popover
  → POST /bulk-enrich { targetRole } → batched Clay webhooks fire
  → Clay processes → POSTs back to /webhooks/clay → Contact records created
  → Frontend polls enrich-progress → updates progress bar
  → Frontend polls usePlanContacts → table populates live
  → User clicks "Export CSV" → client-side CSV generation → download
```

## 7. Key Files

### New Files
- `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` — bulk enrichment endpoint
- `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts` — progress endpoint

### Modified Files
- `src/features/plans/components/ContactsTable.tsx` — add action bar, progress indicator, new full-plan export
- `src/features/plans/lib/queries.ts` — new hooks: `useBulkEnrich`, `useEnrichProgress` (co-located with existing `usePlanContacts`)
- `src/features/shared/types/contact-types.ts` — add `TARGET_ROLES` constant

### Existing Files (no changes needed)
- `src/app/api/contacts/clay-lookup/route.ts` — existing Clay lookup logic (referenced for batch implementation)
- `src/app/api/webhooks/clay/route.ts` — existing webhook handler creates Contact records

## 8. Decisions

- **`TARGET_ROLES` vs `PERSONAS`** — new title-based constant because PERSONAS is department-based; "Superintendent" is a title, not a department
- **Role as Clay hint, not our filter** — Clay returns all contacts it finds; role is a hint to prioritize the search. All contacts are saved, giving the user a richer dataset
- **Skip districts with any contacts** — simpler than role-specific filtering; avoids duplicate Clay calls
- **Polling over SSE** — simpler, uses existing TanStack Query patterns, approximate progress is sufficient
- **Two CSV exports coexist** — top-level export (all districts, primary contact per district) and selection-based export (selected contacts) serve different use cases
- **Include empty districts in CSV** — user gets full district list as a working template
- **Client-side CSV generation** — existing pattern, no server-side CSV dependency needed
- **2-minute stall timeout** — prevents indefinite polling if Clay doesn't respond for some districts
- **Concurrency guard via plan columns** — `enrichmentStartedAt` and `enrichmentQueued` on `TerritoryPlan` model; lightweight, no new tables needed
- **Sequential batches with 1s delay** — respects Clay rate limits; parallel within batch for speed
- **Partial failure tolerance** — individual Clay request failures are logged but don't abort the batch
