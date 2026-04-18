# Follow-up: EK12 master contract / add-on data gap (FIX TODAY)

## Summary

EK12 deals follow a "master renewal contract + add-ons" structure that is invisible in the current data model. A master contract opportunity carries a `minimum_purchase_amount` and `maximum_budget`. Add-on opportunities are stored as separate `opportunities` rows that consume budget against the master's max — but there is no FK or marker linking the add-ons back to their parent master.

The result: **any aggregate of `minimum_purchase_amount` or `maximum_budget` across opportunities will roughly double-count the EK12 ceiling**, because both the master's max and the add-ons' maxes are summed independently.

## Discovered during

DB readiness work for the Claude query tool on 2026-04-12. Surfaced when authoring concept mappings for `upside` / `ceiling` semantics — couldn't safely create the mapping because the underlying SQL (`SUM(maximum_budget)`) is wrong for EK12 reps and reps would get nonsense answers from the query tool.

## Impact

| Query | Currently produces |
|---|---|
| `SUM(maximum_budget) WHERE school_yr='2025-26'` for an EK12 rep | ~2× the real ceiling (master + addons summed independently) |
| `SUM(minimum_purchase_amount)` for the same scope | Same overcount |
| `MAX(maximum_budget)` per district | Misleading — gives you biggest single contract, not actual ceiling |
| `SUM(net_booking_amount)` | **Probably safe** — net booking is the actual signed amount and add-ons add real incremental dollars |
| Per-opportunity questions ("what's the budget on this deal") | Safe — only aggregation breaks |

This blocks the query tool from supporting any natural-language question about "upside", "ceiling", "potential", or "max FY26 pipeline" with confidence.

## Status

Tracked as a mandatory warning in `SEMANTIC_CONTEXT.warnings` in `src/lib/district-column-metadata.ts` so the query tool will surface a heavy caveat instead of returning wrong numbers. The `upside` / `ceiling` concept mappings are intentionally NOT created until the data model is fixed.

## Proposed fix

Add a parent/child link between master contracts and add-ons. Options:

1. **`opportunities.parent_opportunity_id` self-FK** — simplest, mirrors the existing pattern. Master contracts have NULL parent_id, add-ons reference their master.
2. **`contracts` table** — one row per master contract, opportunities reference contract_id. More structurally correct, but bigger change.
3. **`opportunities.contract_role` enum** — `master`, `addon`, `standalone`. Combined with a string `contract_group_id` so queries can `GROUP BY contract_group_id`.

Recommend option 1 for speed.

## Acceptance criteria

- [ ] Decide which fix option to ship
- [ ] Add the column(s) to `prisma/schema.prisma`
- [ ] Backfill historical EK12 opportunities with the parent link (probably manual mapping since the structure isn't in the source data)
- [ ] Update Railway sync to populate the parent link going forward
- [ ] Once the link is live, replace the warning in `SEMANTIC_CONTEXT.warnings` with `upside`/`ceiling` concept mappings that use the corrected aggregation
- [ ] Update `OPPORTUNITY_COLUMNS` descriptions for `minimum_purchase_amount` and `maximum_budget` to remove the warning text

## Files to investigate

- `prisma/schema.prisma` — `Opportunity` model
- Railway scheduler — opportunity sync (which OpenSearch field to map)
- `src/lib/district-column-metadata.ts` — warning to retire after fix
