# Combo Chart (Bar + Line)

Combined bar and line charts for showing magnitude alongside a trend — when two related metrics share the same x-axis but need different visual encodings.

See `_foundations.md` for color palette, tooltip pattern, and number formatting.
See `bar-chart.md` § Bar Styling and `line-chart.md` § Line Styling for encoding rules.

---

## When to Use

- Showing volume/counts (bars) alongside a rate, average, or trend (line)
- e.g., monthly activity counts as bars with a 3-month rolling average line overlay
- e.g., revenue per district as bars with a target/benchmark line
- Not when both series are same unit and scale — use grouped bar or multi-series line instead
- Not for unrelated metrics — the two series must share a meaningful relationship

---

## Dual Y-Axis Pattern

| Axis | Position | Series type | Styling |
|------|----------|-------------|---------|
| Left (primary) | `yAxisId="left"` | Bars (magnitude) | Tick fill `#8A80A8`, fontSize `11` |
| Right (secondary) | `yAxisId="right"` | Line (rate/trend) | Tick fill `#8A80A8`, fontSize `11`, `orientation="right"` |

**Rules:**

- Left axis labels the bar series, right axis labels the line series
- Both axes use the same tick styling from `_foundations.md` § Axis Styling
- Include axis labels (`<Label>`) when units differ (e.g., "Count" on left, "Avg" on right)
- Only the left axis gets `<CartesianGrid>` — hide grid on right axis

---

## Visual Encoding Rules

- **Bars**: Plum `#403770` (palette slot 1). Rounded top corners `radius={[4, 4, 0, 0]}`, `maxBarSize={48}` — see `bar-chart.md` § Bar Styling.
- **Line**: Coral `#F37167` (palette slot 3, chosen for contrast over Plum bars). `strokeWidth={2}`, `type="monotone"`, `dot={false}` — see `line-chart.md` § Line Styling.
- Line must float visually above bars — Coral over Plum provides sufficient contrast. Never use a line color that blends into the bar fill.

---

## Legend

- **Bar series**: small rectangle swatch (not circle) to reflect the bar encoding
- **Line series**: short line segment or circle swatch to reflect the line encoding
- Distinguish encoding type in the legend so users can tell which visual channel maps to which series
- Follow placement rules from `_foundations.md` § Legend Pattern — inline (right of chart) when container >= 400px wide, grid (below) otherwise

---

## TSX Example

### Monthly Activities with 3-Month Rolling Average

Activity counts as bars with a trailing 3-month rolling average line overlay.

```tsx
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}

/** See _foundations.md § Tooltip Pattern for the shared implementation. */
function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
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
            {entry.value != null
              ? Number.isInteger(entry.value)
                ? entry.value
                : entry.value.toFixed(1)
              : "\u2014"}
          </span>
        </div>
      ))}
    </div>
  );
}

const data = [
  { month: "Jul", count: 45, avg: null },
  { month: "Aug", count: 52, avg: null },
  { month: "Sep", count: 38, avg: 45.0 },
  { month: "Oct", count: 61, avg: 50.3 },
  { month: "Nov", count: 55, avg: 51.3 },
  { month: "Dec", count: 48, avg: 54.7 },
];

const legendItems = [
  { key: "count", label: "Activities", type: "bar" as const, color: "#403770" },
  { key: "avg", label: "3-Mo Avg", type: "line" as const, color: "#F37167" },
];

function MonthlyActivitiesWithAverage() {
  const ariaLabel =
    "Monthly activities with 3-month rolling average from July to December: " +
    data.map((d) => `${d.month} ${d.count} activities`).join(", ");

  return (
    <div>
      <div className="h-64" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#8A80A8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#8A80A8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Count",
                angle: -90,
                position: "insideLeft",
                style: { fill: "#8A80A8", fontSize: 11 },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#8A80A8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Avg",
                angle: 90,
                position: "insideRight",
                style: { fill: "#8A80A8", fontSize: 11 },
              }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              yAxisId="left"
              dataKey="count"
              name="Activities"
              fill="#403770"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
            <Line
              yAxisId="right"
              dataKey="avg"
              name="3-Mo Avg"
              stroke="#F37167"
              type="monotone"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend — rectangle swatch for bars, line swatch for trend */}
      <div className="flex items-center gap-6 mt-3">
        {legendItems.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            {item.type === "bar" ? (
              <div
                className="w-3 h-2 rounded-sm flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
            ) : (
              <div
                className="w-3 h-0 border-t-2 flex-shrink-0"
                style={{ borderColor: item.color }}
              />
            )}
            <span className="text-[#6E6390] text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

> **Note on `connectNulls`:** The rolling average line starts at month 3 (Sep). Set `connectNulls={false}` so the line begins where real averages exist — don't draw a line segment through null values.

---

## Codebase Examples

| Component | Location | Notes |
|-----------|----------|-------|
| — | — | No combo charts in codebase yet. |
