# District Detail Panel: Signal-First Redesign

## Goal

Overhaul the floating district detail panel so every metric is presented with contextual meaning rather than raw numbers. Lead with color-coded signal badges (Growing/Declining/Stable/At Risk) and pair every data point with its 3-year trend and state comparison. Replace the current 3-tab layout with a single scrollable signal-card layout.

## Motivation

The database has 39 pre-computed trend, comparison, and quartile columns on the `districts` table (see `2026-02-14-district-benchmarks-trends-design.md`). None of this data is surfaced in the UI. Current components show raw numbers with hardcoded color thresholds — a graduation rate of 85% shows as green regardless of whether the state average is 92%. This redesign closes that gap.

## Audience

Both sales prospecting (quick scan: "should I pursue this district?") and account management (deeper understanding: "how is this customer's situation evolving?").

---

## Architecture: Signal Cards

### Layout Change

**Before:** Header → Tab bar (District Info | Data + Demographics | Contacts) → Tab content

**After:** Header (enriched with signal strip) → Scrollable signal cards → Fullmind/CRM card → District Details card → Contacts card

No tab bar. Single scrollable panel. Each card is collapsible.

### Information Hierarchy

Every signal card follows a consistent 3-tier pattern:

```
┌──────────────────────────────────────────────────┐
│ Icon  Category Title              [Signal Badge]  │  Tier 1: Signal
│                                                   │
│  Primary Metric     ↓ 8.2% over 3 years          │  Tier 2: Contextual metric
│  Below state average · Bottom quartile            │
│                                                   │
│  ▸ View details                                   │  Tier 3: Expandable raw data
│    ┌────────────────────────────────────────────┐ │
│    │ Breakdowns, charts, supporting data        │ │
│    └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- **Tier 1 — Signal badge**: The instant read. Color-coded per Fullmind brand semantic colors.
- **Tier 2 — Contextual metric**: The key number with its trend arrow + magnitude and vs-state quartile.
- **Tier 3 — Expandable detail**: Raw data, breakdowns, charts for deep dives.

---

## Signal Badge System

### Badge Definitions

| Badge | Color | Background | Text Color | Meaning |
|-------|-------|------------|------------|---------|
| Growing | Mint | `bg-[#EDFFE3]` | `text-[#5f665b]` | Trend > +3% |
| Stable | Steel Blue | `bg-[#6EA3BE]/15` | `text-[#4d7285]` | Trend -1% to +3% |
| At Risk | Golden | `bg-[#FFCF70]/20` | `text-[#997c43]` | Trend -5% to -1% |
| Declining | Deep Coral | `bg-[#F37167]/15` | `text-[#c25a52]` | Trend < -5% |

These thresholds apply to percentage-change trends (enrollment, staffing, SWD, ELL, expenditure). For point-change metrics (graduation, absenteeism, proficiency), thresholds are halved (±1.5 and ±2.5 points).

### Trend Arrow Display

Format: `↑ 8.2% over 3 years` or `↓ 2.1 pts over 3 years`

- Arrow direction: up (↑) for positive change, down (↓) for negative, dash (—) for stable
- Arrow color matches signal badge color
- Magnitude shown as percentage for ratio metrics, points for rate metrics

### Quartile Context Line

Driven by the `*QuartileState` database columns:

| Quartile | Display | Color |
|----------|---------|-------|
| `well_above` | "Well above state average" | Mint text `text-[#5f665b]` |
| `above` | "Above state average" | Steel Blue text `text-[#4d7285]` |
| `below` | "Below state average" | Golden text `text-[#997c43]` |
| `well_below` | "Well below state average" | Deep Coral text `text-[#c25a52]` |

For inverted metrics (absenteeism, student-teacher ratio) where higher = worse, the labels read directionally: "Well above" still means "notably high" — the color inverts (high absenteeism = Deep Coral, not Mint).

---

## Header Redesign

### Current
- District name, state/county/LEAID
- 3-column grid: enrollment, grades, schools
- External links, tags

### New
- District name, state/county/LEAID (unchanged)
- **Signal strip**: Row of 3-4 compact signal pills showing the most important signals
  - Enrollment direction (from `enrollmentTrend3yr`)
  - Staffing pressure (from `vacancyPressureSignal` or `studentTeacherRatioTrend3yr`)
  - Academic standing (from `graduationTrend3yr`)
  - Spend direction (from `expenditurePpTrend3yr`)
- Factual stats as compact text line: "14,230 students · K-12 · 22 schools"
- External links, tags (unchanged)

Signal pills use the same badge styling as card badges but smaller (`text-[10px]`).

---

## Signal Cards

### Card 1: Enrollment & Growth

**Signal source**: `enrollmentTrend3yr`

**Primary metric**: Enrollment count + trend arrow + magnitude

**Context**: Enrollment vs-state comparison (if quartile available)

**Expandable detail**:
- Demographics donut chart (existing `DemographicsChart` component, restyled)
- Charter schools list with sparklines (existing `CharterSchools` component)
- Number of schools

### Card 2: Staffing & Capacity

**Signal source**: Composite — worst signal of `staffingTrend3yr`, `studentTeacherRatioTrend3yr`, `vacancyPressureSignal`

**Primary metric**: Student-teacher ratio + trend arrow (e.g., "16.2:1 ↑ rising")

**Secondary line** (if notable): SPED student-teacher ratio (`spedStudentTeacherRatio`)

**Context**: `studentTeacherRatioQuartileState` badge + vs-state delta

**Expandable detail**:
- Staff FTE breakdown (teachers, admin, counselors, aides — existing data)
- Average teacher salary (calculated: `salariesInstruction / teachersFte`)
- Average admin salary (calculated: `salariesSupportAdmin / adminFte`)
- Salary distribution bar (instruction % vs other %)
- Total compensation per employee

### Card 3: Student Populations

**Signal source**: Composite — `swdTrend3yr` and `ellTrend3yr` (badge reflects whichever is more notable; if both notable, show two badges)

**Primary metric**: Two side-by-side mini-metrics:
- SWD: count + % of enrollment + trend arrow
- ELL: count + % of enrollment + trend arrow

**Context**: `swdPctVsState` and `ellPctVsState` quartile badges

**Expandable detail**:
- Chronic absenteeism rate + trend (`absenteeismTrend3yr`) + vs-state quartile
- Absenteeism count
- SPED student-teacher ratio (if not shown in Card 2)

### Card 4: Academic Performance

**Signal source**: `graduationTrend3yr` (absenteeism trend as modifier)

**Primary metric**: Graduation rate + trend arrow + magnitude

**Context**: `graduationQuartileState` badge

**Expandable detail**:
- Math proficiency + trend (`mathProficiencyTrend3yr`) + `mathProficiencyQuartileState`
- Reading proficiency + trend (`readProficiencyTrend3yr`) + `readProficiencyQuartileState`
- Graduation data year

### Card 5: Financial Health

**Signal source**: `expenditurePpTrend3yr`

**Primary metric**: Per-pupil expenditure + trend arrow + magnitude

**Context**: `expenditurePpQuartileState` badge + vs-state delta

**Expandable detail**:
- Revenue breakdown pie chart (federal/state/local — existing chart, restyled)
- Total expenditure
- Children poverty rate + count + median household income

---

## Non-Signal Sections

### Card 6: Fullmind / CRM

Not signal-driven — this is CRM data without trend computation.

- Restyle existing `FullmindMetrics` to match card pattern
- FY25/26/27 sessions, bookings, pipeline (existing data)
- Competitor spend section (existing)
- "Add to Plan" / "Remove from Plan" button (existing)
- "Find Similar Districts" button (existing)

### Card 7: District Details

- Address, phone (existing)
- Notes editor (existing)
- Tags editor (existing)
- Task list (existing)

### Card 8: Contacts

- Contact list with CRUD (existing)
- Clay lookup integration (existing)

---

## Data Pipeline Changes

### TypeScript Types

Add trend/comparison fields to `DistrictDetail` type in `src/lib/api.ts`:

```typescript
// Add to District type or create a new TrendData sub-type
interface DistrictTrends {
  enrollmentTrend3yr: number | null;
  staffingTrend3yr: number | null;
  swdTrend3yr: number | null;
  ellTrend3yr: number | null;
  absenteeismTrend3yr: number | null;
  graduationTrend3yr: number | null;
  studentTeacherRatioTrend3yr: number | null;
  mathProficiencyTrend3yr: number | null;
  readProficiencyTrend3yr: number | null;
  expenditurePpTrend3yr: number | null;
}

interface DistrictComparisons {
  // Ratios
  studentTeacherRatio: number | null;
  studentStaffRatio: number | null;
  spedStudentTeacherRatio: number | null;
  // Percentages
  swdPct: number | null;
  ellPct: number | null;
  // State deltas
  absenteeismVsState: number | null;
  graduationVsState: number | null;
  studentTeacherRatioVsState: number | null;
  swdPctVsState: number | null;
  ellPctVsState: number | null;
  mathProficiencyVsState: number | null;
  readProficiencyVsState: number | null;
  expenditurePpVsState: number | null;
  // National deltas
  absenteeismVsNational: number | null;
  graduationVsNational: number | null;
  studentTeacherRatioVsNational: number | null;
  swdPctVsNational: number | null;
  ellPctVsNational: number | null;
  mathProficiencyVsNational: number | null;
  readProficiencyVsNational: number | null;
  expenditurePpVsNational: number | null;
  // Quartile flags
  absenteeismQuartileState: string | null;
  graduationQuartileState: string | null;
  studentTeacherRatioQuartileState: string | null;
  swdPctQuartileState: string | null;
  ellPctQuartileState: string | null;
  mathProficiencyQuartileState: string | null;
  readProficiencyQuartileState: string | null;
  expenditurePpQuartileState: string | null;
  // Sales signals
  vacancyPressureSignal: string | null;
}
```

### API Route

Update `/api/districts/[leaid]` to include trend and comparison columns in the Prisma select.

---

## Shared Components

### `SignalBadge`

Reusable component accepting a trend value and rendering the appropriate badge.

```tsx
type SignalLevel = 'growing' | 'stable' | 'at_risk' | 'declining';

interface SignalBadgeProps {
  trend: number | null;
  isPointChange?: boolean; // halves thresholds for rate metrics
  invertDirection?: boolean; // for metrics where higher = worse
  label?: string; // override auto-generated label
}
```

### `TrendArrow`

Reusable component showing directional arrow with magnitude.

```tsx
interface TrendArrowProps {
  value: number | null;
  unit: 'percent' | 'points' | 'ratio';
  invertColor?: boolean;
}
```

### `QuartileContext`

Reusable component rendering the "Above state average" context line.

```tsx
interface QuartileContextProps {
  quartile: string | null; // well_above | above | below | well_below
  invertLabel?: boolean; // for metrics where higher = worse
}
```

### `SignalCard`

Container component providing the consistent 3-tier layout.

```tsx
interface SignalCardProps {
  icon: ReactNode;
  title: string;
  badge: ReactNode; // SignalBadge
  children: ReactNode; // primary metric + context
  detail?: ReactNode; // expandable content
  defaultExpanded?: boolean;
}
```

---

## Styling

All components follow the Fullmind brand guide:
- Card backgrounds: `bg-white` with `border border-gray-100 rounded-xl`
- Text: Plum `#403770` for headers, `gray-600` for body
- Signal colors: per semantic color system
- Typography: Plus Jakarta Sans, existing weight hierarchy
- Spacing: `p-3` card padding, `gap-3` between cards
- Expandable sections: smooth height transition, chevron rotation

---

## File Structure

```
src/components/map-v2/panels/district/
├── DistrictDetailPanel.tsx       # Rewrite: scrollable signal-card layout
├── DistrictHeader.tsx            # Modify: add signal strip
├── signals/
│   ├── SignalBadge.tsx           # New: reusable signal badge
│   ├── TrendArrow.tsx           # New: directional trend indicator
│   ├── QuartileContext.tsx       # New: state comparison line
│   └── SignalCard.tsx           # New: card container with expand/collapse
├── EnrollmentCard.tsx            # New: enrollment & growth signal card
├── StaffingCard.tsx              # New: staffing & capacity signal card
├── StudentPopulationsCard.tsx    # New: SWD/ELL signal card
├── AcademicCard.tsx              # New: academic performance signal card
├── FinanceCard.tsx               # New: financial health signal card
├── FullmindCard.tsx              # Refactor from FullmindMetrics.tsx
├── DistrictDetailsCard.tsx       # Refactor from DistrictInfo.tsx + editors
├── ContactsCard.tsx              # Refactor from ContactsTab.tsx
├── DemographicsChart.tsx         # Keep (used inside EnrollmentCard detail)
├── CharterSchools.tsx            # Keep (used inside EnrollmentCard detail)
├── CompetitorSpend.tsx           # Keep (used inside FullmindCard)
├── AddToPlanButton.tsx           # Keep
├── FindSimilarDistricts.tsx      # Keep
├── TagsEditor.tsx                # Keep (used inside DistrictDetailsCard)
├── NotesEditor.tsx               # Keep (used inside DistrictDetailsCard)
├── TaskList.tsx                  # Keep (used inside DistrictDetailsCard)
└── ContactsList.tsx              # Keep (used inside ContactsCard)
```

### Files to Delete (replaced by new cards)

- `DistrictInfoTab.tsx` — replaced by card layout in `DistrictDetailPanel`
- `DataDemographicsTab.tsx` — replaced by signal cards
- `StudentPopulations.tsx` — replaced by `StudentPopulationsCard.tsx`
- `AcademicMetrics.tsx` — replaced by `AcademicCard.tsx`
- `FinanceData.tsx` — replaced by `FinanceCard.tsx`
- `StaffingSalaries.tsx` — replaced by `StaffingCard.tsx`
- `DistrictInfo.tsx` — replaced by `DistrictDetailsCard.tsx`

---

## Scope Boundaries

**In scope:**
- Full panel layout restructure (tabs → signal cards)
- Header enrichment with signal strip
- 5 new signal card components with trend/comparison context
- 4 shared signal display components (badge, arrow, quartile, card)
- TypeScript type additions for trend/comparison fields
- API route update to include trend/comparison data
- Restyle of CRM, details, and contacts sections

**Out of scope:**
- ETL changes (trends already computed — see benchmarks design doc)
- Schema changes (columns already exist)
- New composite scoring algorithms
- Mobile responsive behavior (panel is desktop-only floating panel)
