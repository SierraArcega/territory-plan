# Data Visualization Documentation — Design Spec

## Goal

Create a `Data Visualization/` folder under `Documentation/UI Framework/Components/` containing `.md` files that give an AI everything it needs to produce consistent, correct, on-brand data visualizations using Recharts. The documentation standardizes chart selection, styling, token usage, and interaction patterns across the platform.

## Decisions

- **Library**: Keep Recharts (v3.7.0). No migration to Elastic Charts or any other library.
- **Scope**: Donut/pie, bar (vertical/horizontal/stacked/grouped), line/area, combo (bar + line) — plus a decision tree for chart type selection.
- **Token drift**: Document only the corrected token values. Existing gray-* drift will be cleaned up in a separate ticket.
- **External references**: None. Docs are fully self-contained.
- **Pattern**: Follow the existing `_foundations.md` + individual component files convention used by Tables/, Navigation/, Display/, and Containers/.

## Folder Structure

```
Documentation/UI Framework/Components/Data Visualization/
  _foundations.md      — decision tree, shared patterns, Recharts conventions
  donut-chart.md       — pie/donut chart guide
  bar-chart.md         — bar chart guide (vertical, horizontal, stacked, grouped)
  line-chart.md        — line and area chart guide (time series, trends)
  combo-chart.md       — combined bar + line chart guide (magnitude + trend)
```

---

## File 1: `_foundations.md`

### Purpose
Shared patterns referenced by every chart-type guide. Establishes the decision tree, color system, Recharts wrapper conventions, tooltip/legend patterns, empty states, accessibility, and animation timing.

### Sections

#### 1. Which Chart?
A numbered decision tree (same format as Containers `_foundations.md`):

1. **Showing parts of a whole (composition/proportion)?** → [Donut Chart](donut-chart.md)
2. **Comparing discrete categories or ranking items?** → [Bar Chart](bar-chart.md)
3. **Showing change over time or continuous trends?** → [Line Chart](line-chart.md)
4. **Comparing magnitude AND showing a trend on the same data?** → [Combo Chart](combo-chart.md)

Edge-case guidance:
- Few categories (≤5) with a time dimension → Bar chart (grouped by period), not line
- Single value out of a total → Donut with one filled segment + empty track
- Sparkline-style inline trend → Line chart at micro size (see line-chart.md § Sparkline Variant)
- Bars with a rolling average or target line → Combo chart, not separate charts

#### 2. Data Visualization Color Palette

A dedicated ordered palette for chart series data, drawn from brand tokens. This is the sequence AI should use when assigning colors to data series:

| Slot | Hex | Token Name | Typical Role |
|------|-----|-----------|-------------|
| 1 | `#403770` | Plum | Primary series / largest segment |
| 2 | `#6EA3BE` | Steel Blue | Secondary series |
| 3 | `#F37167` | Coral | Tertiary / attention |
| 4 | `#FFCF70` | Golden | Fourth series |
| 5 | `#8AA891` | Sage | Fifth series (derived from success family) |
| 6 | `#C4E7E6` | Robin's Egg | Sixth series (light, use with dark text) |

**Prerequisite:** `#8AA891` (Sage) is used across the codebase but has not been formally added to `tokens.md` Brand Palette. It must be added to `tokens.md` before or alongside this documentation work.

**Max series:** 6 is the practical limit. Charts with more than 6 series should group the smallest values into an "Other" segment using `#EFEDF5` (Hover surface).

Rules:
- Always assign colors in this order for unnamed/generic series.
- When data has semantic meaning (e.g., revenue sources, demographic groups), colors may be assigned by domain convention but must still come from this palette.
- Never use Tailwind grays or arbitrary hex values not in `tokens.md`.
- For segments representing "empty" or "remaining" track, use `#EFEDF5` (Hover surface).

#### 3. Recharts Wrapper Pattern

Every chart must be wrapped in `ResponsiveContainer` to handle resize. Standard pattern:

```tsx
import { ResponsiveContainer } from "recharts";

<div className="h-48"> {/* or h-36, h-64 — explicit height required */}
  <ResponsiveContainer width="100%" height="100%">
    {/* Chart component here */}
  </ResponsiveContainer>
</div>
```

Standard chart heights:
| Context | Height class | Pixels |
|---------|-------------|--------|
| Compact (inside cards/panels) | `h-36` | 144px |
| Standard | `h-48` | 192px |
| Feature (hero/dashboard) | `h-64` | 256px |

Container div always gets explicit `className="h-{size}"`. Never put height on the chart component itself.

#### 4. Tooltip Pattern

Canonical tooltip styling replacing all `gray-*` drift:

```tsx
function ChartTooltip({ active, payload, label, formatter }: TooltipProps) {
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

Note: `ChartTooltipProps` is a custom interface — not Recharts' `TooltipProps<ValueType, NameType>`. The `formatter` prop is our extension. Wire it into Recharts via the `content` prop:

```tsx
<Tooltip content={<ChartTooltip formatter={(v) => `$${v.toLocaleString()}`} />} />
```

Recharts passes `active`, `payload`, and `label` automatically through the `content` prop.

Key rules:
- Border: `border-[#D4CFE2]` (Border Default)
- Shadow: `shadow-lg` (Medium elevation — same tier as map tooltips per Display docs)
- Radius: `rounded-lg`
- Label text: `text-[#8A80A8]` (Secondary)
- Value text: `text-[#403770]` (Primary / Plum)
- Name text: `text-[#6E6390]` (Body)
- Color swatch: `w-2 h-2 rounded-full` (matches Status Dot pattern from Display `_foundations.md`)

#### 5. Legend Pattern

Two layouts depending on context:

**Inline legend** (beside chart, used when space allows):
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

Grid legend uses `text-[#8A80A8]` (Secondary) for values instead of `text-[#403770]` (Primary) — this is intentional. In narrow contexts, de-emphasizing the value avoids visual competition with the label text at small sizes.

Rules:
- Color swatch: `w-2 h-2 rounded-full` — matches Status Dot from Display `_foundations.md`
- Never use Recharts' built-in `<Legend>` component — it doesn't match our token system
- Legend placement: inline (right of chart) when container ≥ 400px wide, grid (below) otherwise

#### 6. Number Formatting

Reuse the conventions from Display `_foundations.md`:

| Input | Output | Currency |
|-------|--------|----------|
| `null` / `undefined` | `"—"` | `"—"` |
| 1,000,000+ | `"1.2M"` | `"$1.2M"` |
| 1,000+ | `"12K"` | `"$12K"` |
| Below 1,000 | `"1,234"` | `"$1,234"` |

Percentages: `"45.2%"` — one decimal place, no space before `%`.

Axis tick values should use abbreviated format (K/M) to prevent label overlap.

#### 7. Empty / Loading States

- **No data**: Don't render the chart at all. Show the text `"—"` in `text-[#A69DC0]` within the chart's container area, or hide the section entirely if the parent component handles empty states.
- **Loading**: Show a skeleton placeholder: `<div className="h-48 bg-[#EFEDF5] rounded-lg animate-pulse" />`
- **Single zero-value series**: Don't render a chart for a dataset where all values are 0.

#### 8. Animation & Transitions

| Element | Recharts Prop | Value |
|---------|--------------|-------|
| Chart entry animation | `isAnimationActive` | `true` |
| Animation duration | `animationDuration` | `500` |
| Animation easing | `animationEasing` | `"ease-out"` |

Keep animations subtle. Don't animate on re-render — only on initial mount.

#### 9. Accessibility

- Every chart container must have `role="img"` and a descriptive `aria-label` summarizing the data. Templates by chart type:
  - **Donut**: `aria-label="{metric}: {value1}% {label1}, {value2}% {label2}, ..."`
    e.g., `"Revenue sources: 45% Local, 35% State, 20% Federal"`
  - **Bar**: `aria-label="{metric} by {category}: {label1} {value1}, {label2} {value2}, ..."`
    e.g., `"Spending by district: Springfield $12K, Shelbyville $9K"`
  - **Line**: `aria-label="{metric} trend from {start} to {end}"`
    e.g., `"Enrollment trend from 2020 to 2025"`
- Color alone must not convey meaning — pair colors with labels in legends and tooltips.
- Series colors follow the palette order which is designed for distinguishability; however, for charts with 5+ series, verify adjacent segments have sufficient contrast.
- Tooltip content must be accessible via keyboard focus where the chart library supports it.

---

## File 2: `donut-chart.md`

### Purpose
Guide for pie/donut charts — composition and proportion data.

### Sections

#### When to Use
- Showing how parts relate to a whole (e.g., revenue breakdown, demographic distribution)
- Best with 2–7 segments. More than 7 → group smallest into "Other"
- Not for comparing magnitudes — use bar chart instead
- Not for time-based data — use line chart instead

#### Standard Dimensions

| Prop | Compact (`h-36`) | Standard (`h-48`) |
|------|-------------------|-------------------|
| `innerRadius` | 35 | 45 |
| `outerRadius` | 55 | 75 |
| `paddingAngle` | 2 | 2 |
| `cx` / `cy` | `"50%"` | `"50%"` |

The inner radius creates the donut hole. Ratio should be ~60–65% of outer radius.

#### Color Assignment
- Segments are colored using the Data Visualization Color Palette from `_foundations.md`, in order of data value (largest segment gets slot 1).
- Sort data descending by value before passing to the chart.
- Filter out zero-value segments before rendering.

#### Legend Placement
- **In panels/cards (narrow)**: Grid legend below the chart, `grid-cols-2`
- **In dashboards (wide)**: Inline legend to the right, chart + legend in a `flex items-center gap-4` row

#### TSX Example
Complete canonical example with:
- Sorted/filtered data
- `ResponsiveContainer` wrapper
- `PieChart` + `Pie` + `Cell` from Recharts
- Custom tooltip using the foundation pattern
- Grid legend below
- `role="img"` and `aria-label` on the container

#### Codebase Examples
Table of existing components (to be updated as drift is cleaned up):

| Component | Location | Notes |
|-----------|----------|-------|
| DemographicsChart | `src/features/districts/components/DemographicsChart.tsx` | Needs token migration |
| FinanceData | `src/features/districts/components/FinanceData.tsx` | Needs token migration |
| FinanceCard | `src/features/map/components/panels/district/FinanceCard.tsx` | Needs token migration |
| ProportionalDonut | `src/features/plans/components/ProportionalDonut.tsx` | Lightweight SVG donut (no Recharts) for inline/micro use in plan cards. Keep as-is for its use case; use Recharts PieChart for full-featured donuts. Background track uses `stroke="#f0f0f0"` — migrate to `#EFEDF5`. |

---

## File 3: `bar-chart.md`

### Purpose
Guide for bar charts — categorical comparison and ranking.

### Sections

#### When to Use
- Comparing discrete categories (e.g., spending by district, activity counts by type)
- Ranking items from highest to lowest
- Showing grouped comparisons (e.g., this year vs. last year by category)
- Not for continuous data — use line chart instead
- Not for parts-of-a-whole — use donut chart instead

#### Variants

| Variant | When to use | Recharts component |
|---------|-------------|-------------------|
| Vertical | Default. Categories on x-axis, values on y-axis | `<BarChart>` + `<Bar>` |
| Horizontal | Long category labels, or ranking/leaderboard views | `<BarChart layout="vertical">` + `<Bar>` |
| Grouped | Comparing 2–3 series across categories | Multiple `<Bar>` components |
| Stacked | Showing composition within each category | `<Bar stackId="a">` on each Bar |

#### Axis Styling

| Element | Recharts Prop | Value |
|---------|--------------|-------|
| Axis line | `stroke` | `#E2DEEC` (Border Subtle) |
| Axis tick text | `fill` | `#8A80A8` (Secondary) |
| Axis tick font size | `fontSize` | `11` |
| Grid lines | `stroke` on `<CartesianGrid>` | `#EFEDF5` (Hover surface) |
| Grid line style | `strokeDasharray` | `"3 3"` |

Rules:
- Always include `<CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />` for readability.
- Hide redundant axis lines when grid is present: `<XAxis axisLine={false} tickLine={false} />`
- Use abbreviated tick formatting for large numbers (K/M).

#### Bar Styling

| Prop | Value |
|------|-------|
| `radius` | Vertical: `[4, 4, 0, 0]` (top rounded). Horizontal: `[0, 4, 4, 0]` (right rounded). |
| `maxBarSize` | `48` (prevents bars from being too wide on sparse data) |
| Bar gap | Use Recharts defaults (`barGap` and `barCategoryGap`) |

Colors: Follow the palette order from `_foundations.md`. In grouped charts, each series gets the next palette slot.

#### TSX Examples
- Vertical bar chart (simple categorical comparison)
- Horizontal bar chart (ranking/leaderboard)
- Grouped bar chart (period comparison)
- Stacked bar chart (composition per category)

Each example includes: `ResponsiveContainer`, axis configuration, grid, tooltip, legend, `role="img"` + `aria-label`.

#### Codebase Examples
(Currently no bar charts in codebase — table starts empty, filled as components are built.)

---

## File 4: `line-chart.md`

### Purpose
Guide for line and area charts — time series and continuous trends.

### Sections

#### When to Use
- Showing trends over time (e.g., enrollment over years, monthly activity counts)
- Comparing multiple series across the same time range
- Area fill variant for emphasizing volume/magnitude
- Not for categorical comparison — use bar chart instead
- Not for composition — use donut chart instead

#### Line vs. Area

| Variant | When to use | Recharts component |
|---------|-------------|-------------------|
| Line | Comparing trends — focus on direction and crossover points | `<LineChart>` + `<Line>` |
| Area | Emphasizing magnitude/volume under the curve | `<AreaChart>` + `<Area>` |

Area charts: use `fillOpacity={0.15}` and `strokeWidth={2}` so the fill is subtle and the line remains the primary visual.

#### Axis Styling
Same axis and grid rules as bar chart (see bar-chart.md § Axis Styling).

Time axis specific:
- Format dates contextually: "Jan", "Feb" for monthly; "2022", "2023" for yearly; "Mon", "Tue" for daily
- Use `tickFormatter` on `<XAxis>` — don't rely on raw date strings

#### Line Styling

| Prop | Value |
|------|-------|
| `type` | `"monotone"` (smooth curves, default) or `"linear"` (when precision matters) |
| `strokeWidth` | `2` |
| `dot` | `false` (hide dots by default — too noisy) |
| `activeDot` | `{ r: 4, stroke: '#FFFFFF', strokeWidth: 2 }` (show on hover only) |

Colors: Follow palette order from `_foundations.md`. First series = Plum, second = Steel Blue, etc.

#### Multi-Series
- Maximum 4 lines on one chart. Beyond that, the chart becomes unreadable.
- Each series must appear in the legend with its color.
- If series overlap heavily, consider small multiples (separate charts stacked vertically) instead.

#### Sparkline Variant
A minimal line chart for inline use (inside KPI cards, table cells):

| Prop | Value |
|------|-------|
| Height | `h-8` (32px) |
| `<XAxis>` / `<YAxis>` | `hide` |
| `<CartesianGrid>` | None |
| `<Tooltip>` | None |
| `strokeWidth` | `1.5` |
| `dot` | `false` |

Sparklines show trend direction only — no axes, no labels, no interactivity.

#### TSX Examples
- Single-series line chart (trend over time)
- Multi-series line chart (comparison)
- Area chart (volume emphasis)
- Sparkline variant (inline micro-chart)

Each example includes full Recharts setup with token-correct styling.

#### Codebase Examples
(Currently no line/area charts in codebase — table starts empty, filled as components are built.)

---

## File 5: `combo-chart.md`

### Purpose
Guide for combined bar + line charts — showing magnitude and trend together.

### Sections

#### When to Use
- Showing volume/counts (bars) alongside a rate, average, or trend (line) on the same chart
- e.g., monthly activity counts as bars with a 3-month rolling average line overlay
- e.g., revenue per district as bars with a target/benchmark line
- Not when both series are the same unit and scale — use grouped bar or multi-series line instead
- Not for unrelated metrics — the two series must share a meaningful relationship

#### Dual Y-Axis Pattern

| Axis | Position | Series type | Styling |
|------|----------|------------|---------|
| Left (primary) | `yAxisId="left"` | Bars (magnitude) | Tick fill `#8A80A8`, fontSize `11` |
| Right (secondary) | `yAxisId="right"` | Line (rate/trend) | Tick fill `#8A80A8`, fontSize `11`, `orientation="right"` |

Rules:
- Left axis labels the bar series, right axis labels the line series
- Both axes use the same tick styling from `_foundations.md` § Axis Styling
- Include axis labels (`<Label>`) when the units differ (e.g., "Count" on left, "%" on right) to avoid ambiguity
- Hide right axis grid lines — only the left axis grid renders `<CartesianGrid>`

#### Visual Encoding Rules
- **Bars** get the primary palette color (slot 1 — Plum `#403770`)
- **Line** gets a contrasting palette color (slot 3 — Coral `#F37167` recommended for visibility over bars)
- Bar styling follows bar-chart.md § Bar Styling (rounded top corners, `maxBarSize: 48`)
- Line styling follows line-chart.md § Line Styling (`strokeWidth: 2`, `type: "monotone"`, `dot: false`)
- The line should visually "float" above the bars — its color must contrast clearly against bar fills

#### Legend
Legend must clearly distinguish the two series types. Include a visual hint of the encoding:
- Bar series: color swatch as a small rectangle (not circle)
- Line series: color swatch as a short line segment or circle

#### TSX Example
Complete canonical example with:
- `<ComposedChart>` from Recharts (not `<BarChart>` or `<LineChart>`)
- `<Bar>` with `yAxisId="left"`
- `<Line>` with `yAxisId="right"`
- Dual `<YAxis>` components
- Custom tooltip showing both series
- Legend distinguishing bar vs. line
- `role="img"` + `aria-label`

#### Codebase Examples
(Currently no combo charts in codebase — table starts empty, filled as components are built.)

---

## Out of Scope

- Migration of existing components from gray-* to token system (separate cleanup ticket)
- Chart types beyond donut, bar, and line/area (can be added later)
- Dashboard layout composition (belongs in Layouts documentation)
- Map-specific visualizations (choropleth, heatmap layers — belong in Map documentation)
