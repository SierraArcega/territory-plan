# State Normalization — Spec

## Problem

US state values enter the system in mixed formats — `"PA"`, `"Pennsylvania"`, `"PENNSYLVANIA"` — from Salesforce CRM syncs, user input, and API params. Code that compares or filters on state silently breaks when formats don't match (e.g., suggestions endpoint expected 2-letter abbreviations but received full names).

Currently there are 3 duplicate `US_STATES` arrays and 1 `STATE_NAME_TO_ABBREV` map scattered across files with no shared utility.

## Solution

Single shared module + boundary normalization. Normalize state values where data enters the system so downstream code never sees inconsistent formats.

## Deliverables

### 1. Shared module: `src/lib/states.ts`

```ts
// Canonical 2-letter abbreviation list (includes DC + PR)
export const US_STATES: string[] = [...]

// Full name → abbreviation map (keys are UPPERCASE)
const STATE_NAME_TO_ABBREV: Record<string, string> = { ALABAMA: "AL", ... }

// Reverse map for display
const STATE_ABBREV_TO_NAME: Record<string, string> = { AL: "Alabama", ... }

// Normalize any state input to 2-letter abbreviation.
// Returns the abbreviation if recognized, or null if unrecognizable.
// Handles: "PA", "pa", "Pennsylvania", "PENNSYLVANIA", " pa ", etc.
export function normalizeState(raw: string): string | null

// Type guard
export function isValidState(raw: string): boolean

// Display helper (optional, for UI labels)
export function stateDisplayName(abbrev: string): string
```

`normalizeState` should:
- Trim and uppercase the input
- Return as-is if it's a valid 2-letter abbreviation
- Look up full names in `STATE_NAME_TO_ABBREV`
- Return `null` for unrecognized values (don't throw)

### 2. Deduplicate `US_STATES` arrays

Replace the 3 duplicate arrays with imports from `src/lib/states.ts`:

- `src/app/admin/unmatched-opportunities/page.tsx` (line ~282)
- `src/app/admin/unmatched-opportunities/columns.ts` (line ~6)
- `src/features/map/components/panels/AccountForm.tsx` (line ~9)

### 3. Remove duplicate map from suggestions route

Replace the inline `STATE_NAME_TO_ABBREV` and `normalizeState` in `src/app/api/admin/districts/suggestions/route.ts` with an import from `src/lib/states.ts`.

### 4. Normalize at API boundaries

In these API routes, normalize the `state` query param immediately after reading it from `searchParams`. Pattern:

```ts
import { normalizeState } from "@/lib/states";
// ...
const rawState = searchParams.get("state");
const state = rawState ? normalizeState(rawState) : null;
```

Apply to these files (only the state param handling — don't change other logic):

- `src/app/api/admin/unmatched-opportunities/route.ts`
- `src/app/api/districts/route.ts`
- `src/app/api/districts/nces-lookup/route.ts`
- `src/app/api/schools/route.ts`
- `src/app/api/accounts/route.ts`
- `src/app/api/tiles/[z]/[x]/[y]/route.ts`

Do NOT touch `src/app/api/calendar/callback/route.ts` — that `state` param is an OAuth state token, not a US state.

### 5. Normalize at scheduler sync boundary

In `scheduler/sync/compute.py` and `scheduler/run_sync.py`, the `state` field from Salesforce is passed through raw. Since the scheduler is Python, add a small helper there too:

Create `scheduler/sync/normalize.py`:
```python
# Same STATE_NAME_TO_ABBREV map as the TS version
def normalize_state(raw: str | None) -> str | None:
    """Normalize a US state to 2-letter abbreviation. Returns None if unrecognizable."""
```

Apply it in:
- `scheduler/sync/compute.py` line ~113 where `"state": opp.get("state")` is set
- `scheduler/run_sync.py` line ~121 where `"state": opp.get("state")` is set

## What NOT to change

- Database schema — no migrations needed; values are text fields
- Internal component code that reads `stateAbbrev` from the DB — if boundaries are clean, these are already normalized
- Any `stateAbbrev` fields on the District model — those come from NCES data which is already 2-letter abbreviations
- The `state` param in `src/app/api/calendar/callback/route.ts` (OAuth, not US state)

## Testing

- Add a small test file `src/lib/__tests__/states.test.ts` covering:
  - `normalizeState("PA")` → `"PA"`
  - `normalizeState("pennsylvania")` → `"PA"`
  - `normalizeState("PENNSYLVANIA")` → `"PA"`
  - `normalizeState(" pa ")` → `"PA"` (whitespace trimming)
  - `normalizeState("gibberish")` → `null`
  - `normalizeState("")` → `null`
  - `isValidState("PA")` → `true`
  - `isValidState("XX")` → `false`

## Verification

After implementation:
1. `npx tsc --noEmit` — no new type errors
2. `npx vitest run src/lib/__tests__/states.test.ts` — tests pass
3. `grep -r "US_STATES" src/` — should only appear in `src/lib/states.ts` and its imports
4. The inline `STATE_NAME_TO_ABBREV` in suggestions route is gone
