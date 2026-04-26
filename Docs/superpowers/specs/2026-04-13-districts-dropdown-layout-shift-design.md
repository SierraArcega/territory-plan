# Districts Dropdown Layout Shift Fix

**Date:** 2026-04-13
**Branch:** fix/districts-dropdown-flash

## Problem

When opening the Districts filter dropdown, the Sales Executive and Tags sections pop in ~100-200ms after the dropdown renders, causing a visible layout shift. This happens because the data is fetched inside `DistrictsDropdown` via `useEffect`, and the sections are conditionally rendered with `{owners.length > 0 && ...}`.

## Solution: Pre-fetch at SearchBar Level

Move the `/api/sales-executives` and `/api/tags` fetch calls up to the SearchBar component so data is ready before the dropdown opens. Always render the Sales Executive and Tags sections regardless of data state.

### Changes

**SearchBar/index.tsx:**
- Add `useEffect` with fetch calls for `/api/sales-executives` and `/api/tags`
- Store results in local state (`owners`, `tags`)
- Pass as props to `DistrictsDropdown`

**DistrictsDropdown.tsx:**
- Accept `owners` and `tags` as props
- Remove internal `useEffect` fetch calls and local state for owners/tags
- Remove `{owners.length > 0 && ...}` conditional — always render FilterMultiSelect for Sales Executive
- Remove `{tags.length > 0 && ...}` conditional — always render FilterMultiSelect for Tags

### Scope

Two files. No changes to FilterMultiSelect, FullmindContent, store, or filter logic.

### Edge case

Empty API response → FilterMultiSelect renders with empty options list showing "No matches." Preferred over hiding the section.
