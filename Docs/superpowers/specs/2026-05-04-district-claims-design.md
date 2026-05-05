# District Claims — Design

**Status:** Draft
**Author:** Sierra Arcega + Claude
**Date:** 2026-05-04

## Problem

Districts today have a single editable `District.ownerId` field. Most existing values were assigned arbitrarily during a CRM-name backfill at login time; they don't reflect any real working relationship. The "Owner" UI surfaces reinforce the wrong mental model: that a district has one designated rep.

The same CRM-name backfill (`src/app/auth/callback/route.ts`) populates `sales_executive_id` on districts, schools, accounts, and unmatched_accounts, plus `territory_owner_id` on states. All of these share the same problem: they're stale identity guesses dressed up as ownership. We're cleaning all of them up in one pass.

In practice, multiple reps may legitimately have standing on a district — anyone with closed-won/lost history in the last 18 months, anyone with an open opportunity, anyone working a territory plan that includes the district. We want to model that reality on districts, and stop pretending the other entities have meaningful "owners."

## Goals

- Replace the single-owner field on **districts** with a multi-claimant model (derived + manual claims).
- Compute most claims automatically ("derived claims") from existing data — opportunities, territory plans.
- Let reps explicitly *claim* / *release* / *transfer* districts they're working on ("manual claims"), independent of derived basis.
- Surface claimants on district UI so reps can see at a glance who has standing.
- **Drop the entire CRM-name-backfill family** across the schema — the same login-time logic that planted `District.ownerId` also planted `District.salesExecutiveId`, `School.ownerId`, `State.territoryOwnerId`, `Account.salesExecutiveId`, and `unmatched_accounts.sales_executive_id`. All go.
- Preserve historical district attribution during migration; let stale assignments age out naturally.

## Non-goals

- Extending the claim model to schools, states, or accounts. They just lose their owner field with no replacement.
- Reworking `TerritoryPlan.ownerId`. Plans still have a single user-set owner; that's a different concept.
- Reworking `MapView.ownerId`. User's own map views; user-set, untouched.
- Changing how `Opportunity.salesRepId` and `salesRepName` work — the rep on a deal is still the rep on a deal.
- Notifications when someone else claims a district. (Future.)
- Permissions / locking — claims are signals, not exclusive locks. Anyone can claim anything.

## Concepts

A **derived claim** is a `(district, user, basis)` tuple that follows automatically from other data. It is not stored — it's a SQL view.

A **manual claim** is a user-authored row in a `district_manual_claims` table. A rep claims a district to signal "I'm actively working this." Multiple reps may hold manual claims on the same district simultaneously.

A **claimant** is any user with at least one derived OR manual claim on a district.

### Derivation rules

A user has a derived claim on a district if **any** of these is true:

1. They are `Opportunity.salesRepId` on an opp where `district_lea_id` matches and `stage IN ('Stage 0','Stage 1','Stage 2','Stage 3','Stage 4','Stage 5')`. (Open pipeline — no time filter.)
2. They are `Opportunity.salesRepId` on an opp where `district_lea_id` matches and `stage IN ('Closed Won','Closed Lost')` and `close_date >= now() - interval '18 months'`.
3. They are `TerritoryPlan.ownerId` on a plan that contains the district via `TerritoryPlanDistrict`.
4. They are in `TerritoryPlanCollaborator` on a plan that contains the district via `TerritoryPlanDistrict`.

Each rule emits a `basis` value: `open_pipeline`, `recently_closed`, `plan_owner`, `plan_collaborator`. A user with multiple matching rules has multiple bases on the same district; the UI collapses them onto a single user row with a chip per basis.

### Manual-claim mechanics

- **Claim** — a rep adds themselves as a claimant on a district. Idempotent.
- **Release** — a rep removes their own claim. Cannot release someone else's.
- **Transfer** — a rep hands their claim to another user in one atomic step. The current user's row is deleted; a new row is created for the target user with `claimed_at = now()`. Recipient consent is not required for v1.
- **Expiry** — a manual claim is removed automatically when there has been no claim-extending activity from that rep on that district for 6 months. Activity = any of:
  - rep is `salesRepId` on an opp at this district whose `created_at`, `close_date`, or latest `stage_history` entry falls within 6 months;
  - rep is owner or collaborator on a plan that contains this district and the plan was created or updated within 6 months;
  - rep has an `Activity` linked to this district via `ActivityDistrict` with `Activity.userId` = rep, within 6 months.

  We materialize this as `last_activity_at` on the manual-claim row, refreshed nightly. Expiry runs daily and deletes claims with `last_activity_at < now() - interval '6 months'`. No advance warning to the rep in v1.

## Data model

### New table: `district_manual_claims`

```sql
CREATE TABLE district_manual_claims (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_leaid    varchar(7)  NOT NULL REFERENCES districts(leaid),
  user_id           uuid        NOT NULL REFERENCES user_profiles(id),
  claimed_at        timestamptz NOT NULL DEFAULT now(),
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  note              text,
  UNIQUE (district_leaid, user_id)
);
CREATE INDEX district_manual_claims_user_idx       ON district_manual_claims(user_id);
CREATE INDEX district_manual_claims_district_idx   ON district_manual_claims(district_leaid);
CREATE INDEX district_manual_claims_last_activity  ON district_manual_claims(last_activity_at);
```

The `note` field is used for transfer audit trail (`transferred from <user>`); optional otherwise.

### New view: `district_derived_claims_v`

A read-only Postgres view emitting `(district_leaid, user_id, basis, since)` rows. Built as the union of:

- `opportunities` rows where `district_lea_id IS NOT NULL AND sales_rep_id IS NOT NULL` and stage matches one of the open or recently-closed conditions; `basis` is `'open_pipeline'` or `'recently_closed'`; `since` is the opp's `close_date` for closed deals or `created_at` for open ones.
- `territory_plan_districts` joined to `territory_plans` on plan owner; `basis = 'plan_owner'`; `since = added_at` of the district to the plan.
- `territory_plan_districts` joined to `territory_plan_collaborators`; `basis = 'plan_collaborator'`; `since = added_at`.

A `(district, user)` pair may produce multiple rows here (one per basis). The application collapses them at read time.

### New view: `district_claimants_v`

```sql
SELECT district_leaid, user_id, basis, since, 'derived'::text AS kind
FROM district_derived_claims_v
UNION ALL
SELECT district_leaid, user_id, 'manual_claim'::text AS basis, claimed_at AS since, 'manual'::text AS kind
FROM district_manual_claims;
```

API reads `district_claimants_v` and groups in app code by `(district_leaid, user_id)`, collapsing bases into a list per user.

### Schema removed (in destructive migration C)

All columns, their indexes, and their Prisma relations:

- `District.ownerId` / `districts.owner_id` + `District.ownerUser` (`DistrictOwner` named-relation).
- `District.salesExecutiveId` / `districts.sales_executive_id` + `District.salesExecutiveUser` (`DistrictSalesExec` named-relation).
- `School.ownerId` / `schools.owner_id` + `School.ownerUser` (`SchoolOwner` named-relation).
- `State.territoryOwnerId` / `states.territory_owner_id` + `State.territoryOwnerUser` named-relation.
- `Account.salesExecutiveId` / `accounts.sales_executive_id` + relation.
- `unmatched_accounts.sales_executive_id` + relation.

The companion CRM string columns (`districts.owner`, `districts.sales_executive`, `schools.owner`, `states.territory_owner`, etc.) — leave as-is for now. They're populated by the existing CRM ETL and may have other consumers; out of scope to chase down. They become harmless string fields nobody reads.

### Materialized view rebuild

The `district_materialized_financials` materialized view (aliased `dmf` in the summary endpoints) currently includes `sales_executive_id`. The destructive migration must drop and recreate this view without that column. The summary endpoints (`src/app/api/districts/summary/route.ts`, `summary/compare/route.ts`, `leaids/route.ts`) lose the ability to filter financials by `sales_executive_id` — see API changes below for the replacement.

## API

### `GET /api/districts/:leaid/claimants`

Returns:

```ts
{
  claimants: Array<{
    user: { id: string; fullName: string; avatarUrl: string | null };
    kind: "derived" | "manual" | "both";  // "both" if user has both kinds
    bases: Array<
      | "open_pipeline"
      | "recently_closed"
      | "plan_owner"
      | "plan_collaborator"
      | "manual_claim"
    >;
    // Optional human-readable context for plan-based bases:
    planContext?: Array<{ planId: string; planName: string; planColor: string }>;
  }>;
}
```

One row per user. Sorted: current user first, then by `since` desc within each kind.

### `POST /api/districts/:leaid/claims`

Creates a manual claim for the authenticated user. Idempotent — returns 200 with the existing row if already claimed. Sets `last_activity_at = now()`.

### `DELETE /api/districts/:leaid/claims/me`

Removes the authenticated user's manual claim. 404 if no row exists.

### `POST /api/districts/:leaid/claims/transfer`

Body: `{ toUserId: string }`. Atomic: deletes the authenticated user's claim, creates one for `toUserId`. 404 if the authenticated user has no existing claim. The new row's `note` is set to `transferred from <fromUser fullName>`.

### Existing endpoints — changes

District endpoints:

- `GET /api/districts/search` — drop `ownerUser` from the response payload. Add an inline `claimantSummary` field with `{ count: number, currentUserIsClaimant: boolean, topAvatars: Array<{ id, avatarUrl }> }` (≤3 avatars) so the search-card avatar stack can render without a separate per-result fetch.
- `GET /api/districts/:leaid` — drop `ownerUser`, `salesExecutiveUser`, `salesExecutive`, and the `edits.owner` field from response.
- `PATCH /api/districts/:leaid/edits` — drop `ownerId` from accepted body.
- `POST /api/districts/batch-edits` — drop `ownerId` from the accepted body and from the "at least one of" validation. Endpoint stays, now `notes`-only.
- `GET /api/districts` — drop the `salesExec` filter parameter. `where.salesExecutiveId` removed.
- `GET /api/districts/summary`, `summary/compare`, `leaids` — the `owner` query param currently filters on `dmf.sales_executive_id`. Repurpose: `owner` now filters by *claimant* via a join through `district_claimants_v`. Same query param name, new semantics. (If keeping the param name causes confusion, rename to `claimedBy`; design assumes rename.)
- District-list endpoint(s) accept a new `claimedBy=<userId>` filter that joins via `district_claimants_v`.

Other endpoints (CRM-backfill cleanup):

- `GET /api/states/[code]` — drop `territoryOwnerUser` and `territoryOwner` from response.
- `PATCH /api/states/[code]` — drop `territoryOwnerId` from accepted body. The state edit form loses its owner select.
- `GET /api/states/[code]/districts` — drop `salesExecutiveUser` and `salesExecutive` from each district row.
- `GET /api/schools/[ncessch]`, `PATCH /api/schools/[ncessch]/edits` — drop `ownerUser` and `owner` from response and accepted body.
- `POST /api/accounts` — drop `salesExecutiveId` from accepted body. Existing accounts keep working; new accounts can't be created with the field.
- `GET /api/admin/unmatched-*` — drop the `sales_executive_id` filter parameter on the unmatched-accounts admin pages.
- `GET /api/tiles/[z]/[x]/[y]` — drop `d.sales_executive_id` and `d.sales_executive_name` from the SELECT, and from tile-feature properties.

### Auth callback (`src/app/auth/callback/route.ts`)

The callback today runs one re-link by `salesRepEmail` (opportunities) plus a `Promise.all` wrapping five re-links by `crmName`. **Keep only the email-based opp re-link.** Delete the entire `Promise.all` block and the surrounding `crmName` profile fetch:

- `UPDATE districts SET owner_id = ...`
- `UPDATE districts SET sales_executive_id = ...`
- `UPDATE states SET territory_owner_id = ...`
- `UPDATE schools SET owner_id = ...`
- `UPDATE unmatched_accounts SET sales_executive_id = ...`

New users no longer get any CRM-name-derived ownership stitched together at login. Their connection to districts comes entirely from the claim system; their connection to opportunities still comes from the email-based salesRep re-link.

## UI

### `<DistrictClaimants>` component

New component, rendered in two modes:

- **Compact (search card):** avatar stack of up to 3 claimants (overlapping circles, plum border ring). `+N` pill if more. If the current user is among the claimants, their avatar gets a subtle ring highlight. Tooltip on hover lists names. If zero claimants, render nothing — absence carries the meaning, no "Unclaimed" tag.

- **Detail (district panel):** a "Claims" section listing every claimant. Each row shows avatar, full name, and a stack of basis chips:
  - `Open pipeline` — plum
  - `Recently closed` — softer plum
  - `Plan: <plan name>` — colored to the plan's color
  - `Collaborator: <plan name>` — softer variant of plan color
  - `Manual claim` — neutral

  Below the list, action button(s) for the current user:
  - If not currently a manual-claimant: `Claim this district` (primary).
  - If currently a manual-claimant: `Release` and `Transfer…` (transfer opens a user picker modal).

### Search card

Replace the `district.ownerUser?.fullName` text line with `<DistrictClaimants compact ... />`. Keep the existing Customer/Prospect badge and the enrollment metric line.

### District edit / batch-edit modal

Remove the "Owner" select. The detail panel's Claims section replaces the editable owner — the user manages their relationship to the district there, not via an admin-style assignment.

### "Mine" filter chip

New filter chip on the district list / map. Default state: **on** for the authenticated user (per CLAUDE.md "Filter bars default to current user"). One-click toggle to "All". Server side, the filter passes `claimedBy=<currentUserId>` to the list endpoint, which joins through `district_claimants_v`.

### UI surfaces removed (CRM-backfill cleanup)

District-level:

- `src/features/districts/components/DistrictHeader.tsx:156-160` — "Sales Executive: <name>" row is deleted.
- `src/features/map/components/SearchResults/DistrictExploreModal.tsx:285-286` — the "Owner" stat (currently bound to `salesExecutive`) is deleted.
- `src/features/map/components/SearchBar/FullmindDropdown.tsx`, `DistrictsDropdown.tsx`, `FilterPills.tsx`, `SearchBar/index.tsx` — remove the `salesExecutive` and `owner` columns from the searchable filter set. The "Sales Exec" filter pill disappears.
- `src/features/districts/lib/queries.ts` — drop `salesExecutive` from the params interface and from `searchParams` building. Drop `salesExecutiveId` from the edit-payload interface.
- `src/features/shared/lib/queries.ts` — drop the `useSalesExecutives` query (`queryKey: ["salesExecutives"]`).
- `src/features/shared/lib/app-store.ts` — drop the `salesExecutive` filter slice.
- `src/features/shared/lib/filters.ts` — drop the `salesExecutive: "salesExecutiveId"` field-map entry.
- `src/features/shared/types/api-types.ts` — drop `salesExecutive: PersonRef | null` from district-related response types (3 places) and `territoryOwner` from state types.
- `src/lib/district-column-metadata.ts:2321` — drop the `territoryOwnerId` metadata entry (the column that backs it is gone).
- `src/features/map/components/MapV2Container.tsx:1028` — drop the `salesExecutive: props?.sales_executive_name` mapping in the tile-feature handler.

State-level:

- The state detail panel's territory-owner edit field (anywhere `territoryOwnerId` is editable in the UI; trace from the `territoryOwner` types in `src/features/shared/types/api-types.ts:816` to its UI consumers).

Account-level:

- The "Sales Executive" filter on the unmatched-opps admin page (`src/app/admin/unmatched-opportunities/page.tsx` if it has one — verify during implementation; only the API filter is confirmed in trace).
- The "Sales Executive" select on the create-account flow (consumer of `POST /api/accounts`).

### Surfaces NOT changing

- `TerritoryPlan.ownerId` and the "Owner" label on `PlanDetailSidebar.tsx` — plan ownership is a separate concept, user-set, real.
- `HomePanel`'s plan-owner filter — operates on plans, not districts.
- `MapView.ownerId` — user's own map views, user-set.
- `Opportunity.salesRepName` / `salesRepId` displayed in deal views — opp-level, not district-level. The email-based re-link in auth callback stays.
- The CRM string columns themselves (`districts.owner`, `districts.sales_executive`, `schools.owner`, `states.territory_owner`, etc.). They're populated by the CRM ETL; we're not chasing down that pipeline. They become harmless fields nobody reads from app code.

## Migration

Three-phase. Each phase is a separate PR/deploy.

### Phase A — additive schema + backfill

1. Migration creates `district_manual_claims` table, `district_derived_claims_v` view, and `district_claimants_v` view. No drops.
2. Backfill script `scripts/backfill-district-manual-claims.ts`: for every district row, insert into `district_manual_claims (district_leaid, user_id, claimed_at, last_activity_at)` with both timestamps set to `now()` for **each** non-null `(leaid, user_id)` pair from these two sources:
   - `(districts.leaid, districts.owner_id)` where `owner_id IS NOT NULL`
   - `(districts.leaid, districts.sales_executive_id)` where `sales_executive_id IS NOT NULL`

   Skip if a row already exists for that `(leaid, user_id)` (UNIQUE constraint). Idempotent — can be re-run. If both `owner_id` and `sales_executive_id` point to the same user on a district, the second insert is a no-op.

   Setting `last_activity_at = now()` starts the 6-month expiry clock fresh on backfill day. Random/wrong assignments age out naturally if the rep never touches the district. Legitimate assignments stay alive via ongoing opps/plans/activities.

### Phase B — audit (manual)

`scripts/audit-backfilled-claims.ts` produces two CSVs from the backfilled rows:

- `covered.csv` — backfilled manual claims where the user *also* has a derived claim. (Redundant; the rep would have a claim anyway.)
- `unsupported.csv` — backfilled manual claims where the user has no derived basis. (Suspect — likely random assignments.)

Output columns: `district_leaid, district_name, user_id, user_full_name, derived_bases (semicolon-separated), claimed_at`.

Sierra reviews `unsupported.csv` and chooses per row to keep, delete, or leave to natural expiry. No script action — the cleanup is done manually by editing rows in `district_manual_claims` (e.g., a one-off SQL delete by a list of `(leaid, user_id)` pairs).

### Phase C — app code + destructive schema

Two PRs, in order:

1. **App code PR** — implement the new claim API, the `<DistrictClaimants>` component, the search-card and detail-panel changes, the "Mine" filter chip. Remove every read referenced in "Existing endpoints — changes" and "UI surfaces removed (CRM-backfill cleanup)" — the `ownerUser` / `salesExecutiveUser` / `territoryOwnerUser` Prisma includes, the related `salesExec` / `territoryOwnerId` query params, the filter pills, the header rows, the explore-modal stats, the `useSalesExecutives` query, the metadata entry, the auth-callback re-link blocks (4 of 5 deleted). Existing columns and the materialized view stay in the database — application code just stops touching them. Deploy.

2. **Destructive migration PR** (after the app code is deployed and stable) — single migration that:
   1. Drops the `district_materialized_financials` view (or whatever its real name is — verify during implementation).
   2. Drops the listed columns and indexes (`District.ownerId`, `District.salesExecutiveId`, `School.ownerId`, `State.territoryOwnerId`, `Account.salesExecutiveId`, `unmatched_accounts.sales_executive_id`).
   3. Recreates `district_materialized_financials` from scratch without the `sales_executive_id` column.
   4. Drops the corresponding Prisma relations from `schema.prisma` and runs `prisma migrate`.

   Splitting this off from the app PR is cheap insurance: if any code path still referenced one of these columns, we find out before they're gone.

## Background jobs

Both run daily. Match the existing cron-route convention in this codebase (verify during implementation; the app already has cron-style routes elsewhere).

### Activity-refresh job

Recomputes `district_manual_claims.last_activity_at` for every row. For each `(district_leaid, user_id)` pair, set `last_activity_at` to the most recent of:

- `Opportunity` rows where `sales_rep_id = user_id AND district_lea_id = district_leaid`: the max of `created_at`, `close_date`, and the latest `stage_history` entry's timestamp.
- `TerritoryPlan` rows where (`owner_id = user_id` OR user is in `territory_plan_collaborators`) AND the plan contains the district: the plan's `updated_at`.
- `Activity` rows linked via `ActivityDistrict` to this district where `Activity.userId = user_id`: the activity's `createdAt` (or whatever the canonical timestamp on `Activity` is — verify during implementation).

If no activity is found, leave `last_activity_at` at its existing value (the expiry job will handle it).

### Expiry job

Deletes manual claims where `last_activity_at < now() - interval '6 months'`. Logs the count of deleted rows. No notifications.

## Tests (Vitest)

Co-located under `__tests__/` next to source per project convention.

### Derivation view (`district_derived_claims_v`)

- Opp in Stage 0 → claim row emitted with `basis = 'open_pipeline'`.
- Opp in Stage 5 → same.
- Opp in Closed Won, `close_date` 17 months ago → claim row with `basis = 'recently_closed'`.
- Opp in Closed Won, `close_date` 19 months ago → no claim row.
- Opp in Closed Lost, `close_date` 17 months ago → claim row.
- Opp with `district_lea_id IS NULL` → no claim row.
- Opp with `sales_rep_id IS NULL` → no claim row.
- Plan owner with district in plan → claim row with `basis = 'plan_owner'`.
- Plan collaborator with district in plan → claim row with `basis = 'plan_collaborator'`.

### Manual-claim API

- `POST /api/districts/:leaid/claims` creates a row; second call is idempotent (200, no duplicate).
- `DELETE /api/districts/:leaid/claims/me` removes own row; 404 if none.
- `DELETE` cannot remove another user's claim.
- `POST /api/districts/:leaid/claims/transfer` is atomic: source row deleted, target row created with the correct `claimed_at` and `note`. 404 if caller has no claim.

### Expiry cron

- Manual claim with `last_activity_at = 5 months ago` → kept.
- Manual claim with `last_activity_at = 7 months ago` → deleted.
- Manual claim refreshed by activity-refresh job (rep added an activity yesterday) → kept.

### UI tests

- `<DistrictClaimants compact>` renders 0/1/3/5+ claimants correctly, current user gets ring.
- Detail panel shows Claim button when user is not a claimant; Release + Transfer when user is.
- "Mine" filter chip default state matches current user.

### Regression coverage for CRM-backfill cleanup

- `GET /api/districts/:leaid` response no longer contains `ownerUser`, `salesExecutiveUser`, `salesExecutive`, or `edits.owner`.
- `GET /api/states/[code]` response no longer contains `territoryOwnerUser` or `territoryOwner`.
- `PATCH /api/districts/:leaid/edits` rejects (or ignores) an `ownerId` field; same for `PATCH /api/states/[code]` with `territoryOwnerId`.
- `GET /api/districts?salesExec=...` no longer filters; the query param is silently ignored or returns 400 (pick one during implementation — lean toward "silently ignored" for forward compatibility).
- `GET /api/districts/summary?owner=<userId>` filters by claimant, not by `sales_executive_id`. Verify with a fixture user who has a claim but no historical `sales_executive_id` and confirm the summary includes their districts.

## Open questions / future work

- Notifications when someone claims, releases, or transfers a district you're connected to — defer.
- Admin override to remove anyone's claim — defer until a real need surfaces.
- Warning banner before expiry ("Your claim on X expires in 7 days") — defer.
- Should states get their own claim model later? Today they have a single `territoryOwnerId` (which we're dropping). If state-level ownership turns out to matter for territory planning, consider a state_claims companion to district_claims in a later cycle.
- Cleaning up the upstream CRM ETL that populates the now-orphan string columns (`districts.owner`, `sales_executive`, `territory_owner`, etc.) — out of scope; those columns become harmless string blobs.
- Backfilling claim data into the `accounts` table (CMOs, ESAs, charter networks) — `Account.salesExecutiveId` is going away with no replacement on accounts. If account-level claims become a need, design separately.
