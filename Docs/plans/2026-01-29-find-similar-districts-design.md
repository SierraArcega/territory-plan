# Find Similar Districts - Design Document

**Date:** 2026-01-29
**Status:** Ready for implementation

## Overview

A feature that helps sales reps discover districts in the same state with similar characteristics to the one they're currently viewing. Reps can select up to 3 metrics, choose a similarity tolerance, and see matching districts highlighted on the map with the ability to add them to territory plans.

## User Flow

1. Rep is viewing a district in the SidePanel (e.g., "Springfield School District" in Illinois)
2. Rep clicks "Find Similar Districts" to expand the section
3. Rep selects 1-3 metric chips from available options
4. Rep chooses similarity level: "Very Similar" | "Somewhat Similar" | "Broadly Similar"
5. Rep clicks "Search"
6. Results appear:
   - Up to 10 similar districts shown as info cards (sorted by closest match)
   - Those districts get highlighted on the map
7. Rep can:
   - Click any result card to navigate to that district
   - Click "+" on a card to add that district to a plan
   - Click "Add All to Plan" to bulk-add all results
8. "Clear Results" dismisses the highlights and list

## UI Components

### Find Similar Districts Section
- Location: New collapsible section in SidePanel, placed after DistrictInfo
- Initial state: Collapsed, showing header with expand chevron
- Styled consistently with other collapsible sections

### Metric Chips
8 chips in a flex-wrap grid:
- Enrollment
- Locale (Urban/Suburban/Rural)
- Median Income
- Expenditure/Pupil
- Avg Salary
- ELL %
- SWD % (Students with Disabilities)
- POC Rate

States:
- Unselected: Light gray background, dark text
- Selected: Purple background (#403770), white text
- Disabled: Grayed out when metric data is null for current district, or when 3 metrics already selected

### Similarity Presets
Three toggle buttons in a row:
- "Very Similar" → ±15% (±1 for locale)
- "Somewhat Similar" → ±30% (±1 for locale) - default
- "Broadly Similar" → ±50% (±2 for locale)

### Search Button
- Disabled until at least 1 metric selected
- Primary button style

### Results Section
- Header: "X similar districts found" + "Add All to Plan" button
- Cards showing:
  - District name
  - State abbreviation
  - The 1-3 metric values that matched
  - Small "+" button to add to plan
  - Indicator if already in a plan
- Clicking card navigates to that district

## API Design

### Endpoint
```
GET /api/districts/similar
```

### Query Parameters
| Param | Type | Description |
|-------|------|-------------|
| leaid | string | Source district LEAID |
| metrics | string | Comma-separated metric keys |
| tolerance | string | `tight`, `medium`, or `loose` |
| limit | number | Max results (default 10) |

### Response
```typescript
interface SimilarDistrictResult {
  leaid: string;
  name: string;
  stateAbbrev: string;
  distanceScore: number; // Lower = more similar
  metrics: {
    [key: string]: {
      value: number | string;
      sourceValue: number | string;
    };
  };
  territoryPlanIds: string[];
}
```

### Similarity Calculation
1. Fetch source district's values for selected metrics
2. Query districts in same state where each metric falls within tolerance range
3. Calculate distance score: sum of |((candidate - source) / source)| for numeric metrics
4. Sort by distance score ascending
5. Return top N results

### Metric Definitions
| Key | Source | Calculation |
|-----|--------|-------------|
| enrollment | district.enrollment | Direct |
| locale | district.urbanCentricLocale | Exact/±1/±2 match |
| medianIncome | educationData.medianHouseholdIncome | Direct |
| expenditurePerPupil | educationData.expenditurePerPupil | Direct |
| avgSalary | educationData.salariesTotal / staffTotalFte | Computed |
| ellPercent | district.ellStudents / enrollment * 100 | Computed |
| swdPercent | district.specEdStudents / enrollment * 100 | Computed |
| pocRate | (totalEnrollment - enrollmentWhite) / totalEnrollment * 100 | Computed |

## Map Integration

### Highlighting
- Similar districts get orange/coral outline (#F37167)
- Slightly increased opacity fill
- Source district keeps selected styling

### Store Changes
Add to map store:
```typescript
similarDistrictLeaids: string[]
setSimilarDistrictLeaids: (leaids: string[]) => void
clearSimilarDistricts: () => void
```

### Clearing
- "Clear Results" button clears highlights
- Navigating to different district clears highlights
- Selecting from results clears previous search

## Territory Plan Integration

### Bulk Add
- "Add All to Plan" button in results header
- Opens existing plan selector modal
- Adds all result districts to selected plan

### Individual Add
- "+" button on each result card
- Opens plan selector for just that district
- Shows checkmark/indicator after adding

### Visual Feedback
- Cards show indicator if district already in a plan
- Helps rep see which similar districts they've captured

## Files to Create/Modify

### New Files
- `src/components/panel/FindSimilarDistricts.tsx` - Main UI component
- `src/app/api/districts/similar/route.ts` - API endpoint

### Modified Files
- `src/lib/api.ts` - Add `useSimilarDistricts` hook
- `src/lib/store.ts` - Add `similarDistrictLeaids` state
- `src/components/panel/SidePanel.tsx` - Include new component
- `src/components/map/MapContainer.tsx` - Render similar district highlights

## Implementation Phases

### Phase 1: API Endpoint
- Create similarity calculation logic
- Build the `/api/districts/similar` endpoint
- Test with sample queries

### Phase 2: UI Component
- Build FindSimilarDistricts component
- Metric chips with selection logic
- Similarity preset buttons
- Results cards display

### Phase 3: Map Integration
- Add store state for similar districts
- Update map rendering to highlight similar districts
- Wire up clear behavior

### Phase 4: Plan Integration
- Add "+" buttons to result cards
- Add "Add All to Plan" bulk action
- Show plan membership indicators
