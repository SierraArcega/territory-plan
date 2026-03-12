# Badges

Badges are inline visual indicators used to communicate status, signals, counts, and time-based states at a glance. They appear in tables, cards, panel headers, and list rows without interrupting the surrounding layout.

See `_foundations.md` for semantic color palette and status dot pattern.

---

## Signal Badges

Signal badges communicate four semantic trend levels driven by account or district data. They use solid semantic background hex values for consistent rendering on any background.

**Base classes:** `inline-flex items-center font-medium rounded-full`

### Size Variants

| Variant | Padding | Text size | Use |
|---------|---------|-----------|-----|
| Compact | `px-1.5 py-0.5` | `text-[10px]` | Inline / table use |
| Normal | `px-2 py-0.5` | `text-xs` | Default |

### Colors

| Level | Background | Text |
|-------|-----------|------|
| Growing | `bg-[#EDFFE3]` | `text-[#5f665b]` |
| Stable | `bg-[#e8f1f5]` | `text-[#4d7285]` |
| At Risk | `bg-[#fffaf1]` | `text-[#997c43]` |
| Declining | `bg-[#fef1f0]` | `text-[#c25a52]` |

All signal badge fills use solid semantic background hex values for consistent rendering on any background.

### TSX Example

```tsx
type SignalLevel = "growing" | "stable" | "at_risk" | "declining";

const SIGNAL_CLASSES: Record<SignalLevel, string> = {
  growing:   "bg-[#EDFFE3] text-[#5f665b]",
  stable:    "bg-[#e8f1f5] text-[#4d7285]",
  at_risk:   "bg-[#fffaf1] text-[#997c43]",
  declining: "bg-[#fef1f0] text-[#c25a52]",
};

const SIGNAL_LABELS: Record<SignalLevel, string> = {
  growing:   "Growing",
  stable:    "Stable",
  at_risk:   "At Risk",
  declining: "Declining",
};

interface SignalBadgeProps {
  level: SignalLevel;
  compact?: boolean;
}

function SignalBadge({ level, compact = false }: SignalBadgeProps) {
  const sizeClasses = compact
    ? "px-1.5 py-0.5 text-[10px]"
    : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeClasses} ${SIGNAL_CLASSES[level]}`}
    >
      {SIGNAL_LABELS[level]}
    </span>
  );
}
```

---

## Status Badges

Status badges indicate the application state of a plan or entity (active, draft, stale, archived). They use `font-semibold` to distinguish them from signal badges at the same size.

**Base classes:** `inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full`

| Status | Background | Text |
|--------|-----------|------|
| Working / Active | `bg-[#8AA891]` | `text-white` |
| Planning / Draft | `bg-[#F7F5FA]` | `text-[#6E6390]` |
| Stale / Warning | `bg-[#FFCF70]/30` | `text-[#997c43]` |
| Archived / Disabled | `bg-[#C2BBD4]` | `text-white` |

### TSX Example

```tsx
type PlanStatus = "active" | "planning" | "stale" | "archived";

const STATUS_CLASSES: Record<PlanStatus, string> = {
  active:   "bg-[#8AA891] text-white",
  planning: "bg-[#F7F5FA] text-[#6E6390]",
  stale:    "bg-[#FFCF70]/30 text-[#997c43]",
  archived: "bg-[#C2BBD4] text-white",
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  active:   "Active",
  planning: "Planning",
  stale:    "Stale",
  archived: "Archived",
};

interface StatusBadgeProps {
  status: PlanStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
```

---

## Count / Label Badges

Count and label badges use the primary plum color to mark fiscal year labels, entity counts, and category identifiers. They carry more visual weight than signal or status badges and should appear no more than once per card or row.

**Classes:** `inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-[#403770] text-white`

Use for: FY labels, entity counts, category identifiers.

### TSX Example

```tsx
{/* FY label */}
<span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-[#403770] text-white">
  FY2026
</span>

{/* Entity count */}
<span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-[#403770] text-white">
  {accountCount} accounts
</span>
```

---

## Recency Badges

Recency badges combine a status dot with a text label to communicate how recently an account or plan was active. The dot uses the same semantic color as the text for a unified reading.

**Base classes:** `inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full`

| Recency | Dot color | Text color | Background |
|---------|-----------|------------|------------|
| Active (≤7d) | `#8AA891` | `#8AA891` | `#F7FFF2` |
| Slowing (≤21d) | `#D4A84B` | `#997c43` | `#fffaf1` |
| Stale (>21d) | `#F37167` | `#c25a52` | `#fef1f0` |
| No activity | `#A69DC0` | `#A69DC0` | `#F7F5FA` |

The recency dot uses `w-1.5 h-1.5` rather than the standard `w-2 h-2` status dot from `_foundations.md` for visual balance at the compact `text-[10px]` badge size.

### TSX Example

```tsx
type RecencyState = "active" | "slowing" | "stale" | "none";

interface RecencyConfig {
  dotColor: string;
  textColor: string;
  bgColor: string;
  label: string;
}

const RECENCY_CONFIG: Record<RecencyState, RecencyConfig> = {
  active:  { dotColor: "#8AA891", textColor: "#8AA891", bgColor: "#F7FFF2", label: "Active" },
  slowing: { dotColor: "#D4A84B", textColor: "#997c43", bgColor: "#fffaf1", label: "Slowing" },
  stale:   { dotColor: "#F37167", textColor: "#c25a52", bgColor: "#fef1f0", label: "Stale" },
  none:    { dotColor: "#A69DC0", textColor: "#A69DC0", bgColor: "#F7F5FA", label: "No activity" },
};

interface RecencyBadgeProps {
  state: RecencyState;
}

function RecencyBadge({ state }: RecencyBadgeProps) {
  const { dotColor, textColor, bgColor, label } = RECENCY_CONFIG[state];

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      {label}
    </span>
  );
}
```

---

## Migration Notes

- **SignalBadge** currently uses opacity-based fills (`#6EA3BE/15`, `#FFCF70/20`) — migrate to solid hex values (`bg-[#e8f1f5]`, `bg-[#fffaf1]`) as defined in the Colors table above.
- **PlanCard** uses `bg-gray-200 text-gray-700` for planning status — migrate to `bg-[#F7F5FA] text-[#6E6390]`.
- **PlanCard** recency badge uses inline styles with non-token colors (`#D97706`, `#FEF3C7`, `#EFF5F0`) — migrate to plum-derived values from the Recency Badges table above.
- **CalendarSyncBadge** uses `bg-green-400` / `bg-red-400` for status dots — migrate to plum-derived semantic colors (`bg-[#8AA891]` for success, `bg-[#F37167]` for error).

---

## Codebase Examples

| Badge | Type | File |
|-------|------|------|
| Signal level indicator | Signal | `src/features/map/components/panels/district/signals/SignalBadge.tsx` |
| Plan status badge | Status | `src/features/plans/components/PlanCard.tsx` |
| FY year badge | Count/Label | `src/features/plans/components/PlanCard.tsx` |
| Plan recency badge | Recency | `src/features/plans/components/PlanCard.tsx` |
| Calendar sync indicator | Status | `src/features/calendar/components/CalendarSyncBadge.tsx` |
