# Feature Spec: Increase Your Targets Tab

**Date:** 2026-04-20
**Slug:** increase-your-targets-tab
**Branch:** `worktree-increase-your-targets-tab`

## Problem

68 districts paid Fullmind revenue in FY26 but have no FY27 activity (no open pipeline, no closed-won, no FY27 row at all) — $1.85M in renewal risk. Today no surface exists that tells reps "these are at risk and claimable." Reps learn it ad hoc or via the query builder.

## Requirements

- A new tab **"Increase Targets"** inside the existing Leaderboard modal.
- Shows the list of at-risk districts with: district name, state, FY26 revenue, session count, last closed-won rep, last sale summary, products purchased.
- Every rep sees every district (team-wide visibility — no per-rep filtering).
- Districts already in ANY territory plan (not just the current rep's) are hidden from the list.
- Rep can click **Add ▾** on a row → pick one of their own territory plans → pick target bucket (Renewal / Winback / Expansion / New Business) → enter a $ target → submit.
- On success, the row disappears from the list (other reps won't see it anymore either) and the header count decrements.
- No NEW scoring mechanics tied to this tab. Existing `district_added` point-awarding (which fires from the reused `POST /api/territory-plans/[id]/districts` route) runs as normal — we don't add a tab-specific action, bonus, or multiplier.

## Visual Design

### Modal width
The Leaderboard modal is `max-w-2xl` (672px) for existing tabs. When `view === "increase"`, the wrapper uses `max-w-5xl` (1024px) and keeps `max-h-[85vh]` + internal scroll. Switching tabs back to any other tab reverts to `max-w-2xl`.

### Tab bar
Append one entry to `VIEW_CONFIG` in `LeaderboardModal.tsx`:
- `{ value: "increase", label: "Increase Targets", icon: Sparkles }`

### Summary strip (sticky, just under tab bar)
Two lines, `#403770` and `#6E6390` respectively:
- `"68 districts • $1.85M FY26 revenue at renewal risk"` (counts are reactive — update after each successful add)
- `"FY26 Fullmind customers with no FY27 activity yet."`

### DataGrid columns

| Key | Label | Width | Renderer |
|-----|-------|-------|----------|
| `districtName` | District | flex | text, truncate |
| `state` | State | 60px | tag-cell |
| `fy26Revenue` | FY26 Revenue ($) | 110px | currency (auto-detect from `($)`) |
| `fy26SessionCount` | Sessions | 80px | numeric |
| `lastRepName` | Last Rep | 130px | text, truncate |
| `lastSaleSummary` | Last Sale | 140px | custom: `"$260K · Mar 2026"` |
| `products` | Products | flex | custom: first 2 chips + `+N` button |
| `_action` | — | 110px | right-pinned **[Add ▾]** button |

Default sort: `fy26Revenue` desc.

### Row expansion
Click anywhere on the row except the action column → row expands in place. Expanded panel shows:
- Full chip list of `product_types` (primary plum chips)
- Full chip list of `sub_products` (muted secondary chips below)
- Last sale detail: `"Closed Won {schoolYr} · ${netBookingAmount} · {closeDate} · {repName}"`
- FY26 revenue breakdown: `"Completed ${completed} · Scheduled ${scheduled}"`

Only one row expanded at a time. Chevron icon rotates on expand.

### Add-to-plan popover
Anchored below the row's action button (right-aligned). Fixed width 320px. Contains:

- **Plan** — styled `<select>` with current user's owned plans (from `GET /api/territory-plans`, filtered client-side by `ownerId === currentUser.id`). Empty option: `"Select a plan…"`. Empty state (0 plans): disabled select with helper text `"You have no plans — create one first."`
- **Type** — radio group: Renewal (default) / Winback / Expansion / New Business
- **Target** — currency input with `$` prefix, `inputMode="decimal"`, formatted on blur. Required.
- **Submit** — primary button `"Add to Plan"`. Disabled until plan + positive target are set.
- **Cancel** — secondary button; closes popover.

Trap focus inside popover. Close on Escape, outside-click, or successful submit. Return focus to trigger button on close.

### States

- **Loading (list):** centered `w-6 h-6 border-2 border-[#403770] border-t-transparent rounded-full animate-spin` (matches existing leaderboard).
- **Empty list:** centered text `"Nothing at risk right now. Every FY26 customer has FY27 activity."` in `#6E6390`.
- **List error:** top banner `"Couldn't load the list."` + `[Retry]` button (calls `refetch()`).
- **Popover submit pending:** submit button shows spinner + disables both buttons.
- **Popover submit success:** row fades out 200ms, removes from local cache, counts update, toast `"Added to {plan name}"` top-right.
- **Popover submit error:** red inline text inside popover, popover stays open.

### Accessibility
- Row expand: `aria-expanded` on row button.
- `+N` chip button: `aria-label="Show N more products"`.
- Popover: focus trap, Escape closes, focus returns to trigger.
- Action button: `aria-haspopup="dialog"`.

### Responsive
Below 1024px viewport, modal falls back to `w-full mx-4`; DataGrid scrolls horizontally inside. Vertical scrolling via existing `max-h-[85vh]`.

### Tokens (no Tailwind grays per CLAUDE.md)
- Surface raised: `#F7F5FA`
- Border default: `#D4CFE2`
- Border strong: `#C2BBD4`
- Primary: `#403770`
- Body: `#6E6390`
- Muted: `#A69DC0`
- Coral accent (focus ring): `#F37167`

## Component Plan

### Reuse
- `src/features/shared/components/DataGrid/` — all table wiring (`DataGrid`, `ColumnDef`, `renderCell`).
- `src/features/shared/components/InlineEditCell.tsx` — target input pattern.
- Button + tab styling from existing `LeaderboardModal.tsx`.
- `POST /api/territory-plans/[id]/districts` — existing route handles upsert + rollup sync + point awarding. No new mutation endpoint.
- `syncPlanRollups` — fires inside the reused route. No direct call needed from new code.

### New components
- `src/features/leaderboard/components/IncreaseTargetsTab.tsx` — tab panel (summary strip + DataGrid).
- `src/features/leaderboard/components/IncreaseTargetsRow.tsx` — (optional; may be absorbed into DataGrid cell renderers) expanded row body + action button trigger.
- `src/features/leaderboard/components/AddToPlanPopover.tsx` — popover form.
- `src/features/leaderboard/lib/columns/increaseTargetsColumns.ts` — `ColumnDef[]` file, co-located per UI framework convention.

### Extend
- `src/features/leaderboard/components/LeaderboardModal.tsx` — add `"increase"` to `VIEW_CONFIG`, conditional `max-w-5xl` wrapper, render `<IncreaseTargetsTab />` when active.
- `src/features/leaderboard/lib/queries.ts` — add `useIncreaseTargetsList()` and `useMyPlansQuery()` (or extend existing plan query with a mine-only selector).

## Backend Design

See `docs/superpowers/specs/2026-04-20-increase-your-targets-tab-backend-context.md`.

### New endpoint: `GET /api/leaderboard/increase-targets`
Raw SQL via Prisma `$queryRaw` (single query, 5 CTEs: fy26 customers, fy27 activity exclusion, already-planned exclusion, last closed-won opp, product aggregation). Returns `IncreaseTarget[]`.

Auth: `getUser()` returns 401 if unauthenticated. No further role check — all reps see the same list.

Response caching: none (leaderboard is already uncached; this list is small and mutates on every add).

### Reused endpoint: `POST /api/territory-plans/[id]/districts`
Body: `{ leaids: string, renewalTarget?: number, winbackTarget?: number, expansionTarget?: number, newBusinessTarget?: number }`. One target field set based on the rep's bucket pick.

Client-side optimistic update: remove the row from the local query cache on success before refetch.

## States (End-to-End)

- **Loading:** first paint → list spinner. Popover → no loading state (opens instantly).
- **Empty:** after initial fetch, zero items → empty-state message.
- **Error:** fetch fail → banner + Retry. Submit fail → inline popover error.
- **Success:** optimistic row removal; count updates; toast.

## Out of Scope

- Bulk "add N districts at once"
- Editing an existing `plan_district` from this tab (only create)
- Notifications to previous reps about ownership changes
- FY28+ or non-Fullmind vendor rows
- Filtering/search inside the tab
- Undo after successful add
- Admin-only operations (forcibly reassigning reps, etc.)
- Changing the list's definition of "at risk" (locked to "FY26 Fullmind revenue > 0 AND no FY27 row with any activity AND not in any plan")

## Open Questions

None — all discovery questions answered by the user. The only guardrail flagged for implementer attention: the user explicitly asked for **no new scoring rules** tied to this tab. The reused route already awards `district_added` points; that is acceptable because it's existing behavior, not a new rule introduced by this feature.
