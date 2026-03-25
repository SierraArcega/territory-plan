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
{ "role": "Superintendent" }
```

**Behavior:**
1. Fetch all district LEAIDs for the plan
2. Filter out districts that already have a contact matching the requested role
3. Batch remaining districts in chunks of 10 and fire Clay webhook lookups with the role parameter
4. Return immediately with response:

```json
{ "total": 401, "skipped": 12, "queued": 389 }
```

No changes to the existing `/api/webhooks/clay` endpoint — it already creates Contact records.

### `GET /api/territory-plans/[id]/contacts/enrich-progress`

Returns enrichment progress by counting districts with a contact matching the target role:

```json
{ "total": 401, "enriched": 124, "role": "Superintendent" }
```

## 2. Action Bar UI

A new action bar at the top of the Contacts tab, above the "CONTACTS BY DISTRICT" header.

### Find Contacts Button
- Opens a small popover with:
  - Role dropdown defaulting to "Superintendent", populated from the existing PERSONAS list
  - "Start" button to kick off enrichment
- Lucide `Search` icon

### Export CSV Button
- Exports all plan contacts immediately (no row selection required)
- Lucide `Download` icon

Both buttons use Fullmind brand styling (tokens from `Documentation/UI Framework/tokens.md`).

## 3. Enrichment Progress UX

**Flow:**
1. User clicks "Find Contacts", picks a role, clicks "Start"
2. Toast notification: "Contact enrichment started for N districts"
3. Action bar shows inline progress indicator: "Enriching contacts... 124/389" with subtle progress bar
4. TanStack Query polls `enrich-progress` endpoint every 5 seconds
5. `usePlanContacts` refetches on the same 5-second interval so the table populates in real-time
6. When enriched === queued, progress indicator disappears, toast: "Contact enrichment complete — N contacts found"
7. Polling stops automatically

Progress state is derived from the database (districts with contacts vs total), not client state. User can navigate away and return — progress persists.

## 4. CSV Export

### Export CSV Button Behavior
- Exports all contacts for all plan districts (not just selected rows)
- One row per primary contact per district (defaults to contact matching the enrichment role)
- Districts with no contacts included as rows with empty contact fields
- File named: `{plan-name}-contacts-{date}.csv`

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

## 5. Data Flow

```
User clicks "Find Contacts" → role selector popover
  → POST /bulk-enrich → batched Clay webhooks fire
  → Clay processes → POSTs back to /webhooks/clay → Contact records created
  → Frontend polls enrich-progress → updates progress bar
  → Frontend polls usePlanContacts → table populates live
  → User clicks "Export CSV" → client-side CSV generation → download
```

## 6. Key Files

### New Files
- `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` — bulk enrichment endpoint
- `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts` — progress endpoint

### Modified Files
- `src/features/plans/components/ContactsTable.tsx` — add action bar, progress indicator, updated export
- `src/features/shared/lib/queries.ts` — new hooks: `useBulkEnrich`, `useEnrichProgress`

### Existing Files (no changes needed)
- `src/app/api/contacts/clay-lookup/route.ts` — existing Clay lookup logic (referenced for batch implementation)
- `src/app/api/webhooks/clay/route.ts` — existing webhook handler creates Contact records
- `src/features/shared/types/contact-types.ts` — PERSONAS list for role dropdown

## 7. Decisions

- **Role selector over full config** — keep it simple, pick the role and go
- **Polling over SSE** — simpler, uses existing TanStack Query patterns, approximate progress is sufficient
- **Skip already-enriched districts** — avoid duplicate contacts, reduce Clay API calls
- **Include empty districts in CSV** — user gets full district list as a working template
- **Client-side CSV generation** — existing pattern, no server-side CSV dependency needed
