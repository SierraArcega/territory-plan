# Leaderboard: Remove Tier Badges + Dynamic FY Checkboxes

**Date:** 2026-04-16
**Scope:** Frontend (LeaderboardHomeWidget, LeaderboardModal, LeaderboardDetailView, RevenueOverviewTab) + API (leaderboard route)

---

## 1. Remove Tier Badges from UI

Remove all visible tier badge rendering from three components. The backend continues to compute tiers (no API changes needed here) — we just stop displaying them.

### LeaderboardHomeWidget (profile sidebar)

**File:** `src/features/leaderboard/components/LeaderboardHomeWidget.tsx`

- Remove `TierBadge` import and rendering (line 90)
- Remove tier-based background color and glow styling — use a neutral Fullmind plum background instead (`#F7F5FA` bg, `rgba(138,128,168,0.3)` glow)
- Remove `parseTierRank` and `TIER_COLORS` imports since they're only used for styling
- Keep rank display (`#{data.rank}`) and ticker — these are the pure ranking elements

### LeaderboardModal

**File:** `src/features/leaderboard/components/LeaderboardModal.tsx`

- Remove tier grouping/dividers — entries should be a flat ranked list
- Remove per-entry `TierBadge` rendering
- Keep rank numbers (#1, #2, etc.)

### LeaderboardDetailView

**File:** `src/features/leaderboard/components/LeaderboardDetailView.tsx`

- Remove `TierBadge` from the table rows
- Keep rank column

---

## 2. Dynamic FY Checkboxes (Revenue Overview Tab)

Replace the two `FYSelect` dropdowns with checkbox groups using relative labels.

### Type Changes

**File:** `src/features/leaderboard/lib/types.ts`

Add prior FY fields to `LeaderboardEntry`:
```typescript
pipelinePriorFY: number;
targetedPriorFY: number;
```

### New FY Selection Model

Replace `FYSelection = "current" | "next" | "both"` with:

```typescript
interface FYChecked {
  prior: boolean;
  current: boolean;
  next: boolean;
}
```

Default state: `{ prior: false, current: true, next: true }`

### Checkbox UI

**File:** `src/features/leaderboard/components/RevenueOverviewTab.tsx`

Replace each `FYSelect` dropdown with an inline checkbox group:

```
PIPELINE:  ☐ Previous (FY25)  ☑ Current (FY26)  ☑ Next (FY27)
TARGETED:  ☐ Previous (FY25)  ☑ Current (FY26)  ☑ Next (FY27)
```

- Each checkbox shows: relative label + dynamic FY string from API response (`fiscalYears.priorFY`, `fiscalYears.currentFY`, `fiscalYears.nextFY`)
- Styled as small inline checkboxes matching Fullmind brand (plum accent `#403770` for checked state)
- Compact layout — fits in the existing filter bar

### Minimum Selection Enforcement

When the user unchecks the last remaining checkbox:
1. Re-check it immediately (prevent empty selection)
2. Show a brief toast: **"At least one fiscal year must be selected"**
3. Toast auto-dismisses after 2 seconds
4. Toast positioned near the checkboxes (inline or bottom of filter bar), not a global toast

### Value Computation

Sum the checked FY values for each entry:

```typescript
function computeValue(
  entry: LeaderboardEntry,
  field: "pipeline" | "targeted",
  checked: FYChecked
): number {
  let sum = 0;
  if (checked.prior) sum += entry[`${field}PriorFY`];
  if (checked.current) sum += entry[`${field}CurrentFY`];
  if (checked.next) sum += entry[`${field}NextFY`];
  return sum;
}
```

Same logic applies to team totals.

---

## 3. API Changes

**File:** `src/app/api/leaderboard/route.ts`

### Add Prior FY Pipeline Data

The API already fetches `priorSchoolYr` actuals but only extracts revenue from it. Add:

```typescript
pipelinePriorFY: yearActuals.get(priorSchoolYr)?.openPipeline ?? 0,
```

to the per-user actuals map (alongside existing `pipelineCurrentFY`, `pipelineNextFY`).

### Add Prior FY Targeted Data

Add a third query for prior FY territory plan districts:

```typescript
const priorFYInt = currentFY - 1;

const targetedPriorFYDistricts = await prisma.territoryPlanDistrict.findMany({
  where: { plan: { ...ownerFilter, fiscalYear: priorFYInt } },
  select: { /* same as current/next */ },
});
const targetedPriorFYByUser = sumTargets(targetedPriorFYDistricts);
```

Add to Promise.all with the existing current/next FY queries.

### Expand Response

Per entry, add:
- `pipelinePriorFY`
- `targetedPriorFY`

In `fiscalYears` response object, add:
- `priorFY: priorSchoolYr` (e.g., `"2024-25"`)

In `teamTotals`, add:
- `pipelinePriorFY`, `unassignedPipelinePriorFY`
- `targetedPriorFY`, `unassignedTargetedPriorFY`

### Error path fallback

Update the catch fallback object to include `pipelinePriorFY: 0`.

---

## 4. Fiscal Year Auto-Rolling

No new work needed — the API already computes fiscal years dynamically:

```typescript
const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
```

In June 2029, `currentFY` = 2030, so:
- Prior = FY29 (`"2028-29"`)
- Current = FY30 (`"2029-30"`)
- Next = FY31 (`"2030-31"`)

The frontend labels pull from the API response, so everything auto-rolls.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/leaderboard/components/LeaderboardHomeWidget.tsx` | Remove TierBadge, use neutral styling |
| `src/features/leaderboard/components/LeaderboardModal.tsx` | Remove tier grouping + per-entry badges |
| `src/features/leaderboard/components/LeaderboardDetailView.tsx` | Remove tier badge column |
| `src/features/leaderboard/components/RevenueOverviewTab.tsx` | Replace FYSelect with checkbox groups + toast |
| `src/features/leaderboard/lib/types.ts` | Add `pipelinePriorFY`, `targetedPriorFY` to entry type |
| `src/app/api/leaderboard/route.ts` | Add prior FY pipeline/targeted data + expand response |
