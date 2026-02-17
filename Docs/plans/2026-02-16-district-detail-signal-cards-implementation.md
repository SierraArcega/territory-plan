# District Detail Signal Cards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the tabbed district detail panel with a signal-first scrollable layout where every metric shows its 3-year trend and state comparison context.

**Architecture:** Add trend/comparison types to the frontend, expose them from the API route, build 4 shared signal display components (SignalBadge, TrendArrow, QuartileContext, SignalCard), then rewrite DistrictDetailPanel as a scrollable list of signal cards. Existing chart components (DemographicsChart, CharterSchools) are reused inside expandable card details.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts, Prisma, TanStack Query

---

## Task 1: Add Trend & Comparison Types

**Files:**
- Modify: `src/lib/api.ts:7-173` (type definitions)

**Step 1: Add DistrictTrends interface after DistrictEnrollmentDemographics (line 162)**

Add this interface between `DistrictEnrollmentDemographics` (ends line 162) and `DistrictDetail` (starts line 164):

```typescript
export interface DistrictTrends {
  // Derived percentages
  swdPct: number | null;
  ellPct: number | null;
  // Staffing ratios
  studentTeacherRatio: number | null;
  studentStaffRatio: number | null;
  spedStudentTeacherRatio: number | null;
  // 3-year trends
  enrollmentTrend3yr: number | null;
  staffingTrend3yr: number | null;
  vacancyPressureSignal: number | null;
  swdTrend3yr: number | null;
  ellTrend3yr: number | null;
  absenteeismTrend3yr: number | null;
  graduationTrend3yr: number | null;
  studentTeacherRatioTrend3yr: number | null;
  mathProficiencyTrend3yr: number | null;
  readProficiencyTrend3yr: number | null;
  expenditurePpTrend3yr: number | null;
  // State comparison deltas (positive = above state avg)
  absenteeismVsState: number | null;
  graduationVsState: number | null;
  studentTeacherRatioVsState: number | null;
  swdPctVsState: number | null;
  ellPctVsState: number | null;
  mathProficiencyVsState: number | null;
  readProficiencyVsState: number | null;
  expenditurePpVsState: number | null;
  // National comparison deltas
  absenteeismVsNational: number | null;
  graduationVsNational: number | null;
  studentTeacherRatioVsNational: number | null;
  swdPctVsNational: number | null;
  ellPctVsNational: number | null;
  mathProficiencyVsNational: number | null;
  readProficiencyVsNational: number | null;
  expenditurePpVsNational: number | null;
  // Quartile flags within state
  absenteeismQuartileState: string | null;
  graduationQuartileState: string | null;
  studentTeacherRatioQuartileState: string | null;
  swdPctQuartileState: string | null;
  ellPctQuartileState: string | null;
  mathProficiencyQuartileState: string | null;
  readProficiencyQuartileState: string | null;
  expenditurePpQuartileState: string | null;
}
```

**Step 2: Add `trends` to `DistrictDetail` interface (line 164-173)**

Add `trends: DistrictTrends | null;` to the `DistrictDetail` interface after `enrollmentDemographics`:

```typescript
export interface DistrictDetail {
  district: District;
  fullmindData: FullmindData | null;
  edits: DistrictEdits | null;
  tags: Tag[];
  contacts: Contact[];
  territoryPlanIds: string[];
  educationData: DistrictEducationData | null;
  enrollmentDemographics: DistrictEnrollmentDemographics | null;
  trends: DistrictTrends | null;
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd territory-plan && npx tsc --noEmit 2>&1 | head -30`

Expected: Type errors in components that destructure `DistrictDetail` — that's fine, we'll fix those in later tasks. The types file itself should parse cleanly.

**Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add DistrictTrends type with trend, comparison, and quartile fields"
```

---

## Task 2: Expose Trends from API Route

**Files:**
- Modify: `src/app/api/districts/[leaid]/route.ts:50-186` (response builder)

**Step 1: Add trends object to the API response**

After the `enrollmentDemographics` block (ends ~line 185), before the closing `};` of the response object, add:

```typescript
      // Trend & comparison data (computed by ETL)
      trends: district.enrollmentTrend3yr != null || district.staffingTrend3yr != null || district.graduationTrend3yr != null ? {
        swdPct: toNumber(district.swdPct),
        ellPct: toNumber(district.ellPct),
        studentTeacherRatio: toNumber(district.studentTeacherRatio),
        studentStaffRatio: toNumber(district.studentStaffRatio),
        spedStudentTeacherRatio: toNumber(district.spedStudentTeacherRatio),
        enrollmentTrend3yr: toNumber(district.enrollmentTrend3yr),
        staffingTrend3yr: toNumber(district.staffingTrend3yr),
        vacancyPressureSignal: toNumber(district.vacancyPressureSignal),
        swdTrend3yr: toNumber(district.swdTrend3yr),
        ellTrend3yr: toNumber(district.ellTrend3yr),
        absenteeismTrend3yr: toNumber(district.absenteeismTrend3yr),
        graduationTrend3yr: toNumber(district.graduationTrend3yr),
        studentTeacherRatioTrend3yr: toNumber(district.studentTeacherRatioTrend3yr),
        mathProficiencyTrend3yr: toNumber(district.mathProficiencyTrend3yr),
        readProficiencyTrend3yr: toNumber(district.readProficiencyTrend3yr),
        expenditurePpTrend3yr: toNumber(district.expenditurePpTrend3yr),
        absenteeismVsState: toNumber(district.absenteeismVsState),
        graduationVsState: toNumber(district.graduationVsState),
        studentTeacherRatioVsState: toNumber(district.studentTeacherRatioVsState),
        swdPctVsState: toNumber(district.swdPctVsState),
        ellPctVsState: toNumber(district.ellPctVsState),
        mathProficiencyVsState: toNumber(district.mathProficiencyVsState),
        readProficiencyVsState: toNumber(district.readProficiencyVsState),
        expenditurePpVsState: toNumber(district.expenditurePpVsState),
        absenteeismVsNational: toNumber(district.absenteeismVsNational),
        graduationVsNational: toNumber(district.graduationVsNational),
        studentTeacherRatioVsNational: toNumber(district.studentTeacherRatioVsNational),
        swdPctVsNational: toNumber(district.swdPctVsNational),
        ellPctVsNational: toNumber(district.ellPctVsNational),
        mathProficiencyVsNational: toNumber(district.mathProficiencyVsNational),
        readProficiencyVsNational: toNumber(district.readProficiencyVsNational),
        expenditurePpVsNational: toNumber(district.expenditurePpVsNational),
        absenteeismQuartileState: district.absenteeismQuartileState,
        graduationQuartileState: district.graduationQuartileState,
        studentTeacherRatioQuartileState: district.studentTeacherRatioQuartileState,
        swdPctQuartileState: district.swdPctQuartileState,
        ellPctQuartileState: district.ellPctQuartileState,
        mathProficiencyQuartileState: district.mathProficiencyQuartileState,
        readProficiencyQuartileState: district.readProficiencyQuartileState,
        expenditurePpQuartileState: district.expenditurePpQuartileState,
      } : null,
```

**Step 2: Verify the API route compiles**

Run: `cd territory-plan && npx tsc --noEmit 2>&1 | grep "route.ts" | head -10`

Expected: No errors for this file. Prisma client already knows about these fields from the schema.

**Step 3: Test the endpoint manually**

Run: `cd territory-plan && curl -s http://localhost:3000/api/districts/0100005 | python3 -m json.tool | grep -A 5 "trends"`

Expected: JSON with trends object containing numeric values or nulls.

**Step 4: Commit**

```bash
git add src/app/api/districts/\[leaid\]/route.ts
git commit -m "feat: expose trend and comparison data from district detail API"
```

---

## Task 3: Create Shared Signal Components

**Files:**
- Create: `src/components/map-v2/panels/district/signals/SignalBadge.tsx`
- Create: `src/components/map-v2/panels/district/signals/TrendArrow.tsx`
- Create: `src/components/map-v2/panels/district/signals/QuartileContext.tsx`
- Create: `src/components/map-v2/panels/district/signals/SignalCard.tsx`

### Step 1: Create the signals directory

Run: `mkdir -p territory-plan/src/components/map-v2/panels/district/signals`

### Step 2: Create SignalBadge.tsx

```tsx
"use client";

export type SignalLevel = "growing" | "stable" | "at_risk" | "declining";

interface SignalBadgeProps {
  trend: number | null;
  /** true for point-change metrics (graduation, absenteeism, proficiency) — halves thresholds */
  isPointChange?: boolean;
  /** true for metrics where higher = worse (absenteeism, student-teacher ratio) */
  invertDirection?: boolean;
  /** Override the auto-computed label */
  label?: string;
  /** Compact size for header strip */
  compact?: boolean;
}

const BADGE_CONFIG: Record<
  SignalLevel,
  { bg: string; text: string; label: string }
> = {
  growing: { bg: "bg-[#EDFFE3]", text: "text-[#5f665b]", label: "Growing" },
  stable: {
    bg: "bg-[#6EA3BE]/15",
    text: "text-[#4d7285]",
    label: "Stable",
  },
  at_risk: {
    bg: "bg-[#FFCF70]/20",
    text: "text-[#997c43]",
    label: "At Risk",
  },
  declining: {
    bg: "bg-[#F37167]/15",
    text: "text-[#c25a52]",
    label: "Declining",
  },
};

export function getSignalLevel(
  trend: number | null,
  isPointChange = false,
  invertDirection = false
): SignalLevel | null {
  if (trend == null) return null;
  const t = invertDirection ? -trend : trend;
  const [hi, lo] = isPointChange ? [1.5, -2.5] : [3, -5];
  if (t > hi) return "growing";
  if (t > (isPointChange ? -1.5 : -1)) return "stable";
  if (t > lo) return "at_risk";
  return "declining";
}

export default function SignalBadge({
  trend,
  isPointChange = false,
  invertDirection = false,
  label,
  compact = false,
}: SignalBadgeProps) {
  const level = getSignalLevel(trend, isPointChange, invertDirection);
  if (!level) return null;

  const config = BADGE_CONFIG[level];
  const displayLabel = label ?? config.label;
  const size = compact
    ? "px-1.5 py-0.5 text-[10px]"
    : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${size}`}
    >
      {displayLabel}
    </span>
  );
}
```

### Step 3: Create TrendArrow.tsx

```tsx
"use client";

interface TrendArrowProps {
  value: number | null;
  /** "percent" for % change, "points" for point change, "ratio" for ratios */
  unit: "percent" | "points" | "ratio";
  /** true for metrics where higher = worse */
  invertColor?: boolean;
}

export default function TrendArrow({
  value,
  unit,
  invertColor = false,
}: TrendArrowProps) {
  if (value == null) return null;

  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.5;

  // Determine arrow direction
  const arrow = isNeutral ? "—" : isPositive ? "↑" : "↓";

  // Color logic: normally positive=green, negative=red; inverted for "higher is worse" metrics
  const isGoodDirection = invertColor ? !isPositive : isPositive;
  const colorClass = isNeutral
    ? "text-[#4d7285]" // Steel Blue shade
    : isGoodDirection
    ? "text-[#5f665b]" // Mint shade (good)
    : "text-[#c25a52]"; // Coral shade (bad)

  // Format the magnitude
  const absVal = Math.abs(value);
  let formatted: string;
  if (unit === "percent") {
    formatted = `${absVal.toFixed(1)}%`;
  } else if (unit === "points") {
    formatted = `${absVal.toFixed(1)} pts`;
  } else {
    formatted = absVal.toFixed(1);
  }

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${colorClass}`}>
      <span>{arrow}</span>
      <span>{formatted} over 3 years</span>
    </span>
  );
}
```

### Step 4: Create QuartileContext.tsx

```tsx
"use client";

type Quartile = "well_above" | "above" | "below" | "well_below";

interface QuartileContextProps {
  quartile: string | null;
  /** true for metrics where higher = worse (renders inverted color) */
  invertLabel?: boolean;
}

const QUARTILE_DISPLAY: Record<
  Quartile,
  { label: string; goodColor: string; badColor: string }
> = {
  well_above: {
    label: "Well above state avg",
    goodColor: "text-[#5f665b]",
    badColor: "text-[#c25a52]",
  },
  above: {
    label: "Above state avg",
    goodColor: "text-[#4d7285]",
    badColor: "text-[#997c43]",
  },
  below: {
    label: "Below state avg",
    goodColor: "text-[#997c43]",
    badColor: "text-[#4d7285]",
  },
  well_below: {
    label: "Well below state avg",
    goodColor: "text-[#c25a52]",
    badColor: "text-[#5f665b]",
  },
};

function isValidQuartile(v: string | null): v is Quartile {
  return v != null && v in QUARTILE_DISPLAY;
}

export default function QuartileContext({
  quartile,
  invertLabel = false,
}: QuartileContextProps) {
  if (!isValidQuartile(quartile)) return null;

  const config = QUARTILE_DISPLAY[quartile];
  const colorClass = invertLabel ? config.badColor : config.goodColor;

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      {config.label}
    </span>
  );
}
```

### Step 5: Create SignalCard.tsx

```tsx
"use client";

import { useState, type ReactNode } from "react";

interface SignalCardProps {
  icon: ReactNode;
  title: string;
  badge: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  defaultExpanded?: boolean;
}

export default function SignalCard({
  icon,
  title,
  badge,
  children,
  detail,
  defaultExpanded = false,
}: SignalCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-100 rounded-xl bg-white">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{icon}</span>
          <h3 className="text-sm font-semibold text-[#403770]">{title}</h3>
        </div>
        {badge}
      </div>

      {/* Primary metric + context */}
      <div className="px-3 pb-3">{children}</div>

      {/* Expandable detail */}
      {detail && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-[#403770] border-t border-gray-50 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {expanded ? "Hide details" : "View details"}
          </button>
          {expanded && (
            <div className="px-3 pb-3 border-t border-gray-50">
              {detail}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### Step 6: Verify all components compile

Run: `cd territory-plan && npx tsc --noEmit 2>&1 | grep "signals/" | head -10`

Expected: No errors for the signals directory.

### Step 7: Commit

```bash
git add src/components/map-v2/panels/district/signals/
git commit -m "feat: add shared signal display components (badge, arrow, quartile, card)"
```

---

## Task 4: Create EnrollmentCard

**Files:**
- Create: `src/components/map-v2/panels/district/EnrollmentCard.tsx`

**Step 1: Create the component**

This card shows enrollment count + 3yr trend + demographics detail.

```tsx
"use client";

import type { District, DistrictEnrollmentDemographics, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import SignalCard from "./signals/SignalCard";
import DemographicsChart from "./DemographicsChart";
import CharterSchools from "./CharterSchools";

interface EnrollmentCardProps {
  district: District;
  demographics: DistrictEnrollmentDemographics | null;
  trends: DistrictTrends | null;
}

export default function EnrollmentCard({
  district,
  demographics,
  trends,
}: EnrollmentCardProps) {
  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
      title="Enrollment & Growth"
      badge={
        <SignalBadge trend={trends?.enrollmentTrend3yr ?? null} />
      }
      detail={
        <div className="space-y-4 pt-2">
          {demographics && <DemographicsChart demographics={demographics} />}
          <CharterSchools leaid={district.leaid} />
          {district.numberOfSchools != null && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Schools in district</span>
              <span className="font-medium text-[#403770]">{district.numberOfSchools}</span>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-[#403770]">
            {district.enrollment?.toLocaleString() ?? "N/A"}
          </span>
          <TrendArrow value={trends?.enrollmentTrend3yr ?? null} unit="percent" />
        </div>
        <div className="text-xs text-gray-500">
          {district.lograde && district.higrade && (
            <span>Grades {formatGrades(district.lograde, district.higrade)} · </span>
          )}
          {district.numberOfSchools != null && (
            <span>{district.numberOfSchools} schools</span>
          )}
        </div>
      </div>
    </SignalCard>
  );
}

function formatGrades(lo: string, hi: string): string {
  const map: Record<string, string> = { PK: "Pre-K", KG: "K", "01": "1", "02": "2", "03": "3", "04": "4", "05": "5", "06": "6", "07": "7", "08": "8", "09": "9", "10": "10", "11": "11", "12": "12", UG: "Ungraded" };
  return `${map[lo] || lo} – ${map[hi] || hi}`;
}
```

### Step 2: Verify compile

Run: `cd territory-plan && npx tsc --noEmit 2>&1 | grep "EnrollmentCard" | head -5`

### Step 3: Commit

```bash
git add src/components/map-v2/panels/district/EnrollmentCard.tsx
git commit -m "feat: add EnrollmentCard signal card with trend and demographics detail"
```

---

## Task 5: Create StaffingCard

**Files:**
- Create: `src/components/map-v2/panels/district/StaffingCard.tsx`

**Step 1: Create the component**

Shows student-teacher ratio + staffing trend + salary detail.

```tsx
"use client";

import type { DistrictEducationData, DistrictTrends } from "@/lib/api";
import SignalBadge, { getSignalLevel } from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import QuartileContext from "./signals/QuartileContext";
import SignalCard from "./signals/SignalCard";

interface StaffingCardProps {
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}

function formatCurrency(val: number | null): string {
  if (val == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatFte(val: number | null): string {
  if (val == null) return "N/A";
  return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(1);
}

export default function StaffingCard({
  educationData,
  trends,
}: StaffingCardProps) {
  const ratio = trends?.studentTeacherRatio;
  const spedRatio = trends?.spedStudentTeacherRatio;

  // Composite signal: worst of staffing trend, ratio trend, vacancy pressure
  const signals = [
    trends?.staffingTrend3yr,
    trends?.studentTeacherRatioTrend3yr != null ? -trends.studentTeacherRatioTrend3yr : null, // invert: rising ratio is bad
    trends?.vacancyPressureSignal != null ? -trends.vacancyPressureSignal : null, // invert: higher pressure is bad
  ].filter((v): v is number => v != null);

  const worstSignal = signals.length > 0 ? Math.min(...signals) : null;

  // Average salary calculations
  const avgTeacherSalary = educationData?.salariesInstruction && educationData?.teachersFte
    ? educationData.salariesInstruction / educationData.teachersFte
    : null;
  const avgAdminSalary = educationData?.salariesSupportAdmin && educationData?.adminFte
    ? educationData.salariesSupportAdmin / educationData.adminFte
    : null;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      }
      title="Staffing & Capacity"
      badge={<SignalBadge trend={worstSignal} />}
      detail={
        <div className="space-y-3 pt-2">
          {/* Staff FTE breakdown */}
          {educationData?.staffTotalFte != null && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Breakdown</h4>
              <div className="space-y-1 text-sm">
                {[
                  { label: "Teachers", value: educationData.teachersFte },
                  { label: "Admin", value: educationData.adminFte },
                  { label: "Counselors", value: educationData.guidanceCounselorsFte },
                  { label: "Instructional Aides", value: educationData.instructionalAidesFte },
                ].filter(r => r.value != null).map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-gray-600">{r.label}</span>
                    <span className="font-medium text-[#403770]">{formatFte(r.value)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-600 font-medium">Total Staff</span>
                  <span className="font-medium text-[#403770]">{formatFte(educationData.staffTotalFte)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Average salaries */}
          {(avgTeacherSalary || avgAdminSalary) && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Compensation</h4>
              <div className="space-y-1 text-sm">
                {avgTeacherSalary != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Teacher Salary</span>
                    <span className="font-medium text-[#403770]">{formatCurrency(avgTeacherSalary)}</span>
                  </div>
                )}
                {avgAdminSalary != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Admin Salary</span>
                    <span className="font-medium text-[#403770]">{formatCurrency(avgAdminSalary)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1.5">
        {/* Primary: Student-Teacher Ratio */}
        {ratio != null ? (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-[#403770]">{ratio.toFixed(1)}:1</span>
            <TrendArrow
              value={trends?.studentTeacherRatioTrend3yr ?? null}
              unit="ratio"
              invertColor
            />
          </div>
        ) : (
          <span className="text-lg text-gray-400">No ratio data</span>
        )}
        <div className="text-xs text-gray-500">Student-teacher ratio</div>

        {/* Quartile context */}
        <QuartileContext quartile={trends?.studentTeacherRatioQuartileState ?? null} invertLabel />

        {/* SPED ratio if notable */}
        {spedRatio != null && (
          <div className="mt-2 text-sm text-gray-600">
            SPED student-teacher ratio: <span className="font-medium text-[#403770]">{spedRatio.toFixed(1)}:1</span>
          </div>
        )}
      </div>
    </SignalCard>
  );
}
```

### Step 2: Verify compile & commit

```bash
git add src/components/map-v2/panels/district/StaffingCard.tsx
git commit -m "feat: add StaffingCard with composite signal, ratio trends, salary detail"
```

---

## Task 6: Create StudentPopulationsCard

**Files:**
- Create: `src/components/map-v2/panels/district/StudentPopulationsCard.tsx`

**Step 1: Create the component**

Shows SWD/ELL trends side by side + absenteeism in expandable detail.

```tsx
"use client";

import type { District, DistrictEducationData, DistrictTrends } from "@/lib/api";
import SignalBadge, { getSignalLevel } from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import QuartileContext from "./signals/QuartileContext";
import SignalCard from "./signals/SignalCard";

interface StudentPopulationsCardProps {
  district: District;
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}

export default function StudentPopulationsCard({
  district,
  educationData,
  trends,
}: StudentPopulationsCardProps) {
  const swdPct = trends?.swdPct;
  const ellPct = trends?.ellPct;
  const swdCount = district.specEdStudents;
  const ellCount = district.ellStudents;

  // Composite signal: most notable of SWD and ELL trends
  const swdLevel = getSignalLevel(trends?.swdTrend3yr ?? null);
  const ellLevel = getSignalLevel(trends?.ellTrend3yr ?? null);

  // Pick the more dramatic trend for the badge
  const trendValues = [trends?.swdTrend3yr, trends?.ellTrend3yr].filter((v): v is number => v != null);
  const mostNotable = trendValues.length > 0
    ? trendValues.reduce((a, b) => Math.abs(a) > Math.abs(b) ? a : b)
    : null;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      }
      title="Student Populations"
      badge={<SignalBadge trend={mostNotable} label={swdLevel && ellLevel ? "SWD & ELL Shifting" : undefined} />}
      detail={
        <div className="space-y-3 pt-2">
          {/* Chronic Absenteeism */}
          {educationData?.chronicAbsenteeismRate != null && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Chronic Absenteeism</h4>
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-bold text-[#403770]">
                  {educationData.chronicAbsenteeismRate.toFixed(1)}%
                </span>
                <TrendArrow
                  value={trends?.absenteeismTrend3yr ?? null}
                  unit="points"
                  invertColor
                />
              </div>
              <QuartileContext quartile={trends?.absenteeismQuartileState ?? null} invertLabel />
              {educationData.chronicAbsenteeismCount != null && (
                <div className="text-xs text-gray-500">
                  {educationData.chronicAbsenteeismCount.toLocaleString()} students chronically absent
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {/* SWD column */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Special Ed</div>
          <div className="text-lg font-bold text-[#403770]">
            {swdPct != null ? `${swdPct.toFixed(1)}%` : swdCount != null ? swdCount.toLocaleString() : "N/A"}
          </div>
          {swdCount != null && swdPct != null && (
            <div className="text-xs text-gray-500">{swdCount.toLocaleString()} students</div>
          )}
          <TrendArrow value={trends?.swdTrend3yr ?? null} unit="percent" />
          <QuartileContext quartile={trends?.swdPctQuartileState ?? null} />
        </div>

        {/* ELL column */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">ELL</div>
          <div className="text-lg font-bold text-[#403770]">
            {ellPct != null ? `${ellPct.toFixed(1)}%` : ellCount != null ? ellCount.toLocaleString() : "N/A"}
          </div>
          {ellCount != null && ellPct != null && (
            <div className="text-xs text-gray-500">{ellCount.toLocaleString()} students</div>
          )}
          <TrendArrow value={trends?.ellTrend3yr ?? null} unit="percent" />
          <QuartileContext quartile={trends?.ellPctQuartileState ?? null} />
        </div>
      </div>
    </SignalCard>
  );
}
```

### Step 2: Verify compile & commit

```bash
git add src/components/map-v2/panels/district/StudentPopulationsCard.tsx
git commit -m "feat: add StudentPopulationsCard with SWD/ELL trends and absenteeism detail"
```

---

## Task 7: Create AcademicCard

**Files:**
- Create: `src/components/map-v2/panels/district/AcademicCard.tsx`

**Step 1: Create the component**

Shows graduation rate + trend + proficiency metrics in detail.

```tsx
"use client";

import type { DistrictEducationData, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import QuartileContext from "./signals/QuartileContext";
import SignalCard from "./signals/SignalCard";

interface AcademicCardProps {
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}

export default function AcademicCard({
  educationData,
  trends,
}: AcademicCardProps) {
  const gradRate = educationData?.graduationRateTotal;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
        </svg>
      }
      title="Academic Performance"
      badge={
        <SignalBadge
          trend={trends?.graduationTrend3yr ?? null}
          isPointChange
        />
      }
      detail={
        <div className="space-y-3 pt-2">
          {/* Math Proficiency */}
          {trends?.mathProficiencyTrend3yr != null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Math Proficiency</span>
                <QuartileContext quartile={trends.mathProficiencyQuartileState} />
              </div>
              <TrendArrow value={trends.mathProficiencyTrend3yr} unit="points" />
            </div>
          )}

          {/* Reading Proficiency */}
          {trends?.readProficiencyTrend3yr != null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reading Proficiency</span>
                <QuartileContext quartile={trends.readProficiencyQuartileState} />
              </div>
              <TrendArrow value={trends.readProficiencyTrend3yr} unit="points" />
            </div>
          )}

          {/* Data year */}
          {educationData?.graduationDataYear && (
            <div className="text-xs text-gray-400 text-center pt-1">
              {educationData.graduationDataYear - 1}–{educationData.graduationDataYear} cohort
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1.5">
        {gradRate != null ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[#403770]">{gradRate.toFixed(1)}%</span>
              <TrendArrow value={trends?.graduationTrend3yr ?? null} unit="points" />
            </div>
            <div className="text-xs text-gray-500">4-year graduation rate</div>
            <QuartileContext quartile={trends?.graduationQuartileState ?? null} />
          </>
        ) : (
          <span className="text-lg text-gray-400">No graduation data</span>
        )}
      </div>
    </SignalCard>
  );
}
```

### Step 2: Verify compile & commit

```bash
git add src/components/map-v2/panels/district/AcademicCard.tsx
git commit -m "feat: add AcademicCard with graduation trend and proficiency detail"
```

---

## Task 8: Create FinanceCard

**Files:**
- Create: `src/components/map-v2/panels/district/FinanceCard.tsx`

**Step 1: Create the component**

Shows per-pupil spending + trend + revenue breakdown in detail.

```tsx
"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { DistrictEducationData, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import QuartileContext from "./signals/QuartileContext";
import SignalCard from "./signals/SignalCard";

interface FinanceCardProps {
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}

const REVENUE_COLORS: Record<string, { hex: string; label: string }> = {
  federal: { hex: "#6EA3BE", label: "Federal" },
  state: { hex: "#48bb78", label: "State" },
  local: { hex: "#F37167", label: "Local" },
};

function formatCurrency(val: number | null): string {
  if (val == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatCompact(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

export default function FinanceCard({
  educationData,
  trends,
}: FinanceCardProps) {
  const ppSpend = educationData?.expenditurePerPupil;

  const revenueData = useMemo(() => {
    if (!educationData) return [];
    return [
      { key: "federal", value: educationData.federalRevenue },
      { key: "state", value: educationData.stateRevenue },
      { key: "local", value: educationData.localRevenue },
    ].filter((d): d is { key: string; value: number } => d.value != null && d.value > 0);
  }, [educationData]);

  const totalRevenue = educationData?.totalRevenue;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      title="Financial Health"
      badge={
        <SignalBadge trend={trends?.expenditurePpTrend3yr ?? null} />
      }
      detail={
        <div className="space-y-4 pt-2">
          {/* Revenue Breakdown */}
          {revenueData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue Sources</h4>
              <div className="flex items-center gap-4">
                <div className="w-[120px] h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData}
                        dataKey="value"
                        nameKey="key"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={2}
                      >
                        {revenueData.map((d) => (
                          <Cell key={d.key} fill={REVENUE_COLORS[d.key]?.hex ?? "#ccc"} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => formatCurrency(val)}
                        labelFormatter={(key: string) => REVENUE_COLORS[key]?.label ?? key}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 text-sm">
                  {revenueData.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REVENUE_COLORS[d.key]?.hex }} />
                      <span className="text-gray-600">{REVENUE_COLORS[d.key]?.label}</span>
                      <span className="ml-auto font-medium text-[#403770]">
                        {totalRevenue ? `${((d.value / totalRevenue) * 100).toFixed(0)}%` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Poverty indicators */}
          {educationData?.childrenPovertyPercent != null && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Economic Context</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Child Poverty Rate</span>
                  <span className="font-medium text-[#403770]">
                    {educationData.childrenPovertyPercent.toFixed(1)}%
                  </span>
                </div>
                {educationData.medianHouseholdIncome != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Median Household Income</span>
                    <span className="font-medium text-[#403770]">
                      {formatCurrency(educationData.medianHouseholdIncome)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1.5">
        {ppSpend != null ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[#403770]">{formatCurrency(ppSpend)}</span>
              <TrendArrow value={trends?.expenditurePpTrend3yr ?? null} unit="percent" />
            </div>
            <div className="text-xs text-gray-500">Per-pupil expenditure</div>
            <QuartileContext quartile={trends?.expenditurePpQuartileState ?? null} />
          </>
        ) : (
          <span className="text-lg text-gray-400">No finance data</span>
        )}
      </div>
    </SignalCard>
  );
}
```

### Step 2: Verify compile & commit

```bash
git add src/components/map-v2/panels/district/FinanceCard.tsx
git commit -m "feat: add FinanceCard with per-pupil trend, revenue chart, poverty context"
```

---

## Task 9: Create FullmindCard and DistrictDetailsCard

**Files:**
- Create: `src/components/map-v2/panels/district/FullmindCard.tsx`
- Create: `src/components/map-v2/panels/district/DistrictDetailsCard.tsx`

### Step 1: Create FullmindCard.tsx

Wraps existing FullmindMetrics + CompetitorSpend + action buttons in a SignalCard container.

```tsx
"use client";

import type { DistrictDetail } from "@/lib/api";
import FullmindMetrics from "./FullmindMetrics";
import CompetitorSpend from "./CompetitorSpend";
import AddToPlanButton from "./AddToPlanButton";
import FindSimilarDistricts from "./FindSimilarDistricts";
import SignalCard from "./signals/SignalCard";

interface FullmindCardProps {
  data: DistrictDetail;
  leaid: string;
}

export default function FullmindCard({ data, leaid }: FullmindCardProps) {
  const hasFullmind = data.fullmindData != null;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      }
      title="Fullmind"
      badge={
        data.fullmindData?.isCustomer ? (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#EDFFE3] text-[#5f665b]">
            Customer
          </span>
        ) : data.fullmindData?.hasOpenPipeline ? (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#FFCF70]/20 text-[#997c43]">
            Pipeline
          </span>
        ) : (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#6EA3BE]/15 text-[#4d7285]">
            Prospect
          </span>
        )
      }
    >
      <div className="space-y-3">
        {hasFullmind && <FullmindMetrics fullmindData={data.fullmindData!} />}
        <CompetitorSpend leaid={leaid} />
        <div className="flex items-center gap-2">
          <AddToPlanButton leaid={leaid} territoryPlanIds={data.territoryPlanIds} />
          <FindSimilarDistricts leaid={leaid} />
        </div>
      </div>
    </SignalCard>
  );
}
```

### Step 2: Create DistrictDetailsCard.tsx

Wraps address, phone, notes, tags, tasks.

```tsx
"use client";

import type { DistrictDetail } from "@/lib/api";
import SignalCard from "./signals/SignalCard";
import TagsEditor from "./TagsEditor";
import NotesEditor from "./NotesEditor";
import TaskList from "@/components/tasks/TaskList";

interface DistrictDetailsCardProps {
  data: DistrictDetail;
  leaid: string;
}

function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function DistrictDetailsCard({ data, leaid }: DistrictDetailsCardProps) {
  const d = data.district;
  const hasAddress = d.streetLocation || d.cityLocation;
  const formatted = formatPhone(d.phone);

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      }
      title="District Details"
      badge={<></>}
    >
      <div className="space-y-4">
        {/* Contact info */}
        {(hasAddress || d.phone) && (
          <div className="space-y-1 text-sm">
            {hasAddress && (
              <p className="text-gray-600">
                {d.streetLocation && <>{d.streetLocation}<br /></>}
                {d.cityLocation}, {d.stateLocation} {d.zipLocation}
              </p>
            )}
            {formatted && (
              <a href={`tel:${d.phone}`} className="text-[#6EA3BE] hover:underline">
                {formatted}
              </a>
            )}
          </div>
        )}

        {/* Tags */}
        <TagsEditor leaid={leaid} tags={data.tags} />

        {/* Notes */}
        <NotesEditor
          leaid={leaid}
          notes={data.edits?.notes ?? null}
          owner={data.edits?.owner ?? null}
        />

        {/* Tasks */}
        <TaskList linkedEntityType="district" linkedEntityId={leaid} />
      </div>
    </SignalCard>
  );
}
```

### Step 3: Verify compile & commit

```bash
git add src/components/map-v2/panels/district/FullmindCard.tsx src/components/map-v2/panels/district/DistrictDetailsCard.tsx
git commit -m "feat: add FullmindCard and DistrictDetailsCard wrappers"
```

---

## Task 10: Rewrite DistrictHeader with Signal Strip

**Files:**
- Modify: `src/components/map-v2/panels/district/DistrictHeader.tsx`

**Step 1: Update the props interface**

Add `trends` prop. The component file starts at line 1.

Replace the entire file with:

```tsx
"use client";

import type { District, FullmindData, Tag, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";

interface DistrictHeaderProps {
  district: District;
  fullmindData: FullmindData | null;
  tags: Tag[];
  trends: DistrictTrends | null;
}

export default function DistrictHeader({
  district,
  fullmindData,
  tags,
  trends,
}: DistrictHeaderProps) {
  return (
    <div className="px-3 pt-3 pb-2 border-b border-gray-100 bg-gradient-to-b from-[#FFFCFA] to-white">
      {/* District Name */}
      <h2 className="text-lg font-bold text-[#403770] pr-8 leading-tight">
        {district.name}
      </h2>

      {/* State, County & LEAID */}
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        <span>{district.stateAbbrev}</span>
        {district.countyName && (
          <>
            <span>·</span>
            <span>{district.countyName} County</span>
          </>
        )}
        <span>·</span>
        <span className="font-mono">{district.leaid}</span>
      </div>

      {/* External Links */}
      {(district.websiteUrl || district.jobBoardUrl) && (
        <div className="flex items-center gap-2 mt-2">
          {district.websiteUrl && (
            <a
              href={district.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 hover:bg-[#403770] hover:text-white text-gray-600 transition-colors"
              title="Visit Website"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </a>
          )}
          {district.jobBoardUrl && (
            <a
              href={district.jobBoardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 hover:bg-[#403770] hover:text-white text-gray-600 transition-colors"
              title="View Job Board"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
          )}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Signal Strip */}
      {trends && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <SignalBadge trend={trends.enrollmentTrend3yr} compact label={
            trends.enrollmentTrend3yr != null
              ? `${trends.enrollmentTrend3yr > 0 ? "↑" : trends.enrollmentTrend3yr < -0.5 ? "↓" : "—"} Enrollment`
              : undefined
          } />
          <SignalBadge
            trend={trends.studentTeacherRatioTrend3yr != null ? -trends.studentTeacherRatioTrend3yr : null}
            compact
            label={trends.studentTeacherRatioTrend3yr != null ? `${trends.studentTeacherRatioTrend3yr > 0.5 ? "⚠" : "✓"} Staffing` : undefined}
          />
          <SignalBadge trend={trends.graduationTrend3yr} isPointChange compact label={
            trends.graduationTrend3yr != null
              ? `${trends.graduationTrend3yr > 0 ? "↑" : trends.graduationTrend3yr < -0.5 ? "↓" : "—"} Graduation`
              : undefined
          } />
          <SignalBadge trend={trends.expenditurePpTrend3yr} compact label={
            trends.expenditurePpTrend3yr != null
              ? `${trends.expenditurePpTrend3yr > 0 ? "↑" : trends.expenditurePpTrend3yr < -0.5 ? "↓" : "—"} Spend`
              : undefined
          } />
        </div>
      )}

      {/* Compact stats line */}
      <div className="mt-2 text-xs text-gray-500">
        {district.enrollment != null && (
          <span>{district.enrollment.toLocaleString()} students</span>
        )}
        {district.lograde && district.higrade && (
          <span> · {formatGrades(district.lograde, district.higrade)}</span>
        )}
        {district.numberOfSchools != null && (
          <span> · {district.numberOfSchools} schools</span>
        )}
      </div>

      {/* Sales Executive */}
      {fullmindData?.salesExecutive && (
        <div className="mt-1.5 text-xs text-gray-500">
          SE: <span className="font-medium text-[#403770]">{fullmindData.salesExecutive}</span>
        </div>
      )}
    </div>
  );
}

function formatGrades(lo: string, hi: string): string {
  const map: Record<string, string> = { PK: "Pre-K", KG: "K", "01": "1", "02": "2", "03": "3", "04": "4", "05": "5", "06": "6", "07": "7", "08": "8", "09": "9", "10": "10", "11": "11", "12": "12", UG: "Ungraded" };
  return `${map[lo] || lo} – ${map[hi] || hi}`;
}
```

### Step 2: Verify compile & commit

```bash
git add src/components/map-v2/panels/district/DistrictHeader.tsx
git commit -m "feat: redesign DistrictHeader with signal strip and compact stats"
```

---

## Task 11: Rewrite DistrictDetailPanel — Signal Card Layout

**Files:**
- Modify: `src/components/map-v2/panels/district/DistrictDetailPanel.tsx`

**Step 1: Replace the entire file**

Remove the tab-based layout and replace with scrollable signal cards:

```tsx
"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail } from "@/lib/api";
import DistrictHeader from "./DistrictHeader";
import EnrollmentCard from "./EnrollmentCard";
import StaffingCard from "./StaffingCard";
import StudentPopulationsCard from "./StudentPopulationsCard";
import AcademicCard from "./AcademicCard";
import FinanceCard from "./FinanceCard";
import FullmindCard from "./FullmindCard";
import DistrictDetailsCard from "./DistrictDetailsCard";
import ContactsList from "./ContactsList";
import SignalCard from "./signals/SignalCard";

export default function DistrictDetailPanel() {
  const selectedLeaid = useMapV2Store((s) => s.selectedLeaid);
  const goBack = useMapV2Store((s) => s.goBack);

  const { data, isLoading, error } = useDistrictDetail(selectedLeaid);

  const district = data?.district;
  const contacts = data?.contacts || [];

  return (
    <div className="flex flex-col h-full">
      {/* Back button header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button
          onClick={goBack}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Go back"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M9 3L5 7L9 11"
              stroke="#6B7280"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          District
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3">
            <LoadingSkeleton />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-red-400">
            Failed to load district details
          </div>
        ) : !district ? (
          <div className="text-center py-8 text-sm text-gray-400">
            District not found
          </div>
        ) : (
          <>
            {/* Header with signal strip */}
            <DistrictHeader
              district={data.district}
              fullmindData={data.fullmindData}
              tags={data.tags}
              trends={data.trends}
            />

            {/* Signal Cards */}
            <div className="p-3 space-y-3">
              {/* Enrollment & Growth */}
              <EnrollmentCard
                district={data.district}
                demographics={data.enrollmentDemographics}
                trends={data.trends}
              />

              {/* Staffing & Capacity */}
              <StaffingCard
                educationData={data.educationData}
                trends={data.trends}
              />

              {/* Student Populations */}
              <StudentPopulationsCard
                district={data.district}
                educationData={data.educationData}
                trends={data.trends}
              />

              {/* Academic Performance */}
              <AcademicCard
                educationData={data.educationData}
                trends={data.trends}
              />

              {/* Financial Health */}
              <FinanceCard
                educationData={data.educationData}
                trends={data.trends}
              />

              {/* Fullmind / CRM */}
              <FullmindCard data={data} leaid={selectedLeaid!} />

              {/* District Details */}
              <DistrictDetailsCard data={data} leaid={selectedLeaid!} />

              {/* Contacts */}
              <SignalCard
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                }
                title={`Contacts (${contacts.length})`}
                badge={<></>}
              >
                <ContactsList leaid={selectedLeaid!} contacts={contacts} />
              </SignalCard>
            </div>

            <p className="text-[10px] text-gray-300 text-center pt-1 pb-3">
              LEAID: {selectedLeaid}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div>
        <div className="h-5 bg-[#C4E7E6]/20 rounded w-4/5 mb-1 animate-pulse" />
        <div className="h-3 bg-[#C4E7E6]/15 rounded w-1/3 animate-pulse" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-5 bg-[#C4E7E6]/20 rounded-full w-20 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border border-gray-100 rounded-xl p-3 animate-pulse space-y-2">
          <div className="flex justify-between">
            <div className="h-4 bg-[#C4E7E6]/20 rounded w-1/3" />
            <div className="h-4 bg-[#C4E7E6]/15 rounded-full w-16" />
          </div>
          <div className="h-7 bg-[#C4E7E6]/15 rounded w-1/2" />
          <div className="h-3 bg-[#C4E7E6]/10 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}
```

### Step 2: Verify the app compiles

Run: `cd territory-plan && npx tsc --noEmit 2>&1 | head -20`

Expected: May have warnings about unused imports in deleted tab files — that's fine.

### Step 3: Commit

```bash
git add src/components/map-v2/panels/district/DistrictDetailPanel.tsx
git commit -m "feat: rewrite DistrictDetailPanel as scrollable signal-card layout"
```

---

## Task 12: Clean Up Replaced Files and Verify

**Files:**
- Delete: `src/components/map-v2/panels/district/DistrictInfoTab.tsx`
- Delete: `src/components/map-v2/panels/district/DataDemographicsTab.tsx`
- Delete: `src/components/map-v2/panels/district/StudentPopulations.tsx`
- Delete: `src/components/map-v2/panels/district/AcademicMetrics.tsx`
- Delete: `src/components/map-v2/panels/district/FinanceData.tsx`
- Delete: `src/components/map-v2/panels/district/StaffingSalaries.tsx`
- Delete: `src/components/map-v2/panels/district/DistrictInfo.tsx`

### Step 1: Check for any remaining imports of deleted files

Run: `cd territory-plan && grep -r "DistrictInfoTab\|DataDemographicsTab\|StudentPopulations\|AcademicMetrics\b\|FinanceData\|StaffingSalaries\|DistrictInfo\b" src/ --include="*.tsx" --include="*.ts" -l`

If any files still import these, update those imports first.

### Step 2: Delete the replaced files

Run:
```bash
cd territory-plan && rm \
  src/components/map-v2/panels/district/DistrictInfoTab.tsx \
  src/components/map-v2/panels/district/DataDemographicsTab.tsx \
  src/components/map-v2/panels/district/StudentPopulations.tsx \
  src/components/map-v2/panels/district/AcademicMetrics.tsx \
  src/components/map-v2/panels/district/FinanceData.tsx \
  src/components/map-v2/panels/district/StaffingSalaries.tsx \
  src/components/map-v2/panels/district/DistrictInfo.tsx
```

### Step 3: Full compile check

Run: `cd territory-plan && npx tsc --noEmit`

Expected: Clean compile with no errors.

### Step 4: Commit

```bash
git add -A src/components/map-v2/panels/district/
git commit -m "chore: remove replaced tab-based district detail components"
```

---

## Task 13: Visual Verification

### Step 1: Start dev server

Run: `cd territory-plan && npm run dev`

### Step 2: Manual verification checklist

Open the app, click a district on the map, and verify:

1. **Header**: District name, location, links, tags, signal strip with 4 colored badges, compact stats line
2. **Enrollment Card**: Enrollment count with trend arrow, signal badge, expandable demographics chart + charter schools
3. **Staffing Card**: Student-teacher ratio with trend, quartile context, expandable staff/salary breakdown
4. **Student Populations Card**: SWD/ELL side by side with trends and quartile context, expandable absenteeism
5. **Academic Card**: Graduation rate with trend and quartile, expandable proficiency trends
6. **Finance Card**: Per-pupil spend with trend and quartile, expandable revenue chart + poverty
7. **Fullmind Card**: Customer/Pipeline/Prospect badge, FY data, competitor spend, action buttons
8. **District Details Card**: Address, phone, tags editor, notes, tasks
9. **Contacts Card**: Contact list

### Step 3: Check districts with missing data

Test with a small/rural district that may have null trends. Cards should gracefully show "No data" states without breaking.

### Step 4: Final commit if any fixes needed

```bash
git add -A
git commit -m "fix: visual polish for district detail signal cards"
```

---

## Task 14: Update ContactsList Integration

**Context:** The current `ContactsTab.tsx` wraps `ContactsList.tsx` and may have its own logic. We need to ensure `ContactsList` works standalone in the new layout.

**Step 1: Check ContactsTab.tsx vs ContactsList.tsx**

Read `ContactsTab.tsx` to understand what wrapper logic it provides. If it only passes props through, we can use `ContactsList` directly. If it has unique logic (add contact form, etc.), we need to preserve that.

**Step 2: Adapt as needed**

If `ContactsTab` has unique logic beyond what `ContactsList` provides, either:
- a) Keep `ContactsTab` and use it inside the Contacts SignalCard, or
- b) Move the logic into `ContactsList` directly

**Step 3: Commit if changes needed**

```bash
git add src/components/map-v2/panels/district/
git commit -m "fix: integrate contacts into signal card layout"
```

---

## Summary

| Task | Component | Signal Source | Key Context Added |
|------|-----------|-------------|-------------------|
| 1-2 | Types + API | — | Expose 39 trend/comparison fields |
| 3 | Signal primitives | — | Badge, arrow, quartile, card container |
| 4 | EnrollmentCard | `enrollmentTrend3yr` | 3yr trend, demographics detail |
| 5 | StaffingCard | Composite (staffing + ratio + vacancy) | Ratio trend, quartile, salary detail |
| 6 | StudentPopulationsCard | `swdTrend3yr` + `ellTrend3yr` | Dual trends, quartile, absenteeism |
| 7 | AcademicCard | `graduationTrend3yr` | Graduation quartile, proficiency trends |
| 8 | FinanceCard | `expenditurePpTrend3yr` | Spend quartile, revenue chart, poverty |
| 9 | Fullmind + Details | — | Restyled wrappers |
| 10 | DistrictHeader | All trends | Signal strip with 4 key badges |
| 11 | DistrictDetailPanel | — | Scrollable signal-card layout |
| 12 | Cleanup | — | Remove old tab components |
| 13 | Verification | — | Visual + null data testing |
| 14 | Contacts | — | Integration check |
