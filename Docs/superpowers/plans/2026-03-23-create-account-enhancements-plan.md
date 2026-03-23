# Implementation Plan: Create Account Enhancements

## Task 1: Create `CreateAccountForm` component (frontend)

Replace `CreateDistrictForm` with a new `CreateAccountForm` that:
1. Account type dropdown (from `ACCOUNT_TYPES`)
2. Conditional fields based on type:
   - District: NCES LEAID input (7-digit, numeric only)
   - Non-district: "ID will be auto-generated" info text
3. Account name input (pre-filled from opportunity.accountName)
4. Address search input with Nominatim type-ahead
5. State dropdown + City input (auto-filled from address selection)
6. Form validation: type required, name required, state required, LEAID required for districts
7. Submit: districts → `POST /api/admin/districts`, non-districts → `POST /api/accounts`

**Files:** `src/app/admin/unmatched-opportunities/page.tsx`

## Task 2: Add `createAccount` API helper (frontend)

Add a client-side function that calls `POST /api/accounts` with:
- name, accountType, city, state, street, zip
- Optional lat/lng for pre-geocoded addresses

**Files:** `src/app/admin/unmatched-opportunities/page.tsx`

## Task 3: Update `DistrictSearchModal` text (frontend)

- Modal title: "Create New District" → "Create New Account" (when showCreate is true)
- Bottom link: "Create new district" → "Create new account"
- Wire `CreateAccountForm` in place of `CreateDistrictForm`

**Files:** `src/app/admin/unmatched-opportunities/page.tsx`

## Task 4: Enhance `/api/accounts` to accept optional lat/lng (backend)

Add optional `lat`/`lng` body params. If provided, skip Nominatim geocoding and use them directly for `point_location`.

**Files:** `src/app/api/accounts/route.ts`

## Dependencies

- Tasks 1-3 are in the same file, implement together
- Task 4 is independent (backend)
