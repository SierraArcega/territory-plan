# District Claims — Design

**Status:** Draft
**Author:** Sierra Arcega + Claude
**Date:** 2026-05-04

## Problem

Districts today have a single editable `District.ownerId` field. Most existing values were assigned arbitrarily during data import; they don't reflect any real working relationship. The "Owner" UI surfaces (search-result card, district-edit modal, batch-edit) reinforce the wrong mental model: that a district has one designated rep.

In practice, multiple reps may legitimately have standing on a district — anyone with closed-won/lost history in the last 18 months, anyone with an open opportunity, anyone working a territory plan that includes the district. We want to model that reality and let reps explicitly *claim* districts they're actively pursuing.

## Goals

- Replace the single-owner field with a multi-claimant model.
- Compute most claims automatically ("derived claims") from existing data — opportunities, territory plans.
- Let reps explicitly *claim* / *release* / *transfer* districts they're working on ("manual claims"), independent of derived basis.
- Surface claimants on district UI so reps can see at a glance who has standing.
- Preserve historical attribution during migration; let stale assignments age out naturally.

## Non-goals

- Reworking `TerritoryPlan.ownerId`. Plans still have a single owner; that's a different concept.
- Changing how `Opportunity.salesRepId` works.
- Reworking `District.salesExecutiveId` (separate account-level field, out of scope).
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

### Schema removed (in destructive migration B)

- `District.ownerId` (column + Prisma field).
- `District.ownerUser` Prisma relation.
- `districts.owner_id` index.
- The `DistrictOwner` named-relation on `UserProfile`.

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

- `GET /api/districts/search` — drop `ownerUser` from the response payload. Add an inline `claimantSummary` field with `{ count: number, currentUserIsClaimant: boolean, topAvatars: Array<{ id, avatarUrl }> }` (≤3 avatars) so the search-card avatar stack can render without a separate per-result fetch.
- `GET /api/districts/:leaid` — drop `ownerUser` and the `edits.owner` field from response.
- `PATCH /api/districts/:leaid/edits` — drop `ownerId` from accepted body.
- `POST /api/districts/batch-edits` — drop `ownerId` from the accepted body and from the validation that requires "at least one of ownerId or notes." Endpoint stays, now `notes`-only.
- District-list endpoint(s) accept a new `claimedBy=<userId>` filter that joins via `district_claimants_v`.

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

### Surfaces NOT changing

- `TerritoryPlan.ownerId` and the "Owner" label on `PlanDetailSidebar.tsx` — plan ownership is a separate concept.
- `HomePanel`'s plan-owner filter — operates on plans, not districts.
- `Opportunity.salesRepName` / `salesRepId` displayed in deal views — opp-level, not district-level.

## Migration

Three-phase. Each phase is a separate PR/deploy.

### Phase A — additive schema + backfill

1. Migration creates `district_manual_claims` table, `district_derived_claims_v` view, and `district_claimants_v` view. No drops.
2. Backfill script `scripts/backfill-district-manual-claims.ts`: for every district row with a non-null `ownerId`, insert into `district_manual_claims (district_leaid, user_id, claimed_at, last_activity_at)` with both timestamps set to `now()`. Skip if a row already exists for that `(leaid, user_id)`. Idempotent — can be re-run.

   Setting `last_activity_at = now()` starts the 6-month expiry clock fresh on backfill day. Random/wrong assignments will age out naturally if the rep never touches the district. Legitimate assignments will be kept alive by ongoing opps/plans/activities.

### Phase B — audit (manual)

`scripts/audit-backfilled-claims.ts` produces two CSVs from the backfilled rows:

- `covered.csv` — backfilled manual claims where the user *also* has a derived claim. (Redundant; the rep would have a claim anyway.)
- `unsupported.csv` — backfilled manual claims where the user has no derived basis. (Suspect — likely random assignments.)

Output columns: `district_leaid, district_name, user_id, user_full_name, derived_bases (semicolon-separated), claimed_at`.

Sierra reviews `unsupported.csv` and chooses per row to keep, delete, or leave to natural expiry. No script action — the cleanup is done manually by editing rows in `district_manual_claims` (e.g., a one-off SQL delete by a list of `(leaid, user_id)` pairs).

### Phase C — app code + destructive schema

Two PRs, in order:

1. **App code PR** — implement the new claim API, the `<DistrictClaimants>` component, the search-card and detail-panel changes, the "Mine" filter chip, and remove all reads of `District.ownerUser` / `ownerId` in the codebase (API responses, UI components, search results, Prisma includes). Existing column stays in the database — application code just stops touching it. Deploy.

2. **Destructive migration PR** (after the app code is deployed and stable) — drop the `District.ownerUser` relation from `schema.prisma`, drop the `owner_id` column and its index, run `prisma migrate`. Splitting this off is cheap insurance: if any code path still referenced `ownerId`, we find out before the column is gone.

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

## Open questions / future work

- Notifications when someone claims, releases, or transfers a district you're connected to — defer.
- Admin override to remove anyone's claim — defer until a real need surfaces.
- Warning banner before expiry ("Your claim on X expires in 7 days") — defer.
- Should `District.salesExecutiveId` be surfaced on the detail panel alongside claimants? Out of scope for this design.
