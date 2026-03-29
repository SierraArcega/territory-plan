# Leaderboard Admin — Handoff Notes

**Branch:** feat/seasonal-leaderboard
**Date:** 2026-03-28

## Where we left off

Design/brainstorm phase is **complete**. Spec is written and committed. Next step is to **invoke the writing-plans skill** to create an implementation plan from the spec.

## What to do next session

1. Review the spec if you haven't already: `Docs/superpowers/specs/2026-03-28-leaderboard-admin-spec.md`
2. Tell Claude to proceed with the implementation plan (it will invoke the `writing-plans` skill)
3. Decide whether to continue on `feat/seasonal-leaderboard` or branch to `feat/leaderboard-admin`

## Spec summary

Admin Leaderboard tab in AdminDashboard with 5 collapsible sections:

1. **Season Identity** — name (decorative/reusable), timestamp UID (`s_{unix}`), dates (nullable end), visibility toggles (showName/showDates to reps)
2. **Scoring Metrics** — searchable dropdown from MetricRegistry, point values + per-metric weights, default 3 metrics, soft gate at 5 with "are you sure"
3. **Tier Thresholds** — visual cards with inline-editable point values, current rep counts
4. **Combined Score Weights** — Season/Pipeline/Take sliders, must sum to 100%
5. **Season Transition** — soft reset depth stepper with live preview

Plus: preview/confirm modal on every save (shows before→after + rep impact), New Season / End Season / Export History buttons, empty state for first-time setup.

## Data model changes needed

- `Season`: add `seasonUid`, `showName`, `showDates`; make `endDate` nullable
- `SeasonMetric`: add `weight` (Decimal, default 1.0)
- New model: `MetricRegistry` (action, label, description, category)
- Update `awardPoints()` to use `pointValue * weight`

## Pending polish from previous sessions (not part of admin spec)

- `isMe` detection in modal rankings may need fixing (comparing userId to rank number string)
- Revenue targeted scoring hook not wired into district target updates yet
- Some docs still reference old Iron/Bronze/Silver/Gold terminology
