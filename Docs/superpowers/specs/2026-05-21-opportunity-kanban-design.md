# Feature Spec: Opportunity Kanban View

**Date:** 2026-05-21
**Slug:** opportunity-kanban
**Branch:** `worktree-saved-views-sidebar`
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar/`

## Source Materials

- Existing (district-based) Kanban: `src/features/views/components/views/KanbanView.tsx`
- Views shell + click routing: `src/features/views/components/GroupCanvas.tsx`
- View body shared primitives: `src/features/views/components/views/_shared.tsx`
- Opp detail panel (confirms available fields): `src/features/views/components/detail/OppDetailContent.tsx`
- Opportunity model: `prisma/schema.prisma` (`model Opportunity`, ~line 1462)
- Plan stats / school-year scoping pattern: `src/app/api/territory-plans/[id]/route.ts`, `src/app/api/territory-plans/route.ts`
- School-year helper: `fiscalYearToSchoolYear()` in `src/lib/opportunity-actuals.ts`
- Brand tokens: `Documentation/UI Framework/tokens.md`
- User-supplied visual reference: kanban screenshot (funnel columns + Closed Won + Closed Lost, dense cards)
- Auto-memory: `feedback_no_id_strings_in_output` (no raw IDs to reps)

## Requirements

**Problem.** The Kanban view currently shows the plan's **districts** bucketed into four
derived stages (Prospect / Pipeline / Renewal / Active) from `isCustomer` × `hasOpenPipeline`
booleans. That's not what a sales rep wants from a board view — they want to see their
**opportunities** moving through the sales funnel for the plan.

**Solution.** Replace the district kanban with an **opportunity** kanban. Columns are the
real Salesforce opportunity **stages** (the numbered funnel plus Closed Won / Closed Lost).
Cards are individual opportunities scoped to the plan's districts and the plan's fiscal year.
The board is **read-only** in v1 — cards open the existing opp detail panel; there is no
drag-to-move and no card-create.

**Why read-only.** Opportunities are a read-only mirror of Salesforce, synced daily. There is
no Salesforce write-back path in this app. A drag-to-change-stage interaction would be
silently reverted on the next sync (or require a large, separate SF write-back build), so it
is explicitly out of scope for v1.

**Scope decisions (locked):**
1. **Entity:** opportunities, not districts. The existing district kanban is fully replaced.
2. **Columns:** eight fixed, ordered stage columns (see Column Model). Opportunities whose
   stage is outside this set (staffing/"Position …" stages, "Complete …", "Active", `null`)
   are **excluded** from the board.
3. **Scope:** opps whose `district_lea_id` is in the active **plan's** districts AND whose
   `school_yr` equals the plan's fiscal year (`fiscalYearToSchoolYear(plan.fiscalYear)`).
   No school-year filter UI — hard-scoped to the plan's year.
4. **Lists:** plan-only for v1. When the active group is a list (`leaids === null`), the
   existing "List scoping not wired yet" empty state is preserved, matching today's behavior.
5. **Interaction:** read-only. Click a card → opp detail panel (existing `data-row-kind` /
   `data-row-id` event delegation in `GroupCanvas`). No column `+` button, no card move arrows.
6. **Persistence:** none. Kanban has no `viewLayouts` slot (it remains typed `never`, per the
   grid-data-views spec). No sort/filter/column customization in v1.

**Success criteria.**
- Opening the Kanban view of a plan shows that plan's opps for the plan's fiscal year,
  bucketed into the eight stage columns in funnel order.
- Each column header shows the stage name, the **true** count of opps in that stage, and the
  **true** summed bookings — both reflecting all in-scope opps, not just the cards rendered.
- Each card shows: opp name, contract-type badge, district, amount (net booking),
  min purchase, max budget (when present), contract close date, sales rep.
- Clicking a card opens the opportunity detail panel.
- A plan with no in-scope opps shows a friendly empty state; columns with zero cards still
  render with a `0` count.
- No raw Salesforce IDs are shown on cards.

## Column Model & Registry

New file: `src/features/views/lib/opp-stage-columns.ts`.

```ts
export interface OppStageColumn {
  id: string;        // stable column id
  label: string;     // header label
  stage: string;     // exact opportunities.stage value this column matches
  accent: string;    // hex accent for the header bar + card dot (brand tokens)
}

export const OPP_STAGE_COLUMNS: readonly OppStageColumn[];
```

| Order | id | label | matches `stage` | accent (token) |
|---|---|---|---|---|
| 0 | `meeting_booked` | Meeting Booked | `0 - Meeting Booked` | plum-light `#A69DC0` |
| 1 | `discovery` | Discovery | `1 - Discovery` | plum `#6E5FA8` |
| 2 | `presentation` | Presentation | `2 - Presentation` | teal `#6EA3BE` |
| 3 | `proposal` | Proposal | `3 - Proposal` | blue `#5B8DEF` |
| 4 | `negotiation` | Negotiation | `4 - Negotiation` | amber `#FFCF70` |
| 5 | `commitment` | Commitment | `5 - Commitment` | gold `#E0A93B` |
| 6 | `closed_won` | Closed Won | `Closed Won` | green `#69B34A` |
| 7 | `closed_lost` | Closed Lost | `Closed Lost` | coral `#F37167` |

Matching is **exact string equality** on `opportunities.stage`. Stages not present in the
registry are excluded server-side (the SQL `WHERE stage = ANY($stages)` only selects the eight
known values). Accent hexes are finalized against `Documentation/UI Framework/tokens.md`
during implementation; the table above is the intended palette (graduated funnel → green won →
coral lost).

## Card Content

Read-only card. Wrapper carries `data-row-kind="opp"` and `data-row-id={opp.id}` so
`GroupCanvas`'s existing event delegation opens the opp detail panel on click.

- **Opp name** — bold link-style text, truncated.
- **Contract-type badge** — small pill from `contract_type` (e.g. `Tier 1`, `Hybrid Staffing`,
  `Instructional Hourly`). Omitted when `contract_type` is null.
- **District** — `district_name` (or joined district name).
- **Amount** — `net_booking_amount`, money-formatted. Always present in practice.
- **Min purchase** — `minimum_purchase_amount`, money-formatted. Nearly always present.
- **Max budget** — `maximum_budget`, money-formatted. **Rendered only when non-null** (~40%
  of open opps have it; hide the row entirely when absent rather than showing `—`).
- **Contract close date** — `close_date`, short date format.
- **Sales rep** — `sales_rep_name`.

**Explicitly excluded** (from the visual reference, no clean data source / against conventions):
- The grey `#…` ID line — it is the raw Salesforce opp id; not shown to reps.
- The "Files:" line — opportunities have no files/attachments field.

## Scope & School Year

- `GroupCanvas` already resolves the active plan and passes `leaids` (= `plan.districtLeaids`)
  to `KanbanView`. It will additionally pass the plan's `fiscalYear` (already on
  `PlanWithStats`).
- `KanbanView` derives `schoolYr = fiscalYearToSchoolYear(plan.fiscalYear)` (e.g. `2026` →
  `"2025-26"`) and includes it in the data request.
- Scope = `district_lea_id = ANY(leaids)` AND `school_yr = schoolYr` AND
  `stage = ANY(known stages)`.

## API

### `GET /api/views/opps-kanban`

Mirrors the query-param shape of `/api/districts` and `/api/views/data` (no new
plan-scoped subroute; leaids + schoolYr come from the already-loaded plan).

| Param | Required | Notes |
|---|---|---|
| `leaids` | yes | csv of plan district leaids |
| `schoolYr` | yes | e.g. `2025-26` |
| `limit` | no | max cards **per column**; default 50, max 50 |

Behaviour:
1. Auth via `getUser()` — 401 if missing.
2. If `leaids` is empty → return all eight columns with `count: 0`, `totalBookings: 0`,
   `cards: []`.
3. One query selects in-scope opps (the eight known stages, the leaids, the school year),
   returning the card fields. A second lightweight aggregate query (or `GROUP BY stage` with
   window/`FILTER`) returns the **true** per-stage `count` and `SUM(net_booking_amount)` so
   totals are correct even when a column is capped at `limit` cards.
4. Cards per column are ordered by `close_date` (NULLS LAST), then `net_booking_amount` DESC,
   and capped at `limit`.
5. Group rows into the registry's column order.

Response:
```ts
{
  schoolYr: string;
  columns: {
    id: string;            // OppStageColumn.id
    label: string;
    count: number;         // true total opps in this stage (in scope)
    totalBookings: number; // true SUM(net_booking_amount) for the stage (in scope)
    cards: {
      id: string;          // used only as data-row-id / detail lookup, never displayed
      name: string | null;
      districtName: string | null;
      contractType: string | null;
      netBookingAmount: number | null;
      minimumPurchaseAmount: number | null;
      maximumBudget: number | null;
      closeDate: string | null;   // ISO
      salesRepName: string | null;
    }[];
    hasMore: boolean;      // count > cards.length (drives a per-column "Show more")
  }[];
}
```

Query against the read-only pool (5s `statement_timeout`), consistent with other views routes.

## UI Components

- **`src/features/views/lib/opp-stage-columns.ts`** — new column registry (above).
- **`src/features/views/components/views/KanbanView.tsx`** — rewritten:
  - Props gain the plan's fiscal year (threaded from `GroupCanvas`). Keep `leaids` prop.
  - `null` leaids → existing "List scoping not wired yet" empty state (unchanged).
  - Fetch from `/api/views/opps-kanban` via `useQuery` with a serialized-primitive key
    (`["views","opps-kanban", leaidsKey(leaids), schoolYr, limit]`).
  - Render columns from the response (header: accent bar + label + count + summed bookings;
    body: cards + optional per-column "Show more").
  - Reuse `LoadingState` / `ErrorState` / `EmptyState` from `_shared.tsx`.
- **`src/features/views/components/GroupCanvas.tsx`** — pass `plan.fiscalYear` to `KanbanView`
  in the `case "kanban"` branch.

Card and column visuals follow the existing Kanban styling (1px border, 8px radius, white card,
accent dot) extended with the additional money rows and the contract-type badge. Brand tokens
only — no Tailwind grays.

## Edge Cases

- **No in-scope opps** → `EmptyState` ("No opportunities for this plan's year").
- **Empty column** → renders with `0` count and `$0`, no cards.
- **`maximumBudget` null** → hide the Max budget row on that card.
- **`contractType` null** → no badge.
- **`leaids === null` (list)** → unchanged "List scoping not wired yet" empty state.
- **Statement timeout** → `ErrorState` with retry (consistent with other views routes).

## Performance

- Per-column card cap of 50 (per CLAUDE.md "never render more than 50 items"); column totals
  are computed server-side so capping cards never distorts the header numbers.
- Stable TanStack Query key built from serialized primitives (sorted `leaidsKey`, `schoolYr`,
  `limit`) — no raw objects.
- Read-only pool with 5s `statement_timeout`.
- Closed Won / Closed Lost are the highest-volume stages; the per-column cap + "Show more"
  keeps initial render bounded.

## Mobile

- Board scrolls horizontally (`min-w-max` row of fixed-width columns); the wrapper uses
  `touch-action: pan-y` for vertical scroll within a column, matching the current Kanban and
  the `_shared.tsx` `ViewScroll` pattern. No map in this view, so `pan-y` is safe.
- Card text spans use `whitespace-nowrap` + truncation per the narrow-width resilience rule.

## Testing

Vitest, co-located in `__tests__/`:
- **`opp-stage-columns`** — registry has eight columns in funnel order; stage-string matching
  maps known stages to the right column and leaves unknown stages unmatched.
- **`/api/views/opps-kanban`** — auth (401), empty-leaids short-circuit, grouping into the
  eight columns, true per-column count + summed bookings when cards are capped, per-column
  ordering, `hasMore` flag.
- **`KanbanView`** — renders columns from a fixture; cards land in the correct columns; header
  count + summed bookings shown; Max budget row hidden when null; badge hidden when contract
  type null; `data-row-kind`/`data-row-id` present on cards; list-scope empty state when
  `leaids === null`.
- The existing Vitest suite must remain green.

## Non-goals (v1)

- Drag-to-move cards between stages / any Salesforce write-back.
- Creating opportunities from the board (column `+`, card `+`).
- School-year filter UI (hard-scoped to the plan's fiscal year).
- List-scoped kanban (plan-only until list previews are wired, matching today).
- Sort / filter / column customization or `viewLayouts` persistence for kanban.
- Surfacing "Files" / attachments on cards.
- Staffing-family stages (Position …, Complete …, Active, Return Position Pending) as columns.
