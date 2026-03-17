# DistrictExploreModal Tab Restructure

**Date:** 2026-03-17
**Status:** Approved

## Overview

Restructure the DistrictExploreModal from 4 tabs (overview, financials, contacts, schools) to 7 tabs matching the map filter section categories: **Fullmind → Competitors → Finance → Demographics → Academics → Contacts → Schools**.

## Tab Definitions

### 1. Fullmind

Primary CRM tab showing the Fullmind relationship with this district.

- **Customer/Prospect** badge + sales executive name
- **Pipeline & Revenue by FY** — FY25/FY26/FY27 bookings, invoicing, pipeline, weighted pipeline (from `FullmindData`)
- **Sessions** — FY25/FY26 session counts and revenue
- **Plan Membership** — list plans this district belongs to (cross-reference `territoryPlanIds` from `useDistrictDetail` with `useTerritoryPlans()`, show plan name, color dot, status)
- **Recent Activity** — last 10 activities via `useActivities({ districtLeaid: leaid, limit: 10 })` showing type icon, title, date, status
- **Tags** — district tags

### 2. Competitors

Competitor intelligence from purchasing data.

- Competitor spend by vendor by fiscal year (via `/api/districts/${leaid}/competitor-spend`)
- Total across all competitors
- Empty state: "No competitor data for this district"

### 3. Finance

District financial profile from NCES/Census data.

- Revenue breakdown: total, federal, state, local
- Expenditure: total, per-pupil
- Salary data: total salaries, instruction salaries, by teacher category
- Staff counts: teachers FTE, admin FTE, counselors FTE, support staff FTE
- Poverty: children poverty %, median household income
- Data year label shown per section

### 4. Demographics

Enrollment and population characteristics.

- Enrollment demographics bar (racial/ethnic breakdown — reuse existing component)
- Enrollment total + 3yr trend
- ELL %, SWD %
- Locale type (urban/suburban/rural from `urbanCentricLocale`)
- Grade span, number of schools

### 5. Academics

Performance metrics and trends.

- Graduation rate + 3yr trend + vs-state/national deltas
- Math proficiency + 3yr trend + vs-state/national
- Reading proficiency + 3yr trend + vs-state/national
- Chronic absenteeism rate + 3yr trend + vs-state/national
- Student-teacher ratio + 3yr trend + vs-state/national
- Quartile badges where available (Q1-Q4 within state)

### 6. Contacts

Unchanged from current implementation.

### 7. Schools

Unchanged from current implementation.

## Data Sources

| Tab | Hook / Endpoint | Already fetched? |
|-----|----------------|-----------------|
| Fullmind | `useDistrictDetail` (FullmindData, tags, territoryPlanIds) | Yes |
| Fullmind | `useTerritoryPlans()` | Yes (already in modal) |
| Fullmind | `useActivities({ districtLeaid })` | **New** |
| Competitors | `fetch(/api/districts/${leaid}/competitor-spend)` | **New** |
| Finance | `useDistrictDetail` (DistrictEducationData) | Yes |
| Demographics | `useDistrictDetail` (DistrictEnrollmentDemographics, District, DistrictTrends) | Yes |
| Academics | `useDistrictDetail` (DistrictTrends, DistrictEducationData) | Yes |
| Contacts | `useDistrictDetail` (contacts) | Yes |
| Schools | `useDistrictDetail` (district) | Yes |

## Sidebar

Unchanged — keeps the plum gradient with district name, grade span, school count, key stats (enrollment, $/pupil, graduation, SWD%, ELL%), and external links.

## Implementation Notes

- Replace the `Tab` type union from 4 to 7 values
- Remove old `OverviewTab` and `FinancialsTab` components
- Build 5 new tab components inline in the same file
- Competitor spend uses `useQuery` with the existing endpoint pattern
- Activities fetched only when Fullmind tab is active (or eagerly — TBD based on perf)
- Reuse existing `SectionLabel`, `DataRow` shared atoms
- Reuse demographic bar rendering from old OverviewTab
