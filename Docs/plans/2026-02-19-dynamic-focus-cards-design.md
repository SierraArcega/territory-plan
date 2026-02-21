# Dynamic Focus Mode Visualization Cards — Design

**Date:** 2026-02-19
**Status:** Approved
**Inspiration:** Uniswap Explore page — area charts with gradient fills, bold headline numbers, clean data-forward aesthetic

## Overview

Redesign the three focus mode overlay cards (TrajectoryCard, FootprintCard, YoYCard) with Recharts area/bar charts, animated number counters, staggered entrance animations, and a cockpit-style layout spreading cards to different corners of the map viewport.

## Decisions

- **Chart library:** Recharts only (already in bundle at v3.7.0)
- **Historical data:** Design for N fiscal years, render with FY25+FY26 today
- **Layout:** Cockpit spread — cards in corners around the map
- **Animations:** Staggered float-in from edges, animated counters, chart animation delays
- **Brand color fix:** Switch second bar series from Coral to Steel Blue (Coral reserved for negative signals per brand guide)

## Card Layout

```
┌──────────────────────────────────────────────┐
│                              [Revenue Trend] │
│                              top-right 320px │
│                                              │
│              🗺️  MAP                          │
│                                              │
│ [Footprint]                  [YoY Perf]      │
│ bottom-left 280px            bottom-right    │
│ left-[396px]                 300px           │
└──────────────────────────────────────────────┘
```

## Card 1: Revenue Trend (replaces TrajectoryCard)

Position: `absolute top-4 right-4`, width 320px

### Content
- **Headline**: Big bold `$X.XM` total net invoicing (FY26, plan districts)
- **Delta badge**: YoY change vs FY25 — mint for positive, coral for negative
- **Subtitle**: "Net Invoicing · Plan Districts"
- **Recharts AreaChart** (height ~120px):
  - Data points: one per FY (FY25, FY26 today — more when loaded)
  - Plum-to-transparent gradient fill via SVG `<linearGradient>`
  - `monotone` curve interpolation
  - X-axis: FY labels only, minimal styling
  - Y-axis: hidden (clean Uniswap aesthetic)
  - Custom tooltip with formatted currency
  - `animationDuration={1000}` `animationBegin={500}`
- **Below chart**: Two compact metric rows:
  - FY26 Bookings: plan/state ratio with mini progress bar
  - FY27 Pipeline: plan/state ratio with mini progress bar

## Card 2: Territory Footprint (upgraded FootprintCard)

Position: `absolute bottom-4 left-[396px]`, width 280px

### Content
- **State selector tabs** (unchanged UX, synced with YoY)
- **Customers**: Animated counter (0 → N), penetration % with small horizontal bar fill (plum)
- **Open Pipeline**: Animated counter for dollar amount, opp count
- **Top 3 Districts**: Name + currency, small inline relative-size bars showing proportion

## Card 3: YoY Performance (upgraded YoYCard)

Position: `absolute bottom-4 right-4`, width 300px

### Content
- **State selector tabs** (synced with Footprint)
- **Delta badges** next to title: `+$X` or `-$X` change between FY25→FY26
- **Recharts BarChart** (same grouped bars, upgraded styling):
  - Bar colors: Plum (#403770) for Closed Won, Steel Blue (#6EA3BE) for Net Invoicing
  - `animationDuration={800}` `animationBegin={500}`
  - Cleaner axis/legend styling matching brand typography

## Animations

### Entrance: `<AnimatedCard>` wrapper

Each card wrapped in a component providing:
- `opacity: 0 → 1`
- `translateX(±20px) → translateX(0)` (direction based on card's edge)
- Staggered `delay` prop: 0ms, 150ms, 300ms
- `transition: all 600ms cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)
- Triggered by a `visible` boolean (set on mount)

### Animated numbers: `useAnimatedNumber` hook

- Takes target number, returns animated current value
- Uses `requestAnimationFrame`, duration ~600ms
- Starts after card entrance delay completes
- Used for headline currency values and customer count

### Chart animations

- Recharts native `animationDuration` and `animationBegin` props
- Area chart: 1000ms duration, 500ms begin delay
- Bar chart: 800ms duration, 500ms begin delay

## Brand Compliance

| Element | Color | Semantic meaning |
|---------|-------|-----------------|
| Area chart gradient fill | Plum `#403770` → transparent | Primary data series |
| Positive delta badge | `bg-[#EDFFE3] text-[#5f665b]` | Growth signal |
| Negative delta badge | `bg-[#F37167]/15 text-[#c25a52]` | Declining signal |
| Closed Won bars | Plum `#403770` | Primary data |
| Net Invoicing bars | Steel Blue `#6EA3BE` | Baseline/comparison |
| Progress bars | Plum `#403770` | Primary UI |
| Card background | `bg-white/85 backdrop-blur-xl` | Frosted glass (unchanged) |

## Files to Modify

- `src/components/map-v2/focus-mode/FocusModeOverlay.tsx` — new layout + AnimatedCard wrapper
- `src/components/map-v2/focus-mode/FocusCard.tsx` — minor: accept animation delay prop
- `src/components/map-v2/focus-mode/TrajectoryCard.tsx` → rename to `RevenueTrendCard.tsx`, full rewrite with AreaChart
- `src/components/map-v2/focus-mode/FootprintCard.tsx` — add animated counters, inline bars
- `src/components/map-v2/focus-mode/YoYCard.tsx` — steel blue bars, delta badges, animation timing

## New Files

- `src/components/map-v2/focus-mode/AnimatedCard.tsx` — entrance animation wrapper
- `src/hooks/useAnimatedNumber.ts` — animated number counter hook

## No New Dependencies

Everything uses Recharts (existing) + CSS transitions + requestAnimationFrame.
