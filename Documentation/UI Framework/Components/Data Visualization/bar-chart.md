# Bar Chart

Bar charts for categorical comparison and ranking — comparing discrete values across groups.

See `_foundations.md` for color palette, tooltip pattern, legend pattern, and number formatting.

---

## When to Use

- Comparing discrete categories (e.g., spending by district, activity counts by type)
- Ranking items from highest to lowest
- Showing grouped comparisons (e.g., this year vs. last year by category)
- Not for continuous data — use line chart instead
- Not for parts-of-a-whole — use donut chart instead

---

## Variants

| Variant | When to use | Recharts component |
|---------|-------------|-------------------|
| Vertical | Default. Categories on x-axis, values on y-axis | `<BarChart>` + `<Bar>` |
| Horizontal | Long category labels, or ranking/leaderboard views | `<BarChart layout="vertical">` + `<Bar>` |
| Grouped | Comparing 2–3 series across categories | Multiple `<Bar>` components |
| Stacked | Showing composition within each category | `<Bar stackId="a">` on each Bar |

---

## Axis Styling

| Element | Recharts Prop | Value |
|---------|--------------|-------|
| Axis line | `stroke` | `#E2DEEC` (Border Subtle) |
| Axis tick text | `fill` | `#8A80A8` (Secondary) |
| Axis tick font size | `fontSize` | `11` |
| Grid lines | `stroke` on `<CartesianGrid>` | `#EFEDF5` (Hover surface) |
| Grid line style | `strokeDasharray` | `"3 3"` |

- Always include `<CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />` for readability
- Hide redundant axis lines when grid is present: `<XAxis axisLine={false} tickLine={false} />`
- Use abbreviated tick formatting for large numbers (K/M)

---

## Bar Styling

| Prop | Value |
|------|-------|
| `radius` | Vertical: `[4, 4, 0, 0]` (top rounded). Horizontal: `[0, 4, 4, 0]` (right rounded). |
| `maxBarSize` | `48` |
| Bar gap | Use Recharts defaults |

Color rule: Follow palette order from `_foundations.md`. Grouped charts assign sequential palette slots to each series.

---

## TSX Examples

### Vertical Bar Chart

Spending by budget category — single series, vertical bars.

```tsx
import {
  BarChart,
  Bar,
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
  { category: "Instruction", amount: 245000 },
  { category: "Administration", amount: 128000 },
  { category: "Transportation", amount: 87000 },
  { category: "Facilities", amount: 64000 },
  { category: "Technology", amount: 52000 },
];

function SpendingByCategory() {
  const ariaLabel =
    "Spending by category: " +
    data.map((d) => `${d.category} $${(d.amount / 1000).toFixed(0)}K`).join(", ");

  return (
    <div className="h-48" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />
          <XAxis
            dataKey="category"
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v / 1000}K`}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={(v) => `$${v.toLocaleString()}`} />
            }
          />
          <Bar
            dataKey="amount"
            name="Spending"
            fill={PALETTE[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Horizontal Bar Chart

District ranking — top 5 districts by activity count, horizontal layout for long labels.

```tsx
import {
  BarChart,
  Bar,
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
  { name: "Springfield Unified", count: 342 },
  { name: "Shelbyville Central", count: 287 },
  { name: "Capital Heights", count: 231 },
  { name: "Riverside Academy", count: 198 },
  { name: "Lakewood Regional", count: 156 },
];

function DistrictRanking() {
  const ariaLabel =
    "District ranking by activity count: " +
    data.map((d) => `${d.name} ${d.count}`).join(", ");

  return (
    <div className="h-48" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />
          <XAxis
            type="number"
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={130}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={(v) => v.toLocaleString()} />
            }
          />
          <Bar
            dataKey="count"
            name="Activities"
            fill={PALETTE[0]}
            radius={[0, 4, 4, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Grouped Bar Chart

Year-over-year comparison across outreach activity types — two series (This Year vs. Last Year).

```tsx
import {
  BarChart,
  Bar,
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
  { category: "Calls", thisYear: 184, lastYear: 142 },
  { category: "Visits", thisYear: 97, lastYear: 110 },
  { category: "Emails", thisYear: 312, lastYear: 275 },
  { category: "Events", thisYear: 45, lastYear: 38 },
];

function OutreachComparison() {
  const ariaLabel =
    "Outreach activities this year vs last year by category: " +
    data
      .map((d) => `${d.category} ${d.thisYear} vs ${d.lastYear}`)
      .join(", ");

  return (
    <div className="h-48" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />
          <XAxis
            dataKey="category"
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            dataKey="thisYear"
            name="This Year"
            fill={PALETTE[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
          <Bar
            dataKey="lastYear"
            name="Last Year"
            fill={PALETTE[1]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Stacked Bar Chart

Budget composition per quarter — three spending categories stacked within each bar.

```tsx
import {
  BarChart,
  Bar,
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
  { quarter: "Q1", personnel: 185000, operations: 72000, programs: 43000 },
  { quarter: "Q2", personnel: 192000, operations: 68000, programs: 51000 },
  { quarter: "Q3", personnel: 178000, operations: 75000, programs: 47000 },
  { quarter: "Q4", personnel: 201000, operations: 81000, programs: 55000 },
];

function QuarterlyBudgetBreakdown() {
  const ariaLabel =
    "Quarterly budget breakdown by Personnel, Operations, and Programs: " +
    data
      .map(
        (d) =>
          `${d.quarter} $${((d.personnel + d.operations + d.programs) / 1000).toFixed(0)}K total`
      )
      .join(", ");

  return (
    <div className="h-48" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFEDF5" />
          <XAxis
            dataKey="quarter"
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8A80A8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v / 1000}K`}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={(v) => `$${v.toLocaleString()}`} />
            }
          />
          <Bar
            dataKey="personnel"
            name="Personnel"
            stackId="a"
            fill={PALETTE[0]}
            maxBarSize={48}
          />
          <Bar
            dataKey="operations"
            name="Operations"
            stackId="a"
            fill={PALETTE[1]}
            maxBarSize={48}
          />
          <Bar
            dataKey="programs"
            name="Programs"
            stackId="a"
            fill={PALETTE[2]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

> **Note on stacked radius:** Only the top-most `<Bar>` in the stack gets `radius={[4, 4, 0, 0]}`. Applying radius to inner stack segments creates visual gaps.

---

## Codebase Examples

| Component | Location | Notes |
|-----------|----------|-------|
| — | — | No bar charts in codebase yet. |
