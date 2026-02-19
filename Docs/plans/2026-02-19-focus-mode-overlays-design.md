# Focus Mode Overlays — Design Doc

**Date:** 2026-02-19
**Status:** Approved

---

## Goal

Evolve the Focus Map feature into a full "Focus Mode" experience with floating data cards overlaying the map. When a user focuses on a plan, translucent cards appear showing Fullmind footprint, year-over-year performance, and FY trajectory — giving a territory command center feel without leaving the map.

## Layout

Cards float over the **map area only** (not the left panel). Positioned in corners:

```
┌─────────┬──────────────────────────────────────────┐
│         │          ┌──────────────────────┐         │
│  Plan   │          │ FY Trajectory Bar    │  top right
│  Work-  │          └──────────────────────┘         │
│  space  │                                           │
│  Panel  │                  MAP                      │
│  (as-is)│                                           │
│         │  ┌────────────┐                           │
│         │  │ Fullmind   │                           │
│         │  │ Footprint  │  bottom left              │
│         │  ├────────────┤                           │
│         │  │ YoY Perf   │  stacked below            │
│         │  └────────────┘                           │
└─────────┴───────────────────────────────────────────┘
```

## Visual Treatment

Inspired by Uniswap — clean, light, data-forward with bold typography.

Every card shares:
- **Background:** `bg-white/85` + `backdrop-blur-xl` (translucent glass)
- **Shadow:** `shadow-lg` (floating effect)
- **Border:** `border border-white/50` (subtle light edge)
- **Radius:** `rounded-2xl`
- **Dismissable:** X button removes the card for the session
- **Collapsible:** Click header to collapse to title bar only

Collapsed state: just the title + chevron, same glass treatment but compact.

## Card 1: FY Trajectory Bar (Top Right)

Horizontal comparison showing plan districts' share within the full state total.

- ~350px wide x ~80px tall
- Two horizontal bars:
  - "FY26 Bookings": full width = state total, filled plum portion = plan districts
  - "FY27 Pipeline": same treatment
- Dollar labels: `$1.2M / $4.8M` (plan / state)
- Percentage badge: `25%`

**Data source:** Aggregate fy26_closed_won_net_booking and fy27_open_pipeline across plan districts vs all districts in plan states.

## Card 2: Fullmind Footprint (Bottom Left, Top)

Fullmind's position in the state — customers, pipeline, top performers.

- ~280px wide, variable height
- State selector tabs at top: `TX | CA | NY` (one per plan state)
- Metrics for selected state:
  - **Customers:** count + penetration % (e.g., "42 of 187 districts — 22%")
  - **Open Pipeline:** dollar value + # opportunities
  - **Top 3 Districts:** by FY26 net invoicing, name + amount

**Data source:** Aggregate from districts table filtered by state, is_customer flag, pipeline columns.

## Card 3: YoY Performance (Bottom Left, Below Footprint)

Year-over-year closed won bookings vs net invoicing.

- ~280px wide x ~180px tall
- State selector tabs (synced with Footprint card)
- Recharts grouped BarChart:
  - Two groups: FY25, FY26
  - Each group: Closed Won Bookings (plum) + Net Invoicing (coral)
  - Y-axis: dollar amounts, X-axis: FY25 | FY26
- Totals shown above each bar

**Data source:** Aggregate fy25/fy26 closed_won_net_booking and net_invoicing from districts table by state.

## Data Flow

1. Focus Mode activates → store has `focusPlanId`, `focusLeaids`, `filterStates`
2. A new API route `/api/focus-mode/[planId]` fetches all overlay data in one call:
   - Aggregates district data by state for plan districts AND all state districts
   - Returns per-state breakdowns + plan-vs-state comparisons
3. Cards consume the response via a `useFocusModeData(planId)` TanStack Query hook
4. State selector tabs are local UI state, synced between Footprint and YoY cards

## Interaction Model

- Cards appear with a fade-in when Focus Mode activates
- Each card independently dismissable (X) and collapsible (header click)
- Dismissed cards stay hidden until Focus Mode is toggled off and back on
- State tabs in Footprint and YoY cards stay synced
- Clicking a "Top 3" district in the Footprint card could open the district detail

## Out of Scope

- No drag-to-reposition cards (fixed positions)
- No card resize
- No dark mode variant
- No custom chart interactions (tooltips are fine, but no drill-down)
- No persistence of dismissed/collapsed state across sessions
