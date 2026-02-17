# V2 Map: District Details Tabbed View

## Summary

Replace the simplified `DistrictDetailPanel` in the v2 map with the full 3-tab district details view from v1. Components are copied into the v2 directory (not shared) so they can evolve independently.

## Motivation

The v1 district details panel has a rich, proven UX with Fullmind CRM data, demographic charts, finance breakdowns, staffing analysis, contact management, and Clay integration. The current v2 panel only shows a basic metrics grid with expandable text sections. Users want the full experience in v2.

## Design Decisions

- **All 3 tabs, full fidelity**: District Info, Data + Demographics, Contacts
- **Shown everywhere**: map click, search result, plan district click (not just from plans)
- **Copy and adapt**: components copied to `map-v2/panels/district/` to evolve independently of v1
- **Direct tab replacement**: replaces current `DistrictDetailPanel` with tabbed version in same panel slot

## File Structure

```
src/components/map-v2/panels/district/
├── DistrictDetailPanel.tsx      # Main container (replaces current file)
├── DistrictHeader.tsx           # Name, state, badge, back button
├── DistrictInfoTab.tsx          # Tab 1: Fullmind, competitor, charters, tags, notes
├── DataDemographicsTab.tsx      # Tab 2: charts, populations, academics, finance, staffing
├── ContactsTab.tsx              # Tab 3: CRUD contacts, Clay integration
├── FullmindMetrics.tsx          # FY revenue cards
├── CompetitorSpend.tsx          # Competitor data
├── CharterSchools.tsx           # Charter schools list with sparklines
├── DemographicsChart.tsx        # Donut chart (Recharts)
├── StudentPopulations.tsx       # ELL, SPED, absenteeism cards
├── AcademicMetrics.tsx          # Graduation rates
├── FinanceData.tsx              # Revenue donut, per-pupil, poverty
├── StaffingSalaries.tsx         # FTE breakdown, salary distribution
├── TagsEditor.tsx               # Tag management
├── NotesEditor.tsx              # Notes
└── AddToPlanButton.tsx          # Plan integration
```

## Component Architecture

### DistrictDetailPanel (main container)

- Back button + "District" breadcrumb (existing v2 pattern)
- `DistrictHeader`: district name, state/county, customer category badge
- Tab bar: horizontal tabs — "District Info" | "Data + Demographics" | "Contacts"
- Tab content area: scrollable, fills remaining panel height
- Active tab in local `useState`, resets on `selectedLeaid` change

### Data Flow

Same hooks as v1 — no API changes needed:
- `useDistrictDetail(leaid)` → `{ district, fullmindData, educationData, enrollmentDemographics, tags, contacts, edits, territoryPlanIds }`
- `useSchoolsByDistrict(leaid)` → charter schools
- Contact mutations: create, update, delete, clayLookup (existing hooks)

### Tab 1: District Info

- Fullmind Metrics: FY25/26/27 revenue cards (sessions, invoicing, bookings, pipeline)
- Competitor Spend section
- "Add to Plan" / "Remove from Plan" button (context-aware)
- Charter Schools: up to 10, with enrollment sparklines
- District Info (collapsible): address, phone, ELL/SPED counts
- Tags Editor
- Notes Editor

### Tab 2: Data + Demographics

- Demographics donut chart (Recharts ResponsiveContainer)
- Student Populations: ELL, Special Ed, Chronic Absenteeism cards
- Academic Metrics: graduation rate
- Finance & Economic Data: per-pupil, revenue donut, poverty
- Staffing & Salaries: FTE breakdown, compensation, salary distribution bar

### Tab 3: Contacts

- Contact list with inline editing (add/update/delete)
- Clay lookup integration + refresh
- Manual contact entry form
- Fields: name, title, email, phone, LinkedIn, department, seniority, primary flag

## Styling Adaptations for V2

- V2 design language: `rounded-xl`, `p-3` padding, `gray-50` card backgrounds
- Brand colors: plum `#403770`, coral `#F37167`, steel-blue `#6EA3BE`
- Tab bar: compact horizontal with bottom-border active indicator
- Collapsible sections: chevron + `border border-gray-100 rounded-xl`
- Charts: `ResponsiveContainer` for flexible width in floating panel
- Smooth transitions on tab switch and section expand/collapse

## Navigation Integration

- Map click → `panelState: "DISTRICT"` → renders `DistrictDetailPanel`
- Search result click → same
- Plan district click → same (shows "Remove from Plan" when in plan context)
- Back button → `goBack()` from `useMapV2Store`
