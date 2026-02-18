# HomePanel Goals + FY Organization — Design

**Date:** 2026-02-18
**Status:** Approved

## Overview

Enrich the Map V2 HomePanel to show goal progress and organize plans by fiscal year. When a user logs in and lands on the map, the home tab shows their profile, their goals progress for a selected FY, and their plans for that FY — all in one scrollable view.

## Structure (top to bottom)

1. **Profile Card** — existing, unchanged
2. **Divider**
3. **FY Pill Tabs** — horizontal row: `FY26 | FY27 | FY28 | FY29`
   - Default selection: `getDefaultFiscalYear()` (current FY)
   - Controls both goals and plans sections below
4. **Goals Summary Card** — stacked rows, always expanded (no collapse):
   - Earnings: `$current / $target` + thin progress bar + `XX%`
   - Take: `$current / $target` + thin progress bar + `XX%`
   - Total Target: `$current / $target` + thin progress bar + `XX%`
   - New Districts: `X / Y` + thin progress bar + `XX%`
   - Colors: coral (#F37167) for Earnings, teal (#6EA3BE) for Take, plum (#403770) for Total Target + New Districts
   - Empty state: "Set goals" link if no goals for selected FY
5. **Plans List** — filtered by `plan.fiscalYear === selectedFY`
   - Existing compact style: color dot + plan name + district count
   - "New plan" button at bottom
   - Empty state: "No plans for FY{XX}" message

## Data Sources

- `useGoalDashboard(selectedFY)` — existing hook, returns goals/actuals/planTotals
- `useTerritoryPlans()` — existing hook, filter client-side by `fiscalYear`
- `getDefaultFiscalYear()` — from `@/components/goals/ProgressCard`

## Metrics Computation

| Row | Current | Target | Source |
|-----|---------|--------|--------|
| Earnings | `actuals.earnings` | `goals.earningsTarget` | GoalDashboard |
| Take | `actuals.take` | `goals.takeTarget` | GoalDashboard |
| Total Target | `actuals.revenue + actuals.pipeline` | sum of renewal/winback/expansion/newBusiness targets | GoalDashboard |
| New Districts | `actuals.newDistricts` | `goals.newDistrictsTarget` | GoalDashboard |

## File Changes

- `src/components/map-v2/panels/HomePanel.tsx` — add FY tabs, goals card, filter plans by FY

No new files, API routes, or DB changes needed.
