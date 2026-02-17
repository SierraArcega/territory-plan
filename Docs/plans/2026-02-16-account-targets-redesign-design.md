# Account Targets Redesign

**Date:** 2026-02-16
**Status:** Approved

## Summary

Replace the two generic per-district targets (revenueTarget, pipelineTarget) with four business-category targets (renewal, winback, expansion, new business). Split the single service selection into two categories: return services and new services.

## Schema Changes

### TerritoryPlanDistrict

Remove `revenueTarget` and `pipelineTarget`. Add:

- `renewalTarget` Decimal(15,2)?
- `winbackTarget` Decimal(15,2)?
- `expansionTarget` Decimal(15,2)?
- `newBusinessTarget` Decimal(15,2)?

### TerritoryPlanDistrictService

Add a `category` field using a new enum:

```prisma
enum ServiceCategory {
  return
  new
}
```

- `category` ServiceCategory @default(return)

The composite key becomes `(planId, districtLeaid, serviceId, category)` — or keep the existing key and add category as a required non-key field if a service can only be in one category per district.

### UserGoal

Remove `revenueTarget` and `pipelineTarget`. Add:

- `renewalTarget` Decimal(15,2)?
- `winbackTarget` Decimal(15,2)?
- `expansionTarget` Decimal(15,2)?
- `newBusinessTarget` Decimal(15,2)?

## API Changes

### PUT /api/territory-plans/[id]/districts/[leaid]

Body:
- Remove: `revenueTarget`, `pipelineTarget`, `serviceIds`
- Add: `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`, `returnServiceIds`, `newServiceIds`

Service persistence: delete existing records, create new ones with appropriate `category` value.

### GET /api/territory-plans/[id]/districts/[leaid]

Response:
- Remove: `revenueTarget`, `pipelineTarget`, `targetServices`
- Add: `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`, `returnServices`, `newServices`

### GET /api/profile/goals/[fiscalYear]/dashboard

Aggregation:
- Sum each of the four targets separately across all districts in all plans
- Compute `totalTarget` as sum of all four
- Per-plan breakdown includes all four targets + total
- Headline metric is the grand total with breakdown underneath

## UI Changes

### PlanDistrictPanel

- Four inline-edit currency fields replace the two existing ones
- "Targeted Services" section splits into "Return Services" and "New Services" with separate service selectors

### DistrictTargetEditor (modal)

- Four currency inputs replace two
- Two service selector groups replace one

### DistrictCard

- Show combined total (sum of non-null targets) as headline
- Service badges split into Return and New groups

### DistrictsTable

- Four target columns replace two
- Inline service popover has two sections (Return / New)

### ServiceSelector component

- No changes — parent components render it twice with different props

### useUpdateDistrictTargets hook

- Mutation payload updated to four targets + two service ID arrays

### Goal Dashboard

- Headline shows grand total
- Breakdown row shows the four individual target sums

## Approach

Widen existing tables with new columns (Approach A). Simple, consistent with existing patterns, no new tables needed.
