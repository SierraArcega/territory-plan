# Line / Area Chart

Line and area charts for time series and continuous trends — showing how values change over a period.

See `_foundations.md` for color palette, tooltip pattern, legend pattern, and number formatting.

---

## When to Use

- Showing trends over time (e.g., enrollment over years, monthly activity counts)
- Comparing multiple series across the same time range
- Area fill variant for emphasizing volume/magnitude
- Not for categorical comparison — use bar chart instead
- Not for composition — use donut chart instead

---

## Line vs. Area

| Variant | When to use | Recharts component |
|---------|-------------|-------------------|
| Line | Comparing trends — focus on direction and crossover points | `<LineChart>` + `<Line>` |
| Area | Emphasizing magnitude/volume under the curve | `<AreaChart>` + `<Area>` |

Area charts use `fillOpacity={0.15}` and `strokeWidth={2}` so fill is subtle.

---

## Axis Styling

Same axis and grid rules as `bar-chart.md` § Axis Styling. All axis lines, tick text, grid lines, and grid dash arrays follow the same token values defined there.

**Time axis specifics:**

- Format dates contextually: `"Jan"`, `"Feb"` for monthly; `"2022"`, `"2023"` for yearly; `"Mon"`, `"Tue"` for daily
- Use `tickFormatter` on `<XAxis>` — don't rely on raw date strings
- When data points are dense (e.g., daily over a year), use `interval="preserveStartEnd"` or a custom `ticks` array to avoid overlapping labels

---

## Line Styling

| Prop | Value |
|------|-------|
| `type` | `"monotone"` (smooth curves, default) or `"linear"` (when precision matters) |
| `strokeWidth` | `2` |
| `dot` | `false` (hide dots by default — too noisy) |
| `activeDot` | `{ r: 4, stroke: '#FFFFFF', strokeWidth: 2 }` (show on hover only) |

Colors: Follow palette order from `_foundations.md`. First series = Plum `#403770`, second = Steel Blue `#6EA3BE`, third = Coral `#F37167`, fourth = Golden `#FFCF70`.

---

## Multi-Series

- Max 4 lines on one chart
- Each series must appear in legend with color
- Heavy overlap → consider small multiples (separate charts stacked vertically)

---

## Sparkline Variant

| Prop | Value |
|------|-------|
| Height | `h-8` (32 px) |
| `<XAxis>` / `<YAxis>` | `hide` |
| `<CartesianGrid>` | None |
| `<Tooltip>` | None |
| `strokeWidth` | `1.5` |
| `dot` | `false` |

No axes, no labels, no interactivity. A sparkline is a pure shape — it communicates direction only.

---

## TSX Examples

### Single-Series Line Chart

Enrollment trend over 6 years — single line showing direction of growth.

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PALETTE = ["#403770", "#6EA3BE", "#F37167", "#FFCF70", "#EDFFE3", "#C4E7E6"];

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  formatter?: (value: number) => string;
}

/** See _foundations.md § Tooltip Pattern for the shared implementation. */
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

const data = [
  { year: "2020", enrollment: 12400 },
  { year: "2021", enrollment: 12800 },
  { year: "2022", enrollment: 13100 },
  { year: "2023", enrollment: 12900 },
  { year: "2024", enrollment: 13500 },
  { year: "2025", enrollment: 14200 },
];

function EnrollmentTrend() {
  return (
    <div className="h-48" role="img" aria-label="Enrollment trend from 2020 to 2025">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />
          <XAxis
            dataKey="year"
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}K`}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={(v) => v.toLocaleString()} />
            }
          />
          <Line
            type="monotone"
            dataKey="enrollment"
            name="Enrollment"
            stroke={PALETTE[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Multi-Series Line Chart

Two districts compared over the same 6-year period — legend below the chart.

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PALETTE = ["#403770", "#6EA3BE", "#F37167", "#FFCF70", "#EDFFE3", "#C4E7E6"];

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  formatter?: (value: number) => string;
}

/** See _foundations.md § Tooltip Pattern for the shared implementation. */
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

const data = [
  { year: "2020", springfield: 12400, shelbyville: 8900 },
  { year: "2021", springfield: 12800, shelbyville: 9200 },
  { year: "2022", springfield: 13100, shelbyville: 9100 },
  { year: "2023", springfield: 12900, shelbyville: 9600 },
  { year: "2024", springfield: 13500, shelbyville: 10100 },
  { year: "2025", springfield: 14200, shelbyville: 10800 },
];

const series = [
  { key: "springfield", label: "Springfield Unified", color: PALETTE[0] },
  { key: "shelbyville", label: "Shelbyville Central", color: PALETTE[1] },
];

function DistrictEnrollmentComparison() {
  return (
    <div>
      <div
        className="h-48"
        role="img"
        aria-label="Enrollment comparison: Springfield Unified vs Shelbyville Central from 2020 to 2025"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />
            <XAxis
              dataKey="year"
              tick={{ fill: "#8A80A8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8A80A8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}K`}
            />
            <Tooltip
              content={
                <ChartTooltip formatter={(v) => v.toLocaleString()} />
              }
            />
            <Line
              type="monotone"
              dataKey="springfield"
              name="Springfield Unified"
              stroke={PALETTE[0]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="shelbyville"
              name="Shelbyville Central"
              stroke={PALETTE[1]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Grid legend — see _foundations.md § Legend Pattern */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[#6E6390] text-xs truncate">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Area Chart

Monthly outreach activity volume — area fill emphasizes cumulative magnitude.

```tsx
import {
  AreaChart,
  Area,
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
  formatter?: (value: number) => string;
}

/** See _foundations.md § Tooltip Pattern for the shared implementation. */
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

const data = [
  { month: "Jan", activities: 142 },
  { month: "Feb", activities: 168 },
  { month: "Mar", activities: 203 },
  { month: "Apr", activities: 187 },
  { month: "May", activities: 224 },
  { month: "Jun", activities: 251 },
];

function MonthlyActivityVolume() {
  return (
    <div
      className="h-48"
      role="img"
      aria-label="Monthly activity volume from January to June"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />
          <XAxis
            dataKey="month"
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={(v) => v.toLocaleString()} />
            }
          />
          <Area
            type="monotone"
            dataKey="activities"
            name="Activities"
            stroke="#403770"
            strokeWidth={2}
            fill="#403770"
            fillOpacity={0.15}
            dot={false}
            activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Sparkline

Inline micro-chart — no axes, no labels, no interactivity. Just the trend line.

```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts";

const data = [
  { v: 42 }, { v: 48 }, { v: 45 }, { v: 53 },
  { v: 51 }, { v: 58 }, { v: 55 }, { v: 62 },
];

function Sparkline() {
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="v"
            stroke="#403770"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Codebase Examples

| Component | Location | Notes |
|-----------|----------|-------|
| — | — | No line/area charts in codebase yet. |
