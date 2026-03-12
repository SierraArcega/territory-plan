# Data Visualization Foundations

Shared patterns for all chart components. Every chart guide in this folder
references these foundations. If a pattern is defined here, the chart guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in chart components.

---

## Which Chart?

1. **Showing parts of a whole (composition/proportion)?** → [Donut Chart](donut-chart.md)
2. **Comparing discrete categories or ranking items?** → [Bar Chart](bar-chart.md)
3. **Showing change over time or continuous trends?** → [Line Chart](line-chart.md)
4. **Comparing magnitude AND showing a trend on the same data?** → [Combo Chart](combo-chart.md)

**Edge cases:**
- Few categories (≤5) with a time dimension → Bar chart (grouped by period), not line
- Single value out of a total → Donut with one filled segment + empty track
- Sparkline-style inline trend → Line chart at micro size (see line-chart.md § Sparkline Variant)
- Bars with a rolling average or target line → Combo chart, not separate charts

---

## Data Visualization Color Palette

| Slot | Hex | Token Name | Typical Role |
|------|-----|-----------|-------------|
| 1 | `#403770` | Plum | Primary series / largest segment |
| 2 | `#6EA3BE` | Steel Blue | Secondary series |
| 3 | `#F37167` | Coral | Tertiary / attention |
| 4 | `#FFCF70` | Golden | Fourth series |
| 5 | `#EDFFE3` | Mint | Fifth series (light green — use with dark text for contrast) |
| 6 | `#C4E7E6` | Robin's Egg | Sixth series (light, use with dark text) |

**Max series:** 6 is the practical limit. Charts with more than 6 series should group the smallest values into an "Other" segment using `#EFEDF5` (Hover surface).

**Rules:**
- Always assign colors in this order for unnamed/generic series.
- When data has semantic meaning (e.g., revenue sources, demographic groups), colors may be assigned by domain convention but must still come from this palette.
- Never use Tailwind grays or arbitrary hex values not in `tokens.md`.
- For segments representing "empty" or "remaining" track, use `#EFEDF5` (Hover surface).

---

## Recharts Wrapper Pattern

Every chart must be wrapped in `ResponsiveContainer`. Standard pattern:

```tsx
import { ResponsiveContainer } from "recharts";

<div className="h-48"> {/* or h-36, h-64 — explicit height required */}
  <ResponsiveContainer width="100%" height="100%">
    {/* Chart component here */}
  </ResponsiveContainer>
</div>
```

**Standard chart heights:**

| Context | Height class | Pixels |
|---------|-------------|--------|
| Compact (inside cards/panels) | `h-36` | 144px |
| Standard | `h-48` | 192px |
| Feature (hero/dashboard) | `h-64` | 256px |

Container div always gets explicit `className="h-{size}"`. Never put height on the chart component itself.

---

## Tooltip Pattern

```tsx
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  formatter?: (value: number) => string;
}

function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-[#D4CFE2] shadow-lg rounded-lg px-3 py-2 text-sm">
      {label && (
        <p className="text-[#8A80A8] text-xs font-medium mb-1">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[#6E6390]">{entry.name}</span>
          <span className="ml-auto font-medium text-[#403770]">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
```

`ChartTooltipProps` is a custom interface — not Recharts' `TooltipProps<ValueType, NameType>`. The `formatter` prop is our extension. Wire it into Recharts via the `content` prop:

```tsx
<Tooltip content={<ChartTooltip formatter={(v) => `$${v.toLocaleString()}`} />} />
```

Recharts passes `active`, `payload`, and `label` automatically through the `content` prop.

**Rules:**
- Border: `border-[#D4CFE2]` (Border Default)
- Shadow: `shadow-lg` (Medium elevation — same tier as map tooltips per Display docs)
- Radius: `rounded-lg`
- Label text: `text-[#8A80A8]` (Secondary)
- Value text: `text-[#403770]` (Primary / Plum)
- Name text: `text-[#6E6390]` (Body)
- Color swatch: `w-2 h-2 rounded-full` (matches Status Dot pattern from Display `_foundations.md`)

---

## Legend Pattern

**Inline legend** (beside chart, used when container ≥ 400px wide):

```tsx
<div className="flex-1 space-y-1 text-sm">
  {data.map((item) => (
    <div key={item.key} className="flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: item.color }}
      />
      <span className="text-[#6E6390] text-xs">{item.label}</span>
      <span className="ml-auto font-medium text-[#403770] text-xs">
        {item.formattedValue}
      </span>
    </div>
  ))}
</div>
```

**Grid legend** (below chart, used in narrow containers):

```tsx
<div className="grid grid-cols-2 gap-x-4 gap-y-2">
  {data.map((item) => (
    <div key={item.key} className="flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: item.color }}
      />
      <span className="text-[#6E6390] text-xs truncate">{item.label}</span>
      <span className="text-[#8A80A8] text-xs ml-auto">{item.formattedValue}</span>
    </div>
  ))}
</div>
```

The grid legend uses `text-[#8A80A8]` (Secondary) for values instead of `text-[#403770]` (Primary) — this is intentional. In narrow contexts, de-emphasizing the value avoids visual competition with the label text at small sizes.

**Rules:**
- Color swatch: `w-2 h-2 rounded-full` — matches Status Dot from Display `_foundations.md`
- Never use Recharts' built-in `<Legend>` component — it doesn't match our token system
- Legend placement: inline (right of chart) when container ≥ 400px wide, grid (below) otherwise

---

## Number Formatting

Reference Display `_foundations.md` for the full implementation. Summary:

| Input | Output | Currency |
|-------|--------|----------|
| `null` / `undefined` | `"—"` | `"—"` |
| 1,000,000+ | `"1.2M"` | `"$1.2M"` |
| 1,000+ | `"12K"` | `"$12K"` |
| Below 1,000 | `"1,234"` | `"$1,234"` |

Percentages: `"45.2%"` — one decimal place, no space before `%`.

Axis tick values should use abbreviated format (K/M) to prevent label overlap.

---

## Empty / Loading States

- **No data:** Don't render the chart at all. Show `"—"` in `text-[#A69DC0]` or hide the section entirely.
- **Loading:** `<div className="h-48 bg-[#EFEDF5] rounded-lg animate-pulse" />`
- **Single zero-value series:** Don't render a chart for a dataset where all values are 0.

---

## Animation & Transitions

| Element | Recharts Prop | Value |
|---------|--------------|-------|
| Chart entry animation | `isAnimationActive` | `true` |
| Animation duration | `animationDuration` | `500` |
| Animation easing | `animationEasing` | `"ease-out"` |

Keep animations subtle. Don't animate on re-render — only on initial mount.

---

## Accessibility

Every chart container must have `role="img"` and a descriptive `aria-label`. Templates by chart type:

- **Donut:** `aria-label="{metric}: {value1}% {label1}, {value2}% {label2}, ..."`
  e.g., `"Revenue sources: 45% Local, 35% State, 20% Federal"`
- **Bar:** `aria-label="{metric} by {category}: {label1} {value1}, {label2} {value2}, ..."`
  e.g., `"Spending by district: Springfield $12K, Shelbyville $9K"`
- **Line:** `aria-label="{metric} trend from {start} to {end}"`
  e.g., `"Enrollment trend from 2020 to 2025"`

**Rules:**
- Color alone must not convey meaning — pair colors with labels in legends and tooltips.
- Series colors follow the palette order which is designed for distinguishability; however, for charts with 5+ series, verify adjacent segments have sufficient contrast.
- Tooltip content must be accessible via keyboard focus where the chart library supports it.
