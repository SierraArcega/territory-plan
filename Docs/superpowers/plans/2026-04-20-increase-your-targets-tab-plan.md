# Implementation Plan: Increase Your Targets Tab

**Date:** 2026-04-20
**Slug:** increase-your-targets-tab
**Spec:** `Docs/superpowers/specs/2026-04-20-increase-your-targets-tab-spec.md`
**Backend context:** `Docs/superpowers/specs/2026-04-20-increase-your-targets-tab-backend-context.md`

## Task dependency graph

```
BE-1 (GET endpoint)                FE-1 (types + queries hook)
        │                                   │
        └────────── both depend on ─────────┤
                                            │
                                    FE-2 (columnDefs file)
                                            │
                                    FE-3 (AddToPlanPopover)
                                            │
                                    FE-4 (IncreaseTargetsTab)
                                            │
                                    FE-5 (wire into LeaderboardModal + widen)
                                            │
                                      (manual smoke test)
                                            │
                                    TEST-1 / TEST-2 (unit + integration)
```

FE-2/FE-3/FE-4 can be drafted against stubbed types if BE-1 is in progress but not merged. FE-5 is last because it touches the existing shared modal.

---

## Backend Tasks

### BE-1 — Create GET endpoint `/api/leaderboard/increase-targets`

**File:** `src/app/api/leaderboard/increase-targets/route.ts` (new)

**Behavior:**
1. Call `getUser()` from `@/lib/supabase/server`. Return 401 if null.
2. Execute a single raw SQL query via Prisma `$queryRaw` that:
   - CTE `fy26`: `district_financials WHERE vendor='fullmind' AND fiscal_year='FY26' AND total_revenue > 0`
   - CTE `fy27_any`: `district_financials WHERE vendor='fullmind' AND fiscal_year='FY27' AND (COALESCE(open_pipeline,0)+COALESCE(closed_won_bookings,0)+COALESCE(total_revenue,0)) > 0`
   - CTE `already_planned`: `SELECT DISTINCT district_leaid FROM territory_plan_districts`
   - CTE `last_opp`: `SELECT DISTINCT ON (district_lea_id) ... ORDER BY district_lea_id, close_date DESC` for stage ILIKE 'Closed Won%'
   - CTE `top_products`: `ARRAY_AGG(DISTINCT s.product_type)` and `ARRAY_AGG(DISTINCT s.sub_product)` grouped by district
   - Final SELECT joining `districts` + the CTEs, excluding `fy27_any` and `already_planned`, ordered by FY26 revenue desc
3. Transform the raw rows into the `IncreaseTarget[]` shape defined in the spec. Numeric fields come back as strings or Decimal — coerce to JS number via `Number(…)`. Dates → ISO strings.
4. Respond `NextResponse.json({ districts: IncreaseTarget[], totalRevenueAtRisk: number })`.
5. Wrap in `try/catch`; on error log `console.error` and return 500 `{ error: "Failed to load at-risk districts" }`.
6. Add `export const dynamic = "force-dynamic";` to match the existing leaderboard route pattern.

**Reference:** mirror `src/app/api/leaderboard/route.ts` structure.

**Test strategy (for TEST-1):**
- Mock the 5 CTEs with seed data (2 FY26 customers; 1 has FY27 activity, 1 doesn't; 1 is already in a plan).
- Assert only the un-planned, no-FY27 row is returned.
- Assert 401 when no user.
- Assert response shape matches the `IncreaseTarget` type exactly.

---

## Frontend Tasks

### FE-1 — Types + TanStack Query hook

**Files:**
- `src/features/leaderboard/lib/types.ts` (modify — append types)
- `src/features/leaderboard/lib/queries.ts` (modify — append hooks)

**Additions to `types.ts`:**
```ts
export interface IncreaseTarget {
  leaid: string;
  districtName: string;
  state: string;
  enrollment: number | null;
  fy26Revenue: number;
  fy26CompletedRevenue: number;
  fy26ScheduledRevenue: number;
  fy26SessionCount: number | null;
  fy26SubscriptionCount: number | null;
  lastClosedWon: {
    repName: string | null;
    repEmail: string | null;
    closeDate: string | null;
    schoolYr: string | null;
    amount: number | null;
  } | null;
  productTypes: string[];
  subProducts: string[];
}

export interface IncreaseTargetsResponse {
  districts: IncreaseTarget[];
  totalRevenueAtRisk: number;
}
```

**Additions to `queries.ts`:**
- `useIncreaseTargetsList()` — query key `["leaderboard", "increase-targets"]`, staleTime 60s (shorter than other leaderboard queries since the list mutates on add).
- `useMyPlans()` — fetches `/api/territory-plans` and filters to `plan.ownerId === currentUser.id`. staleTime 2 minutes. Uses `useMyLeaderboardRank()` to get the user id, OR adds a separate `useCurrentUserId()` hook — prefer the latter via an existing `/api/me` or `/api/auth/me` endpoint (grep first; fall back to extending `useMyLeaderboardRank`).
- `useAddDistrictToPlanMutation()` — wraps the existing `POST /api/territory-plans/[id]/districts`. On success: `queryClient.setQueryData(["leaderboard", "increase-targets"], ...)` to remove the row optimistically, then `invalidateQueries` for plan-related keys.

**Test strategy:** no dedicated unit tests — covered by integration tests in TEST-2.

### FE-2 — Column definitions

**File:** `src/features/leaderboard/lib/columns/increaseTargetsColumns.ts` (new)

**Contents:** `ColumnDef[]` per the UI framework spec (`Documentation/UI Framework/Components/Tables/data-grid.md`):
- `districtName`, `state`, `fy26Revenue` (include `($)` in label for currency auto-detect), `fy26SessionCount`, `lastRepName`, `lastSaleSummary`, `products`.
- `width` set on the narrow columns per spec table.
- `isDefault: true` for all except `fy26SessionCount` (hide by default — it's extra context).
- `group: "At-Risk Info"` (one group — future-proofs the column picker).
- No `filterType: "enum"` for `state` — use `"text"` (don't precompute enum values for 68 rows).

**Test strategy:** no dedicated tests — column defs are declarative config.

### FE-3 — AddToPlanPopover component

**File:** `src/features/leaderboard/components/AddToPlanPopover.tsx` (new)

**Props:**
```ts
interface AddToPlanPopoverProps {
  district: IncreaseTarget;
  anchorRef: React.RefObject<HTMLButtonElement>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (planName: string) => void;
}
```

**Behavior:**
- Renders as a fixed-position `<div>` positioned via `anchorRef.current.getBoundingClientRect()`. Width 320px. Fades in.
- Focus trap using `useEffect` + `tabindex` management (or reuse an existing pattern if present — grep `focus-trap` and `DistrictsTable.tsx` `InlineServiceSelector`).
- Escape key → `onClose`. Click outside → `onClose` (use a ref + `mousedown` listener on `document`).
- Uses `useMyPlans()` to populate the plan `<select>`. If 0 plans, disabled select + helper text.
- `useAddDistrictToPlanMutation()` on submit. Body: `{ leaids: district.leaid, [bucketKey]: Number(targetInput) }` where `bucketKey` is one of `renewalTarget | winbackTarget | expansionTarget | newBusinessTarget`.
- Submit button is disabled unless `planId !== "" && parsedTarget > 0`.
- Loading state: submit shows spinner, Cancel disabled.
- Error: inline red text `"Couldn't add to plan. Try again."` — popover stays open.
- Success: call `onSuccess(planName)`, which closes and triggers toast + cache update.

**Styling tokens:** plum/coral per spec. No grays.

**Test strategy (for TEST-2):**
- Render with 2 fake plans; assert submit is disabled initially.
- Fill plan + target; assert submit becomes enabled.
- Click submit; assert mutation is called with correct `bucketKey: targetValue`.
- Simulate mutation error; assert popover stays open with error message.

### FE-4 — IncreaseTargetsTab component

**File:** `src/features/leaderboard/components/IncreaseTargetsTab.tsx` (new)

**Contents:**
- Imports `useIncreaseTargetsList()`, columns from FE-2, `DataGrid`, `AddToPlanPopover`.
- Top: sticky summary strip. Text computed from `data.districts.length` and `data.totalRevenueAtRisk` using `formatCurrency` from `src/features/shared/lib/format.ts`.
- Middle: loading spinner / error banner / empty state / `<DataGrid />`.
- `DataGrid` props:
  - `data={data.districts}`
  - `columnDefs={increaseTargetsColumns}`
  - `rowIdAccessor="leaid"`
  - `renderRowAction={(row) => <AddButton row={row} />}` — the `AddButton` is an inline component that manages its own popover open/close state and renders `AddToPlanPopover`.
  - `renderExpandedRow={(row) => <ExpandedRowDetail row={row} />}` — shows the full product chip cloud, last sale detail, FY26 breakdown.
  - `cellRenderers={{ products: renderProductChips, lastSaleSummary: renderLastSale, state: renderStateTag }}`
- Toast on success: reuse any existing toast system (grep `toast`, `sonner`, or `react-hot-toast`). If none exists, keep it simple — briefly show a banner at the top of the tab instead.

**Test strategy (for TEST-2):**
- Render with mocked `useIncreaseTargetsList()` returning 3 rows.
- Assert 3 rows render.
- Simulate mutation success on row 1; assert row 1 disappears and count updates.
- Render with empty list; assert empty state message.
- Render with error; assert banner + retry.

### FE-5 — Wire into LeaderboardModal

**File:** `src/features/leaderboard/components/LeaderboardModal.tsx` (modify)

**Changes:**
1. Import `Sparkles` from lucide-react.
2. Add to `VIEW_CONFIG`: `{ value: "increase", label: "Increase Targets", icon: Sparkles }`.
3. Add `"increase"` to the `LeaderboardView` type union in `src/features/leaderboard/lib/types.ts`.
4. Change the modal wrapper className from `max-w-2xl` to `${view === "increase" ? "max-w-5xl" : "max-w-2xl"}`.
5. When `view === "increase"`: render `<IncreaseTargetsTab />` and **skip the existing rankings rendering block** (the tier dividers + ranked entries). Everything else (header, tab bar, description strip) renders the same.
6. Update the description strip (line ~217): add a case for `view === "increase"` — `"Districts with FY26 revenue but no FY27 activity. Add to a plan to start the renewal conversation."`

**Test strategy (for TEST-2):**
- Render modal open with `view="increase"` (seed via initial state if possible; otherwise simulate click on the new tab).
- Assert modal wrapper has `max-w-5xl`.
- Assert `IncreaseTargetsTab` is rendered and ranking block is not.
- Switch back to `"combined"`; assert modal reverts to `max-w-2xl` and ranking block renders.

---

## Test Tasks

### TEST-1 — Backend route test
**File:** `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts` (new)

Use the existing Vitest + Prisma pattern (grep `__tests__` under `src/app/api/` for any route test as a reference, or fall back to treating Prisma as mocked and asserting the SQL + shape at the response layer).

### TEST-2 — Frontend component tests
**Files:**
- `src/features/leaderboard/components/__tests__/IncreaseTargetsTab.test.tsx` (new)
- `src/features/leaderboard/components/__tests__/AddToPlanPopover.test.tsx` (new)

Use Vitest + Testing Library + jsdom. Mock the queries with `vi.mock("../lib/queries")`.

---

## Verification checklist

Before calling this done:
- [ ] `npx vitest run` — all tests pass
- [ ] `npm run build` — clean build
- [ ] `npm run dev` on 3005 — open leaderboard, click the new tab, add a district to a plan, confirm row disappears
- [ ] Row expand shows full product list
- [ ] Popover focus trap + Escape + outside-click all work
- [ ] Modal width shrinks back to `max-w-2xl` when switching to another tab

## Gotchas

1. **Raw SQL fiscal year string:** `fiscal_year` is `"FY26"` / `"FY27"` — not `2026` / `2027`. Don't confuse with `TerritoryPlan.fiscalYear` which IS an int.
2. **Prisma Decimal coercion:** raw-query numeric fields come back as strings or `Decimal` — always `Number(row.fy26_revenue)`.
3. **Plan ownership:** the existing `GET /api/territory-plans` returns ALL plans (team-wide). Filter client-side by `ownerId`. Do NOT accidentally write a new route.
4. **Optimistic row removal:** on success, edit the `["leaderboard", "increase-targets"]` cache entry, don't `invalidate` — invalidation would re-fetch and the row might still be there if DB replication lags.
5. **Toast system:** if none exists in the app, don't add one — use the inline banner fallback at the top of the tab.
6. **Tab label length:** `"Increase Targets"` is 16 chars. Existing longest label is `"Targeted"` (8 chars). Confirm the tab row doesn't wrap at typical widths by spot-checking on a 1024px screen — if it does wrap, abbreviate further (e.g. `"Renewals"`).
