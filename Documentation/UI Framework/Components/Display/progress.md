# Progress Bars

Visual indicators for completion, coverage, and goal tracking across plans, accounts, and targets. See _foundations.md for transition timing.

---

## Standard Progress Bar

Simple fill bar used for coverage, engagement, and plan metrics.

**Track:** `h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden`
**Fill:** `h-full rounded-full transition-all duration-500`
**Default fill color:** `bg-[#403770]` (plum)

**Use case:** Lightweight metric display in cards, panels, and table rows where a single normalized value communicates progress at a glance.

```tsx
interface StandardProgressBarProps {
  value: number; // 0–100
  fillColor?: string;
}

function StandardProgressBar({ value, fillColor = "bg-[#403770]" }: StandardProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${fillColor}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
```

---

## Goal Progress Bar

Thicker bar with semantic color coding based on completion percentage, paired with a status indicator.

**Track:** `h-2 bg-[#EFEDF5] rounded-full overflow-hidden`

**Fill colors by threshold:**

| Percentage | Fill color | Status label | Status color |
|------------|------------|--------------|--------------|
| 100%+ | `bg-[#69B34A]` | "Goal achieved!" | `text-[#69B34A]` |
| 75–99% | `bg-[#6EA3BE]` | "On track" | `text-[#6EA3BE]` |
| 50–74% | `bg-[#D4A84B]` | "Needs attention" | `text-[#D4A84B]` |
| <50% | `bg-[#F37167]` | "Behind target" | `text-[#F37167]` |

**Status indicator:** `flex items-center gap-1.5 text-xs` with a matching colored dot and label.

**Use case:** Goal tracking views where the user needs an at-a-glance assessment of whether a target is on course, at risk, or missed.

```tsx
interface GoalProgressBarProps {
  value: number; // actual achieved value
  target: number; // goal target value
}

function getGoalStatus(pct: number): {
  fillColor: string;
  textColor: string;
  label: string;
} {
  if (pct >= 100) {
    return { fillColor: "bg-[#69B34A]", textColor: "text-[#69B34A]", label: "Goal achieved!" };
  } else if (pct >= 75) {
    return { fillColor: "bg-[#6EA3BE]", textColor: "text-[#6EA3BE]", label: "On track" };
  } else if (pct >= 50) {
    return { fillColor: "bg-[#D4A84B]", textColor: "text-[#D4A84B]", label: "Needs attention" };
  } else {
    return { fillColor: "bg-[#F37167]", textColor: "text-[#F37167]", label: "Behind target" };
  }
}

function GoalProgressBar({ value, target }: GoalProgressBarProps) {
  const pct = target > 0 ? Math.round((value / target) * 100) : 0;
  const { fillColor, textColor, label } = getGoalStatus(pct);
  const barWidth = Math.min(100, pct);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2 bg-[#EFEDF5] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fillColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className={`flex items-center gap-1.5 text-xs ${textColor}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${fillColor}`} />
        <span>{label}</span>
      </div>
    </div>
  );
}
```

---

## Label Row

Progress bars include a label row above the track that identifies the metric and surfaces the current value.

**Layout:** `flex items-center justify-between`
- Left label: `text-xs text-[#8A80A8] font-medium` (metric name)
- Right value: `text-xs font-medium` with color matching fill

**Use case:** Any progress bar that needs to identify what is being measured and show the numeric value in context.

```tsx
interface ProgressLabelRowProps {
  label: string;
  displayValue: string; // e.g. "72%" or "18 / 25"
  valueColor: string;   // Tailwind text color class matching fill
}

function ProgressLabelRow({ label, displayValue, valueColor }: ProgressLabelRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#8A80A8] font-medium">{label}</span>
      <span className={`text-xs font-medium ${valueColor}`}>{displayValue}</span>
    </div>
  );
}

// Composed usage
function LabeledProgressBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex flex-col gap-1">
      <ProgressLabelRow
        label={label}
        displayValue={`${clamped}%`}
        valueColor="text-[#403770]"
      />
      <div className="h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#403770] rounded-full transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
```

---

## Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Plan coverage bar | Standard | `src/features/progress/components/LeadingIndicatorsPanel.tsx` |
| Engagement progress | Standard | `src/features/plans/components/PlanCard.tsx` |
| Goal progress | Goal | `src/features/goals/components/GoalProgress.tsx` |
| Progress card | Goal | `src/features/goals/components/ProgressCard.tsx` |
