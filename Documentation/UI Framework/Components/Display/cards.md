# Cards

This guide covers **card content patterns** — how to lay out metrics, badges, metadata, and detail rows inside cards. For the card shell itself (container, radius, shadow, padding variants), see `Containers/card.md`. See `_foundations.md` for display container and semantic colors.

---

## Card Shell (Base)

Quick reference for the standard card container defined in `Containers/card.md`:

```
bg-white rounded-lg border border-[#D4CFE2] shadow-sm overflow-hidden
```

Standard cards use `rounded-lg`. Larger floating card containers (e.g., popover-like cards) may use `rounded-xl` per `tokens.md`.

---

## Metric Card

Displays a single key metric with an optional badge and expandable detail section. Use when a panel needs to surface one primary number with supporting context.

**Classes:**

| Region | Class string |
|--------|-------------|
| Header | `flex items-center justify-between px-4 py-3 border-b border-[#E2DEEC]` |
| Title | `text-sm font-semibold text-[#403770]` |
| Badge | Signal or status badge — see `badges.md` |
| Body | `px-4 py-3` |
| Value | `text-2xl font-bold text-[#403770]` |
| Context | `text-xs text-[#8A80A8]` |

**TSX example:**

```tsx
function EnrollmentMetricCard() {
  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2DEEC]">
        <span className="text-sm font-semibold text-[#403770]">
          Total Enrollment
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-[#EAF4EC] text-[#2D7A3A]">
          On Track
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-2xl font-bold text-[#403770]">4,218</p>
        <p className="text-xs text-[#8A80A8]">+3.2% vs. prior year</p>
      </div>
    </div>
  );
}
```

---

## Content Card

Rich card with multiple badges, a title, metadata, and an embedded progress bar. Use for plan items, tasks, or any entity that needs to convey status, ownership, and completion in a compact form.

**Classes:**

| Region | Class string |
|--------|-------------|
| Body | `px-4 py-3` |
| Badge row | `flex items-center gap-2` |
| Title | `text-sm font-semibold text-[#403770]` |
| Metadata | `text-xs text-[#8A80A8]` |
| Progress footer | `px-4 pb-3` |

The embedded progress bar follows the standard progress pattern from `progress.md` and is rendered in a `px-4 pb-3` footer section beneath the body.

**TSX example:**

```tsx
function PlanContentCard() {
  const progress = 62;

  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm overflow-hidden">
      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Badge row */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-[#EEF0FD] text-[#403770]">
            Q2 Goal
          </span>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-[#FDF3E7] text-[#8A4E0F]">
            At Risk
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-[#403770]">
          Increase District Retention Rate
        </p>

        {/* Metadata */}
        <p className="text-xs text-[#8A80A8]">
          Owner: Maria Chen · Due Jun 30
        </p>
      </div>

      {/* Progress footer */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#8A80A8]">Progress</span>
          <span className="text-xs font-medium text-[#403770]">{progress}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#EEE9F8]">
          <div
            className="h-1.5 rounded-full bg-[#6B5EA8]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Expandable Card

Card with a collapsible detail section revealing key-value rows. Use for signals, finance summaries, or any card where secondary detail should be available on demand without leaving the panel.

**Classes:**

| Region | Class string |
|--------|-------------|
| Expand trigger | `w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#A69DC0] hover:text-[#403770] border-t border-[#E2DEEC] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none` |
| Chevron icon | `w-3 h-3 transition-transform duration-150` |
| Detail section | `px-4 pb-3 border-t border-[#E2DEEC]` |
| Detail row | `flex justify-between text-sm` |
| Row label | `text-[#6E6390]` |
| Row value | `font-medium text-[#403770]` |

The chevron rotates 90° when the detail section is expanded (`rotate-90` applied conditionally).

**TSX example:**

```tsx
function SignalExpandableCard() {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm overflow-hidden">
      {/* Card body (header + body omitted for brevity — see Metric Card) */}
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-[#403770]">
          Chronic Absenteeism
        </p>
        <p className="text-2xl font-bold text-[#403770]">18.4%</p>
        <p className="text-xs text-[#8A80A8]">District average · Updated Mar 10</p>
      </div>

      {/* Expand trigger */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#A69DC0] hover:text-[#403770] border-t border-[#E2DEEC] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-150 ${
            expanded ? "rotate-90" : ""
          }`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {expanded ? "Hide details" : "View details"}
      </button>

      {/* Detail section */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-[#E2DEEC] space-y-2 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#6E6390]">Elementary</span>
            <span className="font-medium text-[#403770]">14.1%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6E6390]">Middle School</span>
            <span className="font-medium text-[#403770]">19.8%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6E6390]">High School</span>
            <span className="font-medium text-[#403770]">22.3%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6E6390]">State Benchmark</span>
            <span className="font-medium text-[#403770]">12.0%</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Migration Notes

- `LeadingIndicatorsPanel`, `LaggingIndicatorsPanel`, and `SignalCard` use `rounded-xl` on card shells — standard cards should use `rounded-lg` per foundations.
- `border-gray-100` / `border-gray-200` in metric cards → `border-[#D4CFE2]`

---

## Codebase Examples

| Component | Type | File |
|-----------|------|------|
| Plan card | Content | `src/features/plans/components/PlanCard.tsx` |
| Signal card | Expandable | `src/features/map/components/panels/district/signals/SignalCard.tsx` |
| Enrollment card | Metric | `src/features/map/components/panels/district/EnrollmentCard.tsx` |
| Finance card | Expandable | `src/features/map/components/panels/district/FinanceCard.tsx` |
| Staffing card | Metric | `src/features/map/components/panels/district/StaffingCard.tsx` |
| Task card | Content | `src/features/tasks/components/TaskCard.tsx` |
| Calendar event card | Content | `src/features/calendar/components/CalendarEventCard.tsx` |
