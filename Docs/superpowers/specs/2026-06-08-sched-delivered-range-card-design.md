# Sched + Delivered Range Card — Design Spec

**Date:** 2026-06-08
**Status:** Approved design, pending implementation plan
**Branch:** `feat/sched-delivered-range-card`

## Summary

Merge the two financial topline cards **"Sched + Delivered Rev."** and **"Sched +
Delivered Take"** into a single **"Sched + Delivered"** card that tells the whole
contract-economics story on one range bar:

- **Floor** (min) and **budget ceiling** (max) of the *won* contracts being
  delivered against, drawn as a horizontal range scaled `$0 → ceiling`.
- **Revenue** (delivered + scheduled) fills the bar from the left.
- **Take** is the deeper leading slice of the revenue fill (take ⊂ revenue).
- A hover/tap tooltip shows **revenue and take broken down by sales motion**
  (Return / New biz / Win-back), with a per-row take rate.

The topline strip goes from 5 cards (Targets · Open Pipeline · Bookings · Rev ·
Take) to 4 (Targets · Bookings · **Sched + Delivered** · Open Pipeline).

## Motivation

Today min/max only appear on the **Open Pipeline** card, computed against *open*
stages — they describe deals not yet won. Revenue and take live on two separate
cards with no contractual anchor. The user's mental model is: *"revenue consumes
the funds from a won contract and lands somewhere between the contract's floor and
ceiling; take is a function of revenue."* This card makes that model literal and
visible in one place.

## Decisions (locked with user 2026-06-08)

1. **Min/max source = won contracts.** Floor = `Σ minimum_purchase_amount`,
   ceiling = `Σ maximum_budget` across closed-won opps (`stage prefix ≥ 6`) for
   the FY. This is the set revenue is actually delivered against, so `min ≤
   revenue ≤ max` is honest.
2. **Visual = range fill** (chosen over a stacked-figures table and a bullet
   chart). Bar scaled **$0 → ceiling**, with the floor as a marker line — *not*
   floor→ceiling — so fill length is honest absolute progress and the early-year
   "haven't hit the floor commitment yet" state reads correctly.
3. **Structure = merge Rev + Take into one card.** Frees a strip slot.
4. **Segments = tooltip**, showing both **revenue and take by motion** (not just
   revenue). Bookings card still shows the segment split inline, so nothing is
   lost.

## Data / API changes

### `src/app/api/home/dashboard/topline/route.ts`

The per-category query (`subjectCategories`, lines 46–55) **already returns both
`take` and `revenue` per motion** — no change needed; the tooltip data is free.

Add a **won-contract detail** query, mirroring the existing open-pipeline detail
query (lines 60–71) but filtered to closed-won stages:

```sql
SELECT
  COALESCE(SUM(COALESCE(o.minimum_purchase_amount, 0)), 0)::float AS "floor",
  COALESCE(SUM(COALESCE(o.maximum_budget, 0)), 0)::float AS "ceiling",
  COUNT(*)::int AS "oppCount",
  COUNT(DISTINCT o.district_name)::int AS "accountCount"
FROM opportunities o
WHERE o.school_yr = ${schoolYr}
  ${emailFilterSql(scope, Prisma.sql`o.sales_rep_email`)}
  AND o.net_booking_amount IS NOT NULL
  AND ${stagePrefixSql(Prisma.sql`o.stage`)} >= 6   -- closed-won (vs 0–5 for open)
```

`stagePrefixSql` and the `≥ 6` = closed-won convention come from
`src/features/home/lib/trajectory-source.ts` (do not re-derive the stage mapping).

### `src/features/home/lib/topline.ts`

- Add a `WonContractDetail` interface: `{ floor, ceiling, oppCount, accountCount }`
  (parallel to the existing `OpenPipelineDetail`).
- Attach it to the payload. Keep the `revenue` and `take` cards in the API
  response **as-is** — their per-metric ranking and sparkline machinery stays
  intact. The merge happens in the UI layer, consuming both cards plus
  `WonContractDetail`. (Rationale: ranking and YoY sparklines are computed
  per-metric; collapsing them in the API would lose the per-metric rank and
  trend. Cleaner to keep the data and merge the *presentation*.)

### `src/features/home/components/dashboard/ToplineStatStrip.tsx`

Stop rendering the standalone `revenue` and `take` StatCards. In their place
render one new `SchedDeliveredCard`, fed by: the `revenue` card (headline + YoY +
sparkline + per-motion revenue), the `take` card (per-motion take), and
`WonContractDetail` (floor/ceiling). Final order: Targets · Bookings ·
**SchedDelivered** · Open Pipeline.

### New component `SchedDeliveredCard.tsx`

Rendered through `StatCardShell` (same shell as StatCard). Contents:

- **Headline:** revenue (e.g. `$748K revenue`), with `$224K take · 30% take rate`
  as the secondary line. Take rate = take / revenue (guard divide-by-zero).
- **Range bar** scaled `$0 → ceiling`:
  - revenue fill width = `clamp(revenue / ceiling, 0, 1)`
  - take slice width = `clamp(take / ceiling, 0, 1)` (leading, deeper plum)
  - floor marker at `clamp(floor / ceiling, 0, 1)`
- **YoY delta + sparkline:** keep the **revenue** trend as the card's sparkline
  (revenue is the headline). Take has no separate sparkline on this card.
- **Rank pill:** use the **revenue** rank.
- **Tooltip (revenue + take by motion):** zip the revenue card's `segments` with
  the take card's `segments` by segment key; render Motion · Revenue · Take (+ per-
  row take rate) and a Total row.

Colors (from `Documentation/UI Framework/tokens.md` + existing segment palette):
track `#EFEDF5`, revenue fill `#6E5FB0`, take slice `#3A2E73`, floor marker
`#1F1A33`, overage flag `#F37167` (coral). Motion swatches: Return `#403770`,
New biz `#F37167`, Win-back `#6EA3BE`.

## Edge cases

| State | Behavior |
|---|---|
| `revenue < floor` (early year) | Fill stops left of the floor marker — reads as "haven't hit commitment yet." |
| `floor ≤ revenue ≤ ceiling` | Normal healthy case. |
| `revenue > ceiling` (overage) | Fill caps at 100%; coral flag at the right edge; headline still shows the true number. |
| `ceiling = 0` / no won contracts | Hide the bar; show revenue + take figures only with an empty-range note. |
| `floor > ceiling` (data anomaly — per-row min can exceed max) | Clamp floor marker to ≤ 100%; never overflow the track. |

## Known caveat (documented, not blocking)

The headline **revenue is the blended total** (sessions + subscriptions; locked
2026-05-28 for leaderboard reconciliation), while **floor/ceiling come from
opportunities**. Subscription (EK12) revenue has no contract min/max in the same
sense, so the fill is a slight approximation against a pure-contract denominator.
The floor/ceiling are reference marks, not exact denominators — the visual stays
honest. Surface in the metric tooltip copy; revisit only if it misleads in
practice.

## Mobile

- **No hover on touch** (CLAUDE.md rule): the segment tooltip must be
  **tap-to-toggle** on mobile, not hover-only.
- **Narrow-width resilience:** the bar is `%`-based (fine), but the floor-marker
  inline label can collide at narrow widths — drop the inline floor label below
  the `sm` breakpoint and rely on the scale labels + tooltip. `whitespace-nowrap`
  on all figure spans.
- Smoke-test the range bar + tooltip on iPhone (Safari + Chrome) before shipping.

## Out of scope

- The Open Pipeline card's existing min-commit/max-budget line stays unchanged.
- No change to ranking, targets, or the trajectory/sparkline endpoints beyond
  reusing the revenue sparkline on the merged card.

## Testing

- Unit: `buildToplineCards` attaches `WonContractDetail`; take-rate and clamp math
  (under-floor, mid, overage, zero-ceiling, floor>ceiling) in a pure helper.
- Verify the won-contract floor/ceiling SQL live against the DB (mirror how the
  existing detail query was verified).
