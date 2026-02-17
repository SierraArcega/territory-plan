# Future: Per-FY Pipeline & Plan Rollup Vision

> **Status:** Not yet designed. Captured during FY toggle brainstorm (2026-02-17) for a follow-up session.

## Context

While designing the FY fiscal year toggle for the map view, Sierra outlined a bigger vision for how pipeline and target data should evolve. This doc captures that intent so we can brainstorm and plan it properly.

## Per-FY Pipeline Columns

**Current state:** The districts table has `fy26_open_pipeline` and `fy27_open_pipeline` but no historical pipeline columns (FY25, FY24, etc.).

**Vision:** Each fiscal year should have its own open pipeline column on the districts table. Past FYs will always be empty (pipeline closes at year-end), but current and future FYs will reflect actuals. These are manually loaded today but will eventually come from a CRM integration.

**Why it matters:** When the FY toggle is set to a past year, the "pipeline" engagement filter currently can't show anything meaningful. With per-FY pipeline columns, the materialized view can compute pipeline categories for any FY that has data.

## Target & Plan Rollup Enrichment

**Current state:** "Target" in the Fullmind category means "this district is in a territory plan but has no pipeline or revenue." It's a binary signal.

**Vision:** Enrich the target concept with:
- **Dollar amount** — how much the district is being targeted for (sum across plans)
- **Categories** — what products/services/types the plans are targeting
- **Rollup** — aggregate targeting data per district across all plans

This would eventually power a "sales summary" view from the Build View panel, showing not just where reps have been (revenue) but where they're going (pipeline + plan targets).

## How This Connects to the FY Toggle

The FY toggle infrastructure (per-FY category columns in the materialized view, FY param in the tile route) is the same infrastructure this feature will use. The FY toggle ships first with revenue-based categories. When per-FY pipeline data is loaded, it slots into the same column pattern with no frontend changes — just a materialized view SQL update.

## Data Available

Sierra has Fullmind data going back to FY21 that can be loaded when needed. Competitor data availability in `competitor_spend` table needs to be checked for historical FYs.
