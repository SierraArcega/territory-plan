# "This week" section — design

**Date:** 2026-06-03
**Worktree:** `worktree-home-dashboard`
**Status:** Approved, ready for implementation plan

## Summary

Replace the minimal 3-count `ThisWeekCard` (Won/Lost/Created counts in the
Pipeline right rail) with a richer, full-width **This week** section that lists
the caller's actual deal movement over the last 7 days across three columns:
Closed Won, Closed Lost, and Newly Created.

Source of truth for the visual target is the user's screenshot
(`Screenshot 2026-06-03 at 2.51.12 PM.png`).

## Placement & layout

- **Remove** the small `ThisWeekCard` from the Pipeline right rail
  (`PipelineSection.tsx`).
- **Add** a new full-width `ThisWeekSection` in the Pipeline **main column**,
  ordered: Coverage → Stage Funnel → **This week** → Top open opportunities →
  Top targets. (Placed directly above the "Top open opportunities" table per
  user direction — "above top 15 deals".)
- **Section header:** title "This week" + subhead "Movement in your book over
  the last 7 days — won, lost, and newly created." Date range
  (e.g. `Mar 17 → Mar 23`) right-aligned. The range is the last-7-days window
  the data already uses (`now() - interval '7 days'` → `now()`), formatted
  client-side.
- **Three columns:** Closed Won (green `#2E7D5B`), Closed Lost (coral
  `#F37167`), Newly Created (plum `#403770`). Columns sit side-by-side on `sm+`
  and **stack vertically below the `sm` breakpoint** (narrow-width resilience —
  text spans get `whitespace-nowrap`).

## Each column header

- Count + `$total`, where total = Σ of the column's deal values.
- A signed pill on the right (`+4` / `−2` / `+5`).
  - **The pill = the signed count of deals** (net movement to the book this
    week): `+` for Won/Created, `−` for Lost. It is **not** a week-over-week
    comparison — that would need extra SQL and the mockup's pill equals the
    count anyway. Upgrading to true WoW is explicitly deferred.

## Each deal row

- Show **top 5 deals by `$` value**, then a **"Show more"** expander to reveal
  the rest (honors the pagination convention; a column rarely exceeds a handful
  in a single rep-week, but the expander keeps fixed height by default).
- District name + `$value` with a `+`/`−` sign matching the column.
- **Tag line:** `motion · product`
  - motion = DOA `category` (title-cased; e.g. "Renewal", "New", "Winback",
    "Expansion").
  - product = `contract_type`.
  - Any null tag is omitted (no empty `·` separators).
- **Trailing detail** (column-specific):
  - Won → `Nd to close` where N = days from `created_at` to `close_date`.
    Mockup wording ("28d to close") is kept as-is even though the deal is
    already closed.
  - Created → stage name (e.g. "Meeting Booked", "Discovery").
  - Lost → nothing. The mockup's loss-reason line is **dropped** — the
    `opportunities` table has no loss-reason field and we are not adding one in
    this scope.

## Data layer

Rework the last-7-days movement query in
`src/features/home/lib/pipeline-source.ts`.

- **Replace** the `ThisWeek` counts-only type:

  ```ts
  interface ThisWeekDeal {
    account: string;        // district_name
    value: number;          // net_booking_amount (absolute; column applies sign)
    motion: string | null;  // DOA category, title-cased at render
    product: string | null; // contract_type
    daysToClose?: number;   // Won only: created_at → close_date in days
    stage?: string;         // Created only: current stage label
  }

  interface ThisWeekColumn {
    count: number;          // true total deal count in the bucket
    total: number;          // Σ value across all deals in the bucket
    deals: ThisWeekDeal[];  // all deals, value-desc (client shows top 5 + more)
  }

  interface ThisWeek {
    won: ThisWeekColumn;
    lost: ThisWeekColumn;
    created: ThisWeekColumn;
  }
  ```

- **Replace** the `COUNT(*) FILTER (...)` aggregate query with one that selects
  the caller's actual deal rows where
  `close_date >= now() - interval '7 days'` OR
  `created_at >= now() - interval '7 days'`, joined to `category` via the
  existing `categoryJoin(sy)`, scoped to `sales_rep_email = callerEmail` and
  `school_yr = sy`. Bucketing is done in the source function:
  - **won** — `stagePrefix >= 6` AND close_date in window
  - **lost** — `LOWER(stage) = 'closed lost'` AND close_date in window
  - **created** — created_at in window
  - A deal created **and** won in the same window appears in **both** Created
    and Won (matches the mockup's independent columns — intentional).
- Scope is one rep × 7 days → a handful of rows; no server-side pagination
  needed. Deals returned value-desc so the client can slice top 5 directly.

## Components

- **New** `ThisWeekSection.tsx` — owns the section header + 3-column grid;
  takes `thisWeek: ThisWeek`. Renders three `ThisWeekColumn` blocks.
- **New** `ThisWeekColumn.tsx` (or an inline sub-component) — column header
  (label, count, `$total`, signed pill) + deal list with top-5 / "Show more"
  state (`useState` for expanded).
- **Delete** the old `ThisWeekCard.tsx` (superseded).
- Wire into `PipelineSection.tsx`: drop `ThisWeekCard` from the right rail, add
  `ThisWeekSection` to the main column above `TopOpportunitiesTable`.

## Testing

- Unit-test the bucketing/aggregation in the source function (or a pure helper
  extracted from it) in `pipeline.test.ts`-style co-located tests: given a set
  of opp rows, verify won/lost/created assignment, dual-membership, totals,
  counts, and value-desc ordering. The SQL itself stays DB-verified live (per
  the file's existing convention).
- Component render test: top-5 cap + "Show more" reveals the rest; null tags
  omitted cleanly; signs applied per column.

## Out of scope / deferred

- Week-over-week delta math for the pills (pills are signed counts for now).
- Loss-reason capture (no field; reason line dropped).
- Any change to the Performance section or other Pipeline cards.
