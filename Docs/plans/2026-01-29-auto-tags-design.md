# Auto-Tags Feature Design

**Date:** 2026-01-29
**Status:** Approved

---

## Overview

Unify all district status indicators into a single auto-tag system. Remove special badge rendering for Customer/Pipeline and replace with automatically managed tags that appear alongside manual tags.

---

## Auto-Tag Definitions (9 Total)

| Tag Name | Color | Condition |
|----------|-------|-----------|
| Customer | Coral (#F37167) | Has FY25/FY26 invoicing or closed won bookings (`isCustomer` = true) |
| Pipeline | Steel Blue (#6EA3BE) | Has open pipeline (`hasOpenPipeline` = true) |
| Prospect | Teal (#38b2ac) | In any territory plan AND `hasOpenPipeline` = false |
| VIP | Purple (#9f7aea) | Current FY revenue > $100,000 (FY26 net invoicing + closed won bookings) |
| Win Back Target | Orange (#ed8936) | Previous FY revenue > $0, current FY = $0 |
| City | Plum (#403770) | Locale code 11-13 |
| Suburb | Green (#48bb78) | Locale code 21-23 |
| Town | Pink (#EC4899) | Locale code 31-33 |
| Rural | Brown (#A16207) | Locale code 41-43 |

---

## Key Decisions

### Storage
- Auto-tags are real `Tag` records in the database
- They appear alongside manual tags in TagsEditor
- No visual distinction between auto and manual tags

### Trigger Points
| Trigger Event | Tags Affected |
|---------------|---------------|
| District added to any territory plan | Prospect |
| District removed from all territory plans | Prospect |
| Fullmind data refresh/import | Customer, Pipeline, Prospect, VIP, Win Back Target |
| First data load / migration | City, Suburb, Town, Rural (one-time only) |

### User Behavior
- Users CAN remove auto-tags manually
- Auto-tags will reappear on next trigger if condition is still true
- No override persistence - tags reflect current data truth

### Removed Features
- Special badge rendering for Customer/Pipeline
- "No Fullmind Data" gray badge indicator

---

## Implementation

### New Files

| File | Purpose |
|------|---------|
| `src/lib/autoTags.ts` | Constants for auto-tag names, colors, conditions. Sync functions. |

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/territory-plans/[id]/districts/route.ts` | Call `syncAutoTagsForDistrict()` after add/remove |
| `src/components/panel/DistrictHeader.tsx` | Remove badge logic, display tags |
| `src/components/map/MapTooltip.tsx` | Remove badge logic, display tags |
| `src/components/plans/DistrictsTable.tsx` | Remove badge column, add tags column |
| `src/lib/api.ts` | Ensure district queries include tags |

### One-Time Setup (Migration)

1. Create the 9 auto-tags in the Tag table if they don't exist
2. Run locale tag assignment for all districts (one-time, static data)
3. Run Customer/Pipeline/VIP/Win Back sync for all districts with Fullmind data
4. Run Prospect sync for all districts currently in territory plans

### Implementation Order

1. Create `autoTags.ts` with constants and sync functions
2. Seed the 9 auto-tags
3. Run initial sync for all districts
4. Update API endpoints to trigger syncs
5. Update UI components to use tags instead of badges

---

## Revenue Calculation Details

- **Current year revenue** = `fy26NetInvoicing` + `fy26ClosedWonBookings`
- **Previous year revenue** = `fy25NetInvoicing` + `fy25ClosedWonBookings`
- **VIP threshold** = $100,000

---

## Locale Code Mapping

| Category | Codes | Description |
|----------|-------|-------------|
| City | 11, 12, 13 | Large, Midsize, Small |
| Suburb | 21, 22, 23 | Large, Midsize, Small |
| Town | 31, 32, 33 | Fringe, Distant, Remote |
| Rural | 41, 42, 43 | Fringe, Distant, Remote |
