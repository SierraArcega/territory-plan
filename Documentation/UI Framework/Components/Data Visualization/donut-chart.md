# Donut Chart

Pie/donut charts for composition and proportion data — showing how parts relate to a whole.

See `_foundations.md` for color palette, tooltip pattern, legend pattern, and number formatting.

---

## When to Use

- Showing how parts relate to a whole (e.g., revenue breakdown, demographic distribution)
- Best with 2–7 segments. More than 7 → group smallest into "Other"
- Not for comparing magnitudes — use bar chart instead
- Not for time-based data — use line chart instead

---

## Standard Dimensions

| Prop | Compact (`h-36`) | Standard (`h-48`) |
|------|-------------------|-------------------|
| `innerRadius` | 35 | 45 |
| `outerRadius` | 55 | 75 |
| `paddingAngle` | 2 | 2 |
| `cx` / `cy` | `"50%"` | `"50%"` |

Inner radius creates the donut hole. Keep the ratio at ~60–65% of outer radius.

---

## Color Assignment

- Segments are colored using the Data Visualization Color Palette from `_foundations.md`, in slot order (largest segment gets slot 1).
- Sort data descending by value before passing to the chart.
- Filter out zero-value segments before rendering.

---

## Legend Placement

- **Panels/cards (narrow):** Grid legend below the chart, `grid-cols-2`. See `_foundations.md` § Grid Legend.
- **Dashboards (wide):** Inline legend to the right — chart and legend in a `flex items-center gap-4` row. See `_foundations.md` § Inline Legend.

---

## TSX Example

Complete donut chart with tooltip, grid legend, and accessibility label.

```tsx
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PALETTE = ["#403770", "#6EA3BE", "#F37167", "#FFCF70", "#EDFFE3", "#C4E7E6"];

interface DonutDataItem {
  key: string;
  value: number;
  label: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number; payload: DonutDataItem }>;
  formatter?: (value: number) => string;
}

/** See _foundations.md § Tooltip Pattern for the shared implementation. */
function ChartTooltip({ active, payload, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  return (
    <div className="bg-white border border-[#D4CFE2] shadow-lg rounded-lg px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: entry.color }}
        />
        <span className="text-[#6E6390]">{entry.name}</span>
        <span className="ml-auto font-medium text-[#403770]">
          {formatter ? formatter(entry.value) : entry.value}
        </span>
      </div>
    </div>
  );
}

// --- Realistic placeholder data: revenue sources ---

const RAW_DATA: DonutDataItem[] = [
  { key: "local", value: 4_200_000, label: "Local" },
  { key: "state", value: 3_100_000, label: "State" },
  { key: "federal", value: 1_800_000, label: "Federal" },
];

function RevenueDonut() {
  // 1. Filter zero values
  const filtered = RAW_DATA.filter((d) => d.value > 0);

  // 2. Sort descending by value (largest → slot 1 in palette)
  const sorted = [...filtered].sort((a, b) => b.value - a.value);

  // 3. Compute total and percentages
  const total = sorted.reduce((sum, d) => sum + d.value, 0);
  const withPct = sorted.map((d) => ({
    ...d,
    pct: Math.round((d.value / total) * 100),
  }));

  // 4. Build aria-label
  const ariaLabel =
    "Revenue sources: " +
    withPct.map((d) => `${d.pct}% ${d.label}`).join(", ");

  return (
    <div>
      {/* Chart */}
      <div className="h-48" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={withPct}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
              isAnimationActive={true}
              animationDuration={500}
              animationEasing="ease-out"
            >
              {withPct.map((_, i) => (
                <Cell key={sorted[i].key} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Grid legend — see _foundations.md § Grid Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
        {withPct.map((d, i) => (
          <div key={d.key} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <span className="text-[#6E6390] text-xs truncate">{d.label}</span>
            <span className="text-[#8A80A8] text-xs ml-auto">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Codebase Examples

| Component | Location | Notes |
|-----------|----------|-------|
| DemographicsChart | `src/features/districts/components/DemographicsChart.tsx` | Needs token migration |
| FinanceData | `src/features/districts/components/FinanceData.tsx` | Needs token migration |
| FinanceCard | `src/features/map/components/panels/district/FinanceCard.tsx` | Needs token migration |
| ProportionalDonut | `src/features/plans/components/ProportionalDonut.tsx` | Lightweight SVG donut (no Recharts) for inline/micro use in plan cards. Keep as-is for its use case; use Recharts PieChart for full-featured donuts. Background track uses `stroke="#f0f0f0"` — migrate to `#EFEDF5`. |
