# Multi-Select Mode & Add-to-Plan

## Overview

Add a dedicated multi-select mode toggle to the MapV2 map so users can click to select multiple districts without holding Shift, then add them to a new or existing territory plan via a dropdown.

## Components

### 1. SelectModePill (new)

- Floating button in bottom-right, next to LayerBubble
- Icon + "Select" label, pill-shaped like the collapsed LayerBubble
- Toggles `multiSelectMode` on/off
- Active state: plum highlight, map cursor changes to pointer
- Inactive state: muted/default styling

### 2. MultiSelectChip (existing, enhanced)

- Already appears at bottom-center when `selectedLeaids.size > 0`
- Replace "Create Plan" button with "Add to Plan" dropdown:
  - List of existing territory plans (name + district count)
  - Divider
  - "+ Create New Plan" option
- Selecting an existing plan: bulk-add districts via API, show success toast, clear selection
- Selecting "Create New Plan": enter existing `PLAN_NEW` flow with pre-populated districts

### 3. Bulk Add API Route (new)

- `POST /api/territory-plans/[planId]/districts`
- Body: `{ leaids: string[] }`
- Creates `TerritoryPlanDistrict` rows for each leaid
- Skips duplicates (districts already in the plan)
- Returns count of added districts

## Store Changes (`map-v2-store.ts`)

- Add `multiSelectMode: boolean` (default `false`)
- Add `toggleMultiSelectMode()` action: flips mode, clears `selectedLeaids` when turning off

## Click Handler Changes (`MapV2Container`)

- When `multiSelectMode === true` and a district is clicked:
  - Call `toggleDistrictSelection(leaid)` instead of `selectDistrict(leaid)`
  - Skip zoom-to-bounds and panel switch to district detail
- Shift+Click continues to work as before regardless of mode

## What Does NOT Change

- Prisma schema (TerritoryPlanDistrict already exists)
- Tile server
- LayerBubble / Build View
- FloatingPanel navigation
- Existing Shift+Click multi-select behavior
