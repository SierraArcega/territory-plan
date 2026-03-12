# Data Visualization Documentation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 5 markdown documentation files that standardize how data visualizations are built across the Fullmind platform using Recharts and brand tokens.

**Architecture:** Documentation-only work. A `_foundations.md` defines shared patterns (decision tree, colors, tooltips, legends, accessibility). Four chart-type guides (`donut-chart.md`, `bar-chart.md`, `line-chart.md`, `combo-chart.md`) each follow the same structure: when to use, styling specs, complete TSX examples, and codebase references. All files reference `tokens.md` and follow the convention established by existing component doc folders (Display/, Containers/, etc.).

**Tech Stack:** Markdown, Recharts v3.7.0, Tailwind CSS, brand tokens from `Documentation/UI Framework/tokens.md`

**Spec:** `docs/superpowers/specs/2026-03-11-data-visualization-docs-design.md`

---

## Chunk 1: Foundations

### Task 1: Create `_foundations.md`

The shared patterns file that all chart-type guides reference. Must be written first since every other file points back to it.

**Files:**
- Create: `Documentation/UI Framework/Components/Data Visualization/_foundations.md`
- Reference: `Documentation/UI Framework/tokens.md` (color values)
- Reference: `Documentation/UI Framework/Components/Display/_foundations.md` (number formatting, Status Dot pattern)
- Reference: `Documentation/UI Framework/Components/Containers/_foundations.md` (decision tree format)

- [ ] **Step 1: Create the Data Visualization directory**

```bash
mkdir -p "Documentation/UI Framework/Components/Data Visualization"
```

- [ ] **Step 2: Write `_foundations.md`**

The file must contain these sections in order, following the preamble pattern from Display and Containers foundations:

**Opening preamble** (match exact tone of other `_foundations.md` files):
```markdown
# Data Visualization Foundations

Shared patterns for all chart components. Every chart guide in this folder
references these foundations. If a pattern is defined here, the chart guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in chart components.
```

**Section 1: Which Chart?**
- Numbered decision tree (1–4) linking to each chart doc
- Edge-case guidance (4 bullet points from spec)

**Section 2: Data Visualization Color Palette**
- 6-slot table with Hex, Token Name, Typical Role columns
- Max series note (6 limit, "Other" uses `#EFEDF5`)
- 4 rules from spec

**Section 3: Recharts Wrapper Pattern**
- `ResponsiveContainer` wrapper code block
- Chart heights table (h-36 compact, h-48 standard, h-64 feature)
- "Never put height on the chart component" rule

**Section 4: Tooltip Pattern**
- Complete `ChartTooltip` TSX component (using `w-2 h-2` dots, `#D4CFE2` border, `#403770` values, `#6E6390` names, `#8A80A8` labels)
- Note about custom interface vs Recharts `TooltipProps`
- `<Tooltip content={...} />` wiring example
- Key rules list (7 items)

**Section 5: Legend Pattern**
- Inline legend TSX (beside chart, `text-[#403770]` values)
- Grid legend TSX (below chart, `text-[#8A80A8]` values — de-emphasized)
- Rationale for grid legend value color difference
- 3 rules: swatch size, no built-in Legend, placement threshold (400px)

**Section 6: Number Formatting**
- Reference Display `_foundations.md`
- Table: null→"—", 1M+→"1.2M", 1K+→"12K", <1K→"1,234"
- Percentage format: "45.2%"
- Axis tick abbreviation note

**Section 7: Empty / Loading States**
- No data: em dash in `#A69DC0` or hide entirely
- Loading: skeleton `bg-[#EFEDF5] rounded-lg animate-pulse`
- All zeros: don't render

**Section 8: Animation & Transitions**
- 3-row table: `isAnimationActive: true`, `animationDuration: 500`, `animationEasing: "ease-out"`
- "Only on initial mount" rule

**Section 9: Accessibility**
- `role="img"` + `aria-label` requirement
- Templates per chart type (donut, bar, line — exact format strings from spec)
- Color + label pairing rule
- 5+ series contrast verification note

All TSX code blocks use the exact hex values from the spec — no Tailwind grays.

- [ ] **Step 3: Verify the file**

Read through the complete file and confirm:
- All 9 sections present with `---` separators
- All hex values match `tokens.md`
- TSX examples compile-ready (proper JSX syntax, correct imports noted)
- Cross-references to other docs use relative links

- [ ] **Step 4: Commit**

```bash
git add "Documentation/UI Framework/Components/Data Visualization/_foundations.md"
git commit -m "docs: add data visualization foundations with decision tree and shared patterns"
```

---

## Chunk 2: Chart Type Guides (Independent Tasks)

Tasks 2–5 are independent of each other (they only depend on `_foundations.md` from Task 1). They can be executed in parallel.

### Task 2: Create `donut-chart.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Data Visualization/donut-chart.md`
- Reference: `_foundations.md` (in same folder — for palette, tooltip, legend, number formatting)
- Reference: `src/features/districts/components/DemographicsChart.tsx` (existing donut — read for context)
- Reference: `src/features/districts/components/FinanceData.tsx` (existing donut — read for context)

- [ ] **Step 1: Write the file**

Structure:

```markdown
# Donut Chart

Pie/donut charts for composition and proportion data — showing how parts relate to a whole.

See _foundations.md for color palette, tooltip pattern, legend pattern, and number formatting.

---
```

**Section: When to Use**
- 4 bullet points from spec (composition, 2-7 segments, not magnitudes, not time)

**Section: Standard Dimensions**
- Table with Compact vs Standard columns for innerRadius, outerRadius, paddingAngle, cx/cy
- Inner-to-outer ratio note (~60-65%)

**Section: Color Assignment**
- 3 rules: palette order by value, sort descending, filter zeros

**Section: Legend Placement**
- Panels/cards: grid below, `grid-cols-2`
- Dashboards: inline right, `flex items-center gap-4`

**Section: TSX Example**
Write a complete, copy-pasteable donut chart component. This is the canonical reference. Must include:
- Interface for data items (`{ key: string; value: number; label: string }`)
- Data sorting and filtering
- `ResponsiveContainer` in `h-48` container
- `PieChart` > `Pie` > `Cell` with palette colors
- Custom tooltip using the `ChartTooltip` pattern from `_foundations.md` (adapted for donut — show percentage)
- Grid legend below
- `role="img"` and computed `aria-label`
- All hex values from tokens (no grays)

Use realistic placeholder data: revenue sources (Local $4.2M 45%, State $3.1M 35%, Federal $1.8M 20%).

**Section: Codebase Examples**
- Table with 4 rows from spec (DemographicsChart, FinanceData, FinanceCard, ProportionalDonut)
- Each has Component, Location, Notes columns

- [ ] **Step 2: Verify the file**

Read through and confirm: all sections present, TSX is syntactically valid, hex values correct, cross-references work.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Data Visualization/donut-chart.md"
git commit -m "docs: add donut chart component guide"
```

---

### Task 3: Create `bar-chart.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Data Visualization/bar-chart.md`
- Reference: `_foundations.md` (palette, tooltip, legend, number formatting, axis styling)

- [ ] **Step 1: Write the file**

Structure:

```markdown
# Bar Chart

Bar charts for categorical comparison and ranking — comparing discrete values across groups.

See _foundations.md for color palette, tooltip pattern, legend pattern, and number formatting.

---
```

**Section: When to Use**
- 5 bullet points from spec

**Section: Variants**
- Table with 4 rows: Vertical, Horizontal, Grouped, Stacked — each with when-to-use and Recharts component

**Section: Axis Styling**
- Table with 5 rows: axis line stroke, tick fill, tick fontSize, grid stroke, grid strokeDasharray
- 3 rules: CartesianGrid always, hide axis lines, abbreviated ticks

**Section: Bar Styling**
- Table: radius (vertical vs horizontal noted), maxBarSize, bar gap
- Color rule: palette order, grouped charts get sequential slots

**Section: TSX Examples**
Write 4 complete examples:

1. **Vertical bar chart** — spending by category (5 categories). Uses `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, custom legend. Includes `role="img"` + `aria-label`.

2. **Horizontal bar chart** — district ranking (top 5). Uses `BarChart layout="vertical"`, `XAxis type="number"`, `YAxis type="category" dataKey="name"`. Radius `[0, 4, 4, 0]`.

3. **Grouped bar chart** — this year vs last year across 4 categories. Two `<Bar>` components, palette slots 1 and 2.

4. **Stacked bar chart** — composition per category. Multiple `<Bar stackId="a">` with sequential palette colors.

All examples use realistic territory planning data (district names, activity counts, dollar amounts). All use token-correct hex values.

**Section: Codebase Examples**
- Empty table with headers (Component, Location, Notes) and note: "No bar charts in codebase yet."

- [ ] **Step 2: Verify the file**

Read through and confirm: 4 TSX examples present and syntactically valid, axis/bar styling tables correct, hex values match tokens.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Data Visualization/bar-chart.md"
git commit -m "docs: add bar chart component guide with 4 variant examples"
```

---

### Task 4: Create `line-chart.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Data Visualization/line-chart.md`
- Reference: `_foundations.md` (palette, tooltip, legend, number formatting)
- Reference: `bar-chart.md` (axis styling — cross-referenced, not duplicated)

- [ ] **Step 1: Write the file**

Structure:

```markdown
# Line / Area Chart

Line and area charts for time series and continuous trends — showing how values change over a period.

See _foundations.md for color palette, tooltip pattern, legend pattern, and number formatting.

---
```

**Section: When to Use**
- 5 bullet points from spec

**Section: Line vs. Area**
- Table: Line (comparing trends) vs Area (emphasizing volume). Recharts components noted.
- Area chart rule: `fillOpacity={0.15}`, `strokeWidth={2}`

**Section: Axis Styling**
- "Same axis and grid rules as bar-chart.md § Axis Styling." (don't duplicate)
- Time axis specific: date formatting guidance (monthly, yearly, daily examples)
- `tickFormatter` on `<XAxis>` rule

**Section: Line Styling**
- Table: type, strokeWidth, dot, activeDot (exact values from spec)
- Color rule: palette order

**Section: Multi-Series**
- Max 4 lines rule
- Legend requirement
- Small multiples alternative for heavy overlap

**Section: Sparkline Variant**
- Table with 6 props (height, XAxis, YAxis, CartesianGrid, Tooltip, strokeWidth, dot)
- "No axes, no labels, no interactivity" summary

**Section: TSX Examples**
Write 4 complete examples:

1. **Single-series line chart** — enrollment trend over 6 years. `LineChart`, `Line type="monotone"`, `XAxis` with year labels, `CartesianGrid`, custom tooltip, `role="img"` + `aria-label`.

2. **Multi-series line chart** — 2 districts compared over 6 years. Two `<Line>` components with palette slots 1 and 2. Legend below.

3. **Area chart** — monthly activity volume. `AreaChart`, `Area` with `fillOpacity={0.15}`, subtle gradient fill using Plum.

4. **Sparkline** — inline micro-chart. `LineChart` at `h-8`, all axes/grid/tooltip hidden, `strokeWidth={1.5}`. Shows just the line, nothing else.

All examples use realistic territory planning data and token-correct hex values.

**Section: Codebase Examples**
- Empty table with note: "No line/area charts in codebase yet."

- [ ] **Step 2: Verify the file**

Read through and confirm: 4 TSX examples present, sparkline is truly minimal, axis cross-reference to bar-chart.md works, hex values correct.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Data Visualization/line-chart.md"
git commit -m "docs: add line/area chart component guide with sparkline variant"
```

---

### Task 5: Create `combo-chart.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Data Visualization/combo-chart.md`
- Reference: `_foundations.md` (palette, tooltip, legend)
- Reference: `bar-chart.md` (bar styling cross-reference)
- Reference: `line-chart.md` (line styling cross-reference)

- [ ] **Step 1: Write the file**

Structure:

```markdown
# Combo Chart (Bar + Line)

Combined bar and line charts for showing magnitude alongside a trend — when two related metrics share the same x-axis but need different visual encodings.

See _foundations.md for color palette, tooltip pattern, and number formatting.
See bar-chart.md § Bar Styling and line-chart.md § Line Styling for encoding rules.

---
```

**Section: When to Use**
- 4 bullet points from spec (volume + rate, rolling average, target line, not-same-scale, not-unrelated)

**Section: Dual Y-Axis Pattern**
- Table: left axis (bars, `yAxisId="left"`) vs right axis (line, `yAxisId="right"`, `orientation="right"`)
- 4 rules from spec (left labels bars, both same tick styling, include axis Labels for differing units, only left axis gets CartesianGrid)

**Section: Visual Encoding Rules**
- Bars: Plum `#403770` (slot 1)
- Line: Coral `#F37167` (slot 3, for contrast over bars)
- Cross-references to bar-chart.md and line-chart.md for styling details
- "Line must float visually above bars" rule

**Section: Legend**
- Bar series: small rectangle swatch (not circle)
- Line series: short line segment or circle swatch
- Distinguish encoding type in legend

**Section: TSX Example**
Write 1 complete example:

**Monthly activities (bars) with 3-month rolling average (line):**
- `ComposedChart` from Recharts
- `<Bar yAxisId="left">` with Plum fill, rounded top corners
- `<Line yAxisId="right">` with Coral stroke, `type="monotone"`, `dot={false}`
- Dual `<YAxis>` components (left: "Count", right: "Avg")
- `<CartesianGrid>` on left axis only
- Custom tooltip showing both bar value and line value
- Custom legend with rectangle swatch for bars, line swatch for trend
- `role="img"` + `aria-label`
- 6 months of realistic data (Jul–Dec)

**Section: Codebase Examples**
- Empty table with note: "No combo charts in codebase yet."

- [ ] **Step 2: Verify the file**

Read through and confirm: `ComposedChart` import correct, dual axes properly configured, legend differentiates bar vs line, hex values match tokens.

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Data Visualization/combo-chart.md"
git commit -m "docs: add combo chart (bar + line) component guide"
```

---

## Chunk 3: Final Verification

### Task 6: Cross-file verification and final commit

- [ ] **Step 1: Verify all 5 files exist**

```bash
ls -la "Documentation/UI Framework/Components/Data Visualization/"
```

Expected: `_foundations.md`, `donut-chart.md`, `bar-chart.md`, `line-chart.md`, `combo-chart.md`

- [ ] **Step 2: Verify cross-references**

Check that:
- `_foundations.md` links to all 4 chart guides in the decision tree
- Each chart guide references `_foundations.md` in its preamble
- `bar-chart.md` doesn't duplicate axis styling that `line-chart.md` cross-references
- `combo-chart.md` cross-references both `bar-chart.md` and `line-chart.md`

- [ ] **Step 3: Verify no Tailwind grays leaked in**

Search all 5 files for `gray-` — should return zero matches:

```bash
grep -r "gray-" "Documentation/UI Framework/Components/Data Visualization/"
```

Expected: no output

- [ ] **Step 4: Verify all hex values are from tokens.md**

Spot-check that hex values used in TSX examples match the token system:
- `#403770` (Plum), `#6EA3BE` (Steel Blue), `#F37167` (Coral), `#FFCF70` (Golden), `#EDFFE3` (Mint), `#C4E7E6` (Robin's Egg)
- `#D4CFE2` (Border Default), `#E2DEEC` (Border Subtle), `#EFEDF5` (Hover)
- `#8A80A8` (Secondary text), `#6E6390` (Body text), `#A69DC0` (Muted text)

No arbitrary hex values outside this set.
