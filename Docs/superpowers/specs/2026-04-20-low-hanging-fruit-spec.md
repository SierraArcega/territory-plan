# Feature Spec: Low Hanging Fruit

**Date:** 2026-04-20
**Slug:** low-hanging-fruit
**Branch:** `worktree-increase-your-targets-tab`

## Problem

Today's "Missing Renewal Opp" tab inside the Leaderboard modal shows FY26 customers at renewal risk + two win-back categories as a single dense DataGrid. It works, but:

- The grid is cramped inside the modal (`max-w-5xl`). Reps can't scan 100+ districts comfortably.
- Every row is equally weighted. Rich context (products, revenue history, last sale, suggested pitch size) has to hide in expanded rows or drawers.
- No filtering or slicing. Quarterly territory planning — the primary use case — needs to narrow by state, product, revenue band, and category.
- Bulk action is absent. A rep reviewing their book of business for next quarter adds one district at a time via a popover.

## Requirements

- Reframe the tab as **"Low Hanging Fruit"** — the place reps go to see claimable districts and turn them into targets / pipeline.
- Replace the in-modal DataGrid with a **lean summary tab** in the Leaderboard modal + a new **deep-dive tab** in the sidebar.
- Deep-dive supports **rich per-district context, filtering, and bulk add** — the three things quarterly planning needs.
- Every rep sees every district (no per-rep filtering). Districts already in ANY territory plan remain hidden.
- Single-add flow from today stays intact; **new bulk-add wizard** cycles sequentially through selected districts.
- Heuristic **suggested target $** per district. No AI, no pitch-angle generation in this slice.
- No new scoring rules. Existing `district_added` points (fired by the reused POST route) run as normal.
- No schema changes, no migrations, no new mutation endpoints.

## Visual Design

### Use case & moment of use

Optimize for quarterly territory planning — deliberate, deep review. Density over speed; context over triage.

### Navigation

- New sidebar tab **"Low Hanging Fruit"** between "Leaderboard" and "Resources" in `MAIN_TABS` (Sidebar.tsx). Icon: Lucide `Apple`. URL: `/?tab=low-hanging-fruit`.
- Add `"low-hanging-fruit"` to `VALID_TABS` and `TabId` union. Wire the case in `page.tsx` to render `<LowHangingFruitView />`.
- Leaderboard modal tab renames from "Missing Renewal Opp" to "Low Hanging Fruit" and renders a new lean `LowHangingFruitSummaryCard` component.

### Leaderboard tab (lean summary)

Inside the Leaderboard modal (reverts to `max-w-2xl` for this tab — we no longer need the wide treatment):

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                   🍎  (Sparkles)                    │
│              127 districts                          │  text-2xl font-bold text-plum
│         $4.2M FY26 revenue unclaimed                │  text-sm text-[#6E6390]
│                                                     │
│         [ View all →  ]                             │  primary plum button,
│                                                     │   closes modal + sets
│                                                     │   tab=low-hanging-fruit
│   FY26 Fullmind customers with no FY27 activity     │  text-xs text-[#8A80A8]
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Component: `LowHangingFruitSummaryCard` in `src/features/leaderboard/components/`.
- Reads same query (`useIncreaseTargetsList` → rename to `useLowHangingFruitList`).
- "View all →" closes the modal, sets `tab=low-hanging-fruit` via the tab-change callback.

### Deep-dive page layout (`tab=low-hanging-fruit`)

Full-width under the app shell, rendered as a `<LowHangingFruitView />` component.

```
┌─────────────────────────────────────────────────────────────┐
│  Low Hanging Fruit                          [Bulk add ▾]    │  page header
│  127 districts · $4.2M FY26 revenue unclaimed               │
├─────────────┬───────────────────────────────────────────────┤
│  FILTERS    │  Sort: [Revenue (high→low) ▾]    Count: 127   │  secondary bar
│  (sticky)   │                                               │
│             │  ┌────────┐ ┌────────┐ ┌────────┐             │
│ Category    │  │  Card  │ │  Card  │ │  Card  │             │
│ State       │  └────────┘ └────────┘ └────────┘             │
│ Product     │  ┌────────┐ ┌────────┐ ┌────────┐             │
│ Revenue $   │  │  Card  │ │  Card  │ │  Card  │             │
│ Last rep    │  └────────┘ └────────┘ └────────┘             │
│ FY27 signal │                                               │
│             │                                               │
├─────────────┴───────────────────────────────────────────────┤
│  3 selected · [Add selected to plan →]         [Clear]      │  sticky footer,
└─────────────────────────────────────────────────────────────┘  shows when >= 1
```

**Filter rail** — sticky left column, ~220px wide. Subsections collapse/expand.

| Filter | Type | Values |
|---|---|---|
| Category | multi-checkbox | Missing Renewal / Fullmind Winback / EK12 Winback (with row counts) |
| State | multi-select typeahead | all distinct `state` values in the list |
| Product | multi-checkbox | all distinct `productTypes` in the list |
| Revenue band | preset buckets | < $50K / $50K–$250K / $250K–$1M / $1M+ |
| Last rep | single-select | Anyone / Open (no rep) — per-rep filtering deferred |
| FY27 signal | single checkbox | "Hide districts with FY27 target set" (default off) |

Active filters show a count (e.g., "State · 3"). Each section has an inline "Clear" link when any value is applied.

**Filter URL state** — filters serialize into query params so the page is shareable/bookmarkable: `?tab=low-hanging-fruit&state=CA,TX&category=missing_renewal&minRev=250000`.

**Sort** — single dropdown above grid: "Revenue (high → low)" (default), "Last sale (recent → old)", "Category."

All filtering/sorting happens client-side — the list is ~127 rows.

### Rich card (3 per row desktop, 2 per row ≥768px, 1 per row mobile)

Dimensions: ~300px wide, ~180px tall. Background white, `border border-[#D4CFE2]`, `rounded-lg`, `shadow-sm`.

```
┌─────────────────────────────────────────┐
│  ☐  Pasadena USD              [+ Add ▾] │  row 1
│     CA                                  │
│                                         │
│  $320K  FY26 revenue                    │  row 2 — hero number, text-xl font-bold plum
│  12,400 sessions · Live Instruction +2  │  row 3 — caption, text-xs body
│                                         │
│  Last sale: M. Chen · Mar 2026 · $260K  │  row 4 — text-xs muted
│                                         │
│  ● Missing Renewal    Suggested: $340K  │  footer — category chip left, hint right
└─────────────────────────────────────────┘
```

**Card cells:**
- Checkbox — top-left. Click toggles multi-select. Checked card gets `bg-[#EFEDF5]` + left-border `#403770` 3px.
- District name — `font-semibold text-[#403770]`, truncate at 1 line.
- State — `text-xs text-[#8A80A8]`.
- `+ Add ▾` button — top-right, opens single-add popover (existing `AddToPlanPopover`, unchanged behavior). For `inPlan === true` rows, button becomes "Open in LMS" external link (matches today).
- Hero revenue — largest number on the card. For `missing_renewal` shows `fy26Revenue`. For winbacks shows `priorYearRevenue` (with FY tag).
- Sessions + top products — single line, products truncate to first 2 + `+N`.
- Last sale — `"{repName} · {month year} · ${amount}"` or em-dash when null.
- Category chip — same palette as today (`missing_renewal` coral, `fullmind_winback` plum, `ek12_winback` steel-blue/amber).
- Suggested hint — `text-xs text-[#6E6390]`, renders `"Suggested: $X"` or hidden when null.

**Card states:**
- Default — white, `shadow-sm`.
- Hover — `shadow-lg`, `transition-shadow duration-150`, cursor-pointer (clicking opens slide-over; checkbox and Add button stop propagation).
- Checked — `bg-[#EFEDF5]`, left-border plum 3px.
- Adding (during POST) — opacity 50, spinner overlay, pointer-events-none.
- Just-added — fades to 0 over 200ms then unmounts.

### Slide-over detail (opens on card click)

Right-side panel, ~480px wide, uses existing `shared/components/containers/panel` pattern. Backdrop click / Esc / close-button dismisses.

**Header**
- District name (text-lg font-bold plum), state, "Open in LMS" external link (if `lmsId`)
- Category chip

**Body (vertical stack, `gap-5`)**
- **Revenue trend** — small horizontal bars or labeled row: `FY24 $180K · FY25 $240K · FY26 $320K · FY27 —`. Null years render "—".
- **Products purchased** — full chip list: primary product_types as plum pills, sub_products as muted secondary pills below.
- **FY26 breakdown** — `"Completed $X · Scheduled $Y · N sessions"`.
- **Last closed-won** — `"Closed Won {schoolYr} · ${amount} · {closeDate} · {repName}"` or empty state.
- **FY27 readiness** — plan/target/pipeline dots (matches current in-row indicator pattern, if any of those are true).
- **Suggested target** — `"$X (1.05× FY26 revenue)"` or `"$X (0.9× FY25 revenue)"` as explainer.

**Footer**
- Primary: `+ Add to plan` (opens single-add popover anchored to the button). Or "Open in LMS" external link if already planned.

### Bulk-add wizard

**Trigger:** With 1+ cards checked, sticky footer bar shows at bottom of page:

```
┌─────────────────────────────────────────────────────────────┐
│  3 selected · $X total FY26      [Add selected to plan →]  [Clear]  │
└─────────────────────────────────────────────────────────────┘
```

**Wizard modal** (new component `BulkAddWizard`):

```
┌──────────────────────────────────────────────────────────┐
│  Add to plan                      Step 2 of 3      [✕]   │
├──────────────────────────────────────────────────────────┤
│  Katy ISD · TX · $410K FY26                              │
│  ● Missing Renewal                                       │
│                                                          │
│  Plan:   [My FY27 West Territory ▾]    ← sticky choice   │
│  Type:   (•) Renewal  ( ) Winback ...   ← sticky choice  │
│  Target: [$430,000]          Suggested: $430K            │
│                                                          │
│  [← Back]  [Skip this one]    [Add & continue →]         │
└──────────────────────────────────────────────────────────┘
```

- **Step indicator:** "Step N of M" in the header.
- **Sticky choices:** Plan and Type pre-fill from the prior step. Type default for step 1 derives from the district's category (`missing_renewal → Renewal`, winbacks → `Winback`). Plan default is unset on step 1; once chosen, it persists across steps unless rep changes it.
- **Target $:** pre-fills with `suggestedTarget` when non-null; otherwise empty. Required, positive-number, formatted on blur.
- **Submit enabled when:** a plan is selected AND target is a positive number. "Add & continue" stays disabled otherwise. "Skip" is always enabled.
- **Back / Skip / Add & continue:** Back decrements step. Skip advances without adding. Add & continue POSTs to `/api/territory-plans/[planId]/districts`, then advances. On the final step the primary button reads **"Add & finish."**
- **Per-step errors:** inline error text below the target field; step stays put, buttons re-enable.
- **Sequential, not parallel:** each POST awaits before advancing. Avoids duplicate `syncPlanRollups` on the same plan.
- **Exit:** Esc or `✕` closes. Any already-committed adds remain; not-yet-committed districts stay in the grid.

**Single-add path unchanged.** Clicking `+ Add ▾` on a single card still opens the existing `AddToPlanPopover` (no wizard). Wizard is strictly multi-select.

### States (deep-dive)

- **Loading (first paint):** skeleton grid — 6 placeholder cards with shimmer on name, revenue, chip rows. Filter rail reads "Loading filters…"
- **Empty — zero results after filter:** centered message "No districts match these filters." + "Clear filters" button.
- **Empty — zero districts overall:** centered "Every FY26 customer has FY27 activity. Nothing to claim right now."
- **Error:** top banner `#fef1f0` / `#f58d85` border, "Couldn't load the list." + [Retry].
- **Adding:** per-card opacity/spinner overlay; after POST success, card fades out and unmounts.
- **Toast on success:** top-right transient "Added {district} to {plan}" (single-add) or "Added 3 districts to {plan}" (wizard finish).

### Tokens (no Tailwind grays — per `CLAUDE.md`)

From `Documentation/UI Framework/tokens.md`:

- Surface: `#FFFCFA` · Surface Raised: `#F7F5FA` · Hover: `#EFEDF5` · White: `#FFFFFF`
- Borders: Subtle `#E2DEEC` · Default `#D4CFE2` · Strong `#C2BBD4`
- Text: Primary `#403770` · Strong `#544A78` · Body `#6E6390` · Secondary `#8A80A8` · Muted `#A69DC0`
- Accent (category/focus): Coral `#F37167`
- Shadows: `shadow-sm` cards, `shadow-lg` popovers/slide-over, `shadow-xl` wizard modal
- Radii: `rounded-lg` cards/buttons/inputs, `rounded-xl` popover/slide-over, `rounded-2xl` modal

### Accessibility

- Checkbox + "Add" button `aria-labels` reference the district name.
- Card click opens slide-over with `aria-expanded` / focus trap inside the slide-over.
- Wizard uses `role="dialog"`, `aria-labelledby`, focus trap, Esc closes, focus returns to trigger footer button.
- Filter sections use grouped checkboxes with `<fieldset>`/`<legend>`.

### Responsive

- `>= 1280px` (`xl:`) — 3 cards per row, filter rail 220px.
- `>= 768px` (`md:`) — 2 cards per row, filter rail collapses into a top drawer button.
- `< 768px` — 1 card per row, filter rail becomes a slide-up bottom sheet.

## Component Plan

### Reuse (no changes)
- `src/features/shared/components/DataGrid/` — NOT used on the deep-dive (cards replace the grid). Leaderboard summary also doesn't use it.
- `src/features/leaderboard/components/AddToPlanPopover.tsx` — unchanged. Wired from both the card's `+ Add ▾` and the slide-over footer.
- `POST /api/territory-plans/[id]/districts` — existing route, unchanged.
- `src/features/shared/lib/format.ts` — currency / number formatting.
- Icon set — Lucide (`Sparkles`, `Plus`, `ChevronDown`, `ExternalLink`, `X`, `Apple` for tab icon).

### New components

All under `src/features/leaderboard/` (keeping close to existing):

- `components/LowHangingFruitView.tsx` — page-level view (header + filter rail + grid + footer).
- `components/LowHangingFruitCard.tsx` — single rich card.
- `components/LowHangingFruitFilterRail.tsx` — sticky left rail.
- `components/LowHangingFruitDetailDrawer.tsx` — right-side slide-over.
- `components/BulkAddWizard.tsx` — multi-step modal for sequential adds.
- `components/LowHangingFruitSummaryCard.tsx` — lean stat card inside the Leaderboard modal.
- `lib/filters.ts` — filter types + URL param serialize/deserialize + client-side predicate.
- `lib/suggestedTarget.ts` — heuristic (may live in backend mapper instead — see Backend Design).

### Extend

- `src/app/page.tsx` — add `"low-hanging-fruit"` to `VALID_TABS`, add case to render `<LowHangingFruitView />`.
- `src/features/shared/lib/app-store.ts` — extend `TabId` union.
- `src/features/shared/components/navigation/Sidebar.tsx` — append entry to `MAIN_TABS`.
- `src/features/leaderboard/components/LeaderboardModal.tsx`:
  - Rename "Missing Renewal Opp" entry in `VIEW_CONFIG` to "Low Hanging Fruit".
  - Render `<LowHangingFruitSummaryCard />` instead of `<IncreaseTargetsTab />` when this tab is active.
  - Revert the `max-w-5xl` wide treatment for this tab (back to `max-w-2xl`).
- `src/features/leaderboard/lib/queries.ts` — rename `useIncreaseTargetsList` to `useLowHangingFruitList` (keep old export as alias for one release cycle to avoid breaking imports, then drop).
- `src/features/leaderboard/lib/types.ts` — add `suggestedTarget: number | null` and `revenueTrend: { fy24: number | null, fy25: number | null, fy26: number | null, fy27: number | null }` to `IncreaseTarget` (rename the type to `LowHangingFruitRow` in the same edit).

### Remove / replace

- `src/features/leaderboard/components/IncreaseTargetsTab.tsx` — delete. Replaced by `LowHangingFruitSummaryCard` in the modal + `LowHangingFruitView` as the tab view.
- `src/features/leaderboard/lib/columns/increaseTargetsColumns.ts` — delete (no DataGrid on the new surface).
- `src/features/leaderboard/components/__tests__/IncreaseTargetsTab.test.tsx` — replace with tests for the new card, filter rail, and wizard components.
- `src/features/leaderboard/lib/__tests__/increaseTargetsColumns.test.ts` — delete.

## Backend Design

See `docs/superpowers/specs/2026-04-20-low-hanging-fruit-backend-context.md`.

### Summary

- **Extend** `GET /api/leaderboard/increase-targets`:
  - Add a `revenue_trend` CTE pivoting FY24/FY25/FY26/FY27 Fullmind `total_revenue` (and Elevate `total_revenue` for winback rows) into 4 nullable numeric columns per district.
  - Compute `suggestedTarget: number | null` in the response mapper using the existing `fy26Revenue`, `priorYearRevenue`, and `category` fields. No SQL change for this — it lives in the JS mapper.
- **Extend type** `IncreaseTarget` → rename to `LowHangingFruitRow` and add `suggestedTarget`, `revenueTrend`.
- **Refresh** `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts` — currently references dead CTE names (`fy27_any`, `already_planned`); add cases for new fields.
- **No new routes, no new mutations, no schema changes, no migrations.**

### Suggested target heuristic (in the response mapper)

```ts
function computeSuggestedTarget(
  category: "missing_renewal" | "fullmind_winback" | "ek12_winback",
  fy26Revenue: number,
  priorYearRevenue: number,
): number | null {
  if (category === "missing_renewal") {
    return fy26Revenue > 0 ? Math.round((fy26Revenue * 1.05) / 5000) * 5000 : null;
  }
  return priorYearRevenue > 0
    ? Math.round((priorYearRevenue * 0.9) / 5000) * 5000
    : null;
}
```

### Endpoint name

Keep `GET /api/leaderboard/increase-targets`. Do not rename. Rename hooks client-side only.

### Reuse: `POST /api/territory-plans/[id]/districts`

Used by the wizard sequentially. Idempotent via upsert on `(planId, districtLeaid)` PK. Known quirk: re-cycling the wizard over the same district double-awards `district_added` points. Flag in the implementation plan; do not change for this slice.

## States (End-to-End)

- **Loading (list):** skeleton grid.
- **Loading (wizard step):** step's primary button spinner + disables buttons.
- **Empty:** see Visual Design.
- **Fetch error:** banner + Retry.
- **Submit error (single add):** inline in popover; popover stays open; row remains in grid.
- **Submit error (wizard step):** inline under target field; step stays put; rep can retry or skip.
- **Success:** optimistic row removal from client cache; toast.

## Out of Scope

- AI-generated pitch angles or talking points (heuristic suggested $ only).
- Per-rep filtering of the list (admin/ownership views).
- Bulk edits to existing `plan_district` rows (wizard only creates).
- Side-by-side district comparison.
- "Save filter view" / named filter presets.
- Keyboard shortcuts for the wizard (beyond Esc).
- Fixing the `district_added` double-award-on-upsert behavior.
- Notifications to previous reps about ownership changes.
- FY28+ or non-Fullmind vendor rows beyond existing winback categories.
- Undo after successful add.
- Mobile-optimized wizard (responsive falls back but is not polished for touch).

## Open Questions

None blocking. The backend-context doc flags two items the implementer should resolve inline:

1. **FY24/FY25 coverage for `missing_renewal` rows** — if `district_financials` is sparse for FY24 Fullmind customers, the YoY trend will render "—". Acceptable; document in the UI as graceful rendering of nulls.
2. **FY27 in the trend is always 0** — list members are excluded from FY27 activity by definition. Render the FY27 column as "—" (matches the null treatment) rather than "$0".
